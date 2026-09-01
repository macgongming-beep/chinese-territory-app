-- 채팅방 음소거는 사용자가 자기 행만 만들고 바꿀 수 있다.
-- SELECT는 기존 공개 범위를 유지한다. 앱은 event_id + 본인 user_id로만 읽고,
-- 알림 트리거도 이 표를 읽으므로 이번 단계에서 읽기 계약은 바꾸지 않는다.

drop policy if exists "TEMP_session_gate_chat_room_mutes_ins" on public.chat_room_mutes;
drop policy if exists "TEMP_session_gate_chat_room_mutes_upd" on public.chat_room_mutes;
drop policy if exists "TEMP_session_gate_chat_room_mutes_del" on public.chat_room_mutes;

drop policy if exists role_owner_chat_room_mutes_insert on public.chat_room_mutes;
create policy role_owner_chat_room_mutes_insert on public.chat_room_mutes
  for insert to anon, authenticated
  with check (user_id = (select private.request_session_user_id()));

drop policy if exists role_owner_chat_room_mutes_update on public.chat_room_mutes;
create policy role_owner_chat_room_mutes_update on public.chat_room_mutes
  for update to anon, authenticated
  using (user_id = (select private.request_session_user_id()))
  with check (user_id = (select private.request_session_user_id()));

drop policy if exists role_owner_chat_room_mutes_delete on public.chat_room_mutes;
create policy role_owner_chat_room_mutes_delete on public.chat_room_mutes
  for delete to anon, authenticated
  using (user_id = (select private.request_session_user_id()));

do $$
declare
  v_bad text;
begin
  select string_agg(policyname, ', ' order by policyname)
    into v_bad
  from pg_policies
  where schemaname='public' and tablename='chat_room_mutes'
    and cmd in ('INSERT','UPDATE','DELETE')
    and (
      policyname not like 'role\_owner\_chat\_room\_mutes\_%'
      or (coalesce(qual,'') || ' ' || coalesce(with_check,'')) !~ 'request_session_user_id'
    );
  if v_bad is not null then
    raise exception 'chat_room_mutes에 소유자 관문이 아닌 쓰기 정책이 남았습니다: %', v_bad;
  end if;

  if (select count(*) from pg_policies
      where schemaname='public' and tablename='chat_room_mutes'
        and policyname like 'role\_owner\_chat\_room\_mutes\_%') <> 3 then
    raise exception 'chat_room_mutes 소유자 정책 세 개가 모두 만들어지지 않았습니다';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='chat_room_mutes'
      and cmd in ('SELECT','ALL')
      and ('anon'=any(roles) or 'public'=any(roles))
      and coalesce(qual,'') !~ 'request_session|x-session-token'
  ) then
    raise exception 'chat_room_mutes 공개 SELECT 정책이 사라졌습니다';
  end if;
end $$;

notify pgrst, 'reload schema';
