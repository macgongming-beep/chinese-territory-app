-- ============================================================
-- V1+ Chat read security patch
-- - chat_messages 직접 SELECT 차단
-- - 세션 토큰 기반 RPC로 채팅 메시지/메타 조회
-- ============================================================

-- 기존 공개 읽기 정책 제거
revoke select on public.chat_messages from anon, authenticated;
drop policy if exists open_access on public.chat_messages;
drop policy if exists chat_messages_read on public.chat_messages;

-- 참여 권한 확인 헬퍼
create or replace function public.can_access_chat_event(
  p_user_id integer,
  p_event_id integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_name text;
  v_role text;
begin
  select name, role
  into v_user_name, v_role
  from public.app_users
  where id = p_user_id;

  if v_user_name is null then
    return false;
  end if;

  if v_role in ('admin', 'developer') then
    return true;
  end if;

  if exists (
    select 1
    from public.event_participants ep
    where ep.event_id = p_event_id
      and ep.user_name = v_user_name
  ) then
    return true;
  end if;

  if exists (
    select 1
    from public.calendar_events ce
    where ce.id = p_event_id
      and ce.leader_name = v_user_name
  ) then
    return true;
  end if;

  return false;
end;
$$;

grant execute on function public.can_access_chat_event(integer, integer) to anon, authenticated;

drop function if exists public.get_chat_messages(uuid, integer);
create function public.get_chat_messages(
  p_token uuid,
  p_event_id integer
)
returns table (
  id bigint,
  event_id integer,
  author_id integer,
  author_name text,
  message_type text,
  content text,
  image_url text,
  image_expired boolean,
  mention_ids integer[],
  mention_names text[],
  created_at timestamptz,
  deleted_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id integer;
begin
  v_user_id := public.verify_session(p_token);

  if not public.can_access_chat_event(v_user_id, p_event_id) then
    raise exception '채팅방 참여자가 아닙니다';
  end if;

  return query
  select
    cm.id,
    cm.event_id,
    cm.author_id,
    cm.author_name,
    cm.message_type,
    cm.content,
    cm.image_url,
    cm.image_expired,
    cm.mention_ids,
    cm.mention_names,
    cm.created_at,
    cm.deleted_at
  from public.chat_messages cm
  where cm.event_id = p_event_id
    and cm.deleted_at is null
  order by cm.created_at asc;
end;
$$;

grant execute on function public.get_chat_messages(uuid, integer) to anon, authenticated;

drop function if exists public.get_chat_message_meta(uuid, integer[]);
create function public.get_chat_message_meta(
  p_token uuid,
  p_event_ids integer[]
)
returns table (
  event_id integer,
  created_at timestamptz,
  author_id integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id integer;
begin
  v_user_id := public.verify_session(p_token);

  if coalesce(array_length(p_event_ids, 1), 0) = 0 then
    return;
  end if;

  return query
  select
    cm.event_id,
    cm.created_at,
    cm.author_id
  from public.chat_messages cm
  where cm.event_id = any(p_event_ids)
    and cm.deleted_at is null
    and public.can_access_chat_event(v_user_id, cm.event_id)
  order by cm.created_at desc
  limit 1000;
end;
$$;

grant execute on function public.get_chat_message_meta(uuid, integer[]) to anon, authenticated;

drop function if exists public.get_chat_message_previews(uuid, integer[]);
create function public.get_chat_message_previews(
  p_token uuid,
  p_event_ids integer[]
)
returns table (
  id bigint,
  event_id integer,
  author_name text,
  message_type text,
  content text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id integer;
begin
  v_user_id := public.verify_session(p_token);

  if coalesce(array_length(p_event_ids, 1), 0) = 0 then
    return;
  end if;

  return query
  select
    cm.id,
    cm.event_id,
    cm.author_name,
    cm.message_type,
    cm.content,
    cm.created_at
  from public.chat_messages cm
  where cm.event_id = any(p_event_ids)
    and cm.deleted_at is null
    and public.can_access_chat_event(v_user_id, cm.event_id)
  order by cm.created_at desc
  limit 200;
end;
$$;

grant execute on function public.get_chat_message_previews(uuid, integer[]) to anon, authenticated;
