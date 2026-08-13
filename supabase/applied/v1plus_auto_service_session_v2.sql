-- =============================================================
-- 봉사 세션 자동 시작/종료 v2 (수정사항)
-- 작성일: 2026-05-16
--
-- 이전 v1 (v1plus_auto_service_session.sql) 의 두 가지 문제 수정:
--
-- 1) [버그] 시간대 처리 누락
--    v1: '2026-05-16 10:00'::timestamptz → 10:00 UTC 로 해석됨 (서버 timezone 따라감)
--    v2: KST 로 명시 → 10:00 KST = 01:00 UTC 로 저장
--
-- 2) [로직 변경] auto_close 의 '다음 봉사' 기준
--    v1: 같은 user 의 다음 봉사 일정만 (per-user)
--    v2: 캘린더 전체에서 같은 날짜의 다음 봉사 일정 (per-calendar)
--        → 다른 봉사자가 참여하는 다음 일정이라도 시작했으면 이전 세션 종료
--        → '캘린더에 다음 봉사가 시작하면 이전 봉사는 끝났다' 의도 반영
--
-- v1 적용 후 그대로 이 파일 실행하면 됨 (CREATE OR REPLACE).
-- =============================================================

-- ─── 1. 배정 시 세션 자동 생성 (시간대 수정) ───────────────────
create or replace function public.create_sessions_on_assignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_date date;
  v_event_time text;
  v_leader text;
  v_started_at timestamptz;
  v_time_slot text;
  v_hour int;
begin
  select event_date, time, leader_name
  into v_event_date, v_event_time, v_leader
  from calendar_events
  where id = new.event_id;

  if v_event_date is null then
    return new;
  end if;

  -- ★ 시간대 명시: text 를 KST 로 해석 후 timestamptz 변환
  v_started_at := (
    (v_event_date::text || ' ' || coalesce(nullif(v_event_time, ''), '09:00'))::timestamp
    at time zone 'Asia/Seoul'
  );
  v_hour := extract(hour from v_started_at at time zone 'Asia/Seoul');
  v_time_slot := case
    when v_hour < 12 then '오전'
    when v_hour < 17 then '오후'
    else '저녁'
  end;

  -- 봉사자 세션 (중복 시 skip)
  insert into service_sessions (
    user_name, role, calendar_event_id,
    primary_card_id, assigned_card_id, assignment_id,
    time_slot, started_at, service_date, status, source
  ) values (
    new.user_name,
    case when v_leader = new.user_name then 'leader' else 'user' end,
    new.event_id,
    new.assigned_card_id, new.assigned_card_id, new.id,
    v_time_slot, v_started_at, v_event_date, 'active', 'assigned'
  )
  on conflict on constraint service_sessions_user_date_slot_card_unique do nothing;

  -- 인도자 세션 (배정 받은 사람과 다를 때, 같은 일정에 active 없을 때만)
  if v_leader is not null
     and v_leader <> new.user_name
     and not exists (
       select 1 from service_sessions
       where user_name = v_leader
         and calendar_event_id = new.event_id
         and status = 'active'
     )
  then
    insert into service_sessions (
      user_name, role, calendar_event_id,
      primary_card_id, assigned_card_id,
      time_slot, started_at, service_date, status, source
    ) values (
      v_leader, 'leader', new.event_id,
      new.assigned_card_id, new.assigned_card_id,
      v_time_slot, v_started_at, v_event_date, 'active', 'assigned'
    )
    on conflict on constraint service_sessions_user_date_slot_card_unique do nothing;
  end if;

  return new;
end;
$$;

-- ─── 2. 자동 종료 v2 (per-calendar 로직) ─────────────────────
create or replace function public.auto_close_stale_sessions()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_4h_closed int := 0;
  v_next_closed int := 0;
begin
  -- 2-A. 시작 후 4시간 경과 자동 종료 (안전망)
  with closed as (
    update service_sessions
    set ended_at = started_at + interval '4 hours',
        status = 'ended'
    where status = 'active'
      and ended_at is null
      and started_at + interval '4 hours' < now()
    returning id
  )
  select count(*) into v_4h_closed from closed;

  -- 2-B. ★ 캘린더 전체에서 다음 봉사 일정이 시작되면 이전 세션 종료
  --     같은 service_date 안에서 더 늦은 calendar_event 가 이미 시작 시각을 지났으면
  --     active session 의 ended_at = 그 다음 일정의 started_at
  with next_starts as (
    select
      s.id as session_id,
      (
        select min(
          (ce.event_date::text || ' ' || coalesce(nullif(ce.time, ''), '09:00'))::timestamp
          at time zone 'Asia/Seoul'
        )
        from calendar_events ce
        where ce.event_date = s.service_date
          and (
            (ce.event_date::text || ' ' || coalesce(nullif(ce.time, ''), '09:00'))::timestamp
            at time zone 'Asia/Seoul'
          ) > s.started_at
          and (
            (ce.event_date::text || ' ' || coalesce(nullif(ce.time, ''), '09:00'))::timestamp
            at time zone 'Asia/Seoul'
          ) <= now()
      ) as next_start
    from service_sessions s
    where s.status = 'active'
      and s.ended_at is null
  ),
  closed as (
    update service_sessions
    set ended_at = next_starts.next_start,
        status = 'ended'
    from next_starts
    where service_sessions.id = next_starts.session_id
      and next_starts.next_start is not null
    returning service_sessions.id
  )
  select count(*) into v_next_closed from closed;

  return json_build_object(
    'closed_4h', v_4h_closed,
    'closed_by_next', v_next_closed
  );
end;
$$;

grant execute on function public.auto_close_stale_sessions() to anon, authenticated;

-- ─── 검증 ────────────────────────────────────────────────────
-- 1) 함수 즉시 호출 → 캘린더 기준 종료 동작 확인
--    select public.auto_close_stale_sessions();
--
-- 2) 활성 세션 + 다음 일정 매핑 확인:
--    with next_starts as (
--      select s.id, s.user_name, s.started_at,
--             (select min((ce.event_date::text || ' ' || coalesce(nullif(ce.time,''),'09:00'))::timestamp at time zone 'Asia/Seoul')
--              from calendar_events ce
--              where ce.event_date = s.service_date
--                and (ce.event_date::text || ' ' || coalesce(nullif(ce.time,''),'09:00'))::timestamp at time zone 'Asia/Seoul' > s.started_at) as next_start
--      from service_sessions s where s.status='active'
--    )
--    select * from next_starts;
