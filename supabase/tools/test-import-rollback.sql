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
  p_building jsonb,   -- { card_id, name, address, type, lat, lng, warning? }
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
    nullif(p_building->>'warning', '')
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

-- import_building_tx 가 **정말로 통째로 되돌리는지** 확인한다.
-- 세대 삽입 직전에 터지는 트리거를 심어 놓고 불러 본다. 테스트 DB 전용.

do $$
declare v_env text;
begin
  select value into v_env from public.app_private_settings where key = 'environment';
  if coalesce(v_env,'') <> 'test' then raise exception '테스트 표식이 없습니다 — 중단'; end if;
end $$;

drop table if exists public._import_rollback_result;
create table public._import_rollback_result (seq serial primary key, 항목 text, 값 text, 판정 text);

-- 세대가 들어가려 하면 터지는 트리거
create or replace function public._boom_on_unit() returns trigger
language plpgsql as $$ begin raise exception '일부러 터뜨림'; end $$;

do $$
declare
  v_tok uuid; v_admin integer;
  v_card integer;
  v_before_b bigint; v_after_b bigint;
  v_res jsonb;
begin
  select s.token, s.user_id into v_tok, v_admin
  from public.auth_sessions s join public.app_users u on u.id = s.user_id
  where u.role in ('admin','developer') and (s.expires_at is null or s.expires_at > now())
  order by s.last_used_at desc nulls last limit 1;
  if v_tok is null then raise exception '관리자 세션이 없습니다 — 앱에서 로그인하세요'; end if;

  select id into v_card from public.cards order by id limit 1;
  if v_card is null then
    insert into public.cards (name, area, region, type, status) values ('롤백시험카드','가','나','구역','미배정')
    returning id into v_card;
  end if;

  -- ① 정상일 때 들어가나
  select count(*) into v_before_b from public.buildings;
  v_res := public.import_building_tx(v_tok,
    jsonb_build_object('card_id', v_card, 'name','롤백시험-정상','address','롤백시험로 1','type','주택','lat',37.25,'lng',127.19),
    jsonb_build_array(jsonb_build_object('number','101','status','미방문','is_chinese',false,'is_restaurant',false,
      'visits', jsonb_build_array(jsonb_build_object('result','만남','visitor_name','가','visited_at','2026-01-01')))));
  select count(*) into v_after_b from public.buildings;
  insert into public._import_rollback_result (항목,값,판정) values
    ('① 정상 삽입', v_res::text, case when v_after_b = v_before_b + 1 then 'OK' else '⚠ 건물이 안 늘었다' end);

  -- ② 세대에서 터지면 건물도 안 남아야 한다
  create trigger _boom before insert on public.units for each row execute function public._boom_on_unit();
  select count(*) into v_before_b from public.buildings;
  begin
    v_res := public.import_building_tx(v_tok,
      jsonb_build_object('card_id', v_card, 'name','롤백시험-실패','address','롤백시험로 2','type','주택','lat',37.25,'lng',127.19),
      jsonb_build_array(jsonb_build_object('number','101','status','미방문','is_chinese',false,'is_restaurant',false)));
    insert into public._import_rollback_result (항목,값,판정) values ('② 세대 실패', v_res::text, '⚠ 터졌어야 한다');
  exception when others then
    select count(*) into v_after_b from public.buildings;
    insert into public._import_rollback_result (항목,값,판정) values
      ('② 세대에서 터짐', sqlerrm,
       case when v_after_b = v_before_b then 'OK (건물도 안 남았다)' else '⚠ 건물만 남았다 — 롤백 안 됨' end);
  end;
  drop trigger _boom on public.units;

  -- ③ 뒷정리
  delete from public.visit_histories where unit_id in (select id from public.units where building_id in
    (select id from public.buildings where name like '롤백시험-%'));
  delete from public.units where building_id in (select id from public.buildings where name like '롤백시험-%');
  delete from public.buildings where name like '롤백시험-%';
  delete from public.cards where name = '롤백시험카드';
end $$;

drop function if exists public._boom_on_unit();
select 항목, 판정, left(값, 80) as 내용 from public._import_rollback_result order by seq;
