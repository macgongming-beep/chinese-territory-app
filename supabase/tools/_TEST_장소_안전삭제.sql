-- 테스트 DB 전용. 역할별 장소 삭제·요청 계약을 검증하고 전부 롤백한다.
begin;

do $$
declare
  v_marker text := '_smoke_place_' || floor(extract(epoch from clock_timestamp()) * 1000)::bigint;
  v_user_id integer;
  v_leader_id integer;
  v_admin_id integer;
  v_user_token uuid := gen_random_uuid();
  v_leader_token uuid := gen_random_uuid();
  v_admin_token uuid := gen_random_uuid();
  v_card_id integer;
  v_building_id integer;
  v_unit_id bigint;
  v_result jsonb;
  v_count integer;
begin
  select id into v_admin_id from public.app_users
  where role in ('admin','developer') and approval_status='approved' and is_active
  order by id limit 1;
  insert into public.app_users(login_id,name,pin,role,approval_status,is_active)
  values(v_marker||'_user',v_marker||'_사용자','4321','user','approved',true)
  returning id into v_user_id;
  insert into public.app_users(login_id,name,pin,role,approval_status,is_active)
  values(v_marker||'_leader',v_marker||'_인도자','4321','leader','approved',true)
  returning id into v_leader_id;
  insert into public.auth_sessions(token,user_id) values
    (v_user_token,v_user_id),(v_leader_token,v_leader_id),(v_admin_token,v_admin_id);
  select id into v_card_id from public.cards order by id limit 1;

  -- 일반 사용자는 빈 장소도 직접 삭제하지 않고 요청한다.
  insert into public.buildings(card_id,name,address,type,lat,lng)
  values(v_card_id,v_marker||'_사용자건물',v_marker||' 사용자주소','주택',37.2,127.2)
  returning id into v_building_id;
  v_result := public.delete_place_or_request_tx(v_user_token,'building',v_building_id,'remove_place','잘못 등록했습니다.');
  if v_result->>'action' <> 'requested' then raise exception '일반 사용자 삭제가 요청으로 바뀌지 않았습니다'; end if;
  if not exists(select 1 from public.buildings where id=v_building_id) then raise exception '일반 사용자 요청이 실제 건물을 삭제했습니다'; end if;
  if not exists(select 1 from public.place_change_requests where building_id=v_building_id and note='잘못 등록했습니다.') then
    raise exception '일반 사용자 장소 요청이 남지 않았습니다';
  end if;

  -- 인도자는 연결 자료가 없는 건물과 세대를 즉시 정리할 수 있다.
  insert into public.buildings(card_id,name,address,type,lat,lng)
  values(v_card_id,v_marker||'_빈건물',v_marker||' 빈주소','주택',37.2,127.2)
  returning id into v_building_id;
  insert into public.units(building_id,number,status) values(v_building_id,'101','미방문');
  v_result := public.delete_place_or_request_tx(v_leader_token,'building',v_building_id,null,'');
  if v_result->>'action' <> 'deleted' or exists(select 1 from public.buildings where id=v_building_id) then
    raise exception '인도자가 빈 건물을 정리하지 못했습니다: %',v_result;
  end if;

  -- 세대 자체에 방문 상태가 있으면 별도 기록이 없어도 요청으로 바뀐다.
  insert into public.buildings(card_id,name,address,type,lat,lng)
  values(v_card_id,v_marker||'_기록건물',v_marker||' 기록주소','주택',37.2,127.2)
  returning id into v_building_id;
  insert into public.units(building_id,number,status,created_at)
  values(v_building_id,'201','만남',now()-interval '1 day') returning id into v_unit_id;
  v_result := public.delete_place_or_request_tx(v_leader_token,'unit',v_unit_id,'unit_missing','현장 확인 필요');
  if v_result->>'action' <> 'requested' or not exists(select 1 from public.units where id=v_unit_id) then
    raise exception '연결 자료가 있는 인도자 삭제가 안전 요청으로 바뀌지 않았습니다: %',v_result;
  end if;
  if not exists(select 1 from public.units where id=v_unit_id and status='만남') then
    raise exception '인도자 요청 과정에서 세대 상태가 사라졌습니다';
  end if;

  -- 관리자는 명시적인 삭제 요청으로 연결 자료까지 정리할 수 있다.
  insert into public.visit_histories(unit_id,visitor_name,result,time_slot,visited_at)
  values(v_unit_id,v_marker||'_인도자','만남','오후',current_date);
  v_result := public.delete_place_or_request_tx(v_admin_token,'unit',v_unit_id,'unit_missing','');
  if v_result->>'action' <> 'deleted' or exists(select 1 from public.units where id=v_unit_id) then
    raise exception '관리자 삭제가 실행되지 않았습니다: %',v_result;
  end if;
  if exists(select 1 from public.visit_histories where unit_id=v_unit_id) then
    raise exception '관리자 삭제 뒤 FK 연결 자료가 남았습니다';
  end if;

  select count(*) into v_count from pg_policies
  where schemaname='public' and tablename in ('buildings','units')
    and cmd='DELETE' and policyname like 'TEMP_session_gate_%';
  if v_count <> 0 then raise exception '건물·세대의 임시 DELETE 정책이 남았습니다'; end if;
  select count(*) into v_count from pg_policies
  where schemaname='public' and tablename in ('buildings','units')
    and cmd='DELETE' and policyname in ('buildings_delete_admin','units_delete_admin')
    and coalesce(qual,'') like '%request_is_admin%';
  if v_count <> 2 then raise exception '관리자 전용 직접 DELETE 정책이 정확히 두 개가 아닙니다'; end if;
  if not has_function_privilege('anon','public.delete_place_or_request_tx(uuid,text,bigint,text,text)','execute') then
    raise exception 'anon이 안전 삭제 RPC를 호출할 수 없습니다';
  end if;
end;
$$;

rollback;
