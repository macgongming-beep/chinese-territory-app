-- 정기방문에서 새 건물·세대를 만들 때 주택/상가를 사용자가 정한다.
drop function if exists public.create_return_visit_location_tx(uuid,text,text,text,text,integer,text,text,integer,double precision,double precision);

create or replace function public.create_return_visit_location_tx(
  p_token uuid,
  p_display_name text,
  p_address text,
  p_memo text default '',
  p_first_result text default null,
  p_existing_building_id integer default null,
  p_building_name text default null,
  p_building_type text default '주택',
  p_unit_number text default null,
  p_unit_usage_type text default null,
  p_card_id integer default null,
  p_lat double precision default null,
  p_lng double precision default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id integer;
  v_role text;
  v_building_id integer;
  v_unit_id integer;
  v_match_count integer;
  v_card_id integer;
  v_address text := btrim(coalesce(p_address, ''));
  v_unit_number text := btrim(coalesce(p_unit_number, ''));
  v_address_key text;
  v_building_type text;
  v_unit_usage_type text;
  v_result jsonb;
begin
  v_actor_id := public.verify_session(p_token);
  select role into v_role from public.app_users where id = v_actor_id;
  if not coalesce(v_role in ('admin', 'developer', 'leader'), false) then
    raise exception '관리자 또는 인도자만 새 건물과 세대를 만들 수 있습니다' using errcode = '42501';
  end if;
  if v_address = '' or v_unit_number = '' then raise exception '주소와 세대 이름을 입력하세요'; end if;
  if length(v_address) > 500 or length(v_unit_number) > 200
     or length(coalesce(p_building_name, '')) > 200 then
    raise exception '주소 또는 이름이 너무 깁니다';
  end if;
  if not coalesce(p_building_type in ('주택', '상가'), false) then raise exception '건물 유형이 올바르지 않습니다'; end if;
  if p_unit_usage_type is not null and p_unit_usage_type not in ('주택', '상가') then raise exception '세대 용도가 올바르지 않습니다'; end if;

  v_address_key := private.restaurant_address_key(v_address);
  -- 식당 등록과 같은 주소 잠금을 잡아 두 경로가 동시에 같은 건물을 만들지 못하게 한다.
  perform pg_advisory_xact_lock(hashtextextended(v_address_key, 9051700));

  if p_existing_building_id is not null then
    select id, type into v_building_id, v_building_type
    from public.buildings where id = p_existing_building_id for update;
    if v_building_id is null then raise exception '선택한 건물을 찾을 수 없습니다'; end if;
  else
    if not coalesce(p_lat between -90 and 90 and p_lng between -180 and 180, false)
       or (p_lat = 0 and p_lng = 0) then
      raise exception '검색 후보에서 주소를 선택하세요';
    end if;
    select count(*), min(id) into v_match_count, v_building_id
    from public.buildings
    where private.same_building_location(address, lat, lng, v_address, p_lat, p_lng);
    if v_match_count > 1 then raise exception '가까운 같은 주소 건물이 여러 개입니다. 기존 건물을 선택하세요'; end if;
    if v_building_id is not null then
      select type into v_building_type from public.buildings where id = v_building_id for update;
    end if;
  end if;

  if v_building_id is null then
    v_card_id := p_card_id;
    if v_card_id is null then select id into v_card_id from public.cards where name = '미배정 건물' order by id limit 1; end if;
    if v_card_id is null or not exists (select 1 from public.cards where id = v_card_id) then
      raise exception '등록할 구역 카드가 없습니다. 미배정 건물 카드를 확인하세요';
    end if;
    v_building_type := p_building_type;
    insert into public.buildings (card_id, name, address, type, lat, lng)
    values (v_card_id, coalesce(nullif(btrim(p_building_name), ''), v_address), v_address, v_building_type, p_lat, p_lng)
    returning id into v_building_id;
  end if;

  v_unit_usage_type := coalesce(p_unit_usage_type, v_building_type);
  select count(*), min(id) into v_match_count, v_unit_id
  from public.units
  where building_id = v_building_id and lower(btrim(number)) = lower(v_unit_number);
  if v_match_count > 1 then raise exception '같은 이름의 세대가 여러 개입니다'; end if;
  if v_unit_id is null then
    insert into public.units (building_id, number, status, is_chinese, usage_type)
    values (
      v_building_id, v_unit_number, '미방문', true,
      case when v_unit_usage_type = v_building_type then null else v_unit_usage_type end
    ) returning id into v_unit_id;
  end if;

  v_result := public.create_return_visit_tx(p_token, p_display_name, v_address, p_memo, p_first_result, v_unit_id);
  return v_result || jsonb_build_object('building_id', v_building_id, 'unit_id', v_unit_id);
end;
$$;

revoke all on function public.create_return_visit_location_tx(uuid,text,text,text,text,integer,text,text,text,text,integer,double precision,double precision)
  from public, anon, authenticated;
grant execute on function public.create_return_visit_location_tx(uuid,text,text,text,text,integer,text,text,text,text,integer,double precision,double precision)
  to anon, authenticated;

notify pgrst, 'reload schema';
