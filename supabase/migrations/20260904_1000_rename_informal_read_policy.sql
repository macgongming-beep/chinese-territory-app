-- informal-assets 의 Storage 읽기 정책 이름을 실제 계약에 맞춘다.
--
-- 20260903_1500 이 만든 informal_assets_admin_read 는 이름과 달리
-- `using (bucket_id = 'informal-assets')` 뿐이라 **권한 검사가 없다** — 공개 읽기다.
-- (버킷도 public=true 라 공개 엔드포인트로도 읽힌다. 읽기를 여는 것 자체는 의도다.)
-- 이름만 보고 감사하면 정반대로 읽게 되므로 이름을 바꾼다. 동작은 그대로다.

-- ⚠ `alter policy ... rename to` 는 쓸 수 없다. storage.objects 의 소유자는
--    supabase_storage_admin 이고, Supabase 는 postgres 에 create/drop policy 는
--    열어 두었지만 rename 은 열어 두지 않았다 (실측: 42501 must be owner).
--    대시보드 SQL Editor 도 postgres 로 돌아 같은 오류가 난다.
--    그래서 지우고 같은 조건으로 다시 만든다 — 한 트랜잭션 안이라 빈틈이 없다.
drop policy if exists informal_assets_admin_read on storage.objects;
drop policy if exists informal_assets_public_read on storage.objects;
create policy informal_assets_public_read on storage.objects
  for select to public
  using (bucket_id = 'informal-assets');

do $$
declare
  v_storage_policies text[];
begin
  select array_agg(policyname order by policyname)
  into v_storage_policies
  from pg_policies
  where schemaname = 'storage'
    and tablename = 'objects'
    and policyname like 'informal\_assets\_%';

  if v_storage_policies is distinct from array[
    'informal_assets_admin_delete',
    'informal_assets_admin_insert',
    'informal_assets_admin_update',
    'informal_assets_public_read'
  ]::text[] then
    raise exception 'informal-assets Storage 정책 구성이 예상과 다릅니다: %', v_storage_policies;
  end if;

  -- 이름만 바꿨을 뿐 읽기가 여전히 공개인지 확인한다 (권한 조건이 붙지 않았는지)
  if exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'informal_assets_public_read'
      and qual <> '(bucket_id = ''informal-assets''::text)'
  ) then
    raise exception 'informal_assets_public_read 의 조건이 바뀌었습니다';
  end if;
end $$;
