// 식당 판정 — 한 곳에서만 정한다
//
// 왜 모았나: 식당 여부를 배정·통계·지도·PC 식당 탭이 각자 판정하고 있었다.
// 한 군데만 규칙이 어긋나도 그 화면에서만 식당이 사라져 원인을 찾기 어렵다.
//
// 규칙:
//   식당 = units.is_restaurant (업종. 잘 바뀌지 않는 성질)
//   중국어를 쓰지 않는 식당은 방문 결과를 '대상외' 로 찍는다 — 목록에는 그대로 남고
//   상태만 대상외로 보인다. (예전에는 '중국인 아님' 으로 바꾸면 목록에서 사라졌다)

import type { Building, Unit } from '../types'

export function isRestaurantUnit(unit: Unit): boolean {
  return unit.isRestaurant === true
}

export function getRestaurantUnits(building: Building): Unit[] {
  return (building.units ?? []).filter(isRestaurantUnit)
}

export function hasRestaurant(building: Building): boolean {
  return getRestaurantUnits(building).length > 0
}

/** 주거 기준 중국인 세대 (식당은 빼고 센다 — 예전에는 섞여 있었다) */
export function isChineseResidenceUnit(unit: Unit): boolean {
  return unit.isChinese === true && !isRestaurantUnit(unit)
}

export type RestaurantRow = {
  buildingId: number
  unitId: number | null   // null = 세대 없이 건물 단위로 잡힌 옛 데이터
  name: string
  address: string
  status: string
  /** 방문 결과가 '대상외' — 중국어를 쓰지 않아 대상에서 뺀 곳 */
  isExcluded: boolean
}

/**
 * 화면에 뿌릴 식당 목록. 건물 하나에 식당이 여럿이면 각각 한 줄이 된다.
 * 세대가 하나도 없는 옛 데이터는 건물 이름으로 한 줄 만든다.
 */
export function getRestaurantRows(buildings: Building[]): RestaurantRow[] {
  const rows: RestaurantRow[] = []
  for (const building of buildings) {
    const units = getRestaurantUnits(building)
    if (units.length === 0) {
      // 건물에는 식당 표시가 있는데 세대가 없는 경우 (옛 데이터 호환)
      if (!building.isRestaurant) continue
      rows.push({
        buildingId: building.id,
        unitId: null,
        name: building.name || building.address,
        address: building.address,
        status: '미방문',
        isExcluded: false,
      })
      continue
    }
    for (const unit of units) {
      rows.push({
        buildingId: building.id,
        unitId: unit.id,
        name: unit.number || building.name || building.address,
        address: building.address,
        status: unit.status,
        isExcluded: unit.status === '대상외',
      })
    }
  }
  return rows
}

/** 식당 개수 (건물이 아니라 식당 단위로 센다) */
export function countRestaurants(buildings: Building[]): number {
  return getRestaurantRows(buildings).length
}
