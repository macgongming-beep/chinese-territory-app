-- 지역 목록은 모든 화면에서 읽지만 관리자·개발자만 관리한다.
--
-- 지역 이름은 카드의 region과 연결되므로 일반 사용자의 생성·수정·삭제는
-- 지도, 통계, 배정을 한꺼번에 어긋나게 할 수 있다. 공개 SELECT는 유지하고
-- 임시 로그인 관문 세 개만 최종 관리자 정책으로 교체한다.

alter table public.territory_regions enable row level security;

drop policy if exists territory_regions_select_all on public.territory_regions;
create policy territory_regions_select_all on public.territory_regions
  for select to anon, authenticated
  using (true);

drop policy if exists "TEMP_session_gate_territory_regions_ins" on public.territory_regions;
drop policy if exists role_admin_territory_regions_insert on public.territory_regions;
create policy role_admin_territory_regions_insert on public.territory_regions
  for insert to anon, authenticated
  with check ((select private.request_is_admin()));

drop policy if exists "TEMP_session_gate_territory_regions_upd" on public.territory_regions;
drop policy if exists role_admin_territory_regions_update on public.territory_regions;
create policy role_admin_territory_regions_update on public.territory_regions
  for update to anon, authenticated
  using ((select private.request_is_admin()))
  with check ((select private.request_is_admin()));

drop policy if exists "TEMP_session_gate_territory_regions_del" on public.territory_regions;
drop policy if exists role_admin_territory_regions_delete on public.territory_regions;
create policy role_admin_territory_regions_delete on public.territory_regions
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
    and tablename = 'territory_regions';

  if v_actual is distinct from array[
    'role_admin_territory_regions_delete',
    'role_admin_territory_regions_insert',
    'role_admin_territory_regions_update',
    'territory_regions_select_all'
  ]::text[] then
    raise exception 'territory_regions 정책 구성이 예상과 다릅니다: %', v_actual;
  end if;

  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'territory_regions'
      and policyname like 'TEMP\_session\_gate\_%'
  ) then
    raise exception 'territory_regions 임시 세션 정책이 남았습니다';
  end if;
end $$;

notify pgrst, 'reload schema';
