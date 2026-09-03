-- 대화 방법 제안은 홈에서 모두 읽지만 관리자·개발자만 관리한다.

alter table public.service_suggestions enable row level security;

-- RLS가 막지 않는 권한과 앱이 사용하지 않는 스키마 변경 권한을 회수한다.
revoke truncate, references, trigger on public.service_suggestions from public, anon, authenticated;

drop policy if exists service_suggestions_select_all on public.service_suggestions;
create policy service_suggestions_select_all on public.service_suggestions
  for select to public
  using (true);

drop policy if exists "TEMP_session_gate_service_suggestions_ins" on public.service_suggestions;
drop policy if exists role_admin_service_suggestions_insert on public.service_suggestions;
create policy role_admin_service_suggestions_insert on public.service_suggestions
  for insert to public
  with check ((select private.request_is_admin()));

drop policy if exists "TEMP_session_gate_service_suggestions_upd" on public.service_suggestions;
drop policy if exists role_admin_service_suggestions_update on public.service_suggestions;
create policy role_admin_service_suggestions_update on public.service_suggestions
  for update to public
  using ((select private.request_is_admin()))
  with check ((select private.request_is_admin()));

drop policy if exists "TEMP_session_gate_service_suggestions_del" on public.service_suggestions;
drop policy if exists role_admin_service_suggestions_delete on public.service_suggestions;
create policy role_admin_service_suggestions_delete on public.service_suggestions
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
    and tablename = 'service_suggestions';

  if v_actual is distinct from array[
    'role_admin_service_suggestions_delete',
    'role_admin_service_suggestions_insert',
    'role_admin_service_suggestions_update',
    'service_suggestions_select_all'
  ]::text[] then
    raise exception 'service_suggestions 정책 구성이 예상과 다릅니다: %', v_actual;
  end if;

  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'service_suggestions'
      and policyname like 'TEMP\_session\_gate\_%'
  ) then
    raise exception 'service_suggestions 임시 세션 정책이 남았습니다';
  end if;

  if has_table_privilege('anon', 'public.service_suggestions', 'TRUNCATE')
     or has_table_privilege('authenticated', 'public.service_suggestions', 'TRUNCATE')
     or has_table_privilege('anon', 'public.service_suggestions', 'REFERENCES')
     or has_table_privilege('authenticated', 'public.service_suggestions', 'REFERENCES')
     or has_table_privilege('anon', 'public.service_suggestions', 'TRIGGER')
     or has_table_privilege('authenticated', 'public.service_suggestions', 'TRIGGER') then
    raise exception 'service_suggestions에 불필요한 테이블 권한이 남았습니다';
  end if;
end $$;

notify pgrst, 'reload schema';
