-- 비공식 봉사 장소를 사진에서 지도로 (1단계 — 핀 + 메모)
-- Supabase SQL Editor 에서 실행
--
-- 왜: 지금은 장소를 사진으로 알려 주는데, 사진은 위치를 알려 주지 못한다.
-- 처음 가는 형제는 못 찾는다. 그리고 사진 때문에 회중마다 스토리지 버킷을
-- 따로 만들어야 해서 설치 절차가 하나 더 늘어난다.
-- 이 앱엔 이미 지도가 있으므로 핀으로 옮긴다.
--
-- 구상 전문: docs/비공식-봉사-재설계.md
--
-- ⚠ 기존 자료를 지우지 않는다. event_informal_assignments 가 on delete cascade 라
--   자료를 지우면 지난 배정(봉사 이력)이 같이 사라진다. 칸만 더한다.

alter table public.informal_assets
  -- 핀
  add column if not exists lat  double precision,
  add column if not exists lng  double precision,
  -- '1층 카페 앞. 점심때 사람 많음' — 사진보다 이게 더 쓸모 있다
  add column if not exists memo text,
  -- 구역선(닫힌 도형)과 동선(열린 선). 형식이 같아 그리기 도구를 함께 쓴다
  -- [{"lat":37.36,"lng":127.02}, …]
  add column if not exists boundary jsonb,
  add column if not exists route    jsonb,
  -- 비우면 도형에 맞춰 자동(fitBounds). 핀만 있거나 직접 정할 때만 채운다
  add column if not exists zoom     smallint;

-- 지도에 뿌릴 때 핀이 있는 것만 빠르게 고른다
create index if not exists informal_assets_latlng_idx
  on public.informal_assets (lat, lng)
  where lat is not null and lng is not null;

-- ─── 확인 ────────────────────────────────────────────────────
select
  count(*)                                    as 자료수,
  count(*) filter (where lat is not null)     as 핀_찍은것,
  count(*) filter (where image_url is not null) as 사진_있는것
from public.informal_assets;
-- 처음 실행하면 핀_찍은것 = 0 이 정상이다.
-- 사진은 핀이 자리잡을 때까지 그대로 둔다 (둘 다 보이게).
