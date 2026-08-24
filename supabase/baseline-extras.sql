-- baseline.sql 이 못 담는 나머지. **baseline 을 실행한 뒤** 이어서 실행한다.
-- 만든 날: 2026-08-24 (supabase/tools/_EXPORT_extras.sql 로 뽑음)
--
-- ⚠ pg_cron 이 켜져 있어야 한다. Dashboard → Database → Extensions 에서 확인.
-- ⚠ 시각은 UTC 다. 0 18 = 한국시간 새벽 3시, 0 19 = 새벽 4시.

-- ── 예약 작업 ────────────────────────────────────────────────────
-- 만난 세대 자동 초기화 (설정에서 켠 회중만 실제로 동작한다)
select cron.schedule('auto-reset-met-units', '0 18 * * *', 'SELECT auto_reset_met_units()');

-- 오래된 채팅·알림·로그 정리 (무료 500MB 를 지키는 장치)
select cron.schedule('cleanup-old-data', '0 19 * * *', 'SELECT cleanup_old_data()');

-- 오늘 봉사 마련 알림. 5분마다 깨어나 '보낼 시각이 됐는지' 를 스스로 판단한다
-- (하루 한 번만 보낸다 — 함수가 daily_service_last_sent 로 막는다)
select cron.schedule('daily-service-digest', '*/5 * * * *', 'SELECT public.send_daily_service_digest()');

-- ── 스토리지 버킷 ────────────────────────────────────────────────
-- storage.buckets 는 소유자만 읽을 수 있어 SQL Editor 에서 42501 이 난다
-- (must be owner of table buckets). 그래서 DB 대신 **코드에서 찾았다.**
--   ChatRoom.tsx            storage.from('chat-attachments').getPublicUrl(...)
--   v2Assignments.ts        storage.from('informal-assets').getPublicUrl(...)
-- 둘 다 getPublicUrl 을 쓰므로 공개 버킷이다.
--
-- ⚠ SQL 로 만들어지지 않으면 Dashboard → Storage → New bucket 에서
--    같은 이름으로, Public 켜서 만든다.

insert into storage.buckets (id, name, public)
values ('chat-attachments', 'chat-attachments', true),
       ('informal-assets', 'informal-assets', true)
on conflict (id) do nothing;
