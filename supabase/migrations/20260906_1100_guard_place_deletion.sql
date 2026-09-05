-- 건물·세대 삭제를 역할과 연결 자료에 따라 제한한다.
-- 생성은 모든 승인 사용자가 계속 할 수 있다. 삭제만 이 RPC로 모은다.

alter table public.place_change_requests
  drop constraint if exists place_change_requests_request_type_check;
alter table public.place_change_requests
  add constraint place_change_requests_request_type_check check (request_type in (
    'building_missing', 'unit_missing', 'details_wrong', 'duplicate_place', 'remove_place', 'other'
  ));

-- 1000이 이미 적용된 DB도 새 요청 종류를 받을 수 있게 공개 함수의 검증을 함께 갱신한다.
create or replace function public.submit_place_change_request_tx(
  p_token uuid,
  p_request_type text,
  p_building_id bigint default null,
  p_unit_id bigint default null,
  p_return_visit_id bigint default null,
  p_note text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id integer;
  v_actor_name text;
  v_building_id bigint := p_building_id;
  v_unit_id bigint := p_unit_id;
  v_building_name text;
  v_address text;
  v_unit_number text;
  v_id bigint;
begin
  v_actor_id := public.verify_session(p_token);
  select name into v_actor_name from public.app_users where id = v_actor_id;
  if coalesce(btrim(v_actor_name), '') = '' then
    raise exception '로그인 사용자를 찾을 수 없습니다' using errcode = '42501';
  end if;
  if p_request_type not in (
    'building_missing', 'unit_missing', 'details_wrong', 'duplicate_place', 'remove_place', 'other'
  ) then
    raise exception '요청 종류가 올바르지 않습니다';
  end if;

  if p_return_visit_id is not null then
    select coalesce(v_building_id, rv.building_id), coalesce(v_unit_id, rv.unit_id)
      into v_building_id, v_unit_id
    from public.return_visits rv where rv.id = p_return_visit_id;
  end if;
  if v_unit_id is not null then
    select u.number, b.id, b.name, b.address
      into v_unit_number, v_building_id, v_building_name, v_address
    from public.units u join public.buildings b on b.id = u.building_id
    where u.id = v_unit_id;
  elsif v_building_id is not null then
    select b.name, b.address into v_building_name, v_address
    from public.buildings b where b.id = v_building_id;
  elsif p_return_visit_id is not null then
    select rv.display_name, rv.address, rv.unit_number
      into v_building_name, v_address, v_unit_number
    from public.return_visits rv where rv.id = p_return_visit_id;
  end if;

  insert into public.place_change_requests (
    request_type, building_id, unit_id, return_visit_id,
    building_name, address, unit_number, note,
    requested_by_id, requested_by_name
  ) values (
    p_request_type, v_building_id, v_unit_id, p_return_visit_id,
    v_building_name, v_address, v_unit_number, left(btrim(coalesce(p_note, '')), 1000),
    v_actor_id, v_actor_name
  ) returning id into v_id;

  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

revoke all on function public.submit_place_change_request_tx(uuid,text,bigint,bigint,bigint,text)
  from public, anon, authenticated;
grant execute on function public.submit_place_change_request_tx(uuid,text,bigint,bigint,bigint,text)
  to anon, authenticated;

create or replace function private.place_has_linked_data(
  p_target_type text,
  p_target_id bigint
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_linked boolean;
begin
  if p_target_type = 'unit' then
    select exists (
      select 1 from public.units
      where id = p_target_id
        and created_at < now() - interval '30 minutes'
        and (
          status is distinct from '미방문'
          or coalesce(btrim(memo), '') <> ''
          or is_chinese
          or is_restaurant
          or coalesce(btrim(naver_place_id), '') <> ''
        )
    )
      or exists (select 1 from public.visit_histories where unit_id = p_target_id)
      or exists (select 1 from public.regular_visits where unit_id = p_target_id)
      or exists (select 1 from public.return_visits where unit_id = p_target_id)
      or exists (select 1 from public.phone_surveys where unit_id = p_target_id)
      or exists (select 1 from public.event_restaurant_assignments where unit_id = p_target_id)
    into v_linked;
  elsif p_target_type = 'building' then
    select exists (
      select 1 from public.buildings
      where id = p_target_id
        and created_at < now() - interval '30 minutes'
        and (
          warning
          or coalesce(btrim(memo), '') <> ''
          or is_chinese_heavy
          or is_restaurant
        )
    )
      or exists (
      select 1
      from public.units u
      where u.building_id = p_target_id
        and private.place_has_linked_data('unit', u.id)
    )
      or exists (select 1 from public.return_visits where building_id = p_target_id)
      or exists (select 1 from public.restaurant_requests where building_id = p_target_id)
      or exists (select 1 from public.event_restaurant_assignments where building_id = p_target_id)
    into v_linked;
  else
    raise exception '삭제 대상 종류가 올바르지 않습니다';
  end if;
  return coalesce(v_linked, false);
end;
$$;

revoke all on function private.place_has_linked_data(text,bigint) from public, anon, authenticated;

create or replace function public.delete_place_or_request_tx(
  p_token uuid,
  p_target_type text,
  p_target_id bigint,
  p_request_type text default null,
  p_note text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id integer;
  v_actor_role text;
  v_exists boolean;
  v_has_links boolean;
  v_request jsonb;
  v_request_type text;
begin
  v_actor_id := public.verify_session(p_token);
  select role into v_actor_role from public.app_users where id = v_actor_id;
  if p_target_type not in ('building', 'unit') then
    raise exception '삭제 대상 종류가 올바르지 않습니다';
  end if;

  if p_target_type = 'building' then
    select exists(select 1 from public.buildings where id = p_target_id) into v_exists;
  else
    select exists(select 1 from public.units where id = p_target_id) into v_exists;
  end if;
  if not v_exists then raise exception '장소를 찾을 수 없습니다'; end if;

  v_has_links := private.place_has_linked_data(p_target_type, p_target_id);
  if v_actor_role = 'user' or (v_actor_role = 'leader' and v_has_links) then
    v_request_type := coalesce(p_request_type, 'remove_place');
    v_request := public.submit_place_change_request_tx(
      p_token,
      v_request_type,
      case when p_target_type = 'building' then p_target_id else null end,
      case when p_target_type = 'unit' then p_target_id else null end,
      null,
      p_note
    );
    return jsonb_build_object(
      'ok', true,
      'action', 'requested',
      'request_id', v_request -> 'id',
      'has_linked_data', v_has_links
    );
  end if;

  if not coalesce(v_actor_role in ('leader', 'admin', 'developer'), false) then
    raise exception '장소를 삭제할 권한이 없습니다' using errcode = '42501';
  end if;

  if p_target_type = 'unit' then
    delete from public.units where id = p_target_id;
  else
    delete from public.buildings where id = p_target_id;
  end if;

  return jsonb_build_object('ok', true, 'action', 'deleted', 'has_linked_data', v_has_links);
end;
$$;

revoke all on function public.delete_place_or_request_tx(uuid,text,bigint,text,text)
  from public, anon, authenticated;
grant execute on function public.delete_place_or_request_tx(uuid,text,bigint,text,text)
  to anon, authenticated;

-- 직접 DELETE는 관리자·개발자만 허용한다. 인도자와 일반 사용자는 위 RPC를 쓴다.
drop policy if exists "TEMP_session_gate_buildings_del" on public.buildings;
drop policy if exists buildings_delete_admin on public.buildings;
create policy buildings_delete_admin on public.buildings
  for delete to anon, authenticated
  using ((select private.request_is_admin()));

drop policy if exists "TEMP_session_gate_units_del" on public.units;
drop policy if exists units_delete_admin on public.units;
create policy units_delete_admin on public.units
  for delete to anon, authenticated
  using ((select private.request_is_admin()));

revoke truncate, references, trigger on public.buildings from public, anon, authenticated;
revoke truncate, references, trigger on public.units from public, anon, authenticated;

notify pgrst, 'reload schema';
