-- 지역(구·시) 목록을 코드에서 DB 로
-- Supabase SQL Editor 에서 실행 (실행 전 백업 권장: npm run backup)
--
-- 왜: 같은 지역 목록이 코드 여섯 군데에 흩어져 있었다.
--   territoryStructure.ts   목록
--   AdminMobileZone.tsx     순서
--   MapCanvas.tsx           카드명 접두 제거
--   ZoneAssignScreen.tsx    카드명 접두 제거
--   placeMatch.ts           주소 정규화
--   DesktopTerritory.tsx    구 → 상위 시
-- 지역 하나를 늘리려면 여섯 군데를 고쳐야 했고, 하나만 빠뜨려도 조용히 어긋났다.
-- (실제로 placeMatch 에만 '성남시' 가 있고, 구·시가 한 배열에 섞여 있었다)
--
-- 이 표 하나가 그 여섯 곳의 재료가 된다.

create table if not exists public.territory_regions (
  id          serial primary key,
  -- 카드의 region 값과 정확히 같아야 한다 ('처인구'). 카드 이름의 앞부분이기도 하다
  name        text not null unique,
  -- 구를 품은 시. 주소만으로 지도를 찍을 때 '수지구' 만으로는 엉뚱한 곳에 찍혀
  -- 시까지 붙인 후보를 함께 시도한다. 시 자체인 지역(화성시)은 비워 둔다
  city        text,
  sort_order  integer not null default 0,
  name_zh     text,
  name_en     text,
  created_at  timestamptz not null default now()
);

create index if not exists territory_regions_sort_idx
  on public.territory_regions (sort_order, name);

alter table public.territory_regions enable row level security;
drop policy if exists open_access on public.territory_regions;
create policy open_access on public.territory_regions
for all to anon, authenticated
using (true)
with check (true);

-- ─── 지금 쓰는 값 그대로 심기 ───────────────────────────────
-- 값은 코드에 흩어져 있던 것을 모은 것이다. 동작이 달라지면 안 된다.
insert into public.territory_regions (name, city, sort_order, name_zh, name_en)
values
  ('처인구', '용인시', 1, '处仁区', 'Cheoin-gu'),
  ('기흥구', '용인시', 2, '器兴区', 'Giheung-gu'),
  ('수지구', '용인시', 3, '水枝区', 'Suji-gu'),
  ('영통구', '수원시', 4, '灵通区', 'Yeongton-gu'),
  ('화성시', null,     5, '华城市', 'Hwaseong-si')
on conflict (name) do nothing;

-- 카드에 있는데 위 목록에 없는 지역이 있으면 같이 넣는다.
-- 이걸 빼먹으면 그 지역 카드가 필터에서 통째로 사라진다.
insert into public.territory_regions (name, sort_order)
select distinct c.region, 90
  from public.cards c
 where coalesce(btrim(c.region), '') <> ''
   and not exists (select 1 from public.territory_regions r where r.name = c.region)
on conflict (name) do nothing;

-- ─── 확인 ────────────────────────────────────────────────────
select r.sort_order as 순서, r.name as 지역, coalesce(r.city, '(시 자체)') as 상위시,
       r.name_zh as 중국어, count(c.id) as 카드수
  from public.territory_regions r
  left join public.cards c on c.region = r.name
 group by r.id, r.sort_order, r.name, r.city, r.name_zh
 order by r.sort_order, r.name;
-- 카드수가 0 인 지역이 있어도 괜찮다 (아직 카드를 안 만든 지역).
-- 반대로 카드가 있는데 목록에 없는 지역이 있으면 안 된다 — 아래가 0 이어야 한다.
select '목록에 없는 지역의 카드 (0 이어야 함)' as 구분, count(*) as 개수
  from public.cards c
 where coalesce(btrim(c.region), '') <> ''
   and not exists (select 1 from public.territory_regions r where r.name = c.region);
