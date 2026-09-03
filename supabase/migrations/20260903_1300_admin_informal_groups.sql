-- 비공식 그룹은 모두 읽지만 관리자·개발자만 관리한다.
-- 그룹 삭제는 informal_assets.group_id를 NULL로 풀 뿐 자료 자체를 지우지 않는다.

alter table public.informal_groups enable row level security;

revoke truncate, references, trigger on public.informal_groups from public, anon, authenticated;

drop policy if exists informal_groups_select_all on public.informal_groups;
create policy informal_groups_select_all on public.informal_groups
  for select to anon, authenticated
  using (true);

drop policy if exists "TEMP_session_gate_informal_groups_ins" on public.informal_groups;
drop policy if exists role_admin_informal_groups_insert on public.informal_groups;
create policy role_admin_informal_groups_insert on public.informal_groups
  for insert to anon, authenticated
  with check ((select private.request_is_admin()));

drop policy if exists "TEMP_session_gate_informal_groups_upd" on public.informal_groups;
drop policy if exists role_admin_informal_groups_update on public.informal_groups;
create policy role_admin_informal_groups_update on public.informal_groups
  for update to anon, authenticated
  using ((select private.request_is_admin()))
  with check ((select private.request_is_admin()));

drop policy if exists "TEMP_session_gate_informal_groups_del" on public.informal_groups;
drop policy if exists role_admin_informal_groups_delete on public.informal_groups;
create policy role_admin_informal_groups_delete on public.informal_groups
  for delete to anon, authenticated
  using ((select private.request_is_admin()));

do $$
declare
  v_actual text[];
begin
  select array_agg(policyname order by policyname)
  into v_actual
  from pg_policies
  where schemaname = 'public'
    and tablename = 'informal_groups';

  if v_actual is distinct from array[
    'informal_groups_select_all',
    'role_admin_informal_groups_delete',
    'role_admin_informal_groups_insert',
    'role_admin_informal_groups_update'
  ]::text[] then
    raise exception 'informal_groups 정책 구성이 예상과 다릅니다: %', v_actual;
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'informal_groups'
      and policyname like 'TEMP\_session\_gate\_%'
  ) then
    raise exception 'informal_groups 임시 세션 정책이 남았습니다';
  end if;

  if has_table_privilege('anon', 'public.informal_groups', 'TRUNCATE')
     or has_table_privilege('authenticated', 'public.informal_groups', 'TRUNCATE')
     or has_table_privilege('anon', 'public.informal_groups', 'REFERENCES')
     or has_table_privilege('authenticated', 'public.informal_groups', 'REFERENCES')
     or has_table_privilege('anon', 'public.informal_groups', 'TRIGGER')
     or has_table_privilege('authenticated', 'public.informal_groups', 'TRIGGER') then
    raise exception 'informal_groups에 불필요한 테이블 권한이 남았습니다';
  end if;
end $$;

notify pgrst, 'reload schema';
