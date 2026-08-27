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

grant execute on function public.filter_notification_recipients(integer[], text) to anon, authenticated;

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
  -- ⑤ 먼저 정해진 순서로 잠근다. 두 사람이 동시에 저장하면
  --    둘 다 옛 값을 보고 알림을 두 번 보낼 수 있었다.
  perform 1 from public.calendar_events
   where series_id = p_series_id and event_date >= p_from_date
   order by id for update;

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

-- 알림·권한 매트릭스 검증. **테스트 DB 에서만** 돌린다.
--
-- 확인하는 것 (칸마다):
--   · 바뀐 일정 행 수
--   · notifications 생성 건수 / 대상 사람 수
--   · 작성자 본인이 포함됐는지
--   · notify=false 일 때 0건인지
--   · 권한 실패 뒤 DB 가 **전혀** 안 바뀌었는지
--
-- 끝나면 만든 자료를 지우고 결과표만 남긴다.
--
-- ⚠ 이 스크립트는 열 칸이 **한 트랜잭션**에서 돈다. 운영은 호출마다 트랜잭션이 다르다.
--   그 차이 때문에 억제 표식이 앞 칸에서 뒤 칸으로 새는 일이 있었다.
--   그래서 칸마다 표식을 초기화한다. **RPC 가 표식을 지우게 만들면 안 된다** —
--   그건 시험 사정 때문에 운영 코드를 굽히는 것이다.
--   API 를 실제로 거치는 검증은 `npm run smoke:notify` 가 따로 한다.
--
-- ⚠ 알림 건수는 **id 물길**로 센다. 시각으로 세면 안 된다 —
--   notifications.created_at 의 기본값은 now() 이고, now() 는 **트랜잭션 시작 시각**이라
--   블록 안에서 clock_timestamp() 로 찍은 기준보다 항상 이르다.
--   처음에 그렇게 짰다가 알림이 전부 0건으로 나와 코드가 잘못된 줄 알았다.

do $$
declare
  v_env text;
begin
  select value into v_env from public.app_private_settings where key = 'environment';
  if coalesce(v_env, '') <> 'test' then
    raise exception '이 DB 에는 테스트 표식이 없습니다 — 중단합니다. (app_private_settings 의 environment=test)';
  end if;
end $$;

-- 앞선 시도가 중간에 멈췄을 수 있으니 먼저 치운다
delete from public.auth_sessions where user_id in (select id from public.app_users where login_id like 'mtx-%');
delete from public.event_participants where user_name like '매트릭스%';
delete from public.notifications where related_id in (select id from public.calendar_events where title = '매트릭스봉사');
delete from public.calendar_events where title = '매트릭스봉사';
delete from public.notices where title like '매트릭스공지%';
delete from public.app_users where login_id like 'mtx-%';

drop table if exists public._notify_matrix_result;
create table public._notify_matrix_result (
  seq          serial primary key,
  칸           text,
  결과         text,
  바뀐일정     integer,
  알림건수     integer,
  받은사람     integer,
  본인포함     boolean,
  판정         text
);

do $$
declare
  v_series   uuid := gen_random_uuid();
  v_admin    integer; v_admin_tok  uuid := gen_random_uuid();
  v_lead_all integer; v_lead_all_tok uuid := gen_random_uuid();
  v_lead_one integer; v_lead_one_tok uuid := gen_random_uuid();
  v_plain    integer; v_plain_tok  uuid := gen_random_uuid();
  v_e1 integer; v_e2 integer; v_e3 integer;
  v_before_e bigint;
  v_upd integer; v_cnt integer; v_ppl integer; v_self boolean;
  v_res jsonb;
  v_mark bigint;   -- 알림 세는 물길. 시각으로 세면 안 된다(아래 설명)

begin
  -- ── 사람 넷 ────────────────────────────────────────────
  -- 승인·활성을 명시한다 (insert_notifications 가 미승인·비활성을 거른다).
  -- 기본값도 approved 지만 시험은 조건을 눈에 보이게 적는다.
  insert into public.app_users (login_id, name, pin, role, approval_status, is_active)
  values ('mtx-admin', '매트릭스관리자', '1234', 'admin', 'approved', true) returning id into v_admin;
  insert into public.app_users (login_id, name, pin, role, approval_status, is_active)
  values ('mtx-lead-all', '매트릭스전담인도자', '1234', 'leader', 'approved', true) returning id into v_lead_all;
  insert into public.app_users (login_id, name, pin, role, approval_status, is_active)
  values ('mtx-lead-one', '매트릭스일부인도자', '1234', 'leader', 'approved', true) returning id into v_lead_one;
  insert into public.app_users (login_id, name, pin, role, approval_status, is_active)
  values ('mtx-plain', '매트릭스일반', '1234', 'user', 'approved', true) returning id into v_plain;

  insert into public.auth_sessions (token, user_id, expires_at) values
    (v_admin_tok, v_admin, now() + interval '1 hour'),
    (v_lead_all_tok, v_lead_all, now() + interval '1 hour'),
    (v_lead_one_tok, v_lead_one, now() + interval '1 hour'),
    (v_plain_tok, v_plain, now() + interval '1 hour');

  -- ── 반복 일정 셋. 인도자는 전담인도자, 첫 회차에만 일부인도자도 넣는다 ──
  insert into public.calendar_events (event_date, time, title, type, place, leader_name, series_id)
  values (current_date + 7, '10:00', '매트릭스봉사', '봉사', '가', '매트릭스전담인도자, 매트릭스일부인도자', v_series)
  returning id into v_e1;
  insert into public.calendar_events (event_date, time, title, type, place, leader_name, series_id)
  values (current_date + 14, '10:00', '매트릭스봉사', '봉사', '가', '매트릭스전담인도자', v_series)
  returning id into v_e2;
  insert into public.calendar_events (event_date, time, title, type, place, leader_name, series_id)
  values (current_date + 21, '10:00', '매트릭스봉사', '봉사', '가', '매트릭스전담인도자', v_series)
  returning id into v_e3;

  -- 신청자는 **회차마다 다르게** (합집합 계산이 중요한 이유)
  insert into public.event_participants (event_id, user_name, role) values
    (v_e2, '매트릭스일반', '신청'),
    (v_e3, '매트릭스관리자', '신청');

  -- ═══ 칸 1: 관리자 · 반복 · notify=true ═══
  perform set_config('app.suppress_notifications', '', true);   -- 칸마다 표식 초기화
  select coalesce(max(id), 0) into v_mark from public.notifications;
  v_res := public.update_calendar_event_series_tx(
    v_admin_tok, v_series, current_date + 7,
    jsonb_build_object('place', '바뀐장소1'), true);
  select count(*), count(distinct user_id),
         bool_or(user_id = v_admin)
    into v_cnt, v_ppl, v_self
    from public.notifications where id > v_mark and type = 'event_change';
  insert into public._notify_matrix_result (칸, 결과, 바뀐일정, 알림건수, 받은사람, 본인포함, 판정)
  values ('1 관리자·반복·알림보냄', v_res::text, (v_res->>'updated')::int, v_cnt, v_ppl, v_self,
    case when (v_res->>'updated')::int = 3 and v_cnt = v_ppl and v_ppl >= 1 and not v_self
         then 'OK (일정3 · 사람당 1건 · 본인 제외)'
         else '⚠ 확인' end);

  -- ═══ 칸 2: 관리자 · 반복 · notify=false ═══
  perform set_config('app.suppress_notifications', '', true);   -- 칸마다 표식 초기화
  select coalesce(max(id), 0) into v_mark from public.notifications;
  v_res := public.update_calendar_event_series_tx(
    v_admin_tok, v_series, current_date + 7,
    jsonb_build_object('place', '바뀐장소2'), false);
  select count(*) into v_cnt from public.notifications where id > v_mark;
  insert into public._notify_matrix_result (칸, 결과, 바뀐일정, 알림건수, 판정)
  values ('2 관리자·반복·알림안보냄', v_res::text, (v_res->>'updated')::int, v_cnt,
    case when v_cnt = 0 then 'OK (0건)' else '⚠ 알림이 나갔다' end);

  -- ═══ 칸 3: 전담 인도자 · 반복 · notify=true ═══
  perform set_config('app.suppress_notifications', '', true);   -- 칸마다 표식 초기화
  select coalesce(max(id), 0) into v_mark from public.notifications;
  v_res := public.update_calendar_event_series_tx(
    v_lead_all_tok, v_series, current_date + 7,
    jsonb_build_object('place', '바뀐장소3'), true);
  select count(*), count(distinct user_id), bool_or(user_id = v_lead_all)
    into v_cnt, v_ppl, v_self
    from public.notifications where id > v_mark and type = 'event_change';
  insert into public._notify_matrix_result (칸, 결과, 바뀐일정, 알림건수, 받은사람, 본인포함, 판정)
  values ('3 전담인도자·반복·알림보냄', v_res::text, (v_res->>'updated')::int, v_cnt, v_ppl, v_self,
    case when (v_res->>'updated')::int = 3 and not v_self then 'OK' else '⚠ 확인' end);

  -- ═══ 칸 4: 일부만 인도한 사람 · 반복 → 거부돼야 한다 ═══
  select count(*) into v_before_e from public.calendar_events where series_id = v_series and place = '바뀐장소4';
  begin
    v_res := public.update_calendar_event_series_tx(
      v_lead_one_tok, v_series, current_date + 7,
      jsonb_build_object('place', '바뀐장소4'), true);
    insert into public._notify_matrix_result (칸, 결과, 판정)
    values ('4 일부인도자·반복', v_res::text, '⚠ 막혔어야 하는데 통과했다');
  exception when others then
    select count(*) into v_cnt from public.calendar_events where series_id = v_series and place = '바뀐장소4';
    insert into public._notify_matrix_result (칸, 결과, 바뀐일정, 판정)
    values ('4 일부인도자·반복', sqlerrm, v_cnt,
      case when v_cnt = 0 then 'OK (거부 + DB 그대로)' else '⚠ 거부했는데 DB 가 바뀌었다' end);
  end;

  -- ═══ 칸 5: 일반 사용자 · 반복 → 거부 ═══
  begin
    v_res := public.update_calendar_event_series_tx(
      v_plain_tok, v_series, current_date + 7,
      jsonb_build_object('place', '바뀐장소5'), true);
    insert into public._notify_matrix_result (칸, 결과, 판정)
    values ('5 일반사용자·반복', v_res::text, '⚠ 막혔어야 하는데 통과했다');
  exception when others then
    select count(*) into v_cnt from public.calendar_events where series_id = v_series and place = '바뀐장소5';
    insert into public._notify_matrix_result (칸, 결과, 바뀐일정, 판정)
    values ('5 일반사용자·반복', sqlerrm, v_cnt,
      case when v_cnt = 0 then 'OK (거부 + DB 그대로)' else '⚠ DB 가 바뀌었다' end);
  end;

  -- ═══ 칸 6: 관리자 · 단일 · notify=false ═══
  perform set_config('app.suppress_notifications', '', true);   -- 칸마다 표식 초기화
  select coalesce(max(id), 0) into v_mark from public.notifications;
  v_res := public.update_calendar_event_tx(v_admin_tok, v_e1, jsonb_build_object('place', '단일변경'), false);
  select count(*) into v_cnt from public.notifications where id > v_mark;
  insert into public._notify_matrix_result (칸, 결과, 바뀐일정, 알림건수, 판정)
  values ('6 관리자·단일·알림안보냄', v_res::text, (v_res->>'updated')::int, v_cnt,
    case when v_cnt = 0 and (v_res->>'updated')::int = 1 then 'OK' else '⚠ 확인' end);

  -- ═══ 칸 7: 알림 대상 아닌 칸(메모)만 바꾸면 notify=true 여도 안 나간다 ═══
  perform set_config('app.suppress_notifications', '', true);   -- 칸마다 표식 초기화
  select coalesce(max(id), 0) into v_mark from public.notifications;
  v_res := public.update_calendar_event_series_tx(
    v_admin_tok, v_series, current_date + 7,
    jsonb_build_object('memo', '메모만 바꿈'), true);
  select count(*) into v_cnt from public.notifications where id > v_mark;
  insert into public._notify_matrix_result (칸, 결과, 바뀐일정, 알림건수, 판정)
  values ('7 메모만 바꿈·알림보냄', v_res::text, (v_res->>'updated')::int, v_cnt,
    case when v_cnt = 0 then 'OK (서버가 알림 대상 아님을 판단)' else '⚠ 메모만 바꿨는데 알림이 나갔다' end);

  -- ═══ 칸 8: 공지 — 일반 사용자는 거부 ═══
  begin
    v_res := public.create_notice_tx(v_plain_tok, '매트릭스공지', '내용', 'normal', true);
    insert into public._notify_matrix_result (칸, 결과, 판정)
    values ('8 일반사용자·공지', v_res::text, '⚠ 막혔어야 하는데 통과했다');
  exception when others then
    insert into public._notify_matrix_result (칸, 결과, 판정)
    values ('8 일반사용자·공지', sqlerrm, 'OK (거부)');
  end;

  -- ═══ 칸 9: 공지 — 관리자 · notify=false ═══
  perform set_config('app.suppress_notifications', '', true);   -- 칸마다 표식 초기화
  select coalesce(max(id), 0) into v_mark from public.notifications;
  v_res := public.create_notice_tx(v_admin_tok, '매트릭스공지-조용히', '내용', 'normal', false);
  select count(*) into v_cnt from public.notifications where id > v_mark;
  insert into public._notify_matrix_result (칸, 결과, 알림건수, 판정)
  values ('9 관리자·공지·알림안보냄', v_res::text, v_cnt,
    case when v_cnt = 0 then 'OK (0건)' else '⚠ 알림이 나갔다' end);

  -- ═══ 칸 10: 공지 — 관리자 · notify=true (본인 제외 확인) ═══
  perform set_config('app.suppress_notifications', '', true);   -- 칸마다 표식 초기화
  select coalesce(max(id), 0) into v_mark from public.notifications;
  v_res := public.create_notice_tx(v_admin_tok, '매트릭스공지-알림', '내용', 'normal', true);
  select count(*), count(distinct user_id), bool_or(user_id = v_admin)
    into v_cnt, v_ppl, v_self
    from public.notifications where id > v_mark and type = 'notice';
  insert into public._notify_matrix_result (칸, 결과, 알림건수, 받은사람, 본인포함, 판정)
  values ('10 관리자·공지·알림보냄', v_res::text, v_cnt, v_ppl, v_self,
    case when v_cnt > 0 and not v_self then 'OK (본인 제외)' else '⚠ 확인' end);

  -- ── 뒷정리 ────────────────────────────────────────────
  delete from public.notifications
   where related_id in (select id from public.calendar_events where series_id = v_series)
      or related_id in (select id from public.notices where title like '매트릭스공지%');
  delete from public.notices where title like '매트릭스공지%';
  delete from public.event_participants where event_id in (v_e1, v_e2, v_e3);
  delete from public.calendar_events where series_id = v_series;
  delete from public.auth_sessions where user_id in (v_admin, v_lead_all, v_lead_one, v_plain);
  delete from public.app_users where id in (v_admin, v_lead_all, v_lead_one, v_plain);
end $$;

select 칸, 판정, 바뀐일정, 알림건수, 받은사람, 본인포함, left(결과, 70) as 응답
from public._notify_matrix_result order by seq;
