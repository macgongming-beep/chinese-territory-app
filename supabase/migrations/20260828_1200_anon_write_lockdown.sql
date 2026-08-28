-- anon 쓰기 최종 전환. **한 트랜잭션이다. 나누면 안 된다.**
--
-- 지금: 표 28개가 `FOR ALL using(true)` 로 읽기·쓰기를 다 받고,
--       notices·restaurant_requests 는 개별 정책으로 열려 있다.
--       **앱 번들의 anon 키만 있으면 회중 데이터를 통째로 지울 수 있다.**
--
-- ⚠⚠ 그 FOR ALL 이 **SELECT 도 주고 있다.** 실측: FOR ALL 28 · FOR SELECT 7 —
--    표 21개는 읽기를 그 하나에서만 받는다. **그냥 지우면 앱이 백지가 된다(62명).**
--    그래서 순서가 정해져 있다:
--      ① 표마다 명시적 SELECT 정책을 **먼저** (기존 읽기·Realtime 을 그대로 재현)
--      ② INSERT / UPDATE / DELETE 에 세션 관문
--      ③ 그다음에야 FOR ALL 제거
--      ④ app_users 의 role·approval_status·is_active 변경 차단 (트리거)
--      ⑤ app_settings·notices 쓰기를 관리자만
--      ⑥ 검증
--
-- ⚠ Realtime 은 구독자의 **SELECT RLS** 를 보는데 WebSocket 에는 헤더가 안 붙는다.
--   그래서 SELECT 는 `using (true)` 로 **지금과 똑같이** 두고 세션 관문은 쓰기에만 건다.
--
-- ⚠ `verify_session` 을 쓰지 않는다. 그건 세션을 지우고 쓰고 던지는 함수라
--   행마다 평가되면 잠금 경합을 만든다. 부작용 없는 `private.request_session_user_id()` 를
--   `(select …)` 로 감싸 statement 당 한 번만 평가되게 한다.
--
-- ⚠ 정책 이름은 `TEMP_session_gate_*` 다. 이것은 '로그인했나' 만 보는 **거친 관문**이다.
--   역할별 권한으로 바꾸면 이 이름이 0개가 되어야 한다.
--   **다른 회중 배포 조건 = TEMP 정책 0개.**
--
-- ⚠ 옛 PWA 를 쓰는 사람은 헤더가 없어 **쓰기가 전부 실패한다.**
--   읽기는 그대로 된다. "앱을 껐다 켜세요" 를 안내할 준비를 하고 넣을 것.

begin;

-- ═══ RLS 가 직접 부르는 helper 에만 실행권한을 연다 ═══
-- 정책 식은 **요청 역할(anon)의 권한**으로 함수를 호출한다.
-- `security definer` 는 함수에 **들어간 다음부터** 소유자 권한이라, 문 앞은 못 지나간다.
-- grant 가 없으면 조회는 살고 **모든 쓰기가 실패**한다.
-- schema `private` 의 USAGE 는 계속 회수한 채로 둔다 → 밖에서 직접은 못 부른다.
-- (`_PROBE_정책이_private함수를_부를수있나.sql` 로 양쪽 다 증명하고 넣을 것)
grant execute on function private.request_session_user_id() to anon, authenticated;
grant execute on function private.request_is_admin()        to anon, authenticated;

-- buildings
create policy buildings_select_all on public.buildings
  for select to anon using (true);
create policy "TEMP_session_gate_buildings_ins" on public.buildings
  for insert to anon with check ((select private.request_session_user_id()) is not null);
create policy "TEMP_session_gate_buildings_upd" on public.buildings
  for update to anon using ((select private.request_session_user_id()) is not null) with check ((select private.request_session_user_id()) is not null);
create policy "TEMP_session_gate_buildings_del" on public.buildings
  for delete to anon using ((select private.request_session_user_id()) is not null);
drop policy open_access on public.buildings;

-- calendar_events
create policy calendar_events_select_all on public.calendar_events
  for select to public using (true);
create policy "TEMP_session_gate_calendar_events_ins" on public.calendar_events
  for insert to public with check ((select private.request_session_user_id()) is not null);
create policy "TEMP_session_gate_calendar_events_upd" on public.calendar_events
  for update to public using ((select private.request_session_user_id()) is not null) with check ((select private.request_session_user_id()) is not null);
create policy "TEMP_session_gate_calendar_events_del" on public.calendar_events
  for delete to public using ((select private.request_session_user_id()) is not null);
drop policy open on public.calendar_events;

-- card_assignments
create policy card_assignments_select_all on public.card_assignments
  for select to anon using (true);
create policy "TEMP_session_gate_card_assignments_ins" on public.card_assignments
  for insert to anon with check ((select private.request_session_user_id()) is not null);
create policy "TEMP_session_gate_card_assignments_upd" on public.card_assignments
  for update to anon using ((select private.request_session_user_id()) is not null) with check ((select private.request_session_user_id()) is not null);
create policy "TEMP_session_gate_card_assignments_del" on public.card_assignments
  for delete to anon using ((select private.request_session_user_id()) is not null);
drop policy open_access on public.card_assignments;

-- card_boundaries
create policy card_boundaries_select_all on public.card_boundaries
  for select to anon using (true);
create policy "TEMP_session_gate_card_boundaries_ins" on public.card_boundaries
  for insert to anon with check ((select private.request_session_user_id()) is not null);
create policy "TEMP_session_gate_card_boundaries_upd" on public.card_boundaries
  for update to anon using ((select private.request_session_user_id()) is not null) with check ((select private.request_session_user_id()) is not null);
create policy "TEMP_session_gate_card_boundaries_del" on public.card_boundaries
  for delete to anon using ((select private.request_session_user_id()) is not null);
drop policy open_access on public.card_boundaries;

-- card_leader_assignments
create policy card_leader_assignments_select_all on public.card_leader_assignments
  for select to anon using (true);
create policy "TEMP_session_gate_card_leader_assignments_ins" on public.card_leader_assignments
  for insert to anon with check ((select private.request_session_user_id()) is not null);
create policy "TEMP_session_gate_card_leader_assignments_upd" on public.card_leader_assignments
  for update to anon using ((select private.request_session_user_id()) is not null) with check ((select private.request_session_user_id()) is not null);
create policy "TEMP_session_gate_card_leader_assignments_del" on public.card_leader_assignments
  for delete to anon using ((select private.request_session_user_id()) is not null);
drop policy open_access on public.card_leader_assignments;

-- cards
create policy cards_select_all on public.cards
  for select to anon using (true);
create policy "TEMP_session_gate_cards_ins" on public.cards
  for insert to anon with check ((select private.request_session_user_id()) is not null);
create policy "TEMP_session_gate_cards_upd" on public.cards
  for update to anon using ((select private.request_session_user_id()) is not null) with check ((select private.request_session_user_id()) is not null);
create policy "TEMP_session_gate_cards_del" on public.cards
  for delete to anon using ((select private.request_session_user_id()) is not null);
drop policy open_access on public.cards;

-- chat_room_mutes
create policy chat_room_mutes_select_all on public.chat_room_mutes
  for select to anon, authenticated using (true);
create policy "TEMP_session_gate_chat_room_mutes_ins" on public.chat_room_mutes
  for insert to anon, authenticated with check ((select private.request_session_user_id()) is not null);
create policy "TEMP_session_gate_chat_room_mutes_upd" on public.chat_room_mutes
  for update to anon, authenticated using ((select private.request_session_user_id()) is not null) with check ((select private.request_session_user_id()) is not null);
create policy "TEMP_session_gate_chat_room_mutes_del" on public.chat_room_mutes
  for delete to anon, authenticated using ((select private.request_session_user_id()) is not null);
drop policy open_access on public.chat_room_mutes;

-- comments
create policy comments_select_all on public.comments
  for select to anon, authenticated using (true);
create policy "TEMP_session_gate_comments_ins" on public.comments
  for insert to anon, authenticated with check ((select private.request_session_user_id()) is not null);
create policy "TEMP_session_gate_comments_upd" on public.comments
  for update to anon, authenticated using ((select private.request_session_user_id()) is not null) with check ((select private.request_session_user_id()) is not null);
create policy "TEMP_session_gate_comments_del" on public.comments
  for delete to anon, authenticated using ((select private.request_session_user_id()) is not null);
drop policy open_access on public.comments;

-- event_card_assignment_cards
create policy event_card_assignment_cards_select_all on public.event_card_assignment_cards
  for select to anon using (true);
create policy "TEMP_session_gate_event_card_assignment_cards_ins" on public.event_card_assignment_cards
  for insert to anon with check ((select private.request_session_user_id()) is not null);
create policy "TEMP_session_gate_event_card_assignment_cards_upd" on public.event_card_assignment_cards
  for update to anon using ((select private.request_session_user_id()) is not null) with check ((select private.request_session_user_id()) is not null);
create policy "TEMP_session_gate_event_card_assignment_cards_del" on public.event_card_assignment_cards
  for delete to anon using ((select private.request_session_user_id()) is not null);
drop policy open_access on public.event_card_assignment_cards;

-- event_card_assignments
create policy event_card_assignments_select_all on public.event_card_assignments
  for select to anon using (true);
create policy "TEMP_session_gate_event_card_assignments_ins" on public.event_card_assignments
  for insert to anon with check ((select private.request_session_user_id()) is not null);
create policy "TEMP_session_gate_event_card_assignments_upd" on public.event_card_assignments
  for update to anon using ((select private.request_session_user_id()) is not null) with check ((select private.request_session_user_id()) is not null);
create policy "TEMP_session_gate_event_card_assignments_del" on public.event_card_assignments
  for delete to anon using ((select private.request_session_user_id()) is not null);
drop policy open_access on public.event_card_assignments;

-- event_informal_assignments
create policy event_informal_assignments_select_all on public.event_informal_assignments
  for select to anon using (true);
create policy "TEMP_session_gate_event_informal_assignments_ins" on public.event_informal_assignments
  for insert to anon with check ((select private.request_session_user_id()) is not null);
create policy "TEMP_session_gate_event_informal_assignments_upd" on public.event_informal_assignments
  for update to anon using ((select private.request_session_user_id()) is not null) with check ((select private.request_session_user_id()) is not null);
create policy "TEMP_session_gate_event_informal_assignments_del" on public.event_informal_assignments
  for delete to anon using ((select private.request_session_user_id()) is not null);
drop policy open_access on public.event_informal_assignments;

-- event_participants
create policy event_participants_select_all on public.event_participants
  for select to public using (true);
create policy "TEMP_session_gate_event_participants_ins" on public.event_participants
  for insert to public with check ((select private.request_session_user_id()) is not null);
create policy "TEMP_session_gate_event_participants_upd" on public.event_participants
  for update to public using ((select private.request_session_user_id()) is not null) with check ((select private.request_session_user_id()) is not null);
create policy "TEMP_session_gate_event_participants_del" on public.event_participants
  for delete to public using ((select private.request_session_user_id()) is not null);
drop policy open on public.event_participants;

-- event_restaurant_assignments
create policy event_restaurant_assignments_select_all on public.event_restaurant_assignments
  for select to anon using (true);
create policy "TEMP_session_gate_event_restaurant_assignments_ins" on public.event_restaurant_assignments
  for insert to anon with check ((select private.request_session_user_id()) is not null);
create policy "TEMP_session_gate_event_restaurant_assignments_upd" on public.event_restaurant_assignments
  for update to anon using ((select private.request_session_user_id()) is not null) with check ((select private.request_session_user_id()) is not null);
create policy "TEMP_session_gate_event_restaurant_assignments_del" on public.event_restaurant_assignments
  for delete to anon using ((select private.request_session_user_id()) is not null);
drop policy open_access on public.event_restaurant_assignments;

-- informal_assets
create policy informal_assets_select_all on public.informal_assets
  for select to anon using (true);
create policy "TEMP_session_gate_informal_assets_ins" on public.informal_assets
  for insert to anon with check ((select private.request_session_user_id()) is not null);
create policy "TEMP_session_gate_informal_assets_upd" on public.informal_assets
  for update to anon using ((select private.request_session_user_id()) is not null) with check ((select private.request_session_user_id()) is not null);
create policy "TEMP_session_gate_informal_assets_del" on public.informal_assets
  for delete to anon using ((select private.request_session_user_id()) is not null);
drop policy open_access on public.informal_assets;

-- informal_groups
create policy informal_groups_select_all on public.informal_groups
  for select to anon, authenticated using (true);
create policy "TEMP_session_gate_informal_groups_ins" on public.informal_groups
  for insert to anon, authenticated with check ((select private.request_session_user_id()) is not null);
create policy "TEMP_session_gate_informal_groups_upd" on public.informal_groups
  for update to anon, authenticated using ((select private.request_session_user_id()) is not null) with check ((select private.request_session_user_id()) is not null);
create policy "TEMP_session_gate_informal_groups_del" on public.informal_groups
  for delete to anon, authenticated using ((select private.request_session_user_id()) is not null);
drop policy open_access on public.informal_groups;

-- phone_surveys
create policy phone_surveys_select_all on public.phone_surveys
  for select to anon, authenticated using (true);
create policy "TEMP_session_gate_phone_surveys_ins" on public.phone_surveys
  for insert to anon, authenticated with check ((select private.request_session_user_id()) is not null);
create policy "TEMP_session_gate_phone_surveys_upd" on public.phone_surveys
  for update to anon, authenticated using ((select private.request_session_user_id()) is not null) with check ((select private.request_session_user_id()) is not null);
create policy "TEMP_session_gate_phone_surveys_del" on public.phone_surveys
  for delete to anon, authenticated using ((select private.request_session_user_id()) is not null);
drop policy open_access on public.phone_surveys;

-- regular_visits
create policy regular_visits_select_all on public.regular_visits
  for select to anon using (true);
create policy "TEMP_session_gate_regular_visits_ins" on public.regular_visits
  for insert to anon with check ((select private.request_session_user_id()) is not null);
create policy "TEMP_session_gate_regular_visits_upd" on public.regular_visits
  for update to anon using ((select private.request_session_user_id()) is not null) with check ((select private.request_session_user_id()) is not null);
create policy "TEMP_session_gate_regular_visits_del" on public.regular_visits
  for delete to anon using ((select private.request_session_user_id()) is not null);
drop policy open_access on public.regular_visits;

-- return_visit_logs
create policy return_visit_logs_select_all on public.return_visit_logs
  for select to public using (true);
create policy "TEMP_session_gate_return_visit_logs_ins" on public.return_visit_logs
  for insert to public with check ((select private.request_session_user_id()) is not null);
create policy "TEMP_session_gate_return_visit_logs_upd" on public.return_visit_logs
  for update to public using ((select private.request_session_user_id()) is not null) with check ((select private.request_session_user_id()) is not null);
create policy "TEMP_session_gate_return_visit_logs_del" on public.return_visit_logs
  for delete to public using ((select private.request_session_user_id()) is not null);
drop policy "allow all" on public.return_visit_logs;

-- return_visits
create policy return_visits_select_all on public.return_visits
  for select to public using (true);
create policy "TEMP_session_gate_return_visits_ins" on public.return_visits
  for insert to public with check ((select private.request_session_user_id()) is not null);
create policy "TEMP_session_gate_return_visits_upd" on public.return_visits
  for update to public using ((select private.request_session_user_id()) is not null) with check ((select private.request_session_user_id()) is not null);
create policy "TEMP_session_gate_return_visits_del" on public.return_visits
  for delete to public using ((select private.request_session_user_id()) is not null);
drop policy "allow all" on public.return_visits;

-- review_tasks
create policy review_tasks_select_all on public.review_tasks
  for select to public using (true);
create policy "TEMP_session_gate_review_tasks_ins" on public.review_tasks
  for insert to public with check ((select private.request_session_user_id()) is not null);
create policy "TEMP_session_gate_review_tasks_upd" on public.review_tasks
  for update to public using ((select private.request_session_user_id()) is not null) with check ((select private.request_session_user_id()) is not null);
create policy "TEMP_session_gate_review_tasks_del" on public.review_tasks
  for delete to public using ((select private.request_session_user_id()) is not null);
drop policy "allow all" on public.review_tasks;

-- service_sessions
create policy service_sessions_select_all on public.service_sessions
  for select to anon using (true);
create policy "TEMP_session_gate_service_sessions_ins" on public.service_sessions
  for insert to anon with check ((select private.request_session_user_id()) is not null);
create policy "TEMP_session_gate_service_sessions_upd" on public.service_sessions
  for update to anon using ((select private.request_session_user_id()) is not null) with check ((select private.request_session_user_id()) is not null);
create policy "TEMP_session_gate_service_sessions_del" on public.service_sessions
  for delete to anon using ((select private.request_session_user_id()) is not null);
drop policy open_access on public.service_sessions;

-- service_suggestions
create policy service_suggestions_select_all on public.service_suggestions
  for select to public using (true);
create policy "TEMP_session_gate_service_suggestions_ins" on public.service_suggestions
  for insert to public with check ((select private.request_session_user_id()) is not null);
create policy "TEMP_session_gate_service_suggestions_upd" on public.service_suggestions
  for update to public using ((select private.request_session_user_id()) is not null) with check ((select private.request_session_user_id()) is not null);
create policy "TEMP_session_gate_service_suggestions_del" on public.service_suggestions
  for delete to public using ((select private.request_session_user_id()) is not null);
drop policy "Enable all operations for all" on public.service_suggestions;

-- territory_regions
create policy territory_regions_select_all on public.territory_regions
  for select to anon, authenticated using (true);
create policy "TEMP_session_gate_territory_regions_ins" on public.territory_regions
  for insert to anon, authenticated with check ((select private.request_session_user_id()) is not null);
create policy "TEMP_session_gate_territory_regions_upd" on public.territory_regions
  for update to anon, authenticated using ((select private.request_session_user_id()) is not null) with check ((select private.request_session_user_id()) is not null);
create policy "TEMP_session_gate_territory_regions_del" on public.territory_regions
  for delete to anon, authenticated using ((select private.request_session_user_id()) is not null);
drop policy open_access on public.territory_regions;

-- units
create policy units_select_all on public.units
  for select to anon using (true);
create policy "TEMP_session_gate_units_ins" on public.units
  for insert to anon with check ((select private.request_session_user_id()) is not null);
create policy "TEMP_session_gate_units_upd" on public.units
  for update to anon using ((select private.request_session_user_id()) is not null) with check ((select private.request_session_user_id()) is not null);
create policy "TEMP_session_gate_units_del" on public.units
  for delete to anon using ((select private.request_session_user_id()) is not null);
drop policy open_access on public.units;

-- visit_histories
create policy visit_histories_select_all on public.visit_histories
  for select to anon using (true);
create policy "TEMP_session_gate_visit_histories_ins" on public.visit_histories
  for insert to anon with check ((select private.request_session_user_id()) is not null);
create policy "TEMP_session_gate_visit_histories_upd" on public.visit_histories
  for update to anon using ((select private.request_session_user_id()) is not null) with check ((select private.request_session_user_id()) is not null);
create policy "TEMP_session_gate_visit_histories_del" on public.visit_histories
  for delete to anon using ((select private.request_session_user_id()) is not null);
drop policy open_access on public.visit_histories;

-- restaurant_requests · DELETE (FOR ALL 이 아니라 개별 정책이라 따로 잡는다)
drop policy restaurant_requests_delete on public.restaurant_requests;
create policy "TEMP_session_gate_restaurant_requests_delete" on public.restaurant_requests
  for delete to public using ((select private.request_session_user_id()) is not null);

-- restaurant_requests · INSERT (FOR ALL 이 아니라 개별 정책이라 따로 잡는다)
drop policy restaurant_requests_insert on public.restaurant_requests;
create policy "TEMP_session_gate_restaurant_requests_insert" on public.restaurant_requests
  for insert to public with check ((select private.request_session_user_id()) is not null);

-- restaurant_requests · UPDATE (FOR ALL 이 아니라 개별 정책이라 따로 잡는다)
drop policy restaurant_requests_update on public.restaurant_requests;
create policy "TEMP_session_gate_restaurant_requests_update" on public.restaurant_requests
  for update to public using ((select private.request_session_user_id()) is not null) with check ((select private.request_session_user_id()) is not null);-- ═══ app_users — 역할 상승을 막는다 ═══
--
-- ⚠ 이걸 나중 단계로 미루면 안 된다. 일반 쓰기를 세션 기반으로 바꾸는 동안
--   app_users 가 열려 있으면 **로그인한 사람이 자기 role 을 admin 으로 올린다.**
--   그러면 뒤이어 만들 역할별 정책이 전부 무너진다.

create policy app_users_select_all on public.app_users
  for select to anon using (true);
-- ⚠ INSERT 를 '세션 있으면' 으로 두면 안 된다 —
--   **로그인한 일반 사용자가 자기를 admin 으로 한 줄 더 만든다.**
--   가입은 signup_tx(security definer)가 RLS 를 우회해서 하므로 막아도 안 막힌다.
create policy "TEMP_session_gate_app_users_ins" on public.app_users
  for insert to anon with check ((select private.request_is_admin()));
-- UPDATE 는 **본인 아니면 관리자**. 호출부 8곳을 세어 확인했다:
--   본인(2): changePin · updateProfile
--   관리자(6): resetUserPin · updateUsersGroup · renameUserGroup ·
--              updateUserRole · setApprovalStatus · updateUserAccount
-- (auth_login · auth_record_auto_login 의 last_login_at 갱신은 definer 라 RLS 밖이다)
create policy "TEMP_session_gate_app_users_upd" on public.app_users
  for update to anon
  using (id = (select private.request_session_user_id()) or (select private.request_is_admin()))
  with check (id = (select private.request_session_user_id()) or (select private.request_is_admin()));
create policy "TEMP_session_gate_app_users_del" on public.app_users
  for delete to anon using ((select private.request_is_admin()));
drop policy open_access on public.app_users;

-- 위 정책은 '누구 줄을 고치나' 만 본다. **본인 줄에서 자기 role 을 올리는 것**은 못 막는다.
-- 정책만으로는 **어느 칸이 바뀌었는지**를 볼 수 없다 (WITH CHECK 는 새 행만 본다).
-- 그래서 트리거로 막는다: 관리자가 아니면 role·approval_status·is_active 를 못 바꾼다.
--
-- ⚠ 세션이 아예 없으면(백업 스크립트 등 service_role) 통과시킨다 —
--   그 경로는 위 RLS 가 이미 막고 있고, service_role 키는 앱 번들에 없다.
-- ⚠ `security definer` 를 **쓰지 않는다.** definer 로 두면 함수 안에서 current_user 가
--   언제나 소유자(postgres)라 "누가 부르는가" 를 볼 수 없다. 여기는 권한이 필요 없고
--   (NEW/OLD 만 본다) 요청 역할을 알아야 하므로 invoker 가 맞다.
--   → anon 이 private helper 를 부를 수 있어야 한다. 위 grant 가 그것이다.
--
-- ⚠ 무세션 우회(`v_actor is null → return new`)를 **없앴다.** 그건 RLS 를 우회하는
--   definer 경로가 하나만 생겨도 그대로 뚫린다. 대신 **권한 칸이 안 바뀌었으면 통과**로
--   뒤집었다. 그러면 auth_login 의 last_login_at 갱신 같은 것은 그냥 지나간다.
create or replace function public.guard_app_user_privilege_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- 권한·승인 칸이 그대로면 볼 것 없다 (last_login_at·이름·전화 등)
  if new.role is not distinct from old.role
     and new.approval_status is not distinct from old.approval_status
     and coalesce(new.is_active, true) is not distinct from coalesce(old.is_active, true) then
    return new;
  end if;

  -- DB 관리자·서버 키 (SQL Editor, 백업/배치). anon 은 여기 못 든다
  if current_user in ('postgres', 'supabase_admin', 'service_role') then
    return new;
  end if;

  if (select private.request_is_admin()) then
    return new;
  end if;

  raise exception '권한·승인 상태는 관리자만 바꿀 수 있습니다';
end;
$$;
-- ⚠ 여기는 집 규칙("definer 함수를 만들면 revoke")의 예외다. 이유 둘:
--   · 이 함수는 definer 가 아니고, `returns trigger` 라 PostgreSQL 이 직접 호출을
--     타입 단계에서 거부한다 — 열어 둬도 부를 수가 없다
--   · 되레 revoke 가 위험하다. 실행권한 검사가 fire 시점에도 걸린다면
--     **app_users 의 모든 UPDATE 가 죽는다.** 얻는 것 없이 그 위험만 지는 셈이다
-- (revoke 하지 않는다)

drop trigger if exists app_users_guard_privilege on public.app_users;
create trigger app_users_guard_privilege
  before update on public.app_users
  for each row execute function public.guard_app_user_privilege_change();

-- ═══ app_settings — 쓰기는 관리자만 ═══
-- 이름이 open_access 가 아니라 app_settings_write 라 이름으로 찾으면 놓친다.
drop policy app_settings_write on public.app_settings;
create policy "TEMP_session_gate_app_settings_ins" on public.app_settings
  for insert to public with check ((select private.request_is_admin()));
create policy "TEMP_session_gate_app_settings_upd" on public.app_settings
  for update to public
  using ((select private.request_is_admin())) with check ((select private.request_is_admin()));
create policy "TEMP_session_gate_app_settings_del" on public.app_settings
  for delete to public using ((select private.request_is_admin()));

-- ═══ notices — 아무나 쓰고 지울 수 있었다 ═══
-- 이름이 다른 정책이 **두 벌** 있다 (anyone can … / delete·insert·read).
-- 올리는 것은 create_notice_tx(security definer)가 하므로 INSERT 정책은 관리자만 남긴다.
drop policy "anyone can delete notices" on public.notices;
drop policy "anyone can insert notices" on public.notices;
drop policy "delete" on public.notices;
drop policy "insert" on public.notices;
create policy "TEMP_session_gate_notices_ins" on public.notices
  for insert to public with check ((select private.request_is_admin()));
create policy "TEMP_session_gate_notices_del" on public.notices
  for delete to public using ((select private.request_is_admin()));

-- ═══ 검증 — 여기서 던지면 위가 전부 롤백된다 ═══
-- ⚠ 개수를 세지 않는다. **빠진 표를 이름으로 뱉게** 한다.
--   "28개 맞네" 는 엉뚱한 28개여도 통과한다 (오늘 시험에서 여러 번 데었다).
do $$
declare
  v_missing text;
  v_open    text;
begin
  -- (1) RLS 가 켜진 표 중 **SELECT 정책이 하나도 없는** 것 = 그 표는 안 보인다
  select string_agg(c.relname, ', ' order by c.relname) into v_missing
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
    and c.relname <> 'app_private_settings'          -- 일부러 deny_all
    and not exists (
      select 1 from pg_policies p
      where p.schemaname = 'public' and p.tablename = c.relname
        and p.cmd in ('SELECT', 'ALL'));
  if v_missing is not null then
    raise exception 'SELECT 정책이 없는 표: %  → 이대로 commit 하면 이 표들이 화면에서 사라진다', v_missing;
  end if;

  -- (2) 아직 남아 있는 열린 쓰기 정책 = 안 막힌 것
  select string_agg(format('%s.%s(%s)', tablename, policyname, cmd), ', ' order by tablename) into v_open
  from pg_policies
  where schemaname = 'public'
    and cmd in ('ALL', 'INSERT', 'UPDATE', 'DELETE')
    and policyname not like 'TEMP\_session\_gate\_%'
    and policyname <> 'app_private_settings_deny_all';
  if v_open is not null then
    raise exception '아직 열려 있는 쓰기 정책: %', v_open;
  end if;

  -- (3) 역할 상승 차단 트리거가 실제로 붙었나
  if not exists (select 1 from pg_trigger
                 where tgname = 'app_users_guard_privilege' and not tgisinternal) then
    raise exception 'app_users 역할 상승 차단 트리거가 없다';
  end if;

  raise notice '✅ 검증 통과 — SELECT 재현 완료 · 열린 쓰기 0 · 역할 상승 차단 있음';
end $$;

notify pgrst, 'reload schema';

commit;

-- ═══════════════════════════════════════════════════════════
-- commit 뒤에 **따로** 돌릴 검증 (전부 true 여야 한다)
-- ═══════════════════════════════════════════════════════════
-- select
--   (select count(*) from pg_policies
--     where schemaname='public' and cmd='ALL'
--       and policyname <> 'app_private_settings_deny_all') = 0            as 열린_FOR_ALL_없음,
--   (select count(*) from pg_policies
--     where schemaname='public' and cmd='SELECT') >= 28                    as SELECT_정책_재현됨,
--   (select count(*) from pg_policies
--     where schemaname='public' and policyname like 'TEMP\_session\_gate\_%') > 0 as 세션관문_있음,
--   (select count(*) from pg_trigger
--     where tgname='app_users_guard_privilege' and not tgisinternal) = 1   as 역할상승_차단;
--
-- 표마다 읽기가 살아 있는지 (0 이 나오면 안 된다):
-- select count(*) from public.cards;
-- select count(*) from public.buildings;
-- select count(*) from public.calendar_events;
