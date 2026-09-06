-- 식당은 건물 유형과 무관하게 상가 세대다. 직접 수정 경로도 같은 규칙을 지킨다.
create or replace function public.enforce_restaurant_unit_usage()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if coalesce(new.is_restaurant, false) then
    new.usage_type := '상가';
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_restaurant_unit_usage() from public, anon, authenticated;
drop trigger if exists enforce_restaurant_unit_usage_trigger on public.units;
create trigger enforce_restaurant_unit_usage_trigger
before insert or update of is_restaurant, usage_type on public.units
for each row execute function public.enforce_restaurant_unit_usage();

-- 주택 건물도 재사용하고 건물 기본 유형은 바꾸지 않는다.
create or replace function private.register_restaurant_core(
  p_actor_name text, p_name text, p_address text,
  p_existing_building_id integer, p_card_id integer,
  p_lat double precision, p_lng double precision,
  p_is_chinese boolean, p_initial_state text, p_regular_visitor text,
  p_visited_at timestamptz, p_memo text, p_building_name text
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
  if coalesce(v_name, '') = '' or coalesce(v_address, '') = '' then raise exception '식당 이름과 주소를 입력하세요'; end if;
  if length(v_name) > 200 or length(v_address) > 500 then raise exception '식당 이름 또는 주소가 너무 깁니다'; end if;
  if not coalesce(p_initial_state in ('미방문','만남','부재','대상외','거절','확인필요','정기방문'), false) then raise exception '식당 상태가 올바르지 않습니다'; end if;
  if p_is_chinese is null then raise exception '중국어 사용 여부를 선택하세요'; end if;
  if p_initial_state = '정기방문' and coalesce(btrim(p_regular_visitor), '') = '' then raise exception '정기방문 담당자를 입력하세요'; end if;
  if not coalesce(p_lat between -90 and 90 and p_lng between -180 and 180, false) then raise exception '좌표가 올바르지 않습니다'; end if;

  v_address_key := private.restaurant_address_key(v_address);
  perform pg_advisory_xact_lock(hashtextextended(v_address_key, 9051700));

  if p_existing_building_id is not null then
    select id into v_building from public.buildings where id = p_existing_building_id for update;
    if v_building is null then raise exception '선택한 건물을 찾을 수 없습니다'; end if;
  else
    select count(*), min(id) into v_matches, v_building
    from public.buildings
    where private.same_building_location(address, lat, lng, v_address, p_lat, p_lng);
    if v_matches > 1 then raise exception '같은 주소의 건물이 여러 개입니다. 기존 건물을 선택하세요'; end if;
  end if;

  if v_building is null then
    v_card := p_card_id;
    if v_card is null then select id into v_card from public.cards where name = '미배정 건물' order by id limit 1; end if;
    if v_card is null or not exists (select 1 from public.cards where id = v_card) then raise exception '등록할 구역 카드가 없습니다. 미배정 건물 카드를 확인하세요'; end if;
    insert into public.buildings (card_id, name, address, type, lat, lng, is_restaurant)
    values (v_card, coalesce(nullif(btrim(p_building_name), ''), v_address), v_address, '상가', p_lat, p_lng, true)
    returning id into v_building;
  end if;

  select count(*), min(id) into v_matches, v_unit
  from public.units where building_id = v_building and lower(btrim(number)) = lower(v_name);
  if v_matches > 1 then raise exception '같은 이름의 세대가 여러 개입니다. 세대 정보를 확인하세요'; end if;
  if v_unit is not null then
    v_unit_existed := true;
    select status into v_existing_status from public.units where id = v_unit for update;
    select visitor_name into v_existing_regular from public.regular_visits where unit_id = v_unit for update;
  end if;

  v_unit_status := case when p_initial_state = '정기방문' then '만남' else p_initial_state end;
  if v_unit is null then
    insert into public.units (building_id, number, status, is_chinese, is_restaurant, usage_type)
    values (v_building, v_name, v_unit_status, p_is_chinese, true, '상가')
    returning id into v_unit;
  else
    update public.units
    set is_restaurant = true,
        usage_type = '상가',
        is_chinese = is_chinese or p_is_chinese,
        status = case
          when status = '미방문' and p_initial_state <> '미방문'
           and not exists (
             select 1 from public.visit_histories h
             where h.unit_id = v_unit and h.visited_at > coalesce(p_visited_at, now())
           )
          then v_unit_status else status
        end
    where id = v_unit;
  end if;
  update public.buildings set is_restaurant = true where id = v_building;

  if p_initial_state = '정기방문' then
    if v_unit_existed and v_existing_status in ('대상외', '거절') then raise exception '기존 세대 상태가 %입니다. 상태를 먼저 확인하세요', v_existing_status; end if;
    if v_existing_regular is not null and lower(btrim(v_existing_regular)) <> lower(btrim(p_regular_visitor)) then raise exception '이미 %님이 정기방문을 담당하고 있습니다', v_existing_regular; end if;
    if v_existing_regular is null then
      insert into public.regular_visits (unit_id, visitor_name, registered_at)
      values (v_unit, btrim(p_regular_visitor), coalesce(p_visited_at, now()))
      on conflict (unit_id) do nothing;
    end if;
    v_visit_result := '만남';
  elsif p_initial_state <> '미방문' then
    v_visit_result := p_initial_state;
  end if;

  if v_visit_result is not null and not exists (
    select 1 from public.visit_histories h
    where h.unit_id = v_unit and h.visitor_name = p_actor_name
      and h.result = v_visit_result
      and h.visited_at::date = coalesce(p_visited_at, now())::date
      and h.visit_type = 'restaurant'
  ) then
    insert into public.visit_histories (unit_id, visitor_name, result, time_slot, memo, visited_at, visit_type)
    values (v_unit, p_actor_name, v_visit_result, '저녁', nullif(btrim(p_memo), ''), coalesce(p_visited_at, now()), 'restaurant');
  end if;

  return jsonb_build_object('building_id', v_building, 'unit_id', v_unit);
end;
$$;

revoke all on function private.register_restaurant_core(text,text,text,integer,integer,double precision,double precision,boolean,text,text,timestamptz,text,text)
  from public, anon, authenticated;

notify pgrst, 'reload schema';
