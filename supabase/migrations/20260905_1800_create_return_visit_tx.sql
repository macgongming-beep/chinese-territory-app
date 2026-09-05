-- 수동 정기방문 생성과 기존 세대 연결, 첫 기록을 한 트랜잭션으로 처리한다.

do $$
begin
  if exists (
    select 1 from public.return_visits
    where unit_id is not null
    group by unit_id having count(*) > 1
  ) then
    raise exception 'return_visits.unit_id 중복을 먼저 정리해야 합니다';
  end if;
end $$;

create unique index if not exists return_visits_unit_id_unique
  on public.return_visits (unit_id)
  where unit_id is not null;

create or replace function public.create_return_visit_tx(
  p_token uuid,
  p_display_name text,
  p_address text default '',
  p_memo text default '',
  p_first_result text default null,
  p_unit_id bigint default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id integer;
  v_actor_name text;
  v_building_id bigint;
  v_building_address text;
  v_unit_number text;
  v_regular_visitor text;
  v_existing_assignee text;
  v_return_visit_id bigint;
  v_created boolean := false;
  v_now timestamptz := now();
  v_memo text := btrim(coalesce(p_memo, ''));
begin
  v_actor_id := public.verify_session(p_token);
  select name into v_actor_name from public.app_users where id = v_actor_id;
  if coalesce(btrim(v_actor_name), '') = '' then
    raise exception '로그인 사용자를 찾을 수 없습니다' using errcode = '42501';
  end if;
  if coalesce(btrim(p_display_name), '') = '' then
    raise exception '정기방문 이름을 입력하세요';
  end if;
  if p_first_result is not null and p_first_result not in ('만남', '부재') then
    raise exception '첫 방문 결과가 올바르지 않습니다';
  end if;

  if p_unit_id is not null then
    select u.building_id, u.number, b.address
      into v_building_id, v_unit_number, v_building_address
    from public.units u
    join public.buildings b on b.id = u.building_id
    where u.id = p_unit_id
    for update of u, b;
    if not found then raise exception '연결할 세대를 찾을 수 없습니다'; end if;

    select visitor_name into v_regular_visitor
    from public.regular_visits where unit_id = p_unit_id for update;
    if v_regular_visitor is not null and btrim(v_regular_visitor) <> btrim(v_actor_name) then
      raise exception '이미 %님이 정기방문을 담당하고 있습니다', v_regular_visitor;
    end if;

    select id, assigned_user_name into v_return_visit_id, v_existing_assignee
    from public.return_visits where unit_id = p_unit_id for update;
    if v_return_visit_id is not null
       and btrim(coalesce(v_existing_assignee, '')) <> btrim(v_actor_name) then
      raise exception '이미 %님이 활동 정기방문을 담당하고 있습니다', coalesce(nullif(btrim(v_existing_assignee), ''), '다른 사용자');
    end if;

    if v_regular_visitor is null then
      insert into public.regular_visits (unit_id, visitor_name, registered_at)
      values (p_unit_id, v_actor_name, v_now)
      on conflict (unit_id) do nothing;
    end if;

    if v_return_visit_id is null then
      insert into public.return_visits (
        unit_id, building_id, display_name, nickname, address, unit_number,
        assigned_user_name, created_by, created_at
      ) values (
        p_unit_id, v_building_id, btrim(p_display_name), btrim(p_display_name),
        coalesce(v_building_address, ''), coalesce(v_unit_number, ''),
        v_actor_name, v_actor_name, v_now
      ) returning id into v_return_visit_id;
      v_created := true;
    end if;
  else
    insert into public.return_visits (
      unit_id, building_id, display_name, nickname, address, unit_number,
      assigned_user_name, created_by, created_at
    ) values (
      null, null, btrim(p_display_name), btrim(p_display_name), btrim(coalesce(p_address, '')), '',
      v_actor_name, v_actor_name, v_now
    ) returning id into v_return_visit_id;
    v_created := true;
  end if;

  if (p_first_result is not null or v_memo <> '') and not exists (
    select 1 from public.return_visit_logs l
    where l.return_visit_id = v_return_visit_id
      and l.created_by = v_actor_name
      and l.result is not distinct from p_first_result
      and coalesce(l.memo, '') = v_memo
      and l.visited_at::date = v_now::date
  ) then
    insert into public.return_visit_logs (
      return_visit_id, visited_at, result, memo, created_by
    ) values (
      v_return_visit_id, v_now, p_first_result, v_memo, v_actor_name
    );
  end if;

  if p_first_result is not null then
    update public.return_visits
    set last_visited_at = v_now, last_result = p_first_result
    where id = v_return_visit_id;
  end if;

  return jsonb_build_object(
    'id', v_return_visit_id,
    'created', v_created,
    'unit_id', p_unit_id,
    'building_id', v_building_id
  );
end;
$$;

revoke all on function public.create_return_visit_tx(uuid,text,text,text,text,bigint)
  from public, anon, authenticated;
grant execute on function public.create_return_visit_tx(uuid,text,text,text,text,bigint)
  to anon, authenticated;

-- 세대에 연결된 항목의 주소는 건물 주소에서 온다. 글자만 따로 바꾸면 연결과 어긋난다.
create or replace function public.guard_linked_return_visit_address()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_building_address text;
begin
  if old.unit_id is not null and new.address is distinct from old.address then
    select b.address into v_building_address
    from public.units u
    join public.buildings b on b.id = u.building_id
    where u.id = old.unit_id;

    if new.address is distinct from v_building_address then
      raise exception '세대에 연결된 정기방문은 주소만 따로 바꿀 수 없습니다';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists guard_linked_return_visit_address_trigger on public.return_visits;
create trigger guard_linked_return_visit_address_trigger
before update on public.return_visits
for each row execute function public.guard_linked_return_visit_address();

-- 건물 주소를 고치면 연결된 활동 정기방문의 중복 주소도 같은 트랜잭션에서 맞춘다.
create or replace function public.sync_linked_return_visit_address()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.address is distinct from old.address then
    update public.return_visits
    set address = new.address
    where building_id = new.id
      and unit_id is not null
      and address is distinct from new.address;
  end if;
  return new;
end;
$$;

revoke all on function public.sync_linked_return_visit_address()
  from public, anon, authenticated;

drop trigger if exists sync_linked_return_visit_address_trigger on public.buildings;
create trigger sync_linked_return_visit_address_trigger
after update of address on public.buildings
for each row execute function public.sync_linked_return_visit_address();

-- 관리자·인도자만 검색 후보에서 새 건물/세대를 만들 수 있다.
-- 주소 key는 lock에만 쓰고, 동일 건물 판정은 실거리 200m를 함께 본다.
create or replace function public.create_return_visit_location_tx(
  p_token uuid,
  p_display_name text,
  p_address text,
  p_memo text default '',
  p_first_result text default null,
  p_existing_building_id integer default null,
  p_building_name text default null,
  p_unit_number text default null,
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
  v_result jsonb;
begin
  v_actor_id := public.verify_session(p_token);
  select role into v_role from public.app_users where id = v_actor_id;
  if not coalesce(v_role in ('admin', 'developer', 'leader'), false) then
    raise exception '관리자 또는 인도자만 새 건물과 세대를 만들 수 있습니다' using errcode = '42501';
  end if;
  if v_address = '' or v_unit_number = '' then
    raise exception '주소와 세대 이름을 입력하세요';
  end if;
  if length(v_address) > 500 or length(v_unit_number) > 200 then
    raise exception '주소 또는 세대 이름이 너무 깁니다';
  end if;

  v_address_key := private.restaurant_address_key(v_address);
  perform pg_advisory_xact_lock(hashtextextended(v_address_key, 9051800));

  if p_existing_building_id is not null then
    select id into v_building_id
    from public.buildings
    where id = p_existing_building_id
    for update;
    if v_building_id is null then raise exception '선택한 건물을 찾을 수 없습니다'; end if;
  else
    if not coalesce(p_lat between -90 and 90 and p_lng between -180 and 180, false)
       or (p_lat = 0 and p_lng = 0) then
      raise exception '검색 후보에서 주소를 선택하세요';
    end if;

    select count(*), min(id) into v_match_count, v_building_id
    from public.buildings
    where private.same_building_location(address, lat, lng, v_address, p_lat, p_lng);
    if v_match_count > 1 then
      raise exception '가까운 같은 주소 건물이 여러 개입니다. 기존 건물을 선택하세요';
    end if;
  end if;

  if v_building_id is null then
    v_card_id := p_card_id;
    if v_card_id is null then
      select id into v_card_id from public.cards where name = '미배정 건물' order by id limit 1;
    end if;
    if v_card_id is null or not exists (select 1 from public.cards where id = v_card_id) then
      raise exception '등록할 구역 카드가 없습니다. 미배정 건물 카드를 확인하세요';
    end if;

    insert into public.buildings (card_id, name, address, type, lat, lng)
    values (
      v_card_id,
      coalesce(nullif(btrim(p_building_name), ''), v_address),
      v_address,
      '주택',
      p_lat,
      p_lng
    )
    returning id into v_building_id;
  end if;

  select count(*), min(id) into v_match_count, v_unit_id
  from public.units
  where building_id = v_building_id
    and lower(btrim(number)) = lower(v_unit_number);
  if v_match_count > 1 then raise exception '같은 이름의 세대가 여러 개입니다'; end if;
  if v_unit_id is null then
    insert into public.units (building_id, number, status, is_chinese)
    values (v_building_id, v_unit_number, '미방문', true)
    returning id into v_unit_id;
  end if;

  v_result := public.create_return_visit_tx(
    p_token,
    p_display_name,
    v_address,
    p_memo,
    p_first_result,
    v_unit_id
  );
  return v_result || jsonb_build_object('building_id', v_building_id, 'unit_id', v_unit_id);
end;
$$;

revoke all on function public.create_return_visit_location_tx(uuid,text,text,text,text,integer,text,text,integer,double precision,double precision)
  from public, anon, authenticated;
grant execute on function public.create_return_visit_location_tx(uuid,text,text,text,text,integer,text,text,integer,double precision,double precision)
  to anon, authenticated;

notify pgrst, 'reload schema';
