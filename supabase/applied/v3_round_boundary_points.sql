-- 구역선 좌표를 소수점 5자리로 (약 1m 정밀도)
-- Supabase SQL Editor 에서 실행 (실행 전 백업 권장: npm run backup)
--
-- 왜: 첫 화면에서 받는 것 중 card_boundaries 가 가장 무겁다.
--
--   card_boundaries   791KB (gzip 153KB) · 602행 · 평균 31점(최대 127점)
--   JS 번들 전체       gzip 337KB
--
-- 구역선 하나가 JS 번들의 절반 가까이다. 그리고 JS 는 한 번 받고 캐시되지만
-- 이것은 열 때마다 받는다. 회중이 커질수록 더 무거워진다.
--
-- 지금은 좌표를 소수점 7자리로 저장한다:
--
--   {"lat":37.3604177,"lng":127.0202803}   -- 점 하나당 약 45바이트
--
-- 7자리는 1cm 정밀도다. 구역 경계는 지도에서 손으로 찍은 선이라 이 정밀도가
-- 아무 의미가 없다. 5자리(약 1m)로 줄이면 gzip 153KB → 103KB (33% 절약).
--
-- ⚠ 되돌릴 수 없다. backups/2026-08-23/card_boundaries.json 에 원래 값이 있고
--   npm run restore -- --write --table card_boundaries 로 되살릴 수 있다.
--   좌표를 값으로 비교하는 코드가 없는 것은 확인했다 (전부 타입 검사).

-- ─── 1. 지금 상태 ────────────────────────────────────────────
select
  count(*) as 구역선,
  sum(jsonb_array_length(points)) as 점_합계,
  pg_size_pretty(sum(pg_column_size(points))::bigint) as 저장크기
from public.card_boundaries;

-- ─── 2. 반올림 ───────────────────────────────────────────────
update public.card_boundaries
set points = (
  select jsonb_agg(
    jsonb_build_object(
      'lat', round((p->>'lat')::numeric, 5),
      'lng', round((p->>'lng')::numeric, 5)
    )
    order by ord
  )
  from jsonb_array_elements(points) with ordinality as t(p, ord)
)
where points is not null
  and jsonb_typeof(points) = 'array'
  and jsonb_array_length(points) > 0;

-- ─── 3. 확인 ─────────────────────────────────────────────────
select
  count(*) as 구역선,
  sum(jsonb_array_length(points)) as 점_합계,
  pg_size_pretty(sum(pg_column_size(points))::bigint) as 저장크기
from public.card_boundaries;
-- 점 개수는 그대로여야 하고, 저장 크기만 줄어야 한다.

-- 점이 사라진 구역선이 없는지 (0 이어야 함)
select '점이 없어진 구역선 (0 이어야 함)' as 구분, count(*) as 개수
  from public.card_boundaries
 where points is null or jsonb_array_length(points) = 0;
