-- 🚨 **긴급 복구.** anon 쓰기를 다시 연다.
--
-- 왜 (2026-08-30 봉사 중 발생):
--   세션 관문을 걸었는데 **활성 사용자 62명 중 토큰이 있는 사람이 24명뿐**이었다.
--   옛 세션으로 자동 로그인하는 사람은 서버 토큰이 없어 헤더가 안 붙는다.
--   **앱을 껐다 켜도 안 된다 — 다시 로그인해야 토큰이 생긴다.**
--   그래서 38명이 방문 기록·배정을 하나도 저장하지 못했다.
--
--   이건 내가 놓친 것이다. "새 앱을 받았나" 만 봤고 **"토큰이 있나" 를 안 셌다.**
--   전환 전에 `select count(distinct user_id) from auth_sessions` 를 봤어야 했다.
--
-- 이 파일은 **기존 TEMP 정책을 지우지 않는다.** permissive 정책은 OR 로 합쳐지므로
-- 여는 정책을 하나 더 얹으면 즉시 열린다. 나중에 다시 잠글 때는
-- 이 EMERGENCY 정책들만 지우면 원래 상태로 돌아간다.
--
-- ⚠ `app_users`는 절대 긴급 개방하지 않는다. 이 표를 열면 토큰 없는 요청으로
-- role·approval_status·is_active를 바꿔 관리자 권한을 만들 수 있다.
-- 로그인·가입은 별도 SECURITY DEFINER RPC가 있으므로 이 표를 열 필요가 없다.


create policy "EMERGENCY_open_app_settings" on public.app_settings
  for all to public using (true) with check (true);

create policy "EMERGENCY_open_buildings" on public.buildings
  for all to anon using (true) with check (true);

create policy "EMERGENCY_open_calendar_events" on public.calendar_events
  for all to public using (true) with check (true);

create policy "EMERGENCY_open_card_assignments" on public.card_assignments
  for all to anon using (true) with check (true);

create policy "EMERGENCY_open_card_boundaries" on public.card_boundaries
  for all to anon using (true) with check (true);

create policy "EMERGENCY_open_card_leader_assignments" on public.card_leader_assignments
  for all to anon using (true) with check (true);

create policy "EMERGENCY_open_cards" on public.cards
  for all to anon using (true) with check (true);

create policy "EMERGENCY_open_chat_room_mutes" on public.chat_room_mutes
  for all to anon, authenticated using (true) with check (true);

create policy "EMERGENCY_open_comments" on public.comments
  for all to anon, authenticated using (true) with check (true);

create policy "EMERGENCY_open_event_card_assignment_cards" on public.event_card_assignment_cards
  for all to anon using (true) with check (true);

create policy "EMERGENCY_open_event_card_assignments" on public.event_card_assignments
  for all to anon using (true) with check (true);

create policy "EMERGENCY_open_event_informal_assignments" on public.event_informal_assignments
  for all to anon using (true) with check (true);

create policy "EMERGENCY_open_event_participants" on public.event_participants
  for all to public using (true) with check (true);

create policy "EMERGENCY_open_event_restaurant_assignments" on public.event_restaurant_assignments
  for all to anon using (true) with check (true);

create policy "EMERGENCY_open_informal_assets" on public.informal_assets
  for all to anon using (true) with check (true);

create policy "EMERGENCY_open_informal_groups" on public.informal_groups
  for all to anon, authenticated using (true) with check (true);

create policy "EMERGENCY_open_phone_surveys" on public.phone_surveys
  for all to anon, authenticated using (true) with check (true);

create policy "EMERGENCY_open_regular_visits" on public.regular_visits
  for all to anon using (true) with check (true);

create policy "EMERGENCY_open_return_visit_logs" on public.return_visit_logs
  for all to public using (true) with check (true);

create policy "EMERGENCY_open_return_visits" on public.return_visits
  for all to public using (true) with check (true);

create policy "EMERGENCY_open_review_tasks" on public.review_tasks
  for all to public using (true) with check (true);

create policy "EMERGENCY_open_service_sessions" on public.service_sessions
  for all to anon using (true) with check (true);

create policy "EMERGENCY_open_service_suggestions" on public.service_suggestions
  for all to public using (true) with check (true);

create policy "EMERGENCY_open_territory_regions" on public.territory_regions
  for all to anon, authenticated using (true) with check (true);

create policy "EMERGENCY_open_units" on public.units
  for all to anon using (true) with check (true);

create policy "EMERGENCY_open_visit_histories" on public.visit_histories
  for all to anon using (true) with check (true);


do $$
declare v int;
begin
  select count(*) into v from pg_policies
  where schemaname='public' and policyname like 'EMERGENCY\_open\_%';
  if v <> 26 then
    raise exception '긴급 복구 정책은 26개여야 합니다 (현재 %개)', v;
  end if;
  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'app_users'
      and policyname like 'EMERGENCY\_open\_%'
  ) then
    raise exception 'app_users 긴급 개방은 금지입니다';
  end if;
  raise notice '🚨 긴급 복구 정책 %개. app_users는 닫힌 채다', v;
end $$;

notify pgrst, 'reload schema';
