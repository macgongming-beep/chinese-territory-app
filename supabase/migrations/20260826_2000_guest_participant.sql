-- 게스트 참가자 — 앱 계정이 없는 사람도 봉사에 넣는다
--
-- 왜: 손님이 봉사에 함께 나오는 일이 있는데, 지금은 명단에 넣을 방법이 없다.
--   예전 PC 화면(DesktopLeaderAssignment)에는 있었지만 그 기기의 임시 저장에만
--   남아서, 공유해도 다른 사람 화면에는 안 보였다.
--
-- event_participants.user_name 은 app_users 를 참조하지 않는다(그냥 text).
-- 그래서 계정 없는 이름도 넣을 수 있고, role 값만 늘리면 된다.

alter table public.event_participants
  drop constraint if exists event_participants_role_check;

alter table public.event_participants
  add constraint event_participants_role_check
  check (role = any (array['신청'::text, '입명'::text, '게스트'::text]));

comment on column public.event_participants.role is
  '신청 = 본인이 신청 · 입명 = 관리자가 넣음 · 게스트 = 앱 계정이 없는 손님';
