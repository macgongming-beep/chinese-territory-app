-- ===============================================================
-- V1+ Day 1~2 RPC + notification triggers
-- 실행 순서:
--   1) v1plus_schema.sql
--   2) v1plus_rpc.sql
-- ===============================================================

create extension if not exists pgcrypto;

-- ─── auth_login: 승인/활성 체크 + 세션 토큰 발급 ────────────────
drop function if exists public.auth_login(text, text);
drop function if exists public.auth_login(text, text, text, text);

create function public.auth_login(
  p_login_id text,
  p_pin text,
  p_device_label text default null,
  p_user_agent text default null
)
returns table (
  token uuid,
  id integer,
  name text,
  login_id text,
  role text,
  approval_status text
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_id integer;
  v_name text;
  v_login_id text;
  v_role text;
  v_pin text;
  v_approval_status text;
  v_is_active boolean;
  v_token uuid;
begin
  select
    u.id,
    u.name,
    coalesce(u.login_id, u.name),
    u.role,
    u.pin,
    coalesce(u.approval_status, 'approved'),
    coalesce(u.is_active, true)
  into
    v_id,
    v_name,
    v_login_id,
    v_role,
    v_pin,
    v_approval_status,
    v_is_active
  from public.app_users u
  where u.login_id = p_login_id
     or (u.login_id is null and u.name = p_login_id)
  limit 1;

  if v_id is null then
    return;
  end if;

  if v_pin is null or v_pin <> extensions.crypt(p_pin, v_pin) then
    return;
  end if;

  -- 기존 클라이언트가 approval_status를 보고 안내를 띄우므로,
  -- 승인대기/차단은 예외 대신 토큰 없이 상태만 반환한다.
  if v_approval_status <> 'approved' or v_is_active is false then
    return query
    select
      null::uuid,
      v_id,
      v_name,
      v_login_id,
      v_role,
      case when v_is_active is false then 'blocked' else v_approval_status end;
    return;
  end if;

  insert into public.auth_sessions (user_id, device_label, user_agent)
  values (v_id, nullif(trim(coalesce(p_device_label, '')), ''), nullif(trim(coalesce(p_user_agent, '')), ''))
  returning auth_sessions.token into v_token;

  update public.app_users
  set last_login_at = now()
  where app_users.id = v_id;

  if to_regclass('public.login_logs') is not null then
    insert into public.login_logs (user_id, logged_in_at)
    values (v_id, now());
  end if;

  return query
  select v_token, v_id, v_name, v_login_id, v_role, v_approval_status;
end;
$$;

grant execute on function public.auth_login(text, text, text, text) to anon, authenticated;

-- ─── verify_session: 모든 민감 RPC 공통 토큰 검증 ─────────────
create or replace function public.verify_session(p_token uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id integer;
  v_is_active boolean;
  v_approval_status text;
begin
  if p_token is null then
    raise exception '세션 토큰이 없습니다';
  end if;

  select s.user_id, coalesce(u.is_active, true), coalesce(u.approval_status, 'approved')
  into v_user_id, v_is_active, v_approval_status
  from public.auth_sessions s
  join public.app_users u on u.id = s.user_id
  where s.token = p_token
    and s.expires_at > now();

  if v_user_id is null then
    raise exception '세션 만료. 다시 로그인해주세요';
  end if;

  if v_is_active is false then
    delete from public.auth_sessions where token = p_token;
    raise exception '비활성화된 계정입니다';
  end if;

  if v_approval_status is distinct from 'approved' then
    delete from public.auth_sessions where token = p_token;
    raise exception '승인되지 않은 계정입니다';
  end if;

  update public.auth_sessions
  set last_used_at = now()
  where token = p_token;

  return v_user_id;
end;
$$;

grant execute on function public.verify_session(uuid) to anon, authenticated;

-- ─── 채팅 잠금: 모든 봉사 세션 종료 후 7일 지나면 잠금 ───────
create or replace function public.is_chat_locked(p_event_id integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session_count integer;
  v_has_active boolean;
  v_last_ended timestamptz;
begin
  select count(*)
  into v_session_count
  from public.service_sessions
  where calendar_event_id = p_event_id;

  -- 일정만 있고 봉사를 시작한 적이 없으면 채팅은 계속 활성.
  if coalesce(v_session_count, 0) = 0 then
    return false;
  end if;

  select exists (
    select 1
    from public.service_sessions
    where calendar_event_id = p_event_id
      and ended_at is null
  )
  into v_has_active;

  if v_has_active then
    return false;
  end if;

  select max(ended_at)
  into v_last_ended
  from public.service_sessions
  where calendar_event_id = p_event_id
    and ended_at is not null;

  return v_last_ended is not null and v_last_ended < now() - interval '7 days';
end;
$$;

grant execute on function public.is_chat_locked(integer) to anon, authenticated;

-- ─── send_chat_message: 토큰 기반 채팅 작성 ───────────────────
create or replace function public.send_chat_message(
  p_token uuid,
  p_event_id integer,
  p_content text,
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
begin
  v_author_id := public.verify_session(p_token);

  select name, role
  into v_author_name, v_role
  from public.app_users
  where id = v_author_id;

  if nullif(trim(coalesce(p_content, '')), '') is null then
    raise exception '메시지를 입력해주세요';
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
    v_author_id,
    v_author_name,
    'text',
    trim(p_content),
    coalesce(p_mention_ids, '{}'),
    coalesce(p_mention_names, '{}')
  )
  returning id into v_message_id;

  return v_message_id;
end;
$$;

grant execute on function public.send_chat_message(uuid, integer, text, integer[], text[]) to anon, authenticated;

-- ─── service_logs 조회: 관리자/개발자 전체, 인도자는 담당 카드만 ─
create or replace function public.get_service_logs(
  p_token uuid,
  p_filter_event_id integer default null,
  p_filter_card_id integer default null,
  p_limit integer default 100
)
returns setof public.service_logs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id integer;
  v_user_name text;
  v_role text;
begin
  v_user_id := public.verify_session(p_token);

  select name, role
  into v_user_name, v_role
  from public.app_users
  where id = v_user_id;

  if v_role not in ('leader', 'admin', 'developer') then
    raise exception '권한 없음';
  end if;

  return query
  select sl.*
  from public.service_logs sl
  where (p_filter_event_id is null or sl.event_id = p_filter_event_id)
    and (p_filter_card_id is null or sl.card_id = p_filter_card_id)
    and (
      v_role in ('admin', 'developer')
      or (
        v_role = 'leader'
        and sl.card_id in (
          select cla.card_id
          from public.card_leader_assignments cla
          where cla.user_name = v_user_name
        )
      )
    )
  order by sl.created_at desc
  limit greatest(1, least(coalesce(p_limit, 100), 500));
end;
$$;

grant execute on function public.get_service_logs(uuid, integer, integer, integer) to anon, authenticated;

-- ─── service_logs 입력: actor는 토큰에서만 추출 ────────────────
create or replace function public.log_service_action(
  p_token uuid,
  p_session_id integer default null,
  p_event_id integer default null,
  p_card_id integer default null,
  p_action text default null,
  p_target_type text default null,
  p_target_id integer default null,
  p_details jsonb default '{}'::jsonb
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id integer;
  v_actor_name text;
  v_event_title text;
  v_event_date date;
  v_card_name text;
  v_log_id bigint;
begin
  v_actor_id := public.verify_session(p_token);

  select name
  into v_actor_name
  from public.app_users
  where id = v_actor_id;

  if nullif(trim(coalesce(p_action, '')), '') is null then
    raise exception '로그 액션이 없습니다';
  end if;

  if p_event_id is not null then
    select title, event_date
    into v_event_title, v_event_date
    from public.calendar_events
    where id = p_event_id;
  end if;

  if p_card_id is not null then
    select name
    into v_card_name
    from public.cards
    where id = p_card_id;
  end if;

  insert into public.service_logs (
    session_id,
    event_id,
    event_title,
    event_date,
    card_id,
    card_name,
    actor_id,
    actor_name,
    action,
    target_type,
    target_id,
    details
  )
  values (
    p_session_id,
    p_event_id,
    v_event_title,
    v_event_date,
    p_card_id,
    v_card_name,
    v_actor_id,
    v_actor_name,
    trim(p_action),
    nullif(trim(coalesce(p_target_type, '')), ''),
    p_target_id,
    coalesce(p_details, '{}'::jsonb)
  )
  returning id into v_log_id;

  return v_log_id;
end;
$$;

grant execute on function public.log_service_action(uuid, integer, integer, integer, text, text, integer, jsonb) to anon, authenticated;

-- ─── 알림 공통 INSERT 헬퍼 ────────────────────────────────────
create or replace function public.insert_notifications(
  p_user_ids integer[],
  p_type text,
  p_title text,
  p_body text default null,
  p_link text default null,
  p_related_id integer default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inserted integer;
begin
  if p_user_ids is null or cardinality(p_user_ids) = 0 then
    return 0;
  end if;

  with recipients as (
    select distinct unnest(p_user_ids) as user_id
  ),
  filtered as (
    select r.user_id
    from recipients r
    join public.app_users u on u.id = r.user_id
    left join public.notification_preferences pref on pref.user_id = r.user_id
    where coalesce(u.is_active, true) is true
      and coalesce(u.approval_status, 'approved') = 'approved'
      and case p_type
        when 'notice' then coalesce(pref.push_new_notice, true)
        when 'event_change' then coalesce(pref.push_event_change, true)
        when 'comment' then coalesce(pref.push_comment, true)
        when 'mention' then coalesce(pref.push_mention, true)
        when 'chat' then coalesce(pref.push_chat, true)
        when 'service_started' then coalesce(pref.push_service_status, true)
        when 'service_ended' then coalesce(pref.push_service_status, true)
        else true
      end
  ),
  inserted as (
    insert into public.notifications (user_id, type, title, body, link, related_id)
    select user_id, p_type, p_title, p_body, p_link, p_related_id
    from filtered
    returning 1
  )
  select count(*) into v_inserted from inserted;

  return coalesce(v_inserted, 0);
end;
$$;

revoke all on function public.insert_notifications(integer[], text, text, text, text, integer) from anon, authenticated;

-- Edge Function 푸시 발송은 설정값이 있을 때만 시도한다.
-- 설정 예:
--   alter database postgres set app.push_edge_function_url = 'https://.../functions/v1/send-push';
--   alter database postgres set app.push_edge_function_key = '...';
create or replace function public.dispatch_push_notification(
  p_user_ids integer[],
  p_type text,
  p_title text,
  p_body text default null,
  p_link text default null,
  p_related_id integer default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text;
  v_key text;
begin
  v_url := nullif(current_setting('app.push_edge_function_url', true), '');
  v_key := nullif(current_setting('app.push_edge_function_key', true), '');

  if v_url is null or v_key is null or p_user_ids is null or cardinality(p_user_ids) = 0 then
    return;
  end if;

  begin
    perform net.http_post(
      url := v_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_key
      ),
      body := jsonb_build_object(
        'recipient_ids', p_user_ids,
        'type', p_type,
        'title', p_title,
        'body', p_body,
        'link', p_link,
        'related_id', p_related_id
      )
    );
  exception
    when others then
      raise notice 'push dispatch skipped: %', sqlerrm;
  end;
end;
$$;

revoke all on function public.dispatch_push_notification(integer[], text, text, text, text, integer) from anon, authenticated;

-- ─── 댓글 대상 작성자 찾기 ───────────────────────────────────
create or replace function public.get_comment_target_author_id(
  p_target_type text,
  p_target_id integer
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_author_name text;
  v_author_id integer;
begin
  if p_target_type = 'notice' and to_regclass('public.notices') is not null then
    begin
      execute 'select author from public.notices where id = $1'
      into v_author_name
      using p_target_id;
    exception
      when undefined_column then
        v_author_name := null;
    end;
  elsif p_target_type = 'calendar_event' then
    select leader_name
    into v_author_name
    from public.calendar_events
    where id = p_target_id;
  end if;

  if nullif(trim(coalesce(v_author_name, '')), '') is not null then
    select id
    into v_author_id
    from public.app_users
    where name = v_author_name
    limit 1;
  end if;

  return v_author_id;
end;
$$;

revoke all on function public.get_comment_target_author_id(text, integer) from anon, authenticated;

-- ─── 댓글 알림 트리거 ────────────────────────────────────────
create or replace function public.notify_on_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target_author_id integer;
  v_recipient_ids integer[];
  v_link text;
  v_type text;
begin
  v_target_author_id := public.get_comment_target_author_id(new.target_type, new.target_id);

  select array_agg(distinct recipient_id)
  into v_recipient_ids
  from (
    select unnest(coalesce(new.mention_ids, '{}'::integer[])) as recipient_id
    union all
    select v_target_author_id
  ) recipients
  where recipient_id is not null
    and recipient_id is distinct from new.author_id;

  if v_recipient_ids is null or cardinality(v_recipient_ids) = 0 then
    return new;
  end if;

  v_link := case new.target_type
    when 'notice' then '/notices/' || new.target_id
    when 'calendar_event' then '/calendar/events/' || new.target_id
    else null
  end;

  v_type := case
    when cardinality(coalesce(new.mention_ids, '{}'::integer[])) > 0 then 'mention'
    else 'comment'
  end;

  perform public.insert_notifications(
    v_recipient_ids,
    v_type,
    case when v_type = 'mention' then '댓글에서 언급됨' else '새 댓글' end,
    new.author_name || ': ' || left(new.content, 50),
    v_link,
    new.id::integer
  );

  perform public.dispatch_push_notification(
    v_recipient_ids,
    v_type,
    case when v_type = 'mention' then '댓글에서 언급됨' else '새 댓글' end,
    new.author_name || ': ' || left(new.content, 50),
    v_link,
    new.id::integer
  );

  return new;
end;
$$;

drop trigger if exists on_comment_insert on public.comments;
create trigger on_comment_insert
after insert on public.comments
for each row execute function public.notify_on_comment();

-- ─── 채팅 알림 트리거 ────────────────────────────────────────
create or replace function public.notify_on_chat_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recipient_ids integer[];
  v_body text;
  v_link text;
begin
  select array_agg(distinct recipient_id)
  into v_recipient_ids
  from (
    select u.id as recipient_id
    from public.event_participants ep
    join public.app_users u on u.name = ep.user_name
    where ep.event_id = new.event_id

    union

    select u.id as recipient_id
    from public.calendar_events ce
    join public.app_users u on u.name = ce.leader_name
    where ce.id = new.event_id

    union

    select unnest(coalesce(new.mention_ids, '{}'::integer[])) as recipient_id
  ) recipients
  where recipient_id is not null
    and recipient_id is distinct from new.author_id
    and not exists (
      select 1
      from public.chat_room_mutes m
      where m.event_id = new.event_id
        and m.user_id = recipient_id
    );

  if v_recipient_ids is null or cardinality(v_recipient_ids) = 0 then
    return new;
  end if;

  v_body := new.author_name || ': ' || left(coalesce(new.content, '사진 메시지'), 50);
  v_link := '/calendar/events/' || new.event_id || '/chat';

  perform public.insert_notifications(
    v_recipient_ids,
    case when cardinality(coalesce(new.mention_ids, '{}'::integer[])) > 0 then 'mention' else 'chat' end,
    case when cardinality(coalesce(new.mention_ids, '{}'::integer[])) > 0 then '채팅에서 언급됨' else '새 채팅 메시지' end,
    v_body,
    v_link,
    new.id::integer
  );

  perform public.dispatch_push_notification(
    v_recipient_ids,
    case when cardinality(coalesce(new.mention_ids, '{}'::integer[])) > 0 then 'mention' else 'chat' end,
    case when cardinality(coalesce(new.mention_ids, '{}'::integer[])) > 0 then '채팅에서 언급됨' else '새 채팅 메시지' end,
    v_body,
    v_link,
    new.id::integer
  );

  return new;
end;
$$;

drop trigger if exists on_chat_message_insert on public.chat_messages;
create trigger on_chat_message_insert
after insert on public.chat_messages
for each row execute function public.notify_on_chat_message();

-- ─── 일정 변경 알림 트리거 ───────────────────────────────────
create or replace function public.notify_on_calendar_event_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recipient_ids integer[];
  v_link text;
begin
  if old.event_date is not distinct from new.event_date
    and old.time is not distinct from new.time
    and old.place is not distinct from new.place
    and old.meeting_map_url is not distinct from new.meeting_map_url
    and old.leader_name is not distinct from new.leader_name
    and old.title is not distinct from new.title
  then
    return new;
  end if;

  select array_agg(distinct recipient_id)
  into v_recipient_ids
  from (
    select u.id as recipient_id
    from public.event_participants ep
    join public.app_users u on u.name = ep.user_name
    where ep.event_id = new.id

    union

    select u.id as recipient_id
    from public.app_users u
    where u.name = new.leader_name
  ) recipients
  where recipient_id is not null;

  if v_recipient_ids is null or cardinality(v_recipient_ids) = 0 then
    return new;
  end if;

  v_link := '/calendar/events/' || new.id;

  perform public.insert_notifications(
    v_recipient_ids,
    'event_change',
    '일정이 변경되었습니다',
    new.title || ' · ' || new.event_date || ' ' || new.time,
    v_link,
    new.id
  );

  perform public.dispatch_push_notification(
    v_recipient_ids,
    'event_change',
    '일정이 변경되었습니다',
    new.title || ' · ' || new.event_date || ' ' || new.time,
    v_link,
    new.id
  );

  return new;
end;
$$;

drop trigger if exists on_calendar_event_update on public.calendar_events;
create trigger on_calendar_event_update
after update of event_date, time, place, meeting_map_url, leader_name, title
on public.calendar_events
for each row execute function public.notify_on_calendar_event_change();

-- ─── 공지 생성 알림 트리거 ───────────────────────────────────
create or replace function public.notify_on_notice_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_author_id integer;
  v_recipient_ids integer[];
  v_title text;
begin
  begin
    select id
    into v_author_id
    from public.app_users
    where name = new.author
    limit 1;
  exception
    when undefined_column then
      v_author_id := null;
  end;

  select array_agg(id)
  into v_recipient_ids
  from public.app_users
  where coalesce(is_active, true) is true
    and coalesce(approval_status, 'approved') = 'approved'
    and id is distinct from v_author_id;

  if v_recipient_ids is null or cardinality(v_recipient_ids) = 0 then
    return new;
  end if;

  begin
    v_title := coalesce(new.title, '새 공지');
  exception
    when undefined_column then
      v_title := '새 공지';
  end;

  perform public.insert_notifications(
    v_recipient_ids,
    'notice',
    '새 공지',
    v_title,
    '/notices/' || new.id,
    new.id::integer
  );

  perform public.dispatch_push_notification(
    v_recipient_ids,
    'notice',
    '새 공지',
    v_title,
    '/notices/' || new.id,
    new.id::integer
  );

  return new;
end;
$$;

do $do$
begin
  if to_regclass('public.notices') is not null then
    execute 'drop trigger if exists on_notice_insert on public.notices';
    execute 'create trigger on_notice_insert after insert on public.notices for each row execute function public.notify_on_notice_insert()';
  else
    raise notice 'public.notices table was not found. Skipped notice trigger creation.';
  end if;
end
$do$;
