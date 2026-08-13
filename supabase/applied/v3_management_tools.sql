-- ============================================================
-- v3_management_tools.sql
-- 1) app_settings 테이블 (관리 설정 키/값 저장)
-- 2) special_periods.has_invitation 컬럼 추가
-- 3) 만남 자동 초기화 함수 + pg_cron 스케줄
-- 4) 수동 초기화 RPC
-- 5) 방문기록 일괄 삭제 RPC
-- ============================================================

-- 1. app_settings 테이블
CREATE TABLE IF NOT EXISTS app_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 기본값 삽입
INSERT INTO app_settings (key, value) VALUES
  ('visit_reset_enabled',  'true'),
  ('visit_reset_days_met', '90')
ON CONFLICT (key) DO NOTHING;

-- RLS: anon/authenticated 모두 읽기 가능, 쓰기는 클라이언트(관리자)에서 직접
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "app_settings_read"  ON app_settings;
DROP POLICY IF EXISTS "app_settings_write" ON app_settings;
CREATE POLICY "app_settings_read"  ON app_settings FOR SELECT USING (true);
CREATE POLICY "app_settings_write" ON app_settings FOR ALL    USING (true);
GRANT SELECT, INSERT, UPDATE ON app_settings TO anon, authenticated;

-- 2. special_periods.has_invitation 컬럼 추가
ALTER TABLE special_periods
  ADD COLUMN IF NOT EXISTS has_invitation BOOLEAN NOT NULL DEFAULT false;

-- 3. 만남 자동 초기화 함수
CREATE OR REPLACE FUNCTION auto_reset_met_units()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _enabled   BOOLEAN;
  _days      INT;
  _cutoff    TEXT;
BEGIN
  SELECT (value = 'true') INTO _enabled FROM app_settings WHERE key = 'visit_reset_enabled';
  SELECT value::INT        INTO _days   FROM app_settings WHERE key = 'visit_reset_days_met';

  IF NOT COALESCE(_enabled, false) OR COALESCE(_days, 0) <= 0 THEN
    RETURN;
  END IF;

  _cutoff := (CURRENT_DATE - (_days || ' days')::INTERVAL)::DATE::TEXT;

  -- status = '만남' 이면서, 가장 최근 만남 방문일이 cutoff 이전인 유닛만 초기화
  UPDATE units u
  SET    status = '미방문'
  WHERE  u.status = '만남'
  AND NOT EXISTS (
    SELECT 1
    FROM   visit_histories vh
    WHERE  vh.unit_id    = u.id
    AND    vh.result     = '만남'
    AND    vh.visited_at > _cutoff
  );
END;
$$;

-- 4. pg_cron 스케줄 등록 (매일 오전 3시 KST = 18:00 UTC)
-- ⚠️ Supabase 프로젝트에서 pg_cron 확장이 활성화돼 있어야 합니다.
--    Dashboard → Database → Extensions → pg_cron 활성화 후 실행
SELECT cron.schedule(
  'auto-reset-met-units',   -- 잡 이름 (중복 실행 시 이름 충돌 무시)
  '0 18 * * *',             -- UTC 18:00 = KST 03:00
  'SELECT auto_reset_met_units()'
);

-- 5. 수동 즉시 초기화 RPC (관리자 버튼용)
CREATE OR REPLACE FUNCTION manual_reset_met_units()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _count INT;
BEGIN
  UPDATE units SET status = '미방문' WHERE status = '만남';
  GET DIAGNOSTICS _count = ROW_COUNT;
  RETURN _count;
END;
$$;

GRANT EXECUTE ON FUNCTION manual_reset_met_units()  TO anon, authenticated;
GRANT EXECUTE ON FUNCTION auto_reset_met_units()    TO anon, authenticated;

-- 6. 오래된 방문기록 삭제 RPC (관리자용)
--    cutoff_date: 'YYYY-MM-DD' 형식, 이 날짜 이전 기록 삭제
CREATE OR REPLACE FUNCTION delete_old_visit_histories(cutoff_date TEXT)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _count INT;
BEGIN
  DELETE FROM visit_histories
  WHERE visited_at < cutoff_date;
  GET DIAGNOSTICS _count = ROW_COUNT;
  RETURN _count;
END;
$$;

GRANT EXECUTE ON FUNCTION delete_old_visit_histories(TEXT) TO anon, authenticated;

-- 7. 오래된 방문기록 개수 미리보기 RPC
CREATE OR REPLACE FUNCTION count_old_visit_histories(cutoff_date TEXT)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _count INT;
BEGIN
  SELECT COUNT(*) INTO _count
  FROM visit_histories
  WHERE visited_at < cutoff_date;
  RETURN _count;
END;
$$;

GRANT EXECUTE ON FUNCTION count_old_visit_histories(TEXT) TO anon, authenticated;
