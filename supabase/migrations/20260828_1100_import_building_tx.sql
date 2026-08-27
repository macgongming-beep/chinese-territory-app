-- CSV 로 건물을 올릴 때 **건물 하나를 통째로** 한 트랜잭션에 묶는다.
--
-- 지금은 건물 → 세대 → 정기방문 → 방문기록을 따로 넣는다.
-- 세대나 정기방문이 실패하면 `skipped += 1; continue` 로 넘어가는데,
-- **이미 들어간 건물은 그대로 남는다.** 세대가 하나도 없는 건물이 생긴다.
-- 방문기록 실패는 아예 조용하다.
--
-- 하나라도 실패하면 그 건물은 통째로 안 들어간다. 반쯤 들어간 건물은 안 생긴다.

create or replace function public.import_building_tx(
  p_token    uuid,
  p_building jsonb,   -- { card_id, name, address, type, lat, lng, warning? }  warning 은 boolean 또는 글자
  p_units    jsonb    -- [{ number, status, is_chinese, is_restaurant, naver_place_id?,
                      --    memo?, regular_visitor?, regular_visitor_start_date?,
                      --    visits: [{ result, visitor_name, visited_at, time_slot?, memo? }] }]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id   integer;
  v_actor_role text;
  v_building_id integer;
  v_unit        jsonb;
  v_unit_id     integer;
  v_visit       jsonb;
  v_units       integer := 0;
  v_visits      integer := 0;
  v_regulars    integer := 0;
begin
  v_actor_id := public.verify_session(p_token);
  if v_actor_id is null then
    raise exception '세션이 유효하지 않습니다';
  end if;
  select role into v_actor_role from public.app_users where id = v_actor_id;
  if v_actor_role not in ('admin', 'developer') then
    raise exception 'CSV 올리기는 관리자만 할 수 있습니다';
  end if;

  insert into public.buildings (card_id, name, address, type, lat, lng, warning)
  values (
    (p_building->>'card_id')::integer,
    p_building->>'name',
    p_building->>'address',
    coalesce(p_building->>'type', '주택'),
    coalesce((p_building->>'lat')::double precision, 0),
    coalesce((p_building->>'lng')::double precision, 0),
    -- ⚠ buildings.warning 은 **boolean** 이다.
    --   CSV 쪽은 '방문금지' 같은 글자를 보내고 있었고, 그게 boolean 칸에 들어가려다
    --   실패해서 그 건물이 통째로 조용히 건너뛰어졌다 (skipped += 1).
    --   글자가 오면 '경고 있음' 으로 본다.
    coalesce(
      case
        when p_building->'warning' is null then false
        when jsonb_typeof(p_building->'warning') = 'boolean' then (p_building->>'warning')::boolean
        else nullif(btrim(p_building->>'warning'), '') is not null
      end, false)
  )
  returning id into v_building_id;

  for v_unit in select * from jsonb_array_elements(coalesce(p_units, '[]'::jsonb))
  loop
    insert into public.units (building_id, number, status, is_chinese, is_restaurant, naver_place_id, memo)
    values (
      v_building_id,
      v_unit->>'number',
      coalesce(v_unit->>'status', '미방문'),
      coalesce((v_unit->>'is_chinese')::boolean, false),
      coalesce((v_unit->>'is_restaurant')::boolean, false),
      nullif(v_unit->>'naver_place_id', ''),
      nullif(v_unit->>'memo', '')
    )
    returning id into v_unit_id;
    v_units := v_units + 1;

    if nullif(v_unit->>'regular_visitor', '') is not null then
      insert into public.regular_visits (unit_id, visitor_name, registered_at)
      values (
        v_unit_id,
        v_unit->>'regular_visitor',
        coalesce(nullif(v_unit->>'regular_visitor_start_date', '')::timestamptz, now())
      );
      v_regulars := v_regulars + 1;
    end if;

    for v_visit in select * from jsonb_array_elements(coalesce(v_unit->'visits', '[]'::jsonb))
    loop
      insert into public.visit_histories (unit_id, result, visitor_name, visited_at, time_slot, memo)
      values (
        v_unit_id,
        v_visit->>'result',
        coalesce(v_visit->>'visitor_name', ''),
        (v_visit->>'visited_at')::timestamptz,
        nullif(v_visit->>'time_slot', ''),
        nullif(v_visit->>'memo', '')
      );
      v_visits := v_visits + 1;
    end loop;
  end loop;

  return jsonb_build_object('ok', true, 'building_id', v_building_id,
                            'units', v_units, 'regulars', v_regulars, 'visits', v_visits);
end;
$$;

revoke all on function public.import_building_tx(uuid, jsonb, jsonb) from public;
grant execute on function public.import_building_tx(uuid, jsonb, jsonb) to anon, authenticated;

notify pgrst, 'reload schema';
