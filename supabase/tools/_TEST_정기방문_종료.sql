-- 테스트 DB 전용. 정기방문 종료·장소 요청·재활성화 계약을 실제 함수로 검증하고 롤백한다.
begin;

do $$
declare
  v_marker text := '_smoke_end_' || floor(extract(epoch from clock_timestamp()) * 1000)::bigint;
  v_owner_id integer;
  v_other_id integer;
  v_admin_id integer;
  v_owner_token uuid := gen_random_uuid();
  v_other_token uuid := gen_random_uuid();
  v_admin_token uuid := gen_random_uuid();
  v_card_id integer;
  v_building_id integer;
  v_unit_id bigint;
  v_visit_id bigint;
  v_request_id bigint;
  v_result jsonb;
  v_count integer;
begin
  select id into v_admin_id
  from public.app_users
  where role in ('admin', 'developer') and approval_status = 'approved' and is_active
  order by id limit 1;
  if v_admin_id is null then raise exception '테스트 관리자 계정이 없습니다'; end if;

  insert into public.app_users (login_id, name, pin, role, approval_status, is_active)
  values (v_marker || '_owner', v_marker || '_담당자', '4321', 'user', 'approved', true)
  returning id into v_owner_id;
  insert into public.app_users (login_id, name, pin, role, approval_status, is_active)
  values (v_marker || '_other', v_marker || '_다른사람', '4321', 'user', 'approved', true)
  returning id into v_other_id;

  insert into public.auth_sessions (token, user_id) values
    (v_owner_token, v_owner_id),
    (v_other_token, v_other_id),
    (v_admin_token, v_admin_id);

  select id into v_card_id from public.cards order by id limit 1;
  insert into public.buildings (card_id, name, address, type, lat, lng)
  values (v_card_id, v_marker || '_건물', v_marker || ' 주소', '주택', 37.2, 127.2)
  returning id into v_building_id;
  insert into public.units (building_id, number, status)
  values (v_building_id, '201', '미방문') returning id into v_unit_id;

  v_result := public.create_return_visit_tx(
    v_owner_token, v_marker || '_별칭', '', '보존할 첫 기록', '만남', v_unit_id
  );
  v_visit_id := (v_result ->> 'id')::bigint;
  if v_visit_id is null then raise exception '정기방문 생성 결과에 id가 없습니다'; end if;

  begin
    perform public.end_return_visit_tx(v_other_token, v_visit_id, 'no_longer_assigned', null, '');
    raise exception '다른 일반 사용자가 남의 정기방문을 종료했습니다';
  exception when sqlstate '42501' then
    null;
  end;

  v_result := public.end_return_visit_tx(
    v_owner_token, v_visit_id, 'needs_reassignment', 'unit_missing', '201호가 없어졌습니다.'
  );
  v_request_id := (v_result ->> 'request_id')::bigint;
  if coalesce((v_result ->> 'ok')::boolean, false) is not true or v_request_id is null then
    raise exception '종료 또는 장소 요청 결과가 올바르지 않습니다: %', v_result;
  end if;

  select count(*) into v_count from public.regular_visits where unit_id = v_unit_id;
  if v_count <> 0 then raise exception '현재 정기방문 담당 행이 해제되지 않았습니다'; end if;
  select count(*) into v_count
  from public.return_visits
  where id = v_visit_id and ended_at is not null and end_reason = 'needs_reassignment';
  if v_count <> 1 then raise exception '활동 정기방문 종료 상태가 남지 않았습니다'; end if;
  select count(*) into v_count from public.return_visit_logs where return_visit_id = v_visit_id;
  if v_count <> 1 then raise exception '종료하면서 과거 방문 기록이 사라졌습니다'; end if;
  select count(*) into v_count
  from public.place_change_requests
  where id = v_request_id
    and request_type = 'unit_missing'
    and building_id = v_building_id
    and unit_id = v_unit_id
    and return_visit_id = v_visit_id
    and building_name = v_marker || '_건물'
    and address = v_marker || ' 주소'
    and unit_number = '201'
    and requested_by_id = v_owner_id
    and note = '201호가 없어졌습니다.';
  if v_count <> 1 then raise exception '장소 요청의 대상 스냅샷이 올바르지 않습니다'; end if;

  begin
    perform public.review_place_change_request_tx(v_other_token, v_request_id, 'completed', '');
    raise exception '일반 사용자가 관리자 요청을 처리했습니다';
  exception when sqlstate '42501' then
    null;
  end;
  perform public.review_place_change_request_tx(v_admin_token, v_request_id, 'completed', '확인 완료');
  select count(*) into v_count
  from public.place_change_requests
  where id = v_request_id and status = 'completed' and review_note = '확인 완료';
  if v_count <> 1 then raise exception '관리자가 요청을 처리하지 못했습니다'; end if;

  v_result := public.create_return_visit_tx(
    v_owner_token, v_marker || '_다시담당', '', '', null, v_unit_id
  );
  if (v_result ->> 'id')::bigint <> v_visit_id
     or coalesce((v_result ->> 'reactivated')::boolean, false) is not true then
    raise exception '종료된 정기방문을 기존 기록으로 재활성화하지 않았습니다: %', v_result;
  end if;
  select count(*) into v_count
  from public.return_visits
  where id = v_visit_id and ended_at is null and assigned_user_name = v_marker || '_담당자';
  if v_count <> 1 then raise exception '재활성화 상태나 담당자가 올바르지 않습니다'; end if;
  select count(*) into v_count from public.return_visit_logs where return_visit_id = v_visit_id;
  if v_count <> 1 then raise exception '재활성화하면서 과거 방문 기록이 바뀌었습니다'; end if;
  select count(*) into v_count
  from public.regular_visits
  where unit_id = v_unit_id and visitor_name = v_marker || '_담당자';
  if v_count <> 1 then raise exception '재활성화하면서 현재 담당 행을 복구하지 못했습니다'; end if;

  if not has_function_privilege('anon', 'public.end_return_visit_tx(uuid,bigint,text,text,text)', 'execute') then
    raise exception 'anon이 종료 RPC를 호출할 실행권한이 없습니다';
  end if;
  if has_table_privilege('anon', 'public.place_change_requests', 'insert')
     or has_table_privilege('anon', 'public.place_change_requests', 'update')
     or has_table_privilege('anon', 'public.place_change_requests', 'delete') then
    raise exception '장소 요청 표에 직접 쓰기 권한이 열려 있습니다';
  end if;
end;
$$;

rollback;
