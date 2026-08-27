
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
