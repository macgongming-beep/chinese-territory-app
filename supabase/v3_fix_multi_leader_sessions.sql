-- 인도자가 두 명 이상인 일정에서 봉사 세션이 잘못 만들어지던 문제
-- Supabase SQL Editor 에서 실행 (실행 전 백업 권장: npm run backup)
--
-- 무엇이 잘못됐나
--   calendar_events.leader_name 은 '엄민석, 장웅' 처럼 여러 이름을 담는다.
--   앱은 이걸 쉼표로 쪼개 쓰는데(storeTransforms.ts), 자동 봉사 세션을 만드는
--   트리거는 통째로 한 사람 이름처럼 다뤘다. 그래서
--     ① '엄민석, 장웅' 이라는 없는 사람의 세션이 생기고 (현재 5건)
--     ② 실제 인도자는 leader_name 과 글자가 안 맞아 role='user' 로 찍혔다 (13건)
--   둘 다 오류가 안 나서 통계만 조용히 어긋난다. 인도자 시간이 유령에게 가고
--   본인은 봉사자로 집계된다.
--
-- 무엇을 고치나
--   1. 트리거가 leader_name 을 쉼표로 쪼개 인도자마다 세션을 만들게 한다
--   2. 이미 생긴 유령 세션 5건을 실제 인도자들로 풀어 준다
--   3. 인도자인데 role='user' 로 찍힌 세션을 'leader' 로 바로잡는다

-- ─── 1. 트리거 함수 교체 ────────────────────────────────────
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
  v_leaders text[];
  v_one text;
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

  -- '엄민석, 장웅' → {엄민석, 장웅}. 빈 조각은 버린다.
  v_leaders := array(
    select btrim(x)
    from unnest(string_to_array(coalesce(v_leader, ''), ',')) as x
    where btrim(x) <> ''
  );

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

  -- 봉사자 세션 — 배정받은 사람이 인도자 목록에 있으면 'leader'
  insert into service_sessions (
    user_name, role, calendar_event_id,
    primary_card_id, assigned_card_id, assignment_id,
    time_slot, started_at, service_date, status, source
  ) values (
    new.user_name,
    case when new.user_name = any(v_leaders) then 'leader' else 'user' end,
    new.event_id,
    new.assigned_card_id, new.assigned_card_id, new.id,
    v_time_slot, v_started_at, v_event_date, 'active', 'assigned'
  )
  on conflict on constraint service_sessions_user_date_slot_card_unique do nothing;

  -- 인도자 세션 — 이름마다 하나씩
  foreach v_one in array v_leaders loop
    continue when v_one = new.user_name;
    continue when exists (
      select 1 from service_sessions
      where user_name = v_one
        and calendar_event_id = new.event_id
        and status = 'active'
    );
    insert into service_sessions (
      user_name, role, calendar_event_id,
      primary_card_id, assigned_card_id,
      time_slot, started_at, service_date, status, source
    ) values (
      v_one, 'leader', new.event_id,
      new.assigned_card_id, new.assigned_card_id,
      v_time_slot, v_started_at, v_event_date, 'active', 'assigned'
    )
    on conflict on constraint service_sessions_user_date_slot_card_unique do nothing;
  end loop;

  return new;
end;
$$;

-- ─── 2. 유령 세션을 실제 인도자로 풀기 ──────────────────────
-- 유령 행 하나가 여러 사람이 되므로, 새로 넣고 원본을 지운다.
-- 이미 같은 사람의 세션이 있으면 unique 제약이 막아 준다 (중복 안 생김).
-- 조각에는 이름 합치기 전 옛 표기가 섞여 있다 ('심창현' → 계정은 '심창현沈昌炫').
-- 그래서 정확히 같은 이름을 먼저 찾고, 없으면 그 이름으로 시작하는 계정이
-- 딱 하나일 때만 그 사람으로 본다. 둘 이상이면 사람이 판단할 몫이라 건드리지 않는다.
create temp table ghost_fix on commit drop as
select
  g.id           as ghost_id,
  btrim(x)       as raw,
  g.calendar_event_id, g.primary_card_id, g.assigned_card_id,
  g.time_slot, g.started_at, g.service_date, g.ended_at, g.status, g.source,
  case
    when exists (select 1 from app_users u where u.name = btrim(x)) then btrim(x)
    when (select count(*) from app_users u where u.name like btrim(x) || '%') = 1
      then (select u.name from app_users u where u.name like btrim(x) || '%')
    else null
  end as person
from service_sessions g,
     unnest(string_to_array(g.user_name, ',')) as x
where g.user_name like '%,%'
  and btrim(x) <> '';

insert into service_sessions (
  user_name, role, calendar_event_id, primary_card_id, assigned_card_id,
  time_slot, started_at, service_date, ended_at, status, source
)
select distinct
  person, 'leader', calendar_event_id, primary_card_id, assigned_card_id,
  time_slot, started_at, service_date, ended_at, status, source
from ghost_fix
where person is not null
on conflict on constraint service_sessions_user_date_slot_card_unique do nothing;

-- 조각을 전부 사람으로 바꾼 줄만 지운다. 하나라도 못 찾았으면 남겨 두고
-- 아래 확인 결과에 드러나게 한다 (조용히 사라지는 게 제일 나쁘다).
delete from service_sessions s
where s.user_name like '%,%'
  and not exists (
    select 1 from ghost_fix f where f.ghost_id = s.id and f.person is null
  );

-- ─── 3. 인도자인데 봉사자로 찍힌 세션 바로잡기 ──────────────
update service_sessions s
set role = 'leader'
from calendar_events e
where s.calendar_event_id = e.id
  and s.role <> 'leader'
  and s.user_name = any(
    array(
      select btrim(x)
      from unnest(string_to_array(coalesce(e.leader_name, ''), ',')) as x
      where btrim(x) <> ''
    )
  );

-- ─── 4. 확인 ────────────────────────────────────────────────
select '못 푼 유령 세션 (0 이어야 함 — 남았으면 이름을 직접 확인)' as 구분, count(*) as 개수
  from service_sessions where user_name like '%,%'
union all
select '계정에 없는 이름의 세션 (0 이어야 함)', count(*)
  from service_sessions s
 where not exists (select 1 from app_users u where u.name = s.user_name)
union all
select '인도자인데 봉사자로 남은 세션 (0 이어야 함)', count(*)
  from service_sessions s
  join calendar_events e on e.id = s.calendar_event_id
 where s.role <> 'leader'
   and s.user_name = any(array(
         select btrim(x) from unnest(string_to_array(coalesce(e.leader_name, ''), ',')) as x
         where btrim(x) <> ''));
