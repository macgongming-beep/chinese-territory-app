-- Direct registration: one building and one restaurant unit, never a partial write.
create or replace function public.register_restaurant_tx(
  p_token uuid,
  p_name text,
  p_address text,
  p_existing_building_id integer default null,
  p_card_id integer default null,
  p_lat double precision default 0,
  p_lng double precision default 0
)
returns jsonb
language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor integer;
  v_role text;
  v_building integer;
  v_unit integer;
  v_card integer;
  v_address text := btrim(p_address);
  v_name text := btrim(p_name);
  v_matches integer;
begin
  v_actor := public.verify_session(p_token);
  select role into v_role from public.app_users where id = v_actor;
  if not coalesce(v_role in ('admin', 'developer', 'leader'), false) then
    raise exception '관리자 또는 인도자만 식당을 등록할 수 있습니다' using errcode = '42501';
  end if;
  if coalesce(v_name, '') = '' or coalesce(v_address, '') = '' then
    raise exception '식당 이름과 주소를 입력하세요';
  end if;
  if length(v_name) > 200 or length(v_address) > 500 then
    raise exception '식당 이름 또는 주소가 너무 깁니다';
  end if;
  if not coalesce(p_lat between -90 and 90 and p_lng between -180 and 180, false) then
    raise exception '좌표가 올바르지 않습니다';
  end if;

  -- Serialize same-address requests, including double taps/retries.
  perform pg_advisory_xact_lock(hashtextextended(regexp_replace(v_address, '\s', '', 'g'), 9051600));
  if p_existing_building_id is not null then
    select id into v_building from public.buildings
      where id = p_existing_building_id and type = '상가' for update;
    if v_building is null then raise exception '선택한 상가 건물을 찾을 수 없습니다'; end if;
  else
    select count(*), min(id) into v_matches, v_building from public.buildings
      where regexp_replace(address, '\s', '', 'g') = regexp_replace(v_address, '\s', '', 'g');
    if v_matches > 1 then raise exception '같은 주소의 건물이 여러 개입니다. 기존 건물을 선택하세요'; end if;
    if v_building is not null then
      perform 1 from public.buildings where id = v_building and type = '상가' for update;
      if not found then raise exception '같은 주소에 상가가 아닌 건물이 있습니다. 건물 정보를 확인하세요'; end if;
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
      values (v_card, v_address, v_address, '상가', p_lat, p_lng, true) returning id into v_building;
  end if;
  -- Reuse only the same named unit, never the first unrelated shop in a building.
  select count(*), min(id) into v_matches, v_unit from public.units
    where building_id = v_building and lower(btrim(number)) = lower(v_name);
  if v_matches > 1 then raise exception '같은 이름의 세대가 여러 개입니다. 세대 정보를 확인하세요'; end if;
  if v_unit is null then
    insert into public.units (building_id, number, status, is_chinese, is_restaurant)
      values (v_building, v_name, '미방문', false, true) returning id into v_unit;
  else
    update public.units set is_restaurant = true where id = v_unit;
  end if;
  update public.buildings set is_restaurant = true where id = v_building;
  return jsonb_build_object('building_id', v_building, 'unit_id', v_unit);
end;
$$;
revoke all on function public.register_restaurant_tx(uuid, text, text, integer, integer, double precision, double precision) from public, anon, authenticated;
grant execute on function public.register_restaurant_tx(uuid, text, text, integer, integer, double precision, double precision) to anon, authenticated;
notify pgrst, 'reload schema';
