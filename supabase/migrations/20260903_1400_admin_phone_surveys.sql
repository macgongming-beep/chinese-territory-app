-- 전화 조사 대장은 관리자·개발자 화면에서만 관리한다.

alter table public.phone_surveys enable row level security;

revoke truncate, references, trigger on public.phone_surveys from public, anon, authenticated;

drop policy if exists phone_surveys_select_all on public.phone_surveys;
create policy phone_surveys_select_all on public.phone_surveys
  for select to public
  using (true);

drop policy if exists "TEMP_session_gate_phone_surveys_ins" on public.phone_surveys;
drop policy if exists role_admin_phone_surveys_insert on public.phone_surveys;
create policy role_admin_phone_surveys_insert on public.phone_surveys
  for insert to public
  with check ((select private.request_is_admin()));

drop policy if exists "TEMP_session_gate_phone_surveys_upd" on public.phone_surveys;
drop policy if exists role_admin_phone_surveys_update on public.phone_surveys;
create policy role_admin_phone_surveys_update on public.phone_surveys
  for update to public
  using ((select private.request_is_admin()))
  with check ((select private.request_is_admin()));

drop policy if exists "TEMP_session_gate_phone_surveys_del" on public.phone_surveys;
drop policy if exists role_admin_phone_surveys_delete on public.phone_surveys;
create policy role_admin_phone_surveys_delete on public.phone_surveys
  for delete to public
  using ((select private.request_is_admin()));

do $$
declare
  v_actual text[];
begin
  select array_agg(policyname order by policyname)
  into v_actual
  from pg_policies
  where schemaname = 'public'
    and tablename = 'phone_surveys';

  if v_actual is distinct from array[
    'phone_surveys_select_all',
    'role_admin_phone_surveys_delete',
    'role_admin_phone_surveys_insert',
    'role_admin_phone_surveys_update'
  ]::text[] then
    raise exception 'phone_surveys 정책 구성이 예상과 다릅니다: %', v_actual;
  end if;

  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'phone_surveys'
      and policyname like 'TEMP\_session\_gate\_%'
  ) then
    raise exception 'phone_surveys 임시 세션 정책이 남았습니다';
  end if;

  if has_table_privilege('anon', 'public.phone_surveys', 'TRUNCATE')
     or has_table_privilege('authenticated', 'public.phone_surveys', 'TRUNCATE')
     or has_table_privilege('anon', 'public.phone_surveys', 'REFERENCES')
     or has_table_privilege('authenticated', 'public.phone_surveys', 'REFERENCES')
     or has_table_privilege('anon', 'public.phone_surveys', 'TRIGGER')
     or has_table_privilege('authenticated', 'public.phone_surveys', 'TRIGGER') then
    raise exception 'phone_surveys에 불필요한 테이블 권한이 남았습니다';
  end if;
end $$;

notify pgrst, 'reload schema';
