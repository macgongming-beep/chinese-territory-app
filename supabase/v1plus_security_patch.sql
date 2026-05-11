-- ============================================================
-- V1+ 보안 패치 (코덱스 P1 리뷰 반영)
--
-- 적용 순서: v1plus_schema.sql / v1plus_rpc.sql 먼저 적용 후 이 파일 실행
--
-- 포함:
--   1. send_chat_image RPC (사진 첨부도 토큰 검증 + 잠금 체크)
--   2. create_system_chat_message RPC + chat_messages 쓰기 잠금
--   3. open_access 테이블 잠금 + RPC 추가
--      - push_subscriptions
--      - notifications
--      - notification_preferences
--      - chat_read_status
-- ============================================================

-- ─── 1. send_chat_image RPC ──────────────────────────────────
create or replace function public.send_chat_image(
  p_token uuid,
  p_event_id integer,
  p_image_url text,
  p_caption text default null,
  p_mention_ids integer[] default '{}',
  p_mention_names text[] default '{}'
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_author_id integer;
  v_author_name text;
  v_role text;
  v_message_id bigint;
  v_caption text;
begin
  v_author_id := public.verify_session(p_token);

  select name, role
  into v_author_name, v_role
  from public.app_users
  where id = v_author_id;

  if p_image_url is null or length(p_image_url) = 0 then
    raise exception '이미지 URL이 비어있습니다';
  end if;

  if public.is_chat_locked(p_event_id) then
    raise exception '채팅방이 잠겼습니다 (모든 세션 종료 후 1주일 경과)';
  end if;

  if v_role not in ('leader', 'admin', 'developer')
    and not exists (
      select 1
      from public.event_participants ep
      where ep.event_id = p_event_id
        and ep.user_name = v_author_name
    )
  then
    raise exception '채팅방 참여자가 아닙니다';
  end if;

  v_caption := nullif(trim(coalesce(p_caption, '')), '');

  insert into public.chat_messages (
    event_id,
    author_id,
    author_name,
    message_type,
    content,
    image_url,
    image_expires_at,
    mention_ids,
    mention_names
  )
  values (
    p_event_id,
    v_author_id,
    v_author_name,
    'image',
    v_caption,
    p_image_url,
    now() + interval '180 days',
    coalesce(p_mention_ids, '{}'),
    coalesce(p_mention_names, '{}')
  )
  returning id into v_message_id;

  return v_message_id;
end;
$$;

grant execute on function public.send_chat_image(uuid, integer, text, text, integer[], text[]) to anon, authenticated;


-- ─── 1-b. 시스템 채팅 RPC + chat_messages 직접 쓰기 잠금 ───────
create or replace function public.create_system_chat_message(
  p_token uuid,
  p_event_id integer,
  p_content text
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id integer;
  v_actor_name text;
  v_actor_role text;
  v_message_id bigint;
begin
  v_actor_id := public.verify_session(p_token);

  select name, role
  into v_actor_name, v_actor_role
  from public.app_users
  where id = v_actor_id;

  if p_event_id is null then
    return null;
  end if;

  if nullif(trim(coalesce(p_content, '')), '') is null then
    raise exception '시스템 메시지가 비어있습니다';
  end if;

  if public.is_chat_locked(p_event_id) then
    raise exception '채팅방이 잠겼습니다 (모든 세션 종료 후 1주일 경과)';
  end if;

  if v_actor_role not in ('leader', 'admin', 'developer')
    and not exists (
      select 1
      from public.event_participants ep
      where ep.event_id = p_event_id
        and ep.user_name = v_actor_name
    )
  then
    raise exception '채팅방 참여자가 아닙니다';
  end if;

  insert into public.chat_messages (
    event_id,
    author_id,
    author_name,
    message_type,
    content,
    mention_ids,
    mention_names
  )
  values (
    p_event_id,
    null,
    '시스템',
    'system',
    trim(p_content),
    '{}',
    '{}'
  )
  returning id into v_message_id;

  return v_message_id;
end;
$$;

grant execute on function public.create_system_chat_message(uuid, integer, text) to anon, authenticated;

-- 채팅 메시지는 클라이언트에서 직접 읽기만 허용하고 쓰기는 RPC로만 허용한다.
revoke all on public.chat_messages from anon, authenticated;
revoke usage, select on sequence public.chat_messages_id_seq from anon, authenticated;
drop policy if exists open_access on public.chat_messages;
drop policy if exists chat_messages_read on public.chat_messages;
create policy chat_messages_read on public.chat_messages
for select to anon, authenticated
using (true);
grant select on public.chat_messages to anon, authenticated;


-- ─── 2. push_subscriptions 잠금 + RPC ────────────────────────
revoke all on public.push_subscriptions from anon, authenticated;
drop policy if exists open_access on public.push_subscriptions;

-- 본인 구독 등록/갱신
create or replace function public.upsert_push_subscription(
  p_token uuid,
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_device_label text default null
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id integer;
  v_id bigint;
begin
  v_user_id := public.verify_session(p_token);

  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, device_label, last_seen_at)
  values (v_user_id, p_endpoint, p_p256dh, p_auth, p_device_label, now())
  on conflict (endpoint) do update
  set
    user_id = excluded.user_id,
    p256dh = excluded.p256dh,
    auth = excluded.auth,
    device_label = excluded.device_label,
    updated_at = now(),
    last_seen_at = now()
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.upsert_push_subscription(uuid, text, text, text, text) to anon, authenticated;

-- 본인 구독 해지 (endpoint 기준)
create or replace function public.delete_push_subscription(
  p_token uuid,
  p_endpoint text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id integer;
begin
  v_user_id := public.verify_session(p_token);

  delete from public.push_subscriptions
  where endpoint = p_endpoint and user_id = v_user_id;
end;
$$;

grant execute on function public.delete_push_subscription(uuid, text) to anon, authenticated;


-- ─── 3. notifications 잠금 + RPC ─────────────────────────────
revoke all on public.notifications from anon, authenticated;
drop policy if exists open_access on public.notifications;

-- 본인 알림 목록 조회
create or replace function public.get_my_notifications(
  p_token uuid,
  p_limit integer default 50
)
returns setof public.notifications
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id integer;
begin
  v_user_id := public.verify_session(p_token);

  return query
  select * from public.notifications
  where user_id = v_user_id
  order by created_at desc
  limit p_limit;
end;
$$;

grant execute on function public.get_my_notifications(uuid, integer) to anon, authenticated;

-- 단일 알림 읽음 처리
create or replace function public.mark_notification_read(
  p_token uuid,
  p_notification_id bigint
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id integer;
begin
  v_user_id := public.verify_session(p_token);

  update public.notifications
  set is_read = true
  where id = p_notification_id and user_id = v_user_id;
end;
$$;

grant execute on function public.mark_notification_read(uuid, bigint) to anon, authenticated;

-- 모두 읽음
create or replace function public.mark_all_notifications_read(p_token uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id integer;
  v_count integer;
begin
  v_user_id := public.verify_session(p_token);

  update public.notifications
  set is_read = true
  where user_id = v_user_id and is_read = false;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

grant execute on function public.mark_all_notifications_read(uuid) to anon, authenticated;


-- ─── 4. notification_preferences 잠금 + RPC ──────────────────
revoke all on public.notification_preferences from anon, authenticated;
drop policy if exists open_access on public.notification_preferences;

create or replace function public.get_my_notification_prefs(p_token uuid)
returns public.notification_preferences
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id integer;
  v_row public.notification_preferences%rowtype;
begin
  v_user_id := public.verify_session(p_token);

  select * into v_row
  from public.notification_preferences
  where user_id = v_user_id;

  if not found then
    -- 없으면 기본값으로 생성 후 반환
    insert into public.notification_preferences (user_id) values (v_user_id)
    returning * into v_row;
  end if;

  return v_row;
end;
$$;

grant execute on function public.get_my_notification_prefs(uuid) to anon, authenticated;

create or replace function public.update_my_notification_prefs(
  p_token uuid,
  p_push_new_notice boolean,
  p_push_event_change boolean,
  p_push_comment boolean,
  p_push_chat boolean,
  p_push_mention boolean,
  p_push_service_status boolean,
  p_quiet_hours_start time default null,
  p_quiet_hours_end time default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id integer;
begin
  v_user_id := public.verify_session(p_token);

  insert into public.notification_preferences (
    user_id,
    push_new_notice,
    push_event_change,
    push_comment,
    push_chat,
    push_mention,
    push_service_status,
    quiet_hours_start,
    quiet_hours_end,
    updated_at
  )
  values (
    v_user_id,
    p_push_new_notice,
    p_push_event_change,
    p_push_comment,
    p_push_chat,
    p_push_mention,
    p_push_service_status,
    p_quiet_hours_start,
    p_quiet_hours_end,
    now()
  )
  on conflict (user_id) do update
  set
    push_new_notice = excluded.push_new_notice,
    push_event_change = excluded.push_event_change,
    push_comment = excluded.push_comment,
    push_chat = excluded.push_chat,
    push_mention = excluded.push_mention,
    push_service_status = excluded.push_service_status,
    quiet_hours_start = excluded.quiet_hours_start,
    quiet_hours_end = excluded.quiet_hours_end,
    updated_at = now();
end;
$$;

grant execute on function public.update_my_notification_prefs(uuid, boolean, boolean, boolean, boolean, boolean, boolean, time, time) to anon, authenticated;


-- ─── 5. chat_read_status 잠금 + RPC ──────────────────────────
revoke all on public.chat_read_status from anon, authenticated;
drop policy if exists open_access on public.chat_read_status;

-- 본인 읽음 시각 갱신
create or replace function public.update_chat_read(
  p_token uuid,
  p_event_id integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id integer;
begin
  v_user_id := public.verify_session(p_token);

  insert into public.chat_read_status (event_id, user_id, last_read_at)
  values (p_event_id, v_user_id, now())
  on conflict (event_id, user_id) do update
  set last_read_at = now();
end;
$$;

grant execute on function public.update_chat_read(uuid, integer) to anon, authenticated;

-- 본인의 모든 채팅 읽음 상태 조회
create or replace function public.get_my_chat_reads(p_token uuid)
returns setof public.chat_read_status
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id integer;
begin
  v_user_id := public.verify_session(p_token);

  return query
  select * from public.chat_read_status
  where user_id = v_user_id;
end;
$$;

grant execute on function public.get_my_chat_reads(uuid) to anon, authenticated;
