-- 사진만 있는 옛 비공식 자료 정리 (핀으로 옮기기로 하면서)
-- Supabase SQL Editor 에서 실행
--
-- 왜: 비공식 봉사 장소를 사진에서 지도 핀으로 옮겼다
-- (docs/비공식-봉사-재설계.md). 사진만 있는 옛 자료는 위치를 알려 주지 못하고,
-- 지금은 이 기능을 쓰지 않고 있어 사용자가 정리하기로 했다 (2026-08-23).
--
-- ⚠ 지운 것은 되돌릴 수 없다. 실행 전 backups/2026-08-23/ 에
--   informal_assets(15개) · event_informal_assignments(9건) 이 저장돼 있는지
--   확인했다. 필요하면 npm run restore 로 되살릴 수 있다.
--
-- 무엇이 사라지나
--   · 사진만 있는 자료 13개 (강남대·단국대(스타벅스)·명지대(함박관) 등)
--   · 그 자료에 딸린 지난 배정 9건 (asset_id 가 on delete cascade)
--
-- 무엇이 남나
--   · 핀을 찍은 자료 (경희대(우정원)·경희대(홈플러스))
--   · 그룹 5개 (경희대·명지대·단국대·용인대·강남대) — 새 장소를 여기 담는다

-- ─── 1. 지우기 전에 눈으로 확인 ──────────────────────────────
select
  count(*) filter (where lat is null) as 지울_자료,
  count(*) filter (where lat is not null) as 남길_자료
from public.informal_assets;

-- ─── 2. 삭제 (핀이 없는 것만) ────────────────────────────────
-- lat 이 null = 지도에 자리가 없는 옛 사진 자료
delete from public.informal_assets where lat is null;

-- ─── 3. 확인 ─────────────────────────────────────────────────
select '남은 자료' as 구분, count(*) as 개수 from public.informal_assets
union all
select '남은 배정', count(*) from public.event_informal_assignments
union all
select '사진이 남은 자료 (0 이어야 함)', count(*)
  from public.informal_assets where coalesce(image_url, '') <> '';
