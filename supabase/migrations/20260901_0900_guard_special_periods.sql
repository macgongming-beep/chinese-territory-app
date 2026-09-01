-- 특별봉사 기간은 관리자 화면에서만 관리한다.
--
-- 2026-09-01 권한 감사에서 special_periods만 RLS가 꺼진 채 anon 쓰기 grant가
-- 남아 있는 것을 발견했다. 다른 표의 TEMP 관문과 달리 비로그인 요청도 그대로
-- INSERT/UPDATE/DELETE 할 수 있었으므로, 읽기는 유지하고 쓰기만 관리자에게 제한한다.

alter table public.special_periods enable row level security;

drop policy if exists special_periods_select_all on public.special_periods;
create policy special_periods_select_all on public.special_periods
  for select to public
  using (true);

drop policy if exists role_admin_special_periods_insert on public.special_periods;
create policy role_admin_special_periods_insert on public.special_periods
  for insert to public
  with check ((select private.request_is_admin()));

drop policy if exists role_admin_special_periods_update on public.special_periods;
create policy role_admin_special_periods_update on public.special_periods
  for update to public
  using ((select private.request_is_admin()))
  with check ((select private.request_is_admin()));

drop policy if exists role_admin_special_periods_delete on public.special_periods;
create policy role_admin_special_periods_delete on public.special_periods
  for delete to public
  using ((select private.request_is_admin()));

do $$
begin
  if not (select relrowsecurity from pg_class where oid = 'public.special_periods'::regclass) then
    raise exception 'special_periods RLS가 켜지지 않았습니다';
  end if;

  if (select count(*) from pg_policies
      where schemaname = 'public' and tablename = 'special_periods'
        and policyname in (
          'special_periods_select_all',
          'role_admin_special_periods_insert',
          'role_admin_special_periods_update',
          'role_admin_special_periods_delete'
        )) <> 4 then
    raise exception 'special_periods 정책 네 개가 모두 만들어지지 않았습니다';
  end if;
end $$;

notify pgrst, 'reload schema';
