// 건물 목록의 '구분' 과 '유형' 을 **한 줄로 합친다.**
//
// 왜 (2026-08-31 실측):
//   상가 565개 중 식당이 360개(64%), 주택 502개 중 식당은 7개(1%).
//   **식당은 거의 상가다.** 두 줄을 따로 고를 일이 드문데 필터가 일곱 줄이나 됐다.
//
// ⚠ 상태는 그대로 둘로 유지한다. `buildingTypeFilter` 는 **세대 목록과 함께 쓰는**
//   값이라, 없애면 그 화면의 유형 필터가 죽는다. 여기서는 UI 만 합친다.

export type BuildingKind = '전체' | '주택' | '상가' | '식당'
export type TypeFilter = '전체' | '주택' | '상가'
export type RestaurantFilter = '전체' | '식당' | '식당 아님'

/** 버튼 하나를 누르면 두 상태가 이렇게 정해진다 */
export function kindToFilters(kind: BuildingKind): { type: TypeFilter; restaurant: RestaurantFilter } {
  if (kind === '식당') return { type: '전체', restaurant: '식당' }
  if (kind === '전체') return { type: '전체', restaurant: '전체' }
  return { type: kind, restaurant: '전체' }
}

/**
 * 지금 어느 버튼이 켜져 보여야 하나.
 *
 * ⚠ 식당을 먼저 본다. 세대 목록에서 유형을 따로 건드려 `상가 + 식당` 이 될 수 있는데,
 *   그때 '상가' 를 켜면 사용자가 식당 필터가 걸린 줄 모른다.
 */
export function filtersToKind(type: TypeFilter, restaurant: RestaurantFilter): BuildingKind | null {
  if (restaurant === '식당') return '식당'
  if (restaurant !== '전체') return null   // '식당 아님' 은 합친 줄에 없는 값이다
  return type === '전체' ? '전체' : type
}
