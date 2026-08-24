-- 병합 RPC 가 정말 통째로 되돌아가는지 시험한다. **테스트 DB 전용.**
--
-- 방법: 건물 삭제 직전에 일부러 터지는 트리거를 심는다.
--       RPC 가 예외를 던지고, 이름·호수·건물이 전부 원래대로면 rollback 이 된 것이다.
--
-- 순서대로 한 덩어리씩 실행할 것.

-- ══ 1. 시험용 중복 건물 두 개 만들기 ═══════════════════════════
-- 같은 주소 · 겹치지 않는 호수 → 병합 대상이 된다
insert into public.buildings (card_id, name, address, type, lat, lng)
select id, 'RB-원본', '롤백시험로 1', '주택', 37.5, 127.1 from public.cards limit 1;
insert into public.buildings (card_id, name, address, type, lat, lng)
select id, 'RB-복제', '롤백시험로 1', '주택', 37.5, 127.1 from public.cards limit 1;

insert into public.units (building_id, number, status, is_chinese)
select id, '101', '미방문', true from public.buildings where name = 'RB-원본';
insert into public.units (building_id, number, status, is_chinese)
select id, '202호', '미방문', true from public.buildings where name = 'RB-복제';

-- 방문 기록도 하나 — 이게 사라지면 안 된다
insert into public.visit_histories (unit_id, visitor_name, result, time_slot, memo, visited_at)
select u.id, 'test-admin', '부재', '오후', '롤백 시험', current_date
from public.units u join public.buildings b on b.id = u.building_id
where b.name = 'RB-복제';

-- ══ 2. 시험 전 상태 ════════════════════════════════════════════
select b.name, b.id, count(u.id) as 호수, count(v.id) as 방문기록
from public.buildings b
left join public.units u on u.building_id = b.id
left join public.visit_histories v on v.unit_id = u.id
where b.name like 'RB-%'
group by 1, 2 order by 1;

-- ══ 3. 건물 삭제 직전에 터지는 트리거를 심는다 ═════════════════
create or replace function public._rb_boom() returns trigger language plpgsql as $$
begin
  raise exception '일부러 터뜨림 (rollback 시험)';
end $$;

create trigger _rb_boom before delete on public.buildings
for each row when (old.name like 'RB-%') execute function public._rb_boom();

-- ══ 4. 병합 시도 → 예외가 나야 한다 ════════════════════════════
-- <토큰> 을 진짜 세션 토큰으로 바꿀 것 (아래 5번으로 얻는다)
-- select public.merge_duplicate_buildings_tx('<토큰>'::uuid);

-- ══ 5. 토큰 얻기 ═══════════════════════════════════════════════
-- select token from public.auth_login('test-admin', '1234');

-- ══ 6. 되돌아갔는지 확인 — 2번과 똑같아야 한다 ═════════════════
-- (위 2번 쿼리를 다시 실행)

-- ══ 7. 뒷정리 ══════════════════════════════════════════════════
-- drop trigger if exists _rb_boom on public.buildings;
-- drop function if exists public._rb_boom();
-- delete from public.units where building_id in (select id from public.buildings where name like 'RB-%');
-- delete from public.buildings where name like 'RB-%';
