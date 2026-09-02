-- 채팅방 음소거 여부도 본인만 읽는다.
-- notify_on_chat_message는 postgres 소유 security definer라 이 SELECT RLS에 영향받지 않고,
-- 앱은 이 표를 Realtime 구독하지 않으며 이미 event_id + currentUserId로만 조회한다.

drop policy if exists chat_room_mutes_select_all on public.chat_room_mutes;
drop policy if exists role_owner_chat_room_mutes_select on public.chat_room_mutes;
create policy role_owner_chat_room_mutes_select on public.chat_room_mutes
  for select to anon, authenticated
  using (user_id = (select private.request_session_user_id()));

do $$
begin
  if (select count(*) from pg_policies
      where schemaname='public' and tablename='chat_room_mutes'
        and policyname like 'role\_owner\_chat\_room\_mutes\_%') <> 4 then
    raise exception 'chat_room_mutes 소유자 정책 네 개가 모두 있어야 합니다';
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='chat_room_mutes'
      and cmd in ('SELECT','ALL')
      and coalesce(qual,'') !~ 'request_session_user_id'
  ) then
    raise exception 'chat_room_mutes에 소유자 조건 없는 SELECT 정책이 남았습니다';
  end if;
end $$;

notify pgrst, 'reload schema';
