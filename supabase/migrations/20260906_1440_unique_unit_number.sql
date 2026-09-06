-- 같은 건물에 203 / 203호처럼 표기만 다른 세대가 다시 생기지 않게 한다.
--
-- 중요한 UX 계약:
--   · 일괄 추가 중 이미 있는 호수는 오류가 아니라 건너뛴다.
--   · 새 호수는 전부 추가하고 생성/제외 개수를 한 번만 돌려준다.
--   · DB UNIQUE는 앱 밖의 쓰기와 동시 요청을 막는 마지막 방어선이다.

create or replace function public.normalize_unit_number(p_raw text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when regexp_replace(coalesce(p_raw, ''), '\s', '', 'g') ~ '^[A-Za-z]*0*\d+호?$'
      then upper((regexp_match(
             regexp_replace(coalesce(p_raw, ''), '\s', '', 'g'),
             '^([A-Za-z]*)0*(\d+)호?$'
           ))[1])
           || (regexp_match(
             regexp_replace(coalesce(p_raw, ''), '\s', '', 'g'),
             '^([A-Za-z]*)0*(\d+)호?$'
           ))[2]
    else regexp_replace(coalesce(p_raw, ''), '\s', '', 'g')
  end;
$$;

comment on function public.normalize_unit_number(text) is
  '같은 건물의 세대 중복 판정용. 101=101호=0101, B02=b2호로 본다.';

-- 운영에 남아 있던 표기 중복은 내용 없는 행만 제거한다.
-- 양쪽에 상태나 연결 기록이 있으면 자동 판단하지 않고 마이그레이션을 멈춘다.
do $$
declare
  v_group record;
  v_keep_id integer;
  v_meaningful_count integer;
begin
  for v_group in
    select
      building_id,
      public.normalize_unit_number(number) as normalized_number,
      array_agg(id order by id) as unit_ids
    from public.units
    group by building_id, public.normalize_unit_number(number)
    having count(*) > 1
  loop
    select count(*) into v_meaningful_count
    from public.units u
    where u.id = any(v_group.unit_ids)
      and (
        u.status <> '미방문'
        or coalesce(btrim(u.memo), '') <> ''
        or coalesce(u.is_chinese, false)
        or coalesce(u.is_restaurant, false)
        or u.usage_type is not null
        or u.naver_place_id is not null
        or exists (select 1 from public.visit_histories h where h.unit_id = u.id)
        or exists (select 1 from public.regular_visits r where r.unit_id = u.id)
        or exists (select 1 from public.return_visits r where r.unit_id = u.id)
        or exists (select 1 from public.event_restaurant_assignments a where a.unit_id = u.id)
        or exists (select 1 from public.phone_surveys p where p.unit_id = u.id)
        or exists (select 1 from public.place_change_requests p where p.unit_id = u.id)
      );

    if v_meaningful_count > 1 then
      raise exception '같은 건물의 % 세대 양쪽에 자료가 있어 자동 정리할 수 없습니다: %',
        v_group.normalized_number, v_group.unit_ids;
    end if;

    select u.id into v_keep_id
    from public.units u
    where u.id = any(v_group.unit_ids)
    order by (
      u.status <> '미방문'
      or coalesce(btrim(u.memo), '') <> ''
      or coalesce(u.is_chinese, false)
      or coalesce(u.is_restaurant, false)
      or u.usage_type is not null
      or u.naver_place_id is not null
      or exists (select 1 from public.visit_histories h where h.unit_id = u.id)
      or exists (select 1 from public.regular_visits r where r.unit_id = u.id)
      or exists (select 1 from public.return_visits r where r.unit_id = u.id)
      or exists (select 1 from public.event_restaurant_assignments a where a.unit_id = u.id)
      or exists (select 1 from public.phone_surveys p where p.unit_id = u.id)
      or exists (select 1 from public.place_change_requests p where p.unit_id = u.id)
    ) desc, u.id
    limit 1;

    delete from public.units
    where id = any(v_group.unit_ids) and id <> v_keep_id;
  end loop;
end;
$$;

create unique index if not exists units_building_normalized_number_unique
  on public.units (building_id, public.normalize_unit_number(number));

create or replace function public.add_units_to_building_tx(
  p_token uuid,
  p_building_id integer,
  p_unit_numbers text[],
  p_usage_type text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id integer;
  v_building_type text;
  v_raw text;
  v_number text;
  v_key text;
  v_existing public.units%rowtype;
  v_created public.units%rowtype;
  v_seen text[] := array[]::text[];
  v_created_rows jsonb := '[]'::jsonb;
  v_skipped_rows jsonb := '[]'::jsonb;
begin
  v_actor_id := public.verify_session(p_token);
  if v_actor_id is null then
    raise exception '세션이 유효하지 않습니다' using errcode = '42501';
  end if;
  if coalesce(array_length(p_unit_numbers, 1), 0) = 0 then
    raise exception '추가할 호수를 입력하세요';
  end if;
  if array_length(p_unit_numbers, 1) > 500 then
    raise exception '한 번에 추가할 수 있는 호수는 500개까지입니다';
  end if;
  if p_usage_type is not null and p_usage_type not in ('주택', '상가') then
    raise exception '세대 용도가 올바르지 않습니다';
  end if;

  -- 같은 건물에 대한 두 요청을 직렬화한다. UNIQUE 오류를 사용자에게 노출하지 않고
  -- 늦게 들어온 요청을 기존 호수 제외로 처리하기 위해서다.
  perform pg_advisory_xact_lock(9050601, p_building_id);
  select type into v_building_type
  from public.buildings
  where id = p_building_id
  for update;
  if v_building_type is null then raise exception '건물을 찾을 수 없습니다'; end if;

  foreach v_raw in array p_unit_numbers loop
    v_number := btrim(coalesce(v_raw, ''));
    v_key := public.normalize_unit_number(v_number);
    if v_key = '' then continue; end if;
    if length(v_number) > 200 then raise exception '호수 이름이 너무 깁니다'; end if;

    if v_key = any(v_seen) then
      v_skipped_rows := v_skipped_rows || jsonb_build_array(jsonb_build_object('id', null, 'number', v_number));
      continue;
    end if;
    v_seen := array_append(v_seen, v_key);

    select * into v_existing
    from public.units
    where building_id = p_building_id
      and public.normalize_unit_number(number) = v_key
    order by id
    limit 1;

    if v_existing.id is not null then
      v_skipped_rows := v_skipped_rows || jsonb_build_array(jsonb_build_object('id', v_existing.id, 'number', v_existing.number));
      continue;
    end if;

    insert into public.units (building_id, number, status, usage_type)
    values (
      p_building_id,
      v_number,
      '미방문',
      case
        when p_usage_type is null or p_usage_type = v_building_type then null
        else p_usage_type
      end
    )
    returning * into v_created;

    v_created_rows := v_created_rows || jsonb_build_array(jsonb_build_object(
      'id', v_created.id,
      'number', v_created.number,
      'status', v_created.status,
      'usage_type', v_created.usage_type
    ));
  end loop;

  return jsonb_build_object(
    'ok', true,
    'created', v_created_rows,
    'skipped', v_skipped_rows,
    'created_count', jsonb_array_length(v_created_rows),
    'skipped_count', jsonb_array_length(v_skipped_rows)
  );
end;
$$;

revoke all on function public.add_units_to_building_tx(uuid,integer,text[],text)
  from public, anon, authenticated;
grant execute on function public.add_units_to_building_tx(uuid,integer,text[],text)
  to anon, authenticated;

notify pgrst, 'reload schema';
