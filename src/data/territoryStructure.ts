// ⚠ 여기 있는 값은 더 이상 정답이 아니다 — 불러오기 전에 화면이 비지 않게 하는 임시값이다.
//
//   지역(구·시) → DB 의 territory_regions  (읽는 곳: lib/regions.ts)
//   동          → 실제 카드에서 뽑는다      (읽는 곳: utils/areaOptions.ts)
//
// 지역·동을 늘리려면 이 파일이 아니라 앱에서 하면 된다. 여기를 고쳐도
// DB 값이 곧바로 덮어쓴다. (동 목록은 15개에서 멈춘 채 실제 41개와
// 어긋나 있었다 — 코드에 두면 이렇게 방치된다)
import type { TerritoryRegion, VisitTargetType } from '../types'

/** DB 를 읽기 전 잠깐 쓰는 기본값. lib/regions.ts 의 FALLBACK 재료다 */
export const territoryRegions: TerritoryRegion[] = ['처인구', '기흥구', '수지구', '영통구', '화성시']

export const territoryAreasByRegion: Record<TerritoryRegion, string[]> = {
  처인구: ['고림동', '김량장동', '역북동', '유방동', '포곡읍'],
  기흥구: ['신갈동', '상하동', '구갈동', '보정동', '동백동'],
  수지구: ['풍덕천동', '죽전동', '상현동', '성복동'],
  영통구: ['매탄동', '영통동', '원천동'],
  화성시: ['병점동', '동탄동', '진안동', '봉담읍'],
}

export const visitTargetTypes: VisitTargetType[] = ['전체', '상가', '주택']
