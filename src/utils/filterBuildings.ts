// 건물 목록을 거른다. 두 단계다.
//
// ① 범위(scope) — 지역·동·카드·유형. **세대 목록(pointRows)의 뿌리이기도 하다.**
// ② 속성 — 정기방문·메모·중국어세대·식당
//
// 두 단계를 합치면 안 된다. 세대 화면은 ①까지만 쓰고 자기 조건을 따로 건다.
// (합쳤다가 세대 목록이 건물 조건에 끌려가는 일이 생긴다)
import type { Building, TerritoryCard } from '../types'
import { getRestaurantUnits } from './restaurants'
import { buildingHasUsage } from './unitUsage'

export type BuildingScopeFilters = {
  region: string
  area: string
  /** '전체' 또는 카드 id */
  card: number | '전체'
  /** '전체' | '주택' | '상가' */
  type: string
}

export type BuildingTraitFilters = {
  /** '전체' | '있음' | '없음' */
  regularVisit: string
  memo: string
  /** '전체' | '식당' | '식당 아님' */
  restaurant: string
  /**
   * '전체' | '확인필요' | '확인됨'
   *
   * **세대를 다 파악했다고 표시한 건물인가.** 표시가 없으면 등록된 세대를 다
   * 방문해도 지도에서 '완료' 가 아니다 — 호수가 더 있는지 아무도 모르기 때문이다.
   * PC 에서 **몰아서 확인할 때** 쓰는 필터다.
   */
  surveyed: string
}

/** 공백만 있는 값은 '없음' 으로 본다 */
export const hasText = (v?: string | null) => Boolean(v?.trim())

/** 건물이나 그 안 세대에 메모가 있나 */
export function buildingHasMemo(building: Building): boolean {
  return hasText(building.memo) || building.units.some((u) => hasText(u.memo))
}

/** 건물 안에 정기방문 세대가 있나 */
export function buildingHasRegularVisit(building: Building): boolean {
  return building.units.some((u) => u.isRegularVisit)
}

/** ① 범위 — 카드가 없는 건물은 아예 뺀다 (고아 건물) */
export function filterBuildingsByScope(
  buildings: readonly Building[],
  f: BuildingScopeFilters,
  cardOf: (cardId: number) => TerritoryCard | undefined,
): Building[] {
  return buildings.filter((b) => {
    const card = cardOf(b.cardId)
    // ⚠ 카드를 못 찾으면 뺀다. 지역·동을 판단할 수 없기 때문이다
    if (!card) return false
    if (f.region !== '전체' && card.region !== f.region) return false
    if (f.area !== '전체' && card.area !== f.area) return false
    if (f.card !== '전체' && b.cardId !== f.card) return false
    if (f.type !== '전체' && !buildingHasUsage(b, f.type as '주택' | '상가')) return false
    return true
  })
}

/** ② 속성 */
export function filterBuildingsByTraits(
  buildings: readonly Building[],
  f: BuildingTraitFilters,
): Building[] {
  return buildings.filter((b) => {
    const hasRegular = buildingHasRegularVisit(b)
    if (f.regularVisit === '있음' && !hasRegular) return false
    if (f.regularVisit === '없음' && hasRegular) return false

    const hasMemo = buildingHasMemo(b)
    if (f.memo === '있음' && !hasMemo) return false
    if (f.memo === '없음' && hasMemo) return false

    const restaurants = getRestaurantUnits(b).length
    if (f.restaurant === '식당' && restaurants === 0) return false
    if (f.restaurant === '식당 아님' && restaurants > 0) return false
    if (f.surveyed === '확인필요' && b.unitsSurveyed === true) return false
    if (f.surveyed === '확인됨' && b.unitsSurveyed !== true) return false
    return true
  })
}
