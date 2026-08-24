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

-- ── 스토리지 ────────────────────────────────────────────────────
-- storage.buckets 는 소유자만 읽을 수 있어 SQL Editor 에서 뽑지 못했다
-- (42501 must be owner of table buckets). 그래서 **적용된 마이그레이션에서
-- 그대로 가져왔다** — 추측보다 정확하다 (용량·MIME 제한까지 들어 있다).
--   supabase/applied/v1plus_schema.sql            채팅 첨부
--   supabase/applied/v2_informal_storage_policies.sql  비공식 자료

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chat-attachments', 'chat-attachments', true, 10485760,
        array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public)
values ('informal-assets', 'informal-assets', true)
on conflict (id) do nothing;

-- ── 스토리지 정책 ────────────────────────────────────────────────
-- ⚠ 이게 없으면 업로드가 "new row violates row-level security policy" 로 막힌다.
--    storage.objects 에 RLS 가 켜져 있는데 anon 용 INSERT 정책이 없기 때문이다.
--    예전에 실제로 겪은 문제라 마이그레이션 주석에 적혀 있다.

drop policy if exists chat_attachments_public_read on storage.objects;
create policy chat_attachments_public_read on storage.objects
for select to anon, authenticated
using (bucket_id = 'chat-attachments');

drop policy if exists chat_attachments_upload on storage.objects;
create policy chat_attachments_upload on storage.objects
for insert to anon, authenticated
with check (bucket_id = 'chat-attachments');

drop policy if exists "informal_assets_anon_read" on storage.objects;
create policy "informal_assets_anon_read" on storage.objects
for select to anon, authenticated
using (bucket_id = 'informal-assets');

drop policy if exists "informal_assets_anon_insert" on storage.objects;
create policy "informal_assets_anon_insert" on storage.objects
for insert to anon, authenticated
with check (bucket_id = 'informal-assets');

drop policy if exists "informal_assets_anon_update" on storage.objects;
create policy "informal_assets_anon_update" on storage.objects
for update to anon, authenticated
using (bucket_id = 'informal-assets')
with check (bucket_id = 'informal-assets');
-- 삭제는 정책을 주지 않는다. delete_informal_asset_secure RPC 로만 지운다.

-- ── Edge Function (SQL 로는 못 만든다) ───────────────────────────
--   supabase/functions/send-push            푸시 발송
--   supabase/functions/cleanup-chat-images  만료된 채팅 사진 정리
--
-- 배포:  supabase functions deploy send-push --project-ref <새 ref>
-- 그다음 app_private_settings 에 주소와 키를 넣어야 푸시가 나간다
-- (push_edge_function_url · push_edge_function_key).
-- VAPID 키는 **회중마다 새로 만든다** — 돌려쓰면 다른 회중 앱이
-- 우리 교인에게 알림을 보낼 수 있다.
