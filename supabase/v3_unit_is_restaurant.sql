-- 세대에 "식당" 표시를 따로 둔다
-- Supabase SQL Editor 에서 실행 (실행 전 백업 권장: npm run backup)
--
-- 배경: 지금은 세대가 식당인지를 units.is_chinese("중국인 여부") 칸으로 표시한다.
--       한 칸이 두 가지 뜻을 갖고 있어서 문제가 생긴다:
--         · 통계의 "중국인 세대"에 식당 216개가 섞여 든다 (실제 거주 세대는 749개)
--         · 어떤 식당을 "중국어 안 씀"으로 바꾸면 식당 목록에서 통째로 사라진다
--
-- 해결: 업종("식당인가")을 별도 칸으로 분리한다.
--       중국어를 쓰지 않는 식당은 지금처럼 방문 결과를 '대상외' 로 찍으면 되고,
--       그래도 식당 목록에는 남아 상태만 대상외로 보인다.
--
--   units.is_restaurant  ← 새 칸. 이 세대가 식당인가 (업종, 잘 안 변함)
--   units.status         ← 그대로. 대상외 등 방문 결과
--   units.is_chinese     ← 그대로. 주거 세대의 중국인 여부 (원래 뜻으로 복귀)

-- ─── 1. 칸 추가 ──────────────────────────────────────────────
alter table public.units
  add column if not exists is_restaurant boolean not null default false;

create index if not exists units_is_restaurant_idx
  on public.units (is_restaurant) where is_restaurant;

-- ─── 2. 지금 식당으로 잡히는 세대를 옮긴다 ───────────────────
-- 판정 규칙은 앱과 동일: 식당 표시된 건물 안의 "중국인" 세대
update public.units u
set is_restaurant = true
from public.buildings b
where u.building_id = b.id
  and b.is_restaurant is true
  and u.is_chinese is true;

-- ⚠ is_chinese 는 건드리지 않는다.
--   그 값이 "중국어 사용"인지 "식당 표시"인지 지금 데이터로는 구분할 수 없다.
--   지우면 없는 정보를 만들어내는 셈이라, 통계에서 걸러 쓰는 편이 안전하다.
--     중국인 거주 세대 = is_chinese and not is_restaurant

-- ─── 2-2. 옛 데이터 보정 ────────────────────────────────────
-- 아래 3곳은 세대에 식당 이름이 들어 있는데 중국어 표시가 꺼져 있어,
-- 지금은 "건물 단위" 로만 목록에 잡혀 있었다. 세대 단위로 옮겨 준다.
--   福源牛肉面 / 진진양꼬치 / 정감
--   (같은 건물의 'A동 103호' 는 주거로 보고 건드리지 않는다)
update public.units set is_restaurant = true where id in (2317, 2353, 2195);

-- ─── 3. 식당이 아닌 업종 제외 ────────────────────────────────
-- 미용실·사우나는 식당 목록에 잘못 들어간 것 (사용자 확인)
update public.units
set is_restaurant = false,
    is_chinese = false          -- 주거 세대도 아니므로 중국인 세대에서도 뺀다
where id in (2168, 2673);

-- ─── 4. 건물 표시를 세대에서 자동으로 맞춘다 ─────────────────
-- buildings.is_restaurant 는 "이 건물에 식당이 있다"는 문지기로 계속 쓴다.
-- 손으로 켜고 끄다 어긋나지 않도록 세대 변경에 맞춰 자동 갱신한다.
create or replace function public.sync_building_is_restaurant()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_building_id integer := coalesce(new.building_id, old.building_id);
  v_has boolean;
begin
  if v_building_id is null then
    return coalesce(new, old);
  end if;

  -- ⚠ 식당 세대와 무관한 변경(호수 추가·수정 등)에는 손대지 않는다.
  --   그러지 않으면 "건물에만 식당 표시가 있고 식당 세대는 없는" 옛 데이터가
  --   엉뚱한 순간에 꺼져 목록에서 사라진다.
  if coalesce(new.is_restaurant, false) is not true
     and coalesce(old.is_restaurant, false) is not true then
    return coalesce(new, old);
  end if;
  select exists (
    select 1 from public.units
    where building_id = v_building_id and is_restaurant is true
  ) into v_has;

  update public.buildings
  set is_restaurant = v_has
  where id = v_building_id
    and is_restaurant is distinct from v_has;

  return coalesce(new, old);
end;
$$;

drop trigger if exists units_sync_building_restaurant on public.units;
create trigger units_sync_building_restaurant
after insert or update of is_restaurant, building_id or delete on public.units
for each row execute function public.sync_building_is_restaurant();

-- 지금 상태 맞추기 — 켜는 방향만 한다.
-- (끄는 방향까지 하면 위에서 말한 옛 데이터 3곳이 사라진다)
update public.buildings b
set is_restaurant = true
where b.is_restaurant is not true
  and exists (select 1 from public.units u where u.building_id = b.id and u.is_restaurant is true);

-- ─── 5. 결과 확인 ────────────────────────────────────────────
select '식당 세대'            as 구분, count(*) as 개수 from public.units where is_restaurant
union all
select '식당 있는 건물',        count(*) from public.buildings where is_restaurant
union all
select '중국인 거주 세대(식당 제외)', count(*) from public.units where is_chinese and not is_restaurant
union all
select '식당 중 대상외',        count(*) from public.units where is_restaurant and status = '대상외';
-- 기대값: 식당 세대 217 / 식당 건물 201 / 중국인 거주 세대 748 / 대상외 1
