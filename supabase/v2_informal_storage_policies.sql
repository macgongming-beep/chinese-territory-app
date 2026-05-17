-- =============================================================
-- informal-assets Storage 버킷 정책
-- 작성일: 2026-05-16
--
-- 증상: 업로드 시 "new row violates row-level security policy"
-- 원인: Supabase Storage 의 storage.objects 테이블에 RLS 가 켜져
--       있고, anon role 에 대한 INSERT 정책이 없음
-- 해결: SELECT/INSERT/UPDATE 정책 추가. DELETE 는 delete_informal_asset_secure RPC 로 제한.
--
-- ⚠️ 주의: informal-assets 버킷을 먼저 Dashboard 에서 만들었어야 함
--   - Storage → New bucket
--   - Name: informal-assets
--   - Public: YES
-- =============================================================

-- 기존 정책 있으면 지우고 다시 만들기 (멱등)
drop policy if exists "informal_assets_anon_read"   on storage.objects;
drop policy if exists "informal_assets_anon_insert" on storage.objects;
drop policy if exists "informal_assets_anon_update" on storage.objects;
drop policy if exists "informal_assets_anon_delete" on storage.objects;

-- 1) 읽기 (이미지를 <img src> 로 표시하려면 필요)
create policy "informal_assets_anon_read"
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'informal-assets');

-- 2) 업로드
create policy "informal_assets_anon_insert"
  on storage.objects
  for insert
  to anon, authenticated
  with check (bucket_id = 'informal-assets');

-- 3) 메타데이터 업데이트 (드물게 필요, 안전망)
create policy "informal_assets_anon_update"
  on storage.objects
  for update
  to anon, authenticated
  using (bucket_id = 'informal-assets')
  with check (bucket_id = 'informal-assets');

-- 4) 삭제
-- anon DELETE 는 열지 않는다. 자료 삭제는 supabase/v2_informal_delete_rpc.sql 의
-- delete_informal_asset_secure RPC 를 통해 admin/developer 만 수행한다.

-- ─── 검증 ───────────────────────────────────────────────────
-- select policyname from pg_policies
-- where schemaname='storage' and tablename='objects'
--   and policyname like 'informal_assets%';
