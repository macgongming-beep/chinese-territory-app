-- 비공식 자료의 DB 행과 Storage 파일은 관리자·개발자만 관리한다.

alter table public.informal_assets enable row level security;

revoke truncate, references, trigger on public.informal_assets from public, anon, authenticated;

drop policy if exists informal_assets_select_all on public.informal_assets;
create policy informal_assets_select_all on public.informal_assets
  for select to public
  using (true);

drop policy if exists "TEMP_session_gate_informal_assets_ins" on public.informal_assets;
drop policy if exists role_admin_informal_assets_insert on public.informal_assets;
create policy role_admin_informal_assets_insert on public.informal_assets
  for insert to public
  with check ((select private.request_is_admin()));

drop policy if exists "TEMP_session_gate_informal_assets_upd" on public.informal_assets;
drop policy if exists role_admin_informal_assets_update on public.informal_assets;
create policy role_admin_informal_assets_update on public.informal_assets
  for update to public
  using ((select private.request_is_admin()))
  with check ((select private.request_is_admin()));

drop policy if exists "TEMP_session_gate_informal_assets_del" on public.informal_assets;
drop policy if exists role_admin_informal_assets_delete on public.informal_assets;
create policy role_admin_informal_assets_delete on public.informal_assets
  for delete to public
  using ((select private.request_is_admin()));

-- Storage도 같은 역할 계약을 쓴다. 삭제 정책은 DB INSERT 실패 시 업로드한
-- 파일을 되돌리는 클라이언트 경로에도 필요하다.
drop policy if exists informal_assets_anon_read on storage.objects;
drop policy if exists informal_assets_anon_insert on storage.objects;
drop policy if exists informal_assets_anon_update on storage.objects;
drop policy if exists informal_assets_anon_delete on storage.objects;
drop policy if exists informal_assets_admin_read on storage.objects;
drop policy if exists informal_assets_admin_insert on storage.objects;
drop policy if exists informal_assets_admin_update on storage.objects;
drop policy if exists informal_assets_admin_delete on storage.objects;

create policy informal_assets_admin_read on storage.objects
  for select to public
  using (bucket_id = 'informal-assets');

create policy informal_assets_admin_insert on storage.objects
  for insert to public
  with check (
    bucket_id = 'informal-assets'
    and (select private.request_is_admin())
  );

create policy informal_assets_admin_update on storage.objects
  for update to public
  using (
    bucket_id = 'informal-assets'
    and (select private.request_is_admin())
  )
  with check (
    bucket_id = 'informal-assets'
    and (select private.request_is_admin())
  );

create policy informal_assets_admin_delete on storage.objects
  for delete to public
  using (
    bucket_id = 'informal-assets'
    and (select private.request_is_admin())
  );

-- 기존 호출 계약은 유지하되, 없는 행을 성공으로 돌려주지 않는다.
create or replace function public.delete_informal_asset_secure(
  p_token uuid,
  p_asset_id integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id integer;
  v_role text;
begin
  v_user_id := public.verify_session(p_token);

  select role
    into v_role
  from public.app_users
  where id = v_user_id;

  if not coalesce(v_role in ('admin', 'developer'), false) then
    raise exception 'permission denied';
  end if;

  delete from public.informal_assets
  where id = p_asset_id;

  if not found then
    raise exception 'informal asset not found';
  end if;

  return true;
end;
$$;

revoke all on function public.delete_informal_asset_secure(uuid, integer) from public;
grant execute on function public.delete_informal_asset_secure(uuid, integer) to anon, authenticated;

do $$
declare
  v_table_policies text[];
  v_storage_policies text[];
begin
  select array_agg(policyname order by policyname)
  into v_table_policies
  from pg_policies
  where schemaname = 'public'
    and tablename = 'informal_assets';

  if v_table_policies is distinct from array[
    'informal_assets_select_all',
    'role_admin_informal_assets_delete',
    'role_admin_informal_assets_insert',
    'role_admin_informal_assets_update'
  ]::text[] then
    raise exception 'informal_assets 정책 구성이 예상과 다릅니다: %', v_table_policies;
  end if;

  select array_agg(policyname order by policyname)
  into v_storage_policies
  from pg_policies
  where schemaname = 'storage'
    and tablename = 'objects'
    and policyname like 'informal\_assets\_%';

  if v_storage_policies is distinct from array[
    'informal_assets_admin_delete',
    'informal_assets_admin_insert',
    'informal_assets_admin_read',
    'informal_assets_admin_update'
  ]::text[] then
    raise exception 'informal-assets Storage 정책 구성이 예상과 다릅니다: %', v_storage_policies;
  end if;

  if has_table_privilege('anon', 'public.informal_assets', 'TRUNCATE')
     or has_table_privilege('authenticated', 'public.informal_assets', 'TRUNCATE')
     or has_table_privilege('anon', 'public.informal_assets', 'REFERENCES')
     or has_table_privilege('authenticated', 'public.informal_assets', 'REFERENCES')
     or has_table_privilege('anon', 'public.informal_assets', 'TRIGGER')
     or has_table_privilege('authenticated', 'public.informal_assets', 'TRIGGER') then
    raise exception 'informal_assets에 불필요한 테이블 권한이 남았습니다';
  end if;

  if not has_function_privilege('anon', 'public.delete_informal_asset_secure(uuid,integer)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.delete_informal_asset_secure(uuid,integer)', 'EXECUTE') then
    raise exception 'delete_informal_asset_secure 실행 권한이 예상과 다릅니다';
  end if;

  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
    where n.nspname = 'public'
      and p.proname = 'delete_informal_asset_secure'
      and pg_get_function_identity_arguments(p.oid) = 'p_token uuid, p_asset_id integer'
      and acl.grantee = 0
      and acl.privilege_type = 'EXECUTE'
  ) then
    raise exception 'delete_informal_asset_secure가 PUBLIC에 열려 있습니다';
  end if;
end $$;

notify pgrst, 'reload schema';
