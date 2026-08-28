-- 테스트 DB 를 **전환 전 상태로 되돌린다.**
--
-- ⚠ **테스트 DB 에서만.** (확인: select count(*) from app_users; → 운영 62 · 테스트 1~2)
-- ⚠ 이걸 운영에 돌리면 **anon 쓰기가 다시 통째로 열린다.**
--
-- 왜 필요한가: 테스트 DB 는 이미 전환됐다. 단일 트랜잭션 경로(psql)를
-- **처음 상태에서** 다시 증명하려면 되돌려야 한다. 리뷰 지적:
-- "완성된 파일을 두 번 돌리는 것은 최종 상태의 수렴만 증명한다."
--
-- baseline.sql 의 원문을 그대로 되살린다 (34개).

-- ① 전환이 만든 것을 걷어낸다
do $$
declare r record;
begin
  for r in select tablename, policyname from pg_policies
           where schemaname = 'public'
             and (policyname like 'TEMP\_session\_gate\_%' or policyname like '%\_select\_all')
  loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

drop trigger if exists app_users_guard_privilege on public.app_users;
drop function if exists public.guard_app_user_privilege_change();

-- ② baseline 의 열린 정책을 되살린다
create policy app_settings_write on public.app_settings as PERMISSIVE for ALL to public using (true);
create policy open_access on public.app_users as PERMISSIVE for ALL to anon using (true) with check (true);
create policy open_access on public.buildings as PERMISSIVE for ALL to anon using (true) with check (true);
create policy open on public.calendar_events as PERMISSIVE for ALL to public using (true) with check (true);
create policy open_access on public.card_assignments as PERMISSIVE for ALL to anon using (true) with check (true);
create policy open_access on public.card_boundaries as PERMISSIVE for ALL to anon using (true) with check (true);
create policy open_access on public.card_leader_assignments as PERMISSIVE for ALL to anon using (true) with check (true);
create policy open_access on public.cards as PERMISSIVE for ALL to anon using (true) with check (true);
create policy open_access on public.chat_room_mutes as PERMISSIVE for ALL to anon, authenticated using (true) with check (true);
create policy open_access on public.comments as PERMISSIVE for ALL to anon, authenticated using (true) with check (true);
create policy open_access on public.event_card_assignment_cards as PERMISSIVE for ALL to anon using (true) with check (true);
create policy open_access on public.event_card_assignments as PERMISSIVE for ALL to anon using (true) with check (true);
create policy open_access on public.event_informal_assignments as PERMISSIVE for ALL to anon using (true) with check (true);
create policy open on public.event_participants as PERMISSIVE for ALL to public using (true) with check (true);
create policy open_access on public.event_restaurant_assignments as PERMISSIVE for ALL to anon using (true) with check (true);
create policy open_access on public.informal_assets as PERMISSIVE for ALL to anon using (true) with check (true);
create policy open_access on public.informal_groups as PERMISSIVE for ALL to anon, authenticated using (true) with check (true);
create policy "anyone can delete notices" on public.notices as PERMISSIVE for DELETE to public using (true);
create policy "anyone can insert notices" on public.notices as PERMISSIVE for INSERT to public with check (true);
create policy delete on public.notices as PERMISSIVE for DELETE to public using (true);
create policy insert on public.notices as PERMISSIVE for INSERT to public with check (true);
create policy open_access on public.phone_surveys as PERMISSIVE for ALL to anon, authenticated using (true) with check (true);
create policy open_access on public.regular_visits as PERMISSIVE for ALL to anon using (true) with check (true);
create policy restaurant_requests_delete on public.restaurant_requests as PERMISSIVE for DELETE to public using (true);
create policy restaurant_requests_insert on public.restaurant_requests as PERMISSIVE for INSERT to public with check (true);
create policy restaurant_requests_update on public.restaurant_requests as PERMISSIVE for UPDATE to public using (true);
create policy "allow all" on public.return_visit_logs as PERMISSIVE for ALL to public using (true);
create policy "allow all" on public.return_visits as PERMISSIVE for ALL to public using (true);
create policy "allow all" on public.review_tasks as PERMISSIVE for ALL to public using (true) with check (true);
create policy open_access on public.service_sessions as PERMISSIVE for ALL to anon using (true) with check (true);
create policy "Enable all operations for all" on public.service_suggestions as PERMISSIVE for ALL to public using (true) with check (true);
create policy open_access on public.territory_regions as PERMISSIVE for ALL to anon, authenticated using (true) with check (true);
create policy open_access on public.units as PERMISSIVE for ALL to anon using (true) with check (true);
create policy open_access on public.visit_histories as PERMISSIVE for ALL to anon using (true) with check (true);

notify pgrst, 'reload schema';

-- 확인: FOR ALL 28 · TEMP 0 이어야 한다
-- select
--   (select count(*) from pg_policies where schemaname='public' and cmd='ALL'
--      and tablename not like '\_probe%') as FOR_ALL_28,
--   (select count(*) from pg_policies where schemaname='public'
--      and policyname like 'TEMP\_%') as TEMP_0;
