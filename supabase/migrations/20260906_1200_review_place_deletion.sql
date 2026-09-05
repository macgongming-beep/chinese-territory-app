-- 연결 자료가 있는 장소는 관리자도 요청함에서 영향 범위를 확인한 뒤 삭제한다.
-- 반려는 상태만 바꾸며, 실제 삭제는 execute_place_deletion_request_tx 한 곳에서만 한다.

alter table public.place_change_requests
  add column if not exists impact_snapshot jsonb not null default '{}'::jsonb;

create or replace function private.place_impact_snapshot(
  p_target_type text,
  p_target_id bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if p_target_type = 'unit' then
    select jsonb_build_object(
      'unit_count', case when exists(select 1 from public.units where id = p_target_id) then 1 else 0 end,
      'visit_history_count', (select count(*) from public.visit_histories where unit_id = p_target_id),
      'regular_visit_count', (select count(*) from public.regular_visits where unit_id = p_target_id),
      'return_visit_count', (select count(*) from public.return_visits where unit_id = p_target_id),
      'phone_survey_count', (select count(*) from public.phone_surveys where unit_id = p_target_id),
      'assignment_count', (select count(*) from public.event_restaurant_assignments where unit_id = p_target_id)
    ) into v_result;
  elsif p_target_type = 'building' then
    select jsonb_build_object(
      'unit_count', (select count(*) from public.units where building_id = p_target_id),
      'visit_history_count', (
        select count(*) from public.visit_histories vh
        join public.units u on u.id = vh.unit_id
        where u.building_id = p_target_id
      ),
      'regular_visit_count', (
        select count(*) from public.regular_visits rv
        join public.units u on u.id = rv.unit_id
        where u.building_id = p_target_id
      ),
      'return_visit_count', (
        select count(distinct rv.id) from public.return_visits rv
        left join public.units u on u.id = rv.unit_id
        where rv.building_id = p_target_id or u.building_id = p_target_id
      ),
      'phone_survey_count', (
        select count(*) from public.phone_surveys ps
        join public.units u on u.id = ps.unit_id
        where u.building_id = p_target_id
      ),
      'assignment_count', (
        select count(distinct era.id) from public.event_restaurant_assignments era
        left join public.units u on u.id = era.unit_id
        where era.building_id = p_target_id or u.building_id = p_target_id
      )
    ) into v_result;
  else
    return '{}'::jsonb;
  end if;
  return coalesce(v_result, '{}'::jsonb);
end;
$$;

revoke all on function private.place_impact_snapshot(text,bigint)
  from public, anon, authenticated;

create or replace function private.set_place_change_request_impact()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.unit_id is not null then
    new.impact_snapshot := private.place_impact_snapshot('unit', new.unit_id);
  elsif new.building_id is not null then
    new.impact_snapshot := private.place_impact_snapshot('building', new.building_id);
  else
    new.impact_snapshot := '{}'::jsonb;
  end if;
  return new;
end;
$$;

revoke all on function private.set_place_change_request_impact()
  from public, anon, authenticated;

drop trigger if exists set_place_change_request_impact on public.place_change_requests;
create trigger set_place_change_request_impact
  before insert on public.place_change_requests
  for each row execute function private.set_place_change_request_impact();

update public.place_change_requests r
set impact_snapshot = case
  when r.unit_id is not null then private.place_impact_snapshot('unit', r.unit_id)
  when r.building_id is not null then private.place_impact_snapshot('building', r.building_id)
  else '{}'::jsonb
end
where r.status = 'pending';

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
  v_existing_request_id bigint;
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
  if v_actor_role = 'user' or v_has_links then
    select id into v_existing_request_id
    from public.place_change_requests
    where status = 'pending'
      and request_type = 'remove_place'
      and (
        (p_target_type = 'unit' and unit_id = p_target_id)
        or (p_target_type = 'building' and building_id = p_target_id and unit_id is null)
      )
    order by id desc limit 1;
    if v_existing_request_id is not null then
      update public.place_change_requests
      set impact_snapshot = private.place_impact_snapshot(p_target_type, p_target_id)
      where id = v_existing_request_id;
      return jsonb_build_object(
        'ok', true, 'action', 'requested', 'request_id', v_existing_request_id,
        'has_linked_data', v_has_links, 'already_requested', true
      );
    end if;

    v_request := public.submit_place_change_request_tx(
      p_token,
      'remove_place',
      case when p_target_type = 'building' then p_target_id else null end,
      case when p_target_type = 'unit' then p_target_id else null end,
      null,
      p_note
    );
    return jsonb_build_object(
      'ok', true, 'action', 'requested', 'request_id', v_request -> 'id',
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
  return jsonb_build_object('ok', true, 'action', 'deleted', 'has_linked_data', false);
end;
$$;

revoke all on function public.delete_place_or_request_tx(uuid,text,bigint,text,text)
  from public, anon, authenticated;
grant execute on function public.delete_place_or_request_tx(uuid,text,bigint,text,text)
  to anon, authenticated;

create or replace function public.refresh_place_change_request_impacts_tx(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id integer;
  v_actor_role text;
  v_count integer;
begin
  v_actor_id := public.verify_session(p_token);
  select role into v_actor_role from public.app_users where id = v_actor_id;
  if not coalesce(v_actor_role in ('admin', 'developer'), false) then
    raise exception '관리자만 요청 영향을 조회할 수 있습니다' using errcode = '42501';
  end if;

  update public.place_change_requests r
  set impact_snapshot = case
    when r.unit_id is not null then private.place_impact_snapshot('unit', r.unit_id)
    when r.building_id is not null then private.place_impact_snapshot('building', r.building_id)
    else r.impact_snapshot
  end
  where r.status = 'pending';
  get diagnostics v_count = row_count;
  return jsonb_build_object('ok', true, 'updated', v_count);
end;
$$;

revoke all on function public.refresh_place_change_request_impacts_tx(uuid)
  from public, anon, authenticated;
grant execute on function public.refresh_place_change_request_impacts_tx(uuid)
  to anon, authenticated;

create or replace function public.execute_place_deletion_request_tx(
  p_token uuid,
  p_request_id bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id integer;
  v_actor_name text;
  v_actor_role text;
  v_request public.place_change_requests%rowtype;
  v_target_type text;
  v_target_id bigint;
  v_impact jsonb;
begin
  v_actor_id := public.verify_session(p_token);
  select name, role into v_actor_name, v_actor_role from public.app_users where id = v_actor_id;
  if not coalesce(v_actor_role in ('admin', 'developer'), false) then
    raise exception '관리자만 장소 삭제를 확정할 수 있습니다' using errcode = '42501';
  end if;

  select * into v_request from public.place_change_requests
  where id = p_request_id and status = 'pending'
  for update;
  if not found then raise exception '처리할 삭제 요청을 찾을 수 없습니다'; end if;
  if v_request.request_type <> 'remove_place' then
    raise exception '장소 삭제 요청이 아닙니다';
  end if;

  if v_request.unit_id is not null then
    v_target_type := 'unit';
    v_target_id := v_request.unit_id;
  elsif v_request.building_id is not null then
    v_target_type := 'building';
    v_target_id := v_request.building_id;
  else
    raise exception '삭제할 장소가 이미 없거나 연결이 끊겼습니다';
  end if;

  v_impact := private.place_impact_snapshot(v_target_type, v_target_id);
  if v_target_type = 'unit' then
    delete from public.units where id = v_target_id;
  else
    delete from public.buildings where id = v_target_id;
  end if;
  if not found then raise exception '삭제할 장소가 이미 없습니다'; end if;

  update public.place_change_requests
  set status = 'completed',
      impact_snapshot = v_impact,
      reviewed_by_name = v_actor_name,
      review_note = '삭제 실행',
      reviewed_at = now()
  where id = p_request_id;

  return jsonb_build_object('ok', true, 'action', 'deleted', 'impact', v_impact);
end;
$$;

revoke all on function public.execute_place_deletion_request_tx(uuid,bigint)
  from public, anon, authenticated;
grant execute on function public.execute_place_deletion_request_tx(uuid,bigint)
  to anon, authenticated;

create or replace function private.guard_place_deletion_completion()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.request_type = 'remove_place'
     and old.status = 'pending'
     and new.status = 'completed'
     and new.review_note is distinct from '삭제 실행' then
    raise exception '삭제 요청은 영구 삭제를 실행해야 완료할 수 있습니다' using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function private.guard_place_deletion_completion()
  from public, anon, authenticated;

drop trigger if exists guard_place_deletion_completion on public.place_change_requests;
create trigger guard_place_deletion_completion
  before update on public.place_change_requests
  for each row execute function private.guard_place_deletion_completion();

notify pgrst, 'reload schema';
