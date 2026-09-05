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

notify pgrst, 'reload schema';
