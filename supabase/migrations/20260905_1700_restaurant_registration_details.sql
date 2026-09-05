-- 식당 등록의 중국어 여부·현재 상태를 보존하고, 승인 전체를 한 트랜잭션으로 처리한다.

alter table public.restaurant_requests
  add column if not exists is_chinese boolean not null default true,
  add column if not exists initial_status text not null default '미방문',
  add column if not exists regular_visitor text;

alter table public.restaurant_requests
  drop constraint if exists restaurant_requests_initial_status_check;
alter table public.restaurant_requests
  add constraint restaurant_requests_initial_status_check
  check (initial_status in ('미방문','만남','부재','대상외','거절','확인필요','정기방문'));

-- 테스트 DB에 먼저 적용했던 짧은 시그니처를 정리한다. 운영에는 없어도 무해하다.
drop function if exists public.register_restaurant_v2_tx(uuid,text,text,integer,integer,double precision,double precision,boolean,text,text);
drop function if exists public.approve_restaurant_request_tx(uuid,integer,text,text,integer,integer,double precision,double precision);
drop function if exists private.register_restaurant_core(text,text,text,integer,integer,double precision,double precision,boolean,text,text,timestamptz,text);

-- 건물 표시명(shortAddress)과 동일한 도로명+건물번호 부분만 비교 키로 쓴다.
-- 실제 동일성 판정에서는 좌표 근접도도 함께 확인해 다른 도시의 동명 도로를 합치지 않는다.
create or replace function private.restaurant_address_key(p_value text)
returns text
language sql immutable
set search_path = ''
as $$
  select coalesce(
    lower(regexp_replace(
      substring(btrim(coalesce(p_value, '')) from '([가-힣A-Za-z0-9]+(로|길)[0-9]*(번길)?[[:space:]]*[0-9]+(-[0-9]+)?)'),
      '[[:space:]]', '', 'g'
    )),
    lower(regexp_replace(btrim(coalesce(p_value, '')), '[[:space:]]', '', 'g'))
  )
$$;
revoke all on function private.restaurant_address_key(text) from public, anon, authenticated;

-- 도로명+번지 키가 같고 실제 거리가 200m 이내면 같은 건물로 본다.
-- 후보 좌표가 없으면 키가 유일한지는 호출부가 따로 확인한다. 기존 건물에만
-- 좌표가 없을 때는 전체 주소까지 같은 경우에만 재사용한다.
create or replace function private.same_building_location(
  p_existing_address text,
  p_existing_lat double precision,
  p_existing_lng double precision,
  p_candidate_address text,
  p_candidate_lat double precision,
  p_candidate_lng double precision
)
returns boolean
language sql immutable
set search_path = ''
as $$
  select private.restaurant_address_key(p_existing_address)
      = private.restaurant_address_key(p_candidate_address)
    and case
      when coalesce(p_candidate_lat, 0) = 0 and coalesce(p_candidate_lng, 0) = 0
        then true
      when coalesce(p_existing_lat, 0) = 0 and coalesce(p_existing_lng, 0) = 0
        then lower(regexp_replace(btrim(coalesce(p_existing_address, '')), '[[:space:]]', '', 'g'))
          = lower(regexp_replace(btrim(coalesce(p_candidate_address, '')), '[[:space:]]', '', 'g'))
      else 6371000 * 2 * asin(least(1, sqrt(
        power(sin(radians((p_existing_lat - p_candidate_lat) / 2)), 2)
        + cos(radians(p_candidate_lat)) * cos(radians(p_existing_lat))
        * power(sin(radians((p_existing_lng - p_candidate_lng) / 2)), 2)
      ))) <= 200
    end
$$;
revoke all on function private.same_building_location(text,double precision,double precision,text,double precision,double precision)
  from public, anon, authenticated;

create or replace function private.register_restaurant_core(
  p_actor_name text,
  p_name text,
  p_address text,
  p_existing_building_id integer,
  p_card_id integer,
  p_lat double precision,
  p_lng double precision,
  p_is_chinese boolean,
  p_initial_state text,
  p_regular_visitor text,
  p_visited_at timestamptz,
  p_memo text,
  p_building_name text
)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_building integer;
  v_unit integer;
  v_card integer;
  v_matches integer;
  v_name text := btrim(p_name);
  v_address text := btrim(p_address);
  v_address_key text;
  v_unit_status text;
  v_visit_result text;
  v_unit_existed boolean := false;
  v_existing_status text;
  v_existing_regular text;
begin
  if coalesce(v_name, '') = '' or coalesce(v_address, '') = '' then
    raise exception '식당 이름과 주소를 입력하세요';
  end if;
  if length(v_name) > 200 or length(v_address) > 500 then
    raise exception '식당 이름 또는 주소가 너무 깁니다';
  end if;
  if not coalesce(p_initial_state in ('미방문','만남','부재','대상외','거절','확인필요','정기방문'), false) then
    raise exception '식당 상태가 올바르지 않습니다';
  end if;
  if p_is_chinese is null then raise exception '중국어 사용 여부를 선택하세요'; end if;
  if p_initial_state = '정기방문' and coalesce(btrim(p_regular_visitor), '') = '' then
    raise exception '정기방문 담당자를 입력하세요';
  end if;
  if not coalesce(p_lat between -90 and 90 and p_lng between -180 and 180, false) then
    raise exception '좌표가 올바르지 않습니다';
  end if;

  v_address_key := private.restaurant_address_key(v_address);
  perform pg_advisory_xact_lock(hashtextextended(v_address_key, 9051700));

  if p_existing_building_id is not null then
    select id into v_building from public.buildings
    where id = p_existing_building_id and type = '상가' for update;
    if v_building is null then raise exception '선택한 상가 건물을 찾을 수 없습니다'; end if;
  else
    select count(*), min(id) into v_matches, v_building
    from public.buildings
    where private.same_building_location(address, lat, lng, v_address, p_lat, p_lng);
    if v_matches > 1 then raise exception '같은 주소의 건물이 여러 개입니다. 기존 건물을 선택하세요'; end if;
    if v_building is not null and not exists (
      select 1 from public.buildings where id = v_building and type = '상가'
    ) then
      raise exception '같은 주소에 상가가 아닌 건물이 있습니다. 건물 정보를 확인하세요';
    end if;
  end if;

  if v_building is null then
    v_card := p_card_id;
    if v_card is null then
      select id into v_card from public.cards where name = '미배정 건물' order by id limit 1;
    end if;
    if v_card is null or not exists (select 1 from public.cards where id = v_card) then
      raise exception '등록할 구역 카드가 없습니다. 미배정 건물 카드를 확인하세요';
    end if;
    insert into public.buildings (card_id, name, address, type, lat, lng, is_restaurant)
    values (v_card, coalesce(nullif(btrim(p_building_name), ''), v_address), v_address, '상가', p_lat, p_lng, true)
    returning id into v_building;
  end if;

  select count(*), min(id) into v_matches, v_unit
  from public.units
  where building_id = v_building and lower(btrim(number)) = lower(v_name);
  if v_matches > 1 then
    raise exception '같은 이름의 세대가 여러 개입니다. 세대 정보를 확인하세요';
  end if;
  if v_unit is not null then
    v_unit_existed := true;
    select status into v_existing_status from public.units where id = v_unit for update;
    select visitor_name into v_existing_regular
    from public.regular_visits where unit_id = v_unit for update;
  end if;

  v_unit_status := case when p_initial_state = '정기방문' then '만남' else p_initial_state end;
  if v_unit is null then
    insert into public.units (building_id, number, status, is_chinese, is_restaurant)
    values (v_building, v_name, v_unit_status, p_is_chinese, true)
    returning id into v_unit;
  else
    update public.units
    set is_restaurant = true,
        -- 신청자가 중국어 사용 식당임을 확인하면 켠다. 이미 켠 값은 끄지 않는다.
        is_chinese = is_chinese or p_is_chinese,
        status = case
          when status = '미방문'
           and p_initial_state <> '미방문'
           and not exists (
             select 1 from public.visit_histories h
             where h.unit_id = v_unit
               and h.visited_at > coalesce(p_visited_at, now())
           )
          then v_unit_status
          else status
        end
    where id = v_unit;
  end if;
  update public.buildings set is_restaurant = true where id = v_building;

  if p_initial_state = '정기방문' then
    if v_unit_existed and v_existing_status in ('대상외', '거절') then
      raise exception '기존 세대 상태가 %입니다. 상태를 먼저 확인하세요', v_existing_status;
    end if;
    if v_existing_regular is not null
       and lower(btrim(v_existing_regular)) <> lower(btrim(p_regular_visitor)) then
      raise exception '이미 %님이 정기방문을 담당하고 있습니다', v_existing_regular;
    end if;
    if v_existing_regular is null then
      insert into public.regular_visits (unit_id, visitor_name, registered_at)
      values (v_unit, btrim(p_regular_visitor), coalesce(p_visited_at, now()))
      on conflict (unit_id) do nothing;
    end if;
    v_visit_result := '만남';
  else
    if p_initial_state <> '미방문' then v_visit_result := p_initial_state; end if;
  end if;

  if v_visit_result is not null and not exists (
    select 1 from public.visit_histories h
    where h.unit_id = v_unit
      and h.visitor_name = p_actor_name
      and h.result = v_visit_result
      and h.visited_at::date = coalesce(p_visited_at, now())::date
      and h.visit_type = 'restaurant'
  ) then
    insert into public.visit_histories
      (unit_id, visitor_name, result, time_slot, memo, visited_at, visit_type)
    values
      (v_unit, p_actor_name, v_visit_result, '저녁', nullif(btrim(p_memo), ''),
       coalesce(p_visited_at, now()), 'restaurant');
  end if;

  return jsonb_build_object('building_id', v_building, 'unit_id', v_unit);
end;
$$;
revoke all on function private.register_restaurant_core(text,text,text,integer,integer,double precision,double precision,boolean,text,text,timestamptz,text,text) from public, anon, authenticated;

create or replace function public.register_restaurant_v2_tx(
  p_token uuid,
  p_name text,
  p_address text,
  p_existing_building_id integer default null,
  p_card_id integer default null,
  p_lat double precision default 0,
  p_lng double precision default 0,
  p_is_chinese boolean default true,
  p_initial_state text default '미방문',
  p_regular_visitor text default null,
  p_building_name text default null
)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_actor integer;
  v_actor_name text;
  v_role text;
begin
  v_actor := public.verify_session(p_token);
  select name, role into v_actor_name, v_role from public.app_users where id = v_actor;
  if not coalesce(v_role in ('admin','developer','leader'), false) then
    raise exception '관리자 또는 인도자만 식당을 등록할 수 있습니다' using errcode = '42501';
  end if;
  return private.register_restaurant_core(
    v_actor_name, p_name, p_address, p_existing_building_id, p_card_id, p_lat, p_lng,
    p_is_chinese, p_initial_state, p_regular_visitor, now(), null, p_building_name
  );
end;
$$;
revoke all on function public.register_restaurant_v2_tx(uuid,text,text,integer,integer,double precision,double precision,boolean,text,text,text) from public, anon, authenticated;
grant execute on function public.register_restaurant_v2_tx(uuid,text,text,integer,integer,double precision,double precision,boolean,text,text,text) to anon, authenticated;

create or replace function public.approve_restaurant_request_tx(
  p_token uuid,
  p_request_id integer,
  p_name text,
  p_address text,
  p_existing_building_id integer default null,
  p_card_id integer default null,
  p_lat double precision default 0,
  p_lng double precision default 0,
  p_building_name text default null
)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_actor integer;
  v_actor_name text;
  v_role text;
  v_request public.restaurant_requests%rowtype;
  v_result jsonb;
begin
  v_actor := public.verify_session(p_token);
  select name, role into v_actor_name, v_role from public.app_users where id = v_actor;
  if not coalesce(v_role in ('admin','developer'), false) then
    raise exception '관리자만 식당 신청을 승인할 수 있습니다' using errcode = '42501';
  end if;

  select * into v_request from public.restaurant_requests
  where id = p_request_id for update;
  if not found then raise exception '식당 신청을 찾을 수 없습니다'; end if;
  if v_request.status <> 'pending' then raise exception '이미 처리된 식당 신청입니다'; end if;

  v_result := private.register_restaurant_core(
    v_request.requested_by, p_name, p_address, p_existing_building_id, p_card_id, p_lat, p_lng,
    v_request.is_chinese, v_request.initial_status, v_request.regular_visitor,
    v_request.visited_at, v_request.memo, p_building_name
  );

  update public.restaurant_requests
  set name = btrim(p_name), address = btrim(p_address), status = 'approved',
      building_id = (v_result->>'building_id')::integer,
      reviewer = v_actor_name, reviewed_at = now()
  where id = p_request_id;
  return v_result;
end;
$$;
revoke all on function public.approve_restaurant_request_tx(uuid,integer,text,text,integer,integer,double precision,double precision,text) from public, anon, authenticated;
grant execute on function public.approve_restaurant_request_tx(uuid,integer,text,text,integer,integer,double precision,double precision,text) to anon, authenticated;

-- 신청자는 새 의미 칸도 승인 전에 바꿀 수 없다.
create or replace function public.guard_restaurant_request_columns()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if current_user in ('postgres', 'supabase_admin', 'service_role') then return new; end if;
  if public.session_is_admin() then return new; end if;
  if new.id is distinct from old.id
     or new.name is distinct from old.name
     or new.address is distinct from old.address
     or new.requested_by is distinct from old.requested_by
     or new.requested_at is distinct from old.requested_at
     or new.status is distinct from old.status
     or new.visited_at is distinct from old.visited_at
     or new.reviewer is distinct from old.reviewer
     or new.reviewed_at is distinct from old.reviewed_at
     or new.building_id is distinct from old.building_id
     or new.is_chinese is distinct from old.is_chinese
     or new.initial_status is distinct from old.initial_status
     or new.regular_visitor is distinct from old.regular_visitor then
    raise exception '신청자는 메모만 고칠 수 있습니다';
  end if;
  return new;
end;
$$;

-- 새 사람 이름 칸도 기존 원자적 개명 RPC에 포함한다.
create or replace function public.rename_user_name_references(
  p_token uuid,
  p_old text,
  p_new text
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
  v_moved      jsonb := '{}'::jsonb;
  n            integer;
begin
  -- 일괄 정리는 알림을 끈 채로 돈다. 이름 표기만 바뀐 걸 '일정이 변경되었습니다' 로
  -- 쏘아 회중 전체에 푸시가 갔던 적이 있다. 이 표식은 이 트랜잭션 안에서만 유효하다.
  perform set_config('app.suppress_notifications', 'on', true);

  -- 1) 인증
  v_actor_id := public.verify_session(p_token);
  if v_actor_id is null then
    raise exception '세션이 유효하지 않습니다';
  end if;
  select name, role into v_actor_name, v_actor_role
  from public.app_users where id = v_actor_id;

  -- 2) 권한: 관리자거나, 자기 이름을 바꾼 경우만
  --    (이름은 이미 app_users 에서 바뀐 뒤라 본인 현재 이름 = p_new 다)
  if v_actor_role not in ('admin', 'developer') and v_actor_name is distinct from p_new then
    raise exception '다른 사람의 기록을 옮길 권한이 없습니다';
  end if;

  if p_old is null or p_new is null
     or btrim(p_old) = '' or btrim(p_new) = '' or p_old = p_new then
    return jsonb_build_object('ok', false, 'reason', 'invalid_names');
  end if;

  -- 3) 유니크 제약이 있는 표: 새 이름 줄이 이미 있으면 옛 줄을 버린다
  delete from public.event_participants a where a.user_name = p_old and exists (
    select 1 from public.event_participants b
    where b.event_id = a.event_id and b.user_name = p_new);
  delete from public.event_card_assignments a where a.user_name = p_old and exists (
    select 1 from public.event_card_assignments b
    where b.event_id = a.event_id and b.user_name = p_new);
  delete from public.event_card_assignment_cards a where a.user_name = p_old and exists (
    select 1 from public.event_card_assignment_cards b
    where b.event_id = a.event_id and b.user_name = p_new
      and b.card_id is not distinct from a.card_id);
  delete from public.event_informal_assignments a where a.user_name = p_old and exists (
    select 1 from public.event_informal_assignments b
    where b.event_id = a.event_id and b.user_name = p_new
      and b.asset_id is not distinct from a.asset_id);
  delete from public.card_assignments a where a.user_name = p_old and exists (
    select 1 from public.card_assignments b
    where b.card_id = a.card_id and b.user_name = p_new);
  delete from public.card_leader_assignments a where a.user_name = p_old and exists (
    select 1 from public.card_leader_assignments b
    where b.card_id = a.card_id and b.user_name = p_new);
  delete from public.service_sessions a where a.user_name = p_old and exists (
    select 1 from public.service_sessions b
    where b.user_name = p_new
      and b.service_date    is not distinct from a.service_date
      and b.time_slot       is not distinct from a.time_slot
      and b.primary_card_id is not distinct from a.primary_card_id);

  -- 4) 이름 한 칸짜리 표를 전부 옮긴다
  update public.event_participants          set user_name          = p_new where user_name          = p_old;
  get diagnostics n = row_count; v_moved := v_moved || jsonb_build_object('event_participants', n);
  update public.event_card_assignments      set user_name          = p_new where user_name          = p_old;
  get diagnostics n = row_count; v_moved := v_moved || jsonb_build_object('event_card_assignments', n);
  update public.event_card_assignment_cards set user_name          = p_new where user_name          = p_old;
  get diagnostics n = row_count; v_moved := v_moved || jsonb_build_object('event_card_assignment_cards', n);
  update public.event_informal_assignments  set user_name          = p_new where user_name          = p_old;
  get diagnostics n = row_count; v_moved := v_moved || jsonb_build_object('event_informal_assignments', n);
  update public.event_restaurant_assignments set user_name         = p_new where user_name          = p_old;
  get diagnostics n = row_count; v_moved := v_moved || jsonb_build_object('event_restaurant_assignments', n);
  update public.card_assignments            set user_name          = p_new where user_name          = p_old;
  get diagnostics n = row_count; v_moved := v_moved || jsonb_build_object('card_assignments', n);
  update public.card_leader_assignments     set user_name          = p_new where user_name          = p_old;
  get diagnostics n = row_count; v_moved := v_moved || jsonb_build_object('card_leader_assignments', n);
  update public.service_sessions            set user_name          = p_new where user_name          = p_old;
  get diagnostics n = row_count; v_moved := v_moved || jsonb_build_object('service_sessions', n);
  update public.cards                       set leader_name        = p_new where leader_name        = p_old;
  get diagnostics n = row_count; v_moved := v_moved || jsonb_build_object('cards', n);
  update public.visit_histories             set visitor_name       = p_new where visitor_name       = p_old;
  get diagnostics n = row_count; v_moved := v_moved || jsonb_build_object('visit_histories', n);
  update public.regular_visits              set visitor_name       = p_new where visitor_name       = p_old;
  get diagnostics n = row_count; v_moved := v_moved || jsonb_build_object('regular_visits', n);
  -- 여기부터는 예전에 빠져 있던 칸들
  update public.chat_messages               set author_name        = p_new where author_name        = p_old;
  get diagnostics n = row_count; v_moved := v_moved || jsonb_build_object('chat_messages', n);
  update public.comments                    set author_name        = p_new where author_name        = p_old;
  get diagnostics n = row_count; v_moved := v_moved || jsonb_build_object('comments', n);
  update public.notices                     set author             = p_new where author             = p_old;
  get diagnostics n = row_count; v_moved := v_moved || jsonb_build_object('notices', n);
  update public.service_logs                set actor_name         = p_new where actor_name         = p_old;
  get diagnostics n = row_count; v_moved := v_moved || jsonb_build_object('service_logs', n);
  update public.return_visits               set assigned_user_name = p_new where assigned_user_name = p_old;
  get diagnostics n = row_count; v_moved := v_moved || jsonb_build_object('return_visits.assigned', n);
  update public.return_visits               set created_by         = p_new where created_by         = p_old;
  get diagnostics n = row_count; v_moved := v_moved || jsonb_build_object('return_visits.created_by', n);
  update public.restaurant_requests         set requested_by       = p_new where requested_by       = p_old;
  get diagnostics n = row_count; v_moved := v_moved || jsonb_build_object('restaurant_requests.requested_by', n);
  update public.restaurant_requests         set reviewer           = p_new where reviewer           = p_old;
  get diagnostics n = row_count; v_moved := v_moved || jsonb_build_object('restaurant_requests.reviewer', n);
  update public.restaurant_requests         set regular_visitor    = p_new where regular_visitor    = p_old;
  get diagnostics n = row_count; v_moved := v_moved || jsonb_build_object('restaurant_requests.regular_visitor', n);
  update public.phone_surveys               set checked_by         = p_new where checked_by         = p_old;
  get diagnostics n = row_count; v_moved := v_moved || jsonb_build_object('phone_surveys.checked_by', n);
  update public.phone_surveys               set uploaded_by        = p_new where uploaded_by        = p_old;
  get diagnostics n = row_count; v_moved := v_moved || jsonb_build_object('phone_surveys.uploaded_by', n);

  -- 5) 쉼표 목록 (일정 인도자) — 이게 이번에 눈에 보인 그 줄이다
  update public.calendar_events
  set leader_name = public.rename_in_name_list(leader_name, p_old, p_new)
  where leader_name is not null
    -- 목록의 한 칸과 정확히 같을 때만. 이게 없으면 띄어쓰기만 다른 줄까지
    -- 애먼 일정이 전부 갱신된다 ('가,나' → '가, 나')
    and p_old = any (select btrim(v) from unnest(string_to_array(leader_name, ',')) v);
  get diagnostics n = row_count; v_moved := v_moved || jsonb_build_object('calendar_events.leader_name', n);

  return jsonb_build_object('ok', true, 'old', p_old, 'new', p_new, 'moved', v_moved);
end;
$$;

notify pgrst, 'reload schema';
