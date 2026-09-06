-- 과거에는 건물 전체의 출입불가를 `출입불가`라는 가짜 세대로 표현했다.
-- 1400 마이그레이션에서 건물 상태와 건물 출입 이력으로 옮겼으므로,
-- 연결 자료가 모두 보존됐는지 다시 검증한 뒤 가짜 세대만 제거한다.
do $$
declare
  v_unit_ids integer[];
  v_history_ids integer[];
  v_unit_count integer;
  v_history_count integer;
  v_deleted integer;
begin
  -- 검사와 삭제 사이에 새 기록이 붙지 않게 관련 쓰기를 잠깐 막는다.
  lock table public.units in share row exclusive mode;
  lock table public.visit_histories in share row exclusive mode;
  lock table public.regular_visits in share row exclusive mode;
  lock table public.return_visits in share row exclusive mode;
  lock table public.event_restaurant_assignments in share row exclusive mode;
  lock table public.phone_surveys in share row exclusive mode;
  lock table public.place_change_requests in share row exclusive mode;

  select coalesce(array_agg(u.id order by u.id), '{}'::integer[])
  into v_unit_ids
  from public.units u
  where btrim(u.number) = '출입불가';

  v_unit_count := cardinality(v_unit_ids);
  if v_unit_count = 0 then
    raise notice '정리할 출입불가 가짜 세대가 없습니다';
    return;
  end if;

  if exists (
    select 1
    from public.units u
    join public.buildings b on b.id = u.building_id
    where u.id = any(v_unit_ids)
      and b.access_status <> 'blocked'
  ) then
    raise exception '출입불가 건물 상태로 이관되지 않은 가짜 세대가 있습니다';
  end if;

  select coalesce(array_agg(vh.id order by vh.id), '{}'::integer[])
  into v_history_ids
  from public.visit_histories vh
  where vh.unit_id = any(v_unit_ids);
  v_history_count := cardinality(v_history_ids);

  if exists (
    select 1
    from public.visit_histories vh
    join public.units u on u.id = vh.unit_id
    where vh.unit_id = any(v_unit_ids)
      and not exists (
        select 1
        from public.building_access_events bae
        where bae.source_visit_history_id = vh.id
          and bae.building_id = u.building_id
          and bae.action = 'blocked'
          and bae.visitor_name = vh.visitor_name
          and bae.visited_at = vh.visited_at
          and bae.time_slot is not distinct from vh.time_slot
          and bae.memo is not distinct from vh.memo
      )
  ) then
    raise exception '건물 출입 이력으로 정확히 복사되지 않은 방문 기록이 있습니다';
  end if;

  if exists (select 1 from public.regular_visits where unit_id = any(v_unit_ids))
     or exists (select 1 from public.return_visits where unit_id = any(v_unit_ids))
     or exists (select 1 from public.event_restaurant_assignments where unit_id = any(v_unit_ids))
     or exists (select 1 from public.phone_surveys where unit_id = any(v_unit_ids))
     or exists (select 1 from public.place_change_requests where unit_id = any(v_unit_ids)) then
    raise exception '가짜 세대에 방문 기록 외의 연결 자료가 남아 있습니다';
  end if;

  delete from public.units
  where id = any(v_unit_ids);
  get diagnostics v_deleted = row_count;

  if v_deleted <> v_unit_count then
    raise exception '가짜 세대 삭제 수가 예상과 다릅니다: 예상 %, 실제 %', v_unit_count, v_deleted;
  end if;

  if v_history_count > 0 and (
    select count(*)
    from public.building_access_events
    where source_visit_history_id = any(v_history_ids)
  ) <> v_history_count then
    raise exception '가짜 세대 삭제 후 건물 출입 이력이 유실됐습니다';
  end if;

  raise notice '출입불가 가짜 세대 %개와 원본 방문 기록 %개를 정리했습니다. 건물 출입 이력은 보존했습니다',
    v_unit_count, v_history_count;
end;
$$;
