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
