-- =============================================================
-- 봉사 세션 자동 시작/종료 (#7 + #11 해결)
-- 작성일: 2026-05-16
--
-- 동작:
--  1) event_card_assignments INSERT 시 → service_sessions 자동 생성
--     - 배정 받은 봉사자 + 인도자(leader_name) 둘 다
--     - status='active', source='assigned'
--     - started_at = 일정의 event_date + time
--  2) auto_close_stale_sessions() RPC
--     - 시작 후 4시간 경과 → 자동 종료
--     - 같은 사용자의 다음 봉사 일정이 시작되면 → 이전 세션 자동 종료
--     - 클라이언트 fetchAll 에서 디바운스로 호출
-- =============================================================

-- ─── 1. 배정 시 세션 자동 생성 트리거 ───────────────────────
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

  -- 시간 없으면 09:00 기본
  v_started_at := (v_event_date::text || ' ' || coalesce(nullif(v_event_time, ''), '09:00'))::timestamptz;
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

drop trigger if exists on_event_card_assignment_session on public.event_card_assignments;
create trigger on_event_card_assignment_session
after insert on public.event_card_assignments
for each row execute function public.create_sessions_on_assignment();

-- ─── 2. 자동 종료 함수 ───────────────────────────────────────
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
  -- 2-A. 시작 후 4시간 경과 자동 종료
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

  -- 2-B. 같은 사용자의 다음 봉사 일정이 시작되면 이전 세션 종료
  with closed as (
    update service_sessions s1
    set ended_at = (
          select s2.started_at
          from service_sessions s2
          where s2.user_name = s1.user_name
            and s2.started_at > s1.started_at
            and s2.started_at <= now()
          order by s2.started_at asc
          limit 1
        ),
        status = 'ended'
    where s1.status = 'active'
      and s1.ended_at is null
      and exists (
        select 1 from service_sessions s2
        where s2.user_name = s1.user_name
          and s2.started_at > s1.started_at
          and s2.started_at <= now()
      )
    returning id
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
-- 1) 트리거 확인:
--    select tgname from pg_trigger where tgname = 'on_event_card_assignment_session';
-- 2) 수동 테스트:
--    select public.auto_close_stale_sessions();
-- 3) 활성 세션 보기:
--    select id, user_name, started_at, ended_at, status
--    from service_sessions where status = 'active' order by started_at desc limit 10;
