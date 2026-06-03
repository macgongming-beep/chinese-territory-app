-- ============================================================
-- v3_data_retention.sql
-- 무료 티어(500MB) 대비 누적 데이터 자동 정리
--
-- 정리 대상 (보존 기간은 app_settings 로 조정 가능):
--   1) chat_messages      — 기본 90일
--   2) notifications      — 읽은 알림 30일 / 안 읽어도 90일 하드캡
--   3) service_logs       — 기본 60일 (운영 로그)
--   4) login_logs         — 기본 180일
--
-- 구성:
--   A. app_settings 기본값 (보존 기간 + on/off)
--   B. cleanup_old_data()      — 실제 삭제 (pg_cron + 수동 공용), 삭제 건수 jsonb 반환
--   C. preview_data_cleanup()  — 삭제 예정 건수 미리보기 (설정 화면용)
--   D. pg_cron 매일 스케줄 (KST 04:00 = UTC 19:00)
--
-- ⚠️ 영구 삭제입니다. 적용 전 백업(npm run backup) 권장.
-- ⚠️ pg_cron 확장 필요: Dashboard → Database → Extensions → pg_cron 활성화
-- ============================================================

-- A. 보존 기간 설정 (이미 있으면 유지)
INSERT INTO app_settings (key, value) VALUES
  ('retention_enabled',           'true'),
  ('retention_chat_days',         '90'),
  ('retention_notif_read_days',   '30'),
  ('retention_notif_max_days',    '90'),
  ('retention_service_logs_days', '60'),
  ('retention_login_logs_days',   '180')
ON CONFLICT (key) DO NOTHING;


-- B. 실제 정리 함수
CREATE OR REPLACE FUNCTION cleanup_old_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _enabled        BOOLEAN;
  _chat_days      INT;
  _notif_read     INT;
  _notif_max      INT;
  _svc_days       INT;
  _login_days     INT;
  _chat_del       INT := 0;
  _notif_del      INT := 0;
  _svc_del        INT := 0;
  _login_del      INT := 0;
BEGIN
  SELECT (value = 'true')        INTO _enabled    FROM app_settings WHERE key = 'retention_enabled';
  SELECT value::INT              INTO _chat_days  FROM app_settings WHERE key = 'retention_chat_days';
  SELECT value::INT              INTO _notif_read FROM app_settings WHERE key = 'retention_notif_read_days';
  SELECT value::INT              INTO _notif_max  FROM app_settings WHERE key = 'retention_notif_max_days';
  SELECT value::INT              INTO _svc_days   FROM app_settings WHERE key = 'retention_service_logs_days';
  SELECT value::INT              INTO _login_days FROM app_settings WHERE key = 'retention_login_logs_days';

  IF NOT COALESCE(_enabled, false) THEN
    RETURN jsonb_build_object('skipped', true, 'reason', 'retention_disabled');
  END IF;

  -- 1) 오래된 채팅 메시지
  IF COALESCE(_chat_days, 0) > 0 THEN
    DELETE FROM chat_messages
    WHERE created_at < now() - (_chat_days || ' days')::INTERVAL;
    GET DIAGNOSTICS _chat_del = ROW_COUNT;
  END IF;

  -- 2) 알림: 읽은 건 _notif_read일, 안 읽어도 _notif_max일 하드캡
  DELETE FROM notifications
  WHERE (is_read = true  AND COALESCE(_notif_read, 0) > 0 AND created_at < now() - (_notif_read || ' days')::INTERVAL)
     OR (                    COALESCE(_notif_max, 0)  > 0 AND created_at < now() - (_notif_max  || ' days')::INTERVAL);
  GET DIAGNOSTICS _notif_del = ROW_COUNT;

  -- 3) 운영 로그
  IF COALESCE(_svc_days, 0) > 0 THEN
    DELETE FROM service_logs
    WHERE created_at < now() - (_svc_days || ' days')::INTERVAL;
    GET DIAGNOSTICS _svc_del = ROW_COUNT;
  END IF;

  -- 4) 로그인 기록
  IF COALESCE(_login_days, 0) > 0 THEN
    DELETE FROM login_logs
    WHERE logged_in_at < now() - (_login_days || ' days')::INTERVAL;
    GET DIAGNOSTICS _login_del = ROW_COUNT;
  END IF;

  RETURN jsonb_build_object(
    'skipped',           false,
    'ran_at',            now(),
    'chat_deleted',      _chat_del,
    'notifications_deleted', _notif_del,
    'service_logs_deleted',  _svc_del,
    'login_logs_deleted',    _login_del
  );
END;
$$;

GRANT EXECUTE ON FUNCTION cleanup_old_data() TO anon, authenticated;


-- C. 삭제 예정 건수 미리보기 (실제 삭제 없음)
CREATE OR REPLACE FUNCTION preview_data_cleanup()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _chat_days  INT;
  _notif_read INT;
  _notif_max  INT;
  _svc_days   INT;
  _login_days INT;
  _chat       INT := 0;
  _notif      INT := 0;
  _svc        INT := 0;
  _login      INT := 0;
BEGIN
  SELECT value::INT INTO _chat_days  FROM app_settings WHERE key = 'retention_chat_days';
  SELECT value::INT INTO _notif_read FROM app_settings WHERE key = 'retention_notif_read_days';
  SELECT value::INT INTO _notif_max  FROM app_settings WHERE key = 'retention_notif_max_days';
  SELECT value::INT INTO _svc_days   FROM app_settings WHERE key = 'retention_service_logs_days';
  SELECT value::INT INTO _login_days FROM app_settings WHERE key = 'retention_login_logs_days';

  IF COALESCE(_chat_days, 0) > 0 THEN
    SELECT COUNT(*) INTO _chat FROM chat_messages
    WHERE created_at < now() - (_chat_days || ' days')::INTERVAL;
  END IF;

  SELECT COUNT(*) INTO _notif FROM notifications
  WHERE (is_read = true  AND COALESCE(_notif_read, 0) > 0 AND created_at < now() - (_notif_read || ' days')::INTERVAL)
     OR (                    COALESCE(_notif_max, 0)  > 0 AND created_at < now() - (_notif_max  || ' days')::INTERVAL);

  IF COALESCE(_svc_days, 0) > 0 THEN
    SELECT COUNT(*) INTO _svc FROM service_logs
    WHERE created_at < now() - (_svc_days || ' days')::INTERVAL;
  END IF;

  IF COALESCE(_login_days, 0) > 0 THEN
    SELECT COUNT(*) INTO _login FROM login_logs
    WHERE logged_in_at < now() - (_login_days || ' days')::INTERVAL;
  END IF;

  RETURN jsonb_build_object(
    'chat_to_delete',          _chat,
    'notifications_to_delete', _notif,
    'service_logs_to_delete',  _svc,
    'login_logs_to_delete',    _login
  );
END;
$$;

GRANT EXECUTE ON FUNCTION preview_data_cleanup() TO anon, authenticated;


-- D. pg_cron 매일 스케줄 (UTC 19:00 = KST 04:00)
--    이미 등록돼 있으면 먼저 해제 후 재등록
SELECT cron.unschedule('cleanup-old-data')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-old-data');

SELECT cron.schedule(
  'cleanup-old-data',
  '0 19 * * *',
  'SELECT cleanup_old_data()'
);
