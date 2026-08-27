-- 운영 적용용 묶음. **한 트랜잭션으로 돈다** — 중간에 실패하면 전부 되돌아간다.
-- (문장이 따로 처리되면 함수 일부만 바뀐 채 남을 수 있다)
--
-- 순서가 중요하다: 필터 함수 → 일정 트리거 → 일정 RPC → 공지 RPC·트리거.
-- 트리거가 필터 함수를 부르기 때문이다.
--
-- ⚠ 확인 쿼리는 여기 없다. commit 이 끝난 뒤 따로 돌릴 것 (파일 맨 아래 주석 참고).

begin;

-- ═══ 20260826_2350_notification_filter.sql ═══
-- 알림 수신자 필터. **다른 것보다 먼저 있어야 한다** —
-- 그래서 파일 이름을 20260826_2350 으로 둔다 (2400 트리거보다 앞서 돌게).
-- 처음엔 20260827_0900 로 뒀는데, 이름 순서로 재생하면 트리거가 먼저 돌아
-- 새 회중 설치가 깨진다. 운영 묶음만 손으로 정렬해선 안 된다.
-- 일정 트리거와 공지 트리거, 두 RPC 가 이걸 부른다.

-- 알림을 실제로 받을 사람만 남긴다.
--
-- ⚠ 지금까지 insert_notifications 만 걸렀고 dispatch_push_notification 은
--   **거르지 않은 목록**을 그대로 받았다. 그래서 '이 알림 끄기' 를 해도
--   휴대폰 푸시는 갔고, 비활성·미승인 사용자의 옛 구독에도 갔다.
--   앱 전체에 있던 문제다 (댓글·채팅·배정도 같다). 여기서 공용 함수를 만들고
--   새 RPC 부터 쓴다. 나머지 트리거는 뒤이어 옮긴다.
create or replace function public.filter_notification_recipients(
  p_user_ids integer[], p_type text
)
returns integer[]
language sql
stable
as $$
  select coalesce(array_agg(distinct u.id), '{}'::integer[])
  from unnest(coalesce(p_user_ids, '{}'::integer[])) as t(uid)
  join public.app_users u on u.id = t.uid
  left join public.notification_preferences pref on pref.user_id = u.id
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
$$;

-- 내부 전용이다. anon 에 열어두면 임의의 사용자 id 목록과 알림 종류를 넣어
-- 누가 어떤 알림을 켜뒀는지 캐낼 수 있다.
revoke all on function public.filter_notification_recipients(integer[], text) from public, anon, authenticated;

-- ═══ 20260826_2400_suppress_bulk_notifications.sql ═══
-- 일괄 정리가 알림 폭탄을 쏘던 문제.
--
-- 무슨 일이 있었나: 옛 이름 정리로 calendar_events.leader_name 을 갈아끼웠더니
-- on_calendar_event_update 트리거가 일정마다 '일정이 변경되었습니다' 를 쏘았다.
-- 이름 표기만 바뀐 건데 참가자 전원에게 푸시가 갔다. 지난 일정까지 포함해서.
--
-- 두 가지를 막는다.
--   ① 관리 작업은 알림을 끈 채로 돈다 (트랜잭션 안에서만 유효한 표식)
--   ② 이미 지난 일정이 바뀐 것은 애초에 알리지 않는다
--      (끝난 모임의 시간이 바뀌었다고 알려봐야 할 일이 없다)

create or replace function public.notify_on_calendar_event_change()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_recipient_ids integer[];
  v_link text;
begin
  -- ① 일괄 정리 중에는 알리지 않는다
  if coalesce(current_setting('app.suppress_notifications', true), '') = 'on' then
    return new;
  end if;

  -- ② 이미 지난 일정은 알리지 않는다
  if new.event_date < current_date then
    return new;
  end if;

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
    -- 인도자 전원. 쉼표 목록을 통짜로 비교하던 것을 고친다
    -- (인도자가 둘 이상이면 아무도 못 찾아 알림이 안 나갔다)
    select unnest(public.user_ids_in_name_list(new.leader_name)) as recipient_id
  ) recipients
  where recipient_id is not null
    -- 고친 사람 본인은 뺀다 (update_calendar_event_tx 가 app.actor_id 로 알려준다).
    -- 없으면(트리거만 돈 경우) 아무도 안 뺀다.
    and recipient_id is distinct from nullif(current_setting('app.actor_id', true), '')::integer;

  -- ⚠ 푸시도 같은 필터를 거친 목록만 받아야 한다.
  --   예전엔 insert_notifications 만 거르고 푸시는 원본 목록을 받아,
  --   '일정 변경 알림 끄기' 를 해도 휴대폰이 울렸다.
  --   반복·공지는 고쳤는데 **단일 일정만 빠져 있었다** (매트릭스에 그 칸이 없어서 놓쳤다).
  v_recipient_ids := public.filter_notification_recipients(v_recipient_ids, 'event_change');

  if v_recipient_ids is null or cardinality(v_recipient_ids) = 0 then
    return new;
  end if;

  v_link := '/calendar?openChat=' || new.id;

  perform public.insert_notifications(
    v_recipient_ids, 'event_change', '일정이 변경되었습니다',
    new.title || ' · ' || new.event_date || ' ' || new.time, v_link, new.id);

  perform public.dispatch_push_notification(
    v_recipient_ids, 'event_change', '일정이 변경되었습니다',
    new.title || ' · ' || new.event_date || ' ' || new.time, v_link, new.id);

  return new;
end;
$function$;

-- 정리 RPC 두 개는 각자의 마이그레이션(2200 / 2300)에서 표식을 세운다.
-- 그 두 파일을 (다시) 실행해야 이 억제가 실제로 걸린다.

-- ═══ 20260827_1000_series_update_tx.sql ═══

-- 반복 일정을 고치면 알림이 일정 수만큼 나가던 문제.
--
-- 한 번 고쳤는데 알림이 46번 갔다. 트리거가 **줄마다** 돌기 때문이다.
-- 실제로 92건이 6명에게 갔다.
--
-- 여기서는 억제를 켠 채로 전부 고치고, 끝나고 **한 번만** 보낸다.
-- 보낼지 말지도 고를 수 있다 (p_notify).

create or replace function public.update_calendar_event_series_tx(
  p_token     uuid,
  p_series_id uuid,
  p_from_date date,
  p_payload   jsonb,
  p_notify    boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id   integer;
  v_actor_name text;
  v_actor_role text;
  v_ids        integer[];
  v_title      text;
  v_first_id   integer;
  v_recipients integer[];
  v_notifiable boolean;
begin
  v_actor_id := public.verify_session(p_token);
  if v_actor_id is null then
    raise exception '세션이 유효하지 않습니다';
  end if;
  select name, role into v_actor_name, v_actor_role
  from public.app_users where id = v_actor_id;

  -- 먼저 대상 행을 정해진 순서로 잠근다. **권한 검사보다 앞이어야 한다** —
  -- 검사와 수정 사이에 다른 트랜잭션이 인도자를 바꾸면 옛 권한으로 고칠 수 있다.
  -- (같은 순서로 잠가야 서로 물고 늘어지지 않는다)
  perform 1 from public.calendar_events
   where series_id = p_series_id and event_date >= p_from_date
   order by id for update;

  -- 권한: 관리자거나, **바뀌는 모든 일정**의 인도자여야 한다.
  -- 예전엔 '그 시리즈의 어느 하나라도 인도자였으면' 이었다 —
  -- 한 번 인도했던 사람이 남의 일정까지 전부 바꿀 수 있었다.
  if v_actor_role not in ('admin', 'developer') then
    if exists (
      select 1 from public.calendar_events e
      where e.series_id = p_series_id
        and e.event_date >= p_from_date
        and not (v_actor_name = any (select btrim(v) from unnest(string_to_array(e.leader_name, ',')) v))
    ) then
      raise exception '내가 인도하지 않는 일정이 섞여 있어 고칠 수 없습니다';
    end if;
  end if;

  -- 알림 대상 칸이 **실제로** 바뀌는지 서버가 직접 본다.
  -- 화면의 판단(willNotifyOnEventChange)은 물어볼지 정하는 용도일 뿐이고,
  -- 보낼지 말지는 여기서 정한다. 두 곳이 어긋나도 잘못 나가지 않는다.
  -- ② 알림 판단은 **오늘 이후 회차만** 본다.
  --    지난 회차에서 '이후 모두' 를 고르면 미래 회차가 조용히 바뀌었고,
  --    반대로 p_notify=true 면 지난 회차 참가자까지 수신자에 들어갔다.
  select exists (
    select 1 from public.calendar_events e
    where e.series_id = p_series_id and e.event_date >= p_from_date
      and e.event_date >= current_date
      and (
        (p_payload ? 'time'            and e.time            is distinct from p_payload->>'time') or
        (p_payload ? 'title'           and e.title           is distinct from p_payload->>'title') or
        (p_payload ? 'place'           and e.place           is distinct from p_payload->>'place') or
        (p_payload ? 'leader_name'     and e.leader_name     is distinct from p_payload->>'leader_name') or
        (p_payload ? 'meeting_map_url' and e.meeting_map_url is distinct from p_payload->>'meeting_map_url') or
        (p_payload ? 'event_date'      and e.event_date      is distinct from (p_payload->>'event_date')::date)
      )
  ) into v_notifiable;

  -- 고치는 동안 줄마다 나가는 알림을 끈다 (이 트랜잭션 안에서만)
  perform set_config('app.suppress_notifications', 'on', true);

  -- payload 에 **들어 있는 칸만** 바꾼다 (예전 update 와 같은 뜻)
  with upd as (
    update public.calendar_events e set
      time               = case when p_payload ? 'time'               then p_payload->>'time'                        else e.time end,
      end_time           = case when p_payload ? 'end_time'           then nullif(p_payload->>'end_time', '')        else e.end_time end,
      title              = case when p_payload ? 'title'              then p_payload->>'title'                       else e.title end,
      place              = case when p_payload ? 'place'              then p_payload->>'place'                       else e.place end,
      leader_name        = case when p_payload ? 'leader_name'        then p_payload->>'leader_name'                 else e.leader_name end,
      memo               = case when p_payload ? 'memo'               then p_payload->>'memo'                        else e.memo end,
      has_meeting        = case when p_payload ? 'has_meeting'        then (p_payload->>'has_meeting')::boolean      else e.has_meeting end,
      allow_applications = case when p_payload ? 'allow_applications' then (p_payload->>'allow_applications')::boolean else e.allow_applications end,
      meeting_map_url    = case when p_payload ? 'meeting_map_url'    then p_payload->>'meeting_map_url'             else e.meeting_map_url end
    where e.series_id = p_series_id
      and e.event_date >= p_from_date
    returning e.id, e.title, e.event_date
  )
  select array_agg(id order by event_date), min(title), min(id order by event_date)
  into v_ids, v_title, v_first_id
  from upd;

  if v_ids is null or cardinality(v_ids) = 0 then
    return jsonb_build_object('ok', true, 'updated', 0, 'notified', 0);
  end if;

  -- 사용자가 안 보내겠다고 했거나, 알림 대상 칸이 안 바뀌었으면 보내지 않는다
  if not p_notify or not v_notifiable then
    return jsonb_build_object('ok', true, 'updated', cardinality(v_ids), 'notified', 0);
  end if;

  -- 받는 사람: 바뀐 일정들의 신청자 + 인도자 전원 − 고친 사람 자신
  select array_agg(distinct rid) into v_recipients
  from (
    select u.id as rid
    from public.event_participants ep
    join public.app_users u on u.name = ep.user_name
    join public.calendar_events ce on ce.id = ep.event_id
    where ep.event_id = any (v_ids) and ce.event_date >= current_date
    union
    select unnest(public.user_ids_in_name_list(e.leader_name)) as rid
    from public.calendar_events e
    where e.id = any (v_ids) and e.event_date >= current_date
  ) r
  where rid is not null and rid is distinct from v_actor_id;

  -- ① 푸시도 같은 필터를 거친 목록만 받는다
  v_recipients := public.filter_notification_recipients(v_recipients, 'event_change');

  if v_recipients is null or cardinality(v_recipients) = 0 then
    return jsonb_build_object('ok', true, 'updated', cardinality(v_ids), 'notified', 0);
  end if;

  -- **한 번만** 보낸다
  perform public.insert_notifications(
    v_recipients, 'event_change', '반복 일정이 변경되었습니다',
    v_title || ' · 일정 ' || cardinality(v_ids) || '개',
    '/calendar?openEvent=' || v_first_id, v_first_id);

  perform public.dispatch_push_notification(
    v_recipients, 'event_change', '반복 일정이 변경되었습니다',
    v_title || ' · 일정 ' || cardinality(v_ids) || '개',
    '/calendar?openEvent=' || v_first_id, v_first_id);

  return jsonb_build_object('ok', true, 'updated', cardinality(v_ids),
                            'notified', cardinality(v_recipients));
end;
$$;

revoke all on function public.update_calendar_event_series_tx(uuid, uuid, date, jsonb, boolean) from public;
grant execute on function public.update_calendar_event_series_tx(uuid, uuid, date, jsonb, boolean) to anon, authenticated;

-- 단일 일정 수정. 알림을 보낼지 고를 수 있게 한다.
-- 보낼 때는 기존 트리거가 그대로 돌고, 안 보낼 때만 억제를 켠다.
create or replace function public.update_calendar_event_tx(
  p_token    uuid,
  p_event_id integer,
  p_payload  jsonb,
  p_notify   boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id   integer;
  v_actor_name text;
  v_actor_role text;
  n            integer;
begin
  v_actor_id := public.verify_session(p_token);
  if v_actor_id is null then
    raise exception '세션이 유효하지 않습니다';
  end if;
  select name, role into v_actor_name, v_actor_role
  from public.app_users where id = v_actor_id;

  -- 반복과 마찬가지로 **권한 검사보다 먼저** 잠근다.
  -- 검사와 수정 사이에 다른 요청이 인도자를 바꾸면 옛 권한으로 고칠 수 있다.
  perform 1 from public.calendar_events where id = p_event_id for update;

  if v_actor_role not in ('admin', 'developer') and not exists (
    select 1 from public.calendar_events e
    where e.id = p_event_id
      and v_actor_name = any (select btrim(v) from unnest(string_to_array(e.leader_name, ',')) v)
  ) then
    raise exception '이 일정을 고칠 권한이 없습니다';
  end if;

  -- 안 보낼 때만 표식을 켠다. **켜져 있는 걸 끄지는 않는다** —
  -- 바깥의 관리 작업이 일부러 켜뒀을 수 있다.
  -- (한때 끄게 했는데, 그건 매트릭스를 한 트랜잭션에서 돌려 생긴 문제를 덮은 것이었다)
  if not p_notify then
    perform set_config('app.suppress_notifications', 'on', true);
  end if;

  -- 고친 사람은 자기 알림을 받지 않는다. 트리거는 누가 고쳤는지 모르므로 여기서 알려준다.
  -- (반복 수정은 서버가 직접 보내며 이미 제외한다 — 단일만 안 맞았다)
  perform set_config('app.actor_id', v_actor_id::text, true);

  update public.calendar_events e set
    time               = case when p_payload ? 'time'               then p_payload->>'time'                        else e.time end,
    end_time           = case when p_payload ? 'end_time'           then nullif(p_payload->>'end_time', '')        else e.end_time end,
    title              = case when p_payload ? 'title'              then p_payload->>'title'                       else e.title end,
    place              = case when p_payload ? 'place'              then p_payload->>'place'                       else e.place end,
    leader_name        = case when p_payload ? 'leader_name'        then p_payload->>'leader_name'                 else e.leader_name end,
    memo               = case when p_payload ? 'memo'               then p_payload->>'memo'                        else e.memo end,
    has_meeting        = case when p_payload ? 'has_meeting'        then (p_payload->>'has_meeting')::boolean      else e.has_meeting end,
    allow_applications = case when p_payload ? 'allow_applications' then (p_payload->>'allow_applications')::boolean else e.allow_applications end,
    meeting_map_url    = case when p_payload ? 'meeting_map_url'    then p_payload->>'meeting_map_url'             else e.meeting_map_url end,
    event_date         = case when p_payload ? 'event_date'         then (p_payload->>'event_date')::date          else e.event_date end
  where e.id = p_event_id;
  get diagnostics n = row_count;

  return jsonb_build_object('ok', true, 'updated', n, 'notified', case when p_notify then 1 else 0 end);
end;
$$;

revoke all on function public.update_calendar_event_tx(uuid, integer, jsonb, boolean) from public;
grant execute on function public.update_calendar_event_tx(uuid, integer, jsonb, boolean) to anon, authenticated;

-- ═══ 20260827_1100_notice_notify_choice.sql ═══
-- 공지를 올릴 때 알림을 보낼지 고를 수 있게 한다.
--
-- 공지는 **활성 사용자 전원**에게 간다 (지금 60명). 되돌릴 수 없다.
-- 오타를 고쳐 다시 올리거나 시험 삼아 올려도 60명 폰이 울렸다.
--
-- 보낼 때는 기존 트리거가 그대로 돈다. 안 보낼 때만 억제를 켠다
-- (일정 수정 RPC 와 같은 방식).

create or replace function public.create_notice_tx(
  p_token    uuid,
  p_title    text,
  p_content  text,
  p_priority text,
  p_notify   boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id   integer;
  v_actor_name text;
  v_actor_role text;
  v_new_id     integer;
begin
  v_actor_id := public.verify_session(p_token);
  if v_actor_id is null then
    raise exception '세션이 유효하지 않습니다';
  end if;
  select name, role into v_actor_name, v_actor_role
  from public.app_users where id = v_actor_id;

  -- ⚠ 이 함수는 security definer 이고 anon 에도 실행권한이 있다.
  --   권한 검사를 빠뜨리면 **일반 사용자가 회중 전원에게 알림을 쏠 수 있다.**
  if v_actor_role not in ('admin', 'developer') then
    raise exception '공지는 관리자만 올릴 수 있습니다';
  end if;

  if btrim(coalesce(p_title, '')) = '' then
    return jsonb_build_object('ok', false, 'reason', 'empty_title');
  end if;

  -- 안 보낼 때만 표식을 켠다. 켜져 있는 걸 끄지는 않는다
  -- (바깥의 관리 작업이 일부러 켜뒀을 수 있다)
  if not p_notify then
    perform set_config('app.suppress_notifications', 'on', true);
  end if;

  insert into public.notices (title, content, priority, author)
  values (btrim(p_title), btrim(coalesce(p_content, '')), p_priority, v_actor_name)
  returning id into v_new_id;

  return jsonb_build_object('ok', true, 'id', v_new_id,
                            'notified', case when p_notify then 1 else 0 end);
end;
$$;

-- 공지 알림 트리거에 **억제 검사만** 얹는다.
-- ⚠ 나머지는 운영본 그대로다. 다시 쓰다가 '글쓴이 본인 제외' 와
--   '승인된 사용자만' 을 빠뜨릴 뻔했다 — 얹기만 할 것.
CREATE OR REPLACE FUNCTION public.notify_on_notice_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_author_id integer;
  v_recipient_ids integer[];
  v_title text;
begin
  -- 올린 사람이 '알림 없이' 를 골랐으면 보내지 않는다 (create_notice_tx 가 표식을 세운다)
  if coalesce(current_setting('app.suppress_notifications', true), '') = 'on' then
    return new;
  end if;

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

  -- ⚠ 푸시도 같은 필터를 거친 목록만 받아야 한다.
  --   예전엔 insert_notifications 만 거르고 푸시는 원본 목록을 받아,
  --   '공지 알림 끄기' 를 해도 휴대폰은 울렸다.
  v_recipient_ids := public.filter_notification_recipients(v_recipient_ids, 'notice');
  if v_recipient_ids is null or cardinality(v_recipient_ids) = 0 then
    return new;
  end if;

  perform public.insert_notifications(
    v_recipient_ids,
    'notice',
    '새 공지',
    v_title,
    '/notices?noticeId=' || new.id,
    new.id::integer
  );

  perform public.dispatch_push_notification(
    v_recipient_ids,
    'notice',
    '새 공지',
    v_title,
    '/notices?noticeId=' || new.id,
    new.id::integer
  );

  return new;
end;
$function$;

revoke all on function public.create_notice_tx(uuid, text, text, text, boolean) from public;
grant execute on function public.create_notice_tx(uuid, text, text, text, boolean) to anon, authenticated;


-- PostgREST 가 새 함수를 바로 보게 한다 (안 그러면 잠깐 404 가 난다)
notify pgrst, 'reload schema';

commit;

-- ═══════════════════════════════════════════════
-- commit 뒤에 **따로** 돌릴 확인 쿼리 (전부 true 여야 한다)
-- ═══════════════════════════════════════════════
-- select
--   (select count(*) from pg_proc where proname = 'filter_notification_recipients') = 1 as 필터함수,
--   (select count(*) from pg_proc where proname = 'update_calendar_event_series_tx') = 1 as 반복수정_RPC,
--   (select count(*) from pg_proc where proname = 'update_calendar_event_tx')        = 1 as 단일수정_RPC,
--   (select count(*) from pg_proc where proname = 'create_notice_tx')                = 1 as 공지_RPC,
--   (select position('공지는 관리자만' in prosrc) > 0 from pg_proc where proname = 'create_notice_tx') as 공지_관리자검사,
--   (select position('내가 인도하지 않는' in prosrc) > 0 from pg_proc where proname = 'update_calendar_event_series_tx') as 반복_권한좁힘,
--   (select position('filter_notification_recipients' in prosrc) > 0 from pg_proc where proname = 'notify_on_calendar_event_change') as 일정트리거_필터,
--   (select position('app.actor_id' in prosrc) > 0 from pg_proc where proname = 'notify_on_calendar_event_change') as 일정트리거_본인제외,
--   (select position('approval_status' in prosrc) > 0 from pg_proc where proname = 'notify_on_notice_insert') as 공지트리거_승인조건_보존,
--   (select position('v_author_id' in prosrc) > 0 from pg_proc where proname = 'notify_on_notice_insert') as 공지트리거_본인제외_보존;
