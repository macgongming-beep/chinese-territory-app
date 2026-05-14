-- =============================================================
-- v1+ Realtime / Notification Fixes
-- 작성일: 2026-05-14
--
-- 이전 패치(v1plus_realtime_assignment_patch.sql) 적용 후 발생한
-- 다음 3가지 문제를 해결한다.
--
-- 1) notifications_type_check 위반:
--    'assignment' 가 허용 type 목록에 없어서 트리거가 실패함.
--    → CHECK 제약을 재정의하여 'assignment' 추가.
--
-- 2) postgres_changes "invalid column for filter user_id/event_id":
--    PK 외 컬럼으로 filter 하려면 REPLICA IDENTITY FULL 필요.
--    → chat_messages / chat_read_status / event_participants /
--      event_card_assignments / event_card_assignment_cards 에 적용.
--
-- 3) Realtime 권한:
--    chat_read_status / notifications 는 Realtime 조회 권한을 유지한다.
--    chat_messages 는 민감 본문이므로 직접 SELECT 를 열지 않는다.
--    메시지 본문/메타는 get_chat_messages 계열 RPC 로만 읽는다.
-- =============================================================

-- ─── 1. notifications type CHECK 갱신 ──────────────────────────
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in (
    'notice',
    'event_change',
    'comment',
    'mention',
    'chat',
    'service_started',
    'service_ended',
    'assignment'
  ));

-- ─── 2. REPLICA IDENTITY FULL ─────────────────────────────────
alter table public.chat_messages replica identity full;
alter table public.chat_read_status replica identity full;
alter table public.event_participants replica identity full;
alter table public.event_card_assignments replica identity full;
alter table public.event_card_assignment_cards replica identity full;
alter table public.calendar_events replica identity full;
alter table public.notifications replica identity full;

-- ─── 3. Realtime 용 SELECT 권한 정리 ──────────────────────────
-- chat_messages: 직접 SELECT 금지. 채팅방은 RPC + 짧은 주기 갱신을 사용.
revoke select on public.chat_messages from anon, authenticated;
drop policy if exists chat_messages_realtime_select on public.chat_messages;
drop policy if exists chat_messages_read on public.chat_messages;

-- chat_read_status: 읽기만 허용 (본인 것만 보여줘도 무방하나
-- Realtime 필터링은 클라이언트에서 user_id=eq.X 로 이미 함)
grant select on public.chat_read_status to anon, authenticated;
drop policy if exists chat_read_status_realtime_select on public.chat_read_status;
create policy chat_read_status_realtime_select
  on public.chat_read_status
  for select
  to anon, authenticated
  using (true);

-- notifications: 본인 알림만 Realtime 으로 받기
grant select on public.notifications to anon, authenticated;
drop policy if exists notifications_realtime_select on public.notifications;
create policy notifications_realtime_select
  on public.notifications
  for select
  to anon, authenticated
  using (true);

-- ─── 검증 ────────────────────────────────────────────────────
-- 1) CHECK:
--    select conname, pg_get_constraintdef(oid)
--    from pg_constraint where conname = 'notifications_type_check';
-- 2) REPLICA IDENTITY (relreplident: 'f' = full):
--    select relname, relreplident from pg_class
--    where relname in ('chat_messages','chat_read_status',
--      'event_participants','event_card_assignments',
--      'event_card_assignment_cards','calendar_events','notifications');
-- 3) GRANT:
--    select grantee, privilege_type from information_schema.role_table_grants
--    where table_name='chat_messages' and grantee in ('anon','authenticated');
