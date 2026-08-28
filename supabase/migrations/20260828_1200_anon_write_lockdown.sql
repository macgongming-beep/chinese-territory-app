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

-- ⚠⚠ **권한이 걸린 셋을 맨 앞에 둔다. 순서가 안전장치다.**
--   SQL Editor 는 `begin;` 을 지키지 않는다 (테스트 DB 에서 확인했다 —
--   마지막 검증만 실패했는데 앞의 정책 112개는 그대로 남았다).
--   그러면 중간에 멈췄을 때 무엇이 이미 닫혔는지가 중요해진다.
--   `app_users` 를 뒤에 두면, 중간에 멈춘 사이 **로그인한 사람이 자기 role 을
--   admin 으로 올릴 수 있다.** 그래서 제일 먼저 닫는다.
--
--   그리고 이 파일은 **몇 번을 다시 돌려도 된다** (모든 create 앞에 drop if exists).
--   중간에 멈추면 고치고 처음부터 다시 돌리면 된다.

-- ═══ app_users — 역할 상승을 막는다 ═══
--
-- ⚠ 이걸 나중 단계로 미루면 안 된다. 일반 쓰기를 세션 기반으로 바꾸는 동안
--   app_users 가 열려 있으면 **로그인한 사람이 자기 role 을 admin 으로 올린다.**
--   그러면 뒤이어 만들 역할별 정책이 전부 무너진다.

drop policy if exists app_users_select_all on public.app_users;
create policy app_users_select_all on public.app_users
  for select to anon using (true);
-- ⚠ INSERT 를 '세션 있으면' 으로 두면 안 된다 —
--   **로그인한 일반 사용자가 자기를 admin 으로 한 줄 더 만든다.**
--   가입은 signup_tx(security definer)가 RLS 를 우회해서 하므로 막아도 안 막힌다.
drop policy if exists "TEMP_session_gate_app_users_ins" on public.app_users;
create policy "TEMP_session_gate_app_users_ins" on public.app_users
  for insert to anon with check ((select private.request_is_admin()));
-- UPDATE 는 **본인 아니면 관리자**. 호출부 8곳을 세어 확인했다:
--   본인(2): changePin · updateProfile
--   관리자(6): resetUserPin · updateUsersGroup · renameUserGroup ·
--              updateUserRole · setApprovalStatus · updateUserAccount
-- (auth_login · auth_record_auto_login 의 last_login_at 갱신은 definer 라 RLS 밖이다)
drop policy if exists "TEMP_session_gate_app_users_upd" on public.app_users;
create policy "TEMP_session_gate_app_users_upd" on public.app_users
  for update to anon
  using (id = (select private.request_session_user_id()) or (select private.request_is_admin()))
  with check (id = (select private.request_session_user_id()) or (select private.request_is_admin()));
drop policy if exists "TEMP_session_gate_app_users_del" on public.app_users;
create policy "TEMP_session_gate_app_users_del" on public.app_users
  for delete to anon using ((select private.request_is_admin()));
drop policy if exists open_access on public.app_users;

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

  -- DB 관리자·서버 키 (SQL Editor, 백업/배치). anon 은 여기 못 든다.
  --
  -- ⚠⚠ 여기가 이 트리거의 **한계**다. `current_user = 'postgres'` 는 SQL Editor 뿐
  --    아니라 **postgres 가 소유한 `security definer` 함수 안에서도 참**이다.
  --    즉 "definer 우회를 없앴다" 가 아니라 **"지금 있는 definer 함수 중에
  --    보호 칸을 건드리는 것이 없어서 안전하다"** 가 맞다 (2026-08-28 감사함).
  --    → **role · approval_status · is_active 를 쓰는 `security definer` RPC 를
  --      새로 만들면 그 함수가 이 검사를 그냥 지나간다.** 그 함수 안에서
  --      직접 권한을 확인할 것. (CLAUDE.md 규칙표에도 넣었다)
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
drop policy if exists app_settings_write on public.app_settings;
drop policy if exists "TEMP_session_gate_app_settings_ins" on public.app_settings;
create policy "TEMP_session_gate_app_settings_ins" on public.app_settings
  for insert to public with check ((select private.request_is_admin()));
drop policy if exists "TEMP_session_gate_app_settings_upd" on public.app_settings;
create policy "TEMP_session_gate_app_settings_upd" on public.app_settings
  for update to public
  using ((select private.request_is_admin())) with check ((select private.request_is_admin()));
drop policy if exists "TEMP_session_gate_app_settings_del" on public.app_settings;
create policy "TEMP_session_gate_app_settings_del" on public.app_settings
  for delete to public using ((select private.request_is_admin()));

-- ═══ notices — 아무나 쓰고 지울 수 있었다 ═══
-- 이름이 다른 정책이 **두 벌** 있다 (anyone can … / delete·insert·read).
-- 올리는 것은 create_notice_tx(security definer)가 하므로 INSERT 정책은 관리자만 남긴다.
drop policy if exists "anyone can delete notices" on public.notices;
drop policy if exists "anyone can insert notices" on public.notices;
drop policy if exists "delete" on public.notices;
drop policy if exists "insert" on public.notices;
drop policy if exists "TEMP_session_gate_notices_ins" on public.notices;
create policy "TEMP_session_gate_notices_ins" on public.notices
  for insert to public with check ((select private.request_is_admin()));
drop policy if exists "TEMP_session_gate_notices_del" on public.notices;
create policy "TEMP_session_gate_notices_del" on public.notices
  for delete to public using ((select private.request_is_admin()));


-- buildings
drop policy if exists buildings_select_all on public.buildings;
create policy buildings_select_all on public.buildings
  for select to anon using (true);
drop policy if exists "TEMP_session_gate_buildings_ins" on public.buildings;
create policy "TEMP_session_gate_buildings_ins" on public.buildings
  for insert to anon with check ((select private.request_session_user_id()) is not null);
drop policy if exists "TEMP_session_gate_buildings_upd" on public.buildings;
create policy "TEMP_session_gate_buildings_upd" on public.buildings
  for update to anon using ((select private.request_session_user_id()) is not null) with check ((select private.request_session_user_id()) is not null);
drop policy if exists "TEMP_session_gate_buildings_del" on public.buildings;
create policy "TEMP_session_gate_buildings_del" on public.buildings
  for delete to anon using ((select private.request_session_user_id()) is not null);
drop policy if exists open_access on public.buildings;

-- calendar_events
drop policy if exists calendar_events_select_all on public.calendar_events;
create policy calendar_events_select_all on public.calendar_events
  for select to public using (true);
drop policy if exists "TEMP_session_gate_calendar_events_ins" on public.calendar_events;
create policy "TEMP_session_gate_calendar_events_ins" on public.calendar_events
  for insert to public with check ((select private.request_session_user_id()) is not null);
drop policy if exists "TEMP_session_gate_calendar_events_upd" on public.calendar_events;
create policy "TEMP_session_gate_calendar_events_upd" on public.calendar_events
  for update to public using ((select private.request_session_user_id()) is not null) with check ((select private.request_session_user_id()) is not null);
drop policy if exists "TEMP_session_gate_calendar_events_del" on public.calendar_events;
create policy "TEMP_session_gate_calendar_events_del" on public.calendar_events
  for delete to public using ((select private.request_session_user_id()) is not null);
drop policy if exists open on public.calendar_events;

-- card_assignments
drop policy if exists card_assignments_select_all on public.card_assignments;
create policy card_assignments_select_all on public.card_assignments
  for select to anon using (true);
drop policy if exists "TEMP_session_gate_card_assignments_ins" on public.card_assignments;
create policy "TEMP_session_gate_card_assignments_ins" on public.card_assignments
  for insert to anon with check ((select private.request_session_user_id()) is not null);
drop policy if exists "TEMP_session_gate_card_assignments_upd" on public.card_assignments;
create policy "TEMP_session_gate_card_assignments_upd" on public.card_assignments
  for update to anon using ((select private.request_session_user_id()) is not null) with check ((select private.request_session_user_id()) is not null);
drop policy if exists "TEMP_session_gate_card_assignments_del" on public.card_assignments;
create policy "TEMP_session_gate_card_assignments_del" on public.card_assignments
  for delete to anon using ((select private.request_session_user_id()) is not null);
drop policy if exists open_access on public.card_assignments;

-- card_boundaries
drop policy if exists card_boundaries_select_all on public.card_boundaries;
create policy card_boundaries_select_all on public.card_boundaries
  for select to anon using (true);
drop policy if exists "TEMP_session_gate_card_boundaries_ins" on public.card_boundaries;
create policy "TEMP_session_gate_card_boundaries_ins" on public.card_boundaries
  for insert to anon with check ((select private.request_session_user_id()) is not null);
drop policy if exists "TEMP_session_gate_card_boundaries_upd" on public.card_boundaries;
create policy "TEMP_session_gate_card_boundaries_upd" on public.card_boundaries
  for update to anon using ((select private.request_session_user_id()) is not null) with check ((select private.request_session_user_id()) is not null);
drop policy if exists "TEMP_session_gate_card_boundaries_del" on public.card_boundaries;
create policy "TEMP_session_gate_card_boundaries_del" on public.card_boundaries
  for delete to anon using ((select private.request_session_user_id()) is not null);
drop policy if exists open_access on public.card_boundaries;

-- card_leader_assignments
drop policy if exists card_leader_assignments_select_all on public.card_leader_assignments;
create policy card_leader_assignments_select_all on public.card_leader_assignments
  for select to anon using (true);
drop policy if exists "TEMP_session_gate_card_leader_assignments_ins" on public.card_leader_assignments;
create policy "TEMP_session_gate_card_leader_assignments_ins" on public.card_leader_assignments
  for insert to anon with check ((select private.request_session_user_id()) is not null);
drop policy if exists "TEMP_session_gate_card_leader_assignments_upd" on public.card_leader_assignments;
create policy "TEMP_session_gate_card_leader_assignments_upd" on public.card_leader_assignments
  for update to anon using ((select private.request_session_user_id()) is not null) with check ((select private.request_session_user_id()) is not null);
drop policy if exists "TEMP_session_gate_card_leader_assignments_del" on public.card_leader_assignments;
create policy "TEMP_session_gate_card_leader_assignments_del" on public.card_leader_assignments
  for delete to anon using ((select private.request_session_user_id()) is not null);
drop policy if exists open_access on public.card_leader_assignments;

-- cards
drop policy if exists cards_select_all on public.cards;
create policy cards_select_all on public.cards
  for select to anon using (true);
drop policy if exists "TEMP_session_gate_cards_ins" on public.cards;
create policy "TEMP_session_gate_cards_ins" on public.cards
  for insert to anon with check ((select private.request_session_user_id()) is not null);
drop policy if exists "TEMP_session_gate_cards_upd" on public.cards;
create policy "TEMP_session_gate_cards_upd" on public.cards
  for update to anon using ((select private.request_session_user_id()) is not null) with check ((select private.request_session_user_id()) is not null);
drop policy if exists "TEMP_session_gate_cards_del" on public.cards;
create policy "TEMP_session_gate_cards_del" on public.cards
  for delete to anon using ((select private.request_session_user_id()) is not null);
drop policy if exists open_access on public.cards;

-- chat_room_mutes
drop policy if exists chat_room_mutes_select_all on public.chat_room_mutes;
create policy chat_room_mutes_select_all on public.chat_room_mutes
  for select to anon, authenticated using (true);
drop policy if exists "TEMP_session_gate_chat_room_mutes_ins" on public.chat_room_mutes;
create policy "TEMP_session_gate_chat_room_mutes_ins" on public.chat_room_mutes
  for insert to anon, authenticated with check ((select private.request_session_user_id()) is not null);
drop policy if exists "TEMP_session_gate_chat_room_mutes_upd" on public.chat_room_mutes;
create policy "TEMP_session_gate_chat_room_mutes_upd" on public.chat_room_mutes
  for update to anon, authenticated using ((select private.request_session_user_id()) is not null) with check ((select private.request_session_user_id()) is not null);
drop policy if exists "TEMP_session_gate_chat_room_mutes_del" on public.chat_room_mutes;
create policy "TEMP_session_gate_chat_room_mutes_del" on public.chat_room_mutes
  for delete to anon, authenticated using ((select private.request_session_user_id()) is not null);
drop policy if exists open_access on public.chat_room_mutes;

-- comments
drop policy if exists comments_select_all on public.comments;
create policy comments_select_all on public.comments
  for select to anon, authenticated using (true);
drop policy if exists "TEMP_session_gate_comments_ins" on public.comments;
create policy "TEMP_session_gate_comments_ins" on public.comments
  for insert to anon, authenticated with check ((select private.request_session_user_id()) is not null);
drop policy if exists "TEMP_session_gate_comments_upd" on public.comments;
create policy "TEMP_session_gate_comments_upd" on public.comments
  for update to anon, authenticated using ((select private.request_session_user_id()) is not null) with check ((select private.request_session_user_id()) is not null);
drop policy if exists "TEMP_session_gate_comments_del" on public.comments;
create policy "TEMP_session_gate_comments_del" on public.comments
  for delete to anon, authenticated using ((select private.request_session_user_id()) is not null);
drop policy if exists open_access on public.comments;

-- event_card_assignment_cards
drop policy if exists event_card_assignment_cards_select_all on public.event_card_assignment_cards;
create policy event_card_assignment_cards_select_all on public.event_card_assignment_cards
  for select to anon using (true);
drop policy if exists "TEMP_session_gate_event_card_assignment_cards_ins" on public.event_card_assignment_cards;
create policy "TEMP_session_gate_event_card_assignment_cards_ins" on public.event_card_assignment_cards
  for insert to anon with check ((select private.request_session_user_id()) is not null);
drop policy if exists "TEMP_session_gate_event_card_assignment_cards_upd" on public.event_card_assignment_cards;
create policy "TEMP_session_gate_event_card_assignment_cards_upd" on public.event_card_assignment_cards
  for update to anon using ((select private.request_session_user_id()) is not null) with check ((select private.request_session_user_id()) is not null);
drop policy if exists "TEMP_session_gate_event_card_assignment_cards_del" on public.event_card_assignment_cards;
create policy "TEMP_session_gate_event_card_assignment_cards_del" on public.event_card_assignment_cards
  for delete to anon using ((select private.request_session_user_id()) is not null);
drop policy if exists open_access on public.event_card_assignment_cards;

-- event_card_assignments
drop policy if exists event_card_assignments_select_all on public.event_card_assignments;
create policy event_card_assignments_select_all on public.event_card_assignments
  for select to anon using (true);
drop policy if exists "TEMP_session_gate_event_card_assignments_ins" on public.event_card_assignments;
create policy "TEMP_session_gate_event_card_assignments_ins" on public.event_card_assignments
  for insert to anon with check ((select private.request_session_user_id()) is not null);
drop policy if exists "TEMP_session_gate_event_card_assignments_upd" on public.event_card_assignments;
create policy "TEMP_session_gate_event_card_assignments_upd" on public.event_card_assignments
  for update to anon using ((select private.request_session_user_id()) is not null) with check ((select private.request_session_user_id()) is not null);
drop policy if exists "TEMP_session_gate_event_card_assignments_del" on public.event_card_assignments;
create policy "TEMP_session_gate_event_card_assignments_del" on public.event_card_assignments
  for delete to anon using ((select private.request_session_user_id()) is not null);
drop policy if exists open_access on public.event_card_assignments;

-- event_informal_assignments
drop policy if exists event_informal_assignments_select_all on public.event_informal_assignments;
create policy event_informal_assignments_select_all on public.event_informal_assignments
  for select to anon using (true);
drop policy if exists "TEMP_session_gate_event_informal_assignments_ins" on public.event_informal_assignments;
create policy "TEMP_session_gate_event_informal_assignments_ins" on public.event_informal_assignments
  for insert to anon with check ((select private.request_session_user_id()) is not null);
drop policy if exists "TEMP_session_gate_event_informal_assignments_upd" on public.event_informal_assignments;
create policy "TEMP_session_gate_event_informal_assignments_upd" on public.event_informal_assignments
  for update to anon using ((select private.request_session_user_id()) is not null) with check ((select private.request_session_user_id()) is not null);
drop policy if exists "TEMP_session_gate_event_informal_assignments_del" on public.event_informal_assignments;
create policy "TEMP_session_gate_event_informal_assignments_del" on public.event_informal_assignments
  for delete to anon using ((select private.request_session_user_id()) is not null);
drop policy if exists open_access on public.event_informal_assignments;

-- event_participants
drop policy if exists event_participants_select_all on public.event_participants;
create policy event_participants_select_all on public.event_participants
  for select to public using (true);
drop policy if exists "TEMP_session_gate_event_participants_ins" on public.event_participants;
create policy "TEMP_session_gate_event_participants_ins" on public.event_participants
  for insert to public with check ((select private.request_session_user_id()) is not null);
drop policy if exists "TEMP_session_gate_event_participants_upd" on public.event_participants;
create policy "TEMP_session_gate_event_participants_upd" on public.event_participants
  for update to public using ((select private.request_session_user_id()) is not null) with check ((select private.request_session_user_id()) is not null);
drop policy if exists "TEMP_session_gate_event_participants_del" on public.event_participants;
create policy "TEMP_session_gate_event_participants_del" on public.event_participants
  for delete to public using ((select private.request_session_user_id()) is not null);
drop policy if exists open on public.event_participants;

-- event_restaurant_assignments
drop policy if exists event_restaurant_assignments_select_all on public.event_restaurant_assignments;
create policy event_restaurant_assignments_select_all on public.event_restaurant_assignments
  for select to anon using (true);
drop policy if exists "TEMP_session_gate_event_restaurant_assignments_ins" on public.event_restaurant_assignments;
create policy "TEMP_session_gate_event_restaurant_assignments_ins" on public.event_restaurant_assignments
  for insert to anon with check ((select private.request_session_user_id()) is not null);
drop policy if exists "TEMP_session_gate_event_restaurant_assignments_upd" on public.event_restaurant_assignments;
create policy "TEMP_session_gate_event_restaurant_assignments_upd" on public.event_restaurant_assignments
  for update to anon using ((select private.request_session_user_id()) is not null) with check ((select private.request_session_user_id()) is not null);
drop policy if exists "TEMP_session_gate_event_restaurant_assignments_del" on public.event_restaurant_assignments;
create policy "TEMP_session_gate_event_restaurant_assignments_del" on public.event_restaurant_assignments
  for delete to anon using ((select private.request_session_user_id()) is not null);
drop policy if exists open_access on public.event_restaurant_assignments;

-- informal_assets
drop policy if exists informal_assets_select_all on public.informal_assets;
create policy informal_assets_select_all on public.informal_assets
  for select to anon using (true);
drop policy if exists "TEMP_session_gate_informal_assets_ins" on public.informal_assets;
create policy "TEMP_session_gate_informal_assets_ins" on public.informal_assets
  for insert to anon with check ((select private.request_session_user_id()) is not null);
drop policy if exists "TEMP_session_gate_informal_assets_upd" on public.informal_assets;
create policy "TEMP_session_gate_informal_assets_upd" on public.informal_assets
  for update to anon using ((select private.request_session_user_id()) is not null) with check ((select private.request_session_user_id()) is not null);
drop policy if exists "TEMP_session_gate_informal_assets_del" on public.informal_assets;
create policy "TEMP_session_gate_informal_assets_del" on public.informal_assets
  for delete to anon using ((select private.request_session_user_id()) is not null);
drop policy if exists open_access on public.informal_assets;

-- informal_groups
drop policy if exists informal_groups_select_all on public.informal_groups;
create policy informal_groups_select_all on public.informal_groups
  for select to anon, authenticated using (true);
drop policy if exists "TEMP_session_gate_informal_groups_ins" on public.informal_groups;
create policy "TEMP_session_gate_informal_groups_ins" on public.informal_groups
  for insert to anon, authenticated with check ((select private.request_session_user_id()) is not null);
drop policy if exists "TEMP_session_gate_informal_groups_upd" on public.informal_groups;
create policy "TEMP_session_gate_informal_groups_upd" on public.informal_groups
  for update to anon, authenticated using ((select private.request_session_user_id()) is not null) with check ((select private.request_session_user_id()) is not null);
drop policy if exists "TEMP_session_gate_informal_groups_del" on public.informal_groups;
create policy "TEMP_session_gate_informal_groups_del" on public.informal_groups
  for delete to anon, authenticated using ((select private.request_session_user_id()) is not null);
drop policy if exists open_access on public.informal_groups;

-- phone_surveys
drop policy if exists phone_surveys_select_all on public.phone_surveys;
create policy phone_surveys_select_all on public.phone_surveys
  for select to anon, authenticated using (true);
drop policy if exists "TEMP_session_gate_phone_surveys_ins" on public.phone_surveys;
create policy "TEMP_session_gate_phone_surveys_ins" on public.phone_surveys
  for insert to anon, authenticated with check ((select private.request_session_user_id()) is not null);
drop policy if exists "TEMP_session_gate_phone_surveys_upd" on public.phone_surveys;
create policy "TEMP_session_gate_phone_surveys_upd" on public.phone_surveys
  for update to anon, authenticated using ((select private.request_session_user_id()) is not null) with check ((select private.request_session_user_id()) is not null);
drop policy if exists "TEMP_session_gate_phone_surveys_del" on public.phone_surveys;
create policy "TEMP_session_gate_phone_surveys_del" on public.phone_surveys
  for delete to anon, authenticated using ((select private.request_session_user_id()) is not null);
drop policy if exists open_access on public.phone_surveys;

-- regular_visits
drop policy if exists regular_visits_select_all on public.regular_visits;
create policy regular_visits_select_all on public.regular_visits
  for select to anon using (true);
drop policy if exists "TEMP_session_gate_regular_visits_ins" on public.regular_visits;
create policy "TEMP_session_gate_regular_visits_ins" on public.regular_visits
  for insert to anon with check ((select private.request_session_user_id()) is not null);
drop policy if exists "TEMP_session_gate_regular_visits_upd" on public.regular_visits;
create policy "TEMP_session_gate_regular_visits_upd" on public.regular_visits
  for update to anon using ((select private.request_session_user_id()) is not null) with check ((select private.request_session_user_id()) is not null);
drop policy if exists "TEMP_session_gate_regular_visits_del" on public.regular_visits;
create policy "TEMP_session_gate_regular_visits_del" on public.regular_visits
  for delete to anon using ((select private.request_session_user_id()) is not null);
drop policy if exists open_access on public.regular_visits;

-- return_visit_logs
drop policy if exists return_visit_logs_select_all on public.return_visit_logs;
create policy return_visit_logs_select_all on public.return_visit_logs
  for select to public using (true);
drop policy if exists "TEMP_session_gate_return_visit_logs_ins" on public.return_visit_logs;
create policy "TEMP_session_gate_return_visit_logs_ins" on public.return_visit_logs
  for insert to public with check ((select private.request_session_user_id()) is not null);
drop policy if exists "TEMP_session_gate_return_visit_logs_upd" on public.return_visit_logs;
create policy "TEMP_session_gate_return_visit_logs_upd" on public.return_visit_logs
  for update to public using ((select private.request_session_user_id()) is not null) with check ((select private.request_session_user_id()) is not null);
drop policy if exists "TEMP_session_gate_return_visit_logs_del" on public.return_visit_logs;
create policy "TEMP_session_gate_return_visit_logs_del" on public.return_visit_logs
  for delete to public using ((select private.request_session_user_id()) is not null);
drop policy if exists "allow all" on public.return_visit_logs;

-- return_visits
drop policy if exists return_visits_select_all on public.return_visits;
create policy return_visits_select_all on public.return_visits
  for select to public using (true);
drop policy if exists "TEMP_session_gate_return_visits_ins" on public.return_visits;
create policy "TEMP_session_gate_return_visits_ins" on public.return_visits
  for insert to public with check ((select private.request_session_user_id()) is not null);
drop policy if exists "TEMP_session_gate_return_visits_upd" on public.return_visits;
create policy "TEMP_session_gate_return_visits_upd" on public.return_visits
  for update to public using ((select private.request_session_user_id()) is not null) with check ((select private.request_session_user_id()) is not null);
drop policy if exists "TEMP_session_gate_return_visits_del" on public.return_visits;
create policy "TEMP_session_gate_return_visits_del" on public.return_visits
  for delete to public using ((select private.request_session_user_id()) is not null);
drop policy if exists "allow all" on public.return_visits;

-- review_tasks
drop policy if exists review_tasks_select_all on public.review_tasks;
create policy review_tasks_select_all on public.review_tasks
  for select to public using (true);
drop policy if exists "TEMP_session_gate_review_tasks_ins" on public.review_tasks;
create policy "TEMP_session_gate_review_tasks_ins" on public.review_tasks
  for insert to public with check ((select private.request_session_user_id()) is not null);
drop policy if exists "TEMP_session_gate_review_tasks_upd" on public.review_tasks;
create policy "TEMP_session_gate_review_tasks_upd" on public.review_tasks
  for update to public using ((select private.request_session_user_id()) is not null) with check ((select private.request_session_user_id()) is not null);
drop policy if exists "TEMP_session_gate_review_tasks_del" on public.review_tasks;
create policy "TEMP_session_gate_review_tasks_del" on public.review_tasks
  for delete to public using ((select private.request_session_user_id()) is not null);
drop policy if exists "allow all" on public.review_tasks;

-- service_sessions
drop policy if exists service_sessions_select_all on public.service_sessions;
create policy service_sessions_select_all on public.service_sessions
  for select to anon using (true);
drop policy if exists "TEMP_session_gate_service_sessions_ins" on public.service_sessions;
create policy "TEMP_session_gate_service_sessions_ins" on public.service_sessions
  for insert to anon with check ((select private.request_session_user_id()) is not null);
drop policy if exists "TEMP_session_gate_service_sessions_upd" on public.service_sessions;
create policy "TEMP_session_gate_service_sessions_upd" on public.service_sessions
  for update to anon using ((select private.request_session_user_id()) is not null) with check ((select private.request_session_user_id()) is not null);
drop policy if exists "TEMP_session_gate_service_sessions_del" on public.service_sessions;
create policy "TEMP_session_gate_service_sessions_del" on public.service_sessions
  for delete to anon using ((select private.request_session_user_id()) is not null);
drop policy if exists open_access on public.service_sessions;

-- service_suggestions
drop policy if exists service_suggestions_select_all on public.service_suggestions;
create policy service_suggestions_select_all on public.service_suggestions
  for select to public using (true);
drop policy if exists "TEMP_session_gate_service_suggestions_ins" on public.service_suggestions;
create policy "TEMP_session_gate_service_suggestions_ins" on public.service_suggestions
  for insert to public with check ((select private.request_session_user_id()) is not null);
drop policy if exists "TEMP_session_gate_service_suggestions_upd" on public.service_suggestions;
create policy "TEMP_session_gate_service_suggestions_upd" on public.service_suggestions
  for update to public using ((select private.request_session_user_id()) is not null) with check ((select private.request_session_user_id()) is not null);
drop policy if exists "TEMP_session_gate_service_suggestions_del" on public.service_suggestions;
create policy "TEMP_session_gate_service_suggestions_del" on public.service_suggestions
  for delete to public using ((select private.request_session_user_id()) is not null);
drop policy if exists "Enable all operations for all" on public.service_suggestions;

-- territory_regions
drop policy if exists territory_regions_select_all on public.territory_regions;
create policy territory_regions_select_all on public.territory_regions
  for select to anon, authenticated using (true);
drop policy if exists "TEMP_session_gate_territory_regions_ins" on public.territory_regions;
create policy "TEMP_session_gate_territory_regions_ins" on public.territory_regions
  for insert to anon, authenticated with check ((select private.request_session_user_id()) is not null);
drop policy if exists "TEMP_session_gate_territory_regions_upd" on public.territory_regions;
create policy "TEMP_session_gate_territory_regions_upd" on public.territory_regions
  for update to anon, authenticated using ((select private.request_session_user_id()) is not null) with check ((select private.request_session_user_id()) is not null);
drop policy if exists "TEMP_session_gate_territory_regions_del" on public.territory_regions;
create policy "TEMP_session_gate_territory_regions_del" on public.territory_regions
  for delete to anon, authenticated using ((select private.request_session_user_id()) is not null);
drop policy if exists open_access on public.territory_regions;

-- units
drop policy if exists units_select_all on public.units;
create policy units_select_all on public.units
  for select to anon using (true);
drop policy if exists "TEMP_session_gate_units_ins" on public.units;
create policy "TEMP_session_gate_units_ins" on public.units
  for insert to anon with check ((select private.request_session_user_id()) is not null);
drop policy if exists "TEMP_session_gate_units_upd" on public.units;
create policy "TEMP_session_gate_units_upd" on public.units
  for update to anon using ((select private.request_session_user_id()) is not null) with check ((select private.request_session_user_id()) is not null);
drop policy if exists "TEMP_session_gate_units_del" on public.units;
create policy "TEMP_session_gate_units_del" on public.units
  for delete to anon using ((select private.request_session_user_id()) is not null);
drop policy if exists open_access on public.units;

-- visit_histories
drop policy if exists visit_histories_select_all on public.visit_histories;
create policy visit_histories_select_all on public.visit_histories
  for select to anon using (true);
drop policy if exists "TEMP_session_gate_visit_histories_ins" on public.visit_histories;
create policy "TEMP_session_gate_visit_histories_ins" on public.visit_histories
  for insert to anon with check ((select private.request_session_user_id()) is not null);
drop policy if exists "TEMP_session_gate_visit_histories_upd" on public.visit_histories;
create policy "TEMP_session_gate_visit_histories_upd" on public.visit_histories
  for update to anon using ((select private.request_session_user_id()) is not null) with check ((select private.request_session_user_id()) is not null);
drop policy if exists "TEMP_session_gate_visit_histories_del" on public.visit_histories;
create policy "TEMP_session_gate_visit_histories_del" on public.visit_histories
  for delete to anon using ((select private.request_session_user_id()) is not null);
drop policy if exists open_access on public.visit_histories;

-- restaurant_requests · DELETE (FOR ALL 이 아니라 개별 정책이라 따로 잡는다)
drop policy if exists restaurant_requests_delete on public.restaurant_requests;
drop policy if exists "TEMP_session_gate_restaurant_requests_delete" on public.restaurant_requests;
create policy "TEMP_session_gate_restaurant_requests_delete" on public.restaurant_requests
  for delete to public using ((select private.request_session_user_id()) is not null);

-- restaurant_requests · INSERT (FOR ALL 이 아니라 개별 정책이라 따로 잡는다)
drop policy if exists restaurant_requests_insert on public.restaurant_requests;
drop policy if exists "TEMP_session_gate_restaurant_requests_insert" on public.restaurant_requests;
create policy "TEMP_session_gate_restaurant_requests_insert" on public.restaurant_requests
  for insert to public with check ((select private.request_session_user_id()) is not null);

-- restaurant_requests · UPDATE (FOR ALL 이 아니라 개별 정책이라 따로 잡는다)
drop policy if exists restaurant_requests_update on public.restaurant_requests;
drop policy if exists "TEMP_session_gate_restaurant_requests_update" on public.restaurant_requests;
create policy "TEMP_session_gate_restaurant_requests_update" on public.restaurant_requests
  for update to public using ((select private.request_session_user_id()) is not null) with check ((select private.request_session_user_id()) is not null);-- ═══ 검증 — 여기서 던지면 위가 전부 롤백된다 ═══
-- ⚠ 개수를 세지 않는다. **빠진 것을 이름으로 뱉게** 한다.
--   "28개 맞네" 는 엉뚱한 28개여도 통과한다 (오늘 시험에서 여러 번 데었다).
do $$
declare
  v_lost   text;
  v_open   text;
  v_gated  text;
begin
  -- (1) **표 × 명령 × 역할** anti-join.
  --     바꾸기 전에 되던 조합이 사라졌으면 그 화면이 조용히 죽는다.
  --     ⚠ 목록을 임시표에 찍어 두지 않는다. SQL Editor 가 문장 사이에
  --       임시표를 지키지 않는다 (여기서 데었다). baseline.sql 에서 뽑아 **박아 넣었다**
  --       — 141개 조합. baseline 이 바뀌면 이 목록도 다시 뽑아야 한다.
  --     `public` 은 anon·authenticated 를 포함하므로 덮는 것으로 친다.
  --     ⚠ 이건 '있나' 만 본다. 일부러 좁힌 것(app_users INSERT 를 관리자만 등)은
  --       정책이 남아 있으므로 통과한다 — 잡으려는 것은 **통째로 빠뜨린 것**이다.
  select string_agg(format('%s.%s(%s)', b.tablename, b.cmd, b.role), ', '
                    order by b.tablename, b.cmd, b.role)
    into v_lost
  from (values
    ('app_settings','DELETE','public'),
    ('app_settings','INSERT','public'),
    ('app_settings','SELECT','public'),
    ('app_settings','UPDATE','public'),
    ('app_users','DELETE','anon'),
    ('app_users','INSERT','anon'),
    ('app_users','SELECT','anon'),
    ('app_users','UPDATE','anon'),
    ('buildings','DELETE','anon'),
    ('buildings','INSERT','anon'),
    ('buildings','SELECT','anon'),
    ('buildings','UPDATE','anon'),
    ('calendar_events','DELETE','public'),
    ('calendar_events','INSERT','public'),
    ('calendar_events','SELECT','public'),
    ('calendar_events','UPDATE','public'),
    ('card_assignments','DELETE','anon'),
    ('card_assignments','INSERT','anon'),
    ('card_assignments','SELECT','anon'),
    ('card_assignments','UPDATE','anon'),
    ('card_boundaries','DELETE','anon'),
    ('card_boundaries','INSERT','anon'),
    ('card_boundaries','SELECT','anon'),
    ('card_boundaries','UPDATE','anon'),
    ('card_leader_assignments','DELETE','anon'),
    ('card_leader_assignments','INSERT','anon'),
    ('card_leader_assignments','SELECT','anon'),
    ('card_leader_assignments','UPDATE','anon'),
    ('cards','DELETE','anon'),
    ('cards','INSERT','anon'),
    ('cards','SELECT','anon'),
    ('cards','UPDATE','anon'),
    ('chat_message_signals','SELECT','anon'),
    ('chat_message_signals','SELECT','authenticated'),
    ('chat_read_status','SELECT','anon'),
    ('chat_read_status','SELECT','authenticated'),
    ('chat_room_mutes','DELETE','anon'),
    ('chat_room_mutes','DELETE','authenticated'),
    ('chat_room_mutes','INSERT','anon'),
    ('chat_room_mutes','INSERT','authenticated'),
    ('chat_room_mutes','SELECT','anon'),
    ('chat_room_mutes','SELECT','authenticated'),
    ('chat_room_mutes','UPDATE','anon'),
    ('chat_room_mutes','UPDATE','authenticated'),
    ('comments','DELETE','anon'),
    ('comments','DELETE','authenticated'),
    ('comments','INSERT','anon'),
    ('comments','INSERT','authenticated'),
    ('comments','SELECT','anon'),
    ('comments','SELECT','authenticated'),
    ('comments','UPDATE','anon'),
    ('comments','UPDATE','authenticated'),
    ('event_card_assignment_cards','DELETE','anon'),
    ('event_card_assignment_cards','INSERT','anon'),
    ('event_card_assignment_cards','SELECT','anon'),
    ('event_card_assignment_cards','UPDATE','anon'),
    ('event_card_assignments','DELETE','anon'),
    ('event_card_assignments','INSERT','anon'),
    ('event_card_assignments','SELECT','anon'),
    ('event_card_assignments','UPDATE','anon'),
    ('event_informal_assignments','DELETE','anon'),
    ('event_informal_assignments','INSERT','anon'),
    ('event_informal_assignments','SELECT','anon'),
    ('event_informal_assignments','UPDATE','anon'),
    ('event_participants','DELETE','public'),
    ('event_participants','INSERT','public'),
    ('event_participants','SELECT','public'),
    ('event_participants','UPDATE','public'),
    ('event_restaurant_assignments','DELETE','anon'),
    ('event_restaurant_assignments','INSERT','anon'),
    ('event_restaurant_assignments','SELECT','anon'),
    ('event_restaurant_assignments','UPDATE','anon'),
    ('informal_assets','DELETE','anon'),
    ('informal_assets','INSERT','anon'),
    ('informal_assets','SELECT','anon'),
    ('informal_assets','UPDATE','anon'),
    ('informal_groups','DELETE','anon'),
    ('informal_groups','DELETE','authenticated'),
    ('informal_groups','INSERT','anon'),
    ('informal_groups','INSERT','authenticated'),
    ('informal_groups','SELECT','anon'),
    ('informal_groups','SELECT','authenticated'),
    ('informal_groups','UPDATE','anon'),
    ('informal_groups','UPDATE','authenticated'),
    ('notices','DELETE','public'),
    ('notices','INSERT','public'),
    ('notices','SELECT','public'),
    ('notifications','SELECT','anon'),
    ('notifications','SELECT','authenticated'),
    ('phone_surveys','DELETE','anon'),
    ('phone_surveys','DELETE','authenticated'),
    ('phone_surveys','INSERT','anon'),
    ('phone_surveys','INSERT','authenticated'),
    ('phone_surveys','SELECT','anon'),
    ('phone_surveys','SELECT','authenticated'),
    ('phone_surveys','UPDATE','anon'),
    ('phone_surveys','UPDATE','authenticated'),
    ('regular_visits','DELETE','anon'),
    ('regular_visits','INSERT','anon'),
    ('regular_visits','SELECT','anon'),
    ('regular_visits','UPDATE','anon'),
    ('restaurant_requests','DELETE','public'),
    ('restaurant_requests','INSERT','public'),
    ('restaurant_requests','SELECT','public'),
    ('restaurant_requests','UPDATE','public'),
    ('return_visit_logs','DELETE','public'),
    ('return_visit_logs','INSERT','public'),
    ('return_visit_logs','SELECT','public'),
    ('return_visit_logs','UPDATE','public'),
    ('return_visits','DELETE','public'),
    ('return_visits','INSERT','public'),
    ('return_visits','SELECT','public'),
    ('return_visits','UPDATE','public'),
    ('review_tasks','DELETE','public'),
    ('review_tasks','INSERT','public'),
    ('review_tasks','SELECT','public'),
    ('review_tasks','UPDATE','public'),
    ('service_sessions','DELETE','anon'),
    ('service_sessions','INSERT','anon'),
    ('service_sessions','SELECT','anon'),
    ('service_sessions','UPDATE','anon'),
    ('service_suggestions','DELETE','public'),
    ('service_suggestions','INSERT','public'),
    ('service_suggestions','SELECT','public'),
    ('service_suggestions','UPDATE','public'),
    ('territory_regions','DELETE','anon'),
    ('territory_regions','DELETE','authenticated'),
    ('territory_regions','INSERT','anon'),
    ('territory_regions','INSERT','authenticated'),
    ('territory_regions','SELECT','anon'),
    ('territory_regions','SELECT','authenticated'),
    ('territory_regions','UPDATE','anon'),
    ('territory_regions','UPDATE','authenticated'),
    ('units','DELETE','anon'),
    ('units','INSERT','anon'),
    ('units','SELECT','anon'),
    ('units','UPDATE','anon'),
    ('visit_histories','DELETE','anon'),
    ('visit_histories','INSERT','anon'),
    ('visit_histories','SELECT','anon'),
    ('visit_histories','UPDATE','anon')
  ) as b(tablename, cmd, role)
  where not exists (
    select 1
    from pg_policies p
    cross join lateral unnest(
      case when p.cmd = 'ALL' then array['SELECT','INSERT','UPDATE','DELETE'] else array[p.cmd] end
    ) as c(cmd)
    cross join lateral unnest(p.roles) as r(role)
    where p.schemaname = 'public'
      and p.tablename = b.tablename
      and c.cmd = b.cmd
      and (r.role::text = b.role or r.role::text = 'public')
  );
  if v_lost is not null then
    raise exception E'전에 되던 것이 사라졌다 (표.명령(역할)): %\n  → 이 화면들이 조용히 죽는다', v_lost;
  end if;

  -- (2) 아직 남아 있는 열린 쓰기 정책 = 안 막힌 것
  select string_agg(format('%s.%s(%s)', tablename, policyname, cmd), ', ' order by tablename)
    into v_open
  from pg_policies
  where schemaname = 'public'
    and cmd in ('ALL', 'INSERT', 'UPDATE', 'DELETE')
    and policyname not like 'TEMP\_session\_gate\_%'
    and policyname <> 'app_private_settings_deny_all'
    -- 테스트 DB 에만 있는 실험용 표 (`npm run smoke:headers` 가 쓴다). 운영엔 없다.
    and tablename not like '\_probe%';
  if v_open is not null then
    raise exception '아직 열려 있는 쓰기 정책: %', v_open;
  end if;

  -- (3) ⚠ **SELECT 정책이 세션을 요구하면 Realtime 이 끊긴다.**
  --     WebSocket 에는 x-session-token 이 안 붙는다. 실수로 걸면 여기서 잡는다.
  select string_agg(format('%s.%s', tablename, policyname), ', ' order by tablename)
    into v_gated
  from pg_policies
  where schemaname = 'public'
    and cmd in ('SELECT', 'ALL')
    and coalesce(qual, '') like '%request_session%';
  if v_gated is not null then
    raise exception E'SELECT 정책이 세션을 요구한다: %\n  → WebSocket 은 헤더를 안 보내므로 Realtime 구독이 끊긴다', v_gated;
  end if;

  -- (4) 역할 상승 차단 트리거가 실제로 붙었나
  if not exists (select 1 from pg_trigger
                 where tgname = 'app_users_guard_privilege' and not tgisinternal) then
    raise exception 'app_users 역할 상승 차단 트리거가 없다';
  end if;

  raise notice '✅ 검증 통과 — 잃은 조합 0 · 열린 쓰기 0 · SELECT 에 세션관문 0 · 트리거 있음';
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
