-- 식당 배정을 '세대(unit) 단위'로 확장
-- Supabase SQL Editor 에서 실행 필요
--
-- 기존: event_restaurant_assignments 가 building_id 단위(건물 통째 배정)
-- 변경: unit_id 추가 → 같은 건물의 식당 세대를 각각 다른 팀에 배정 가능
--   (기존 building 단위 행은 unit_id = NULL 로 그대로 유지/호환)

-- 1) unit_id 컬럼 추가 (nullable: 레거시 건물단위 행 호환)
alter table public.event_restaurant_assignments
  add column if not exists unit_id integer references public.units(id) on delete cascade;

-- 2) 기존 (event_id, user_name, building_id) 유니크 제약 제거
alter table public.event_restaurant_assignments
  drop constraint if exists event_restaurant_assignments_unique;

-- 3) (event_id, user_name, building_id, unit_id) 유니크.
--    unit_id 가 NULL 이어도 중복 방지되도록 coalesce 사용한 표현식 인덱스.
drop index if exists event_restaurant_assignments_unique_idx;
create unique index event_restaurant_assignments_unique_idx
  on public.event_restaurant_assignments
  (event_id, user_name, building_id, coalesce(unit_id, 0));
