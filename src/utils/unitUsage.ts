import type { Building, Unit } from '../types'

export type UnitUsage = Building['type']
export type UnitUsageFilter = UnitUsage | '전체'

/**
 * 식당은 항상 상가다. 그 외에는 세대에 지정한 예외값을 우선하고,
 * 예외값이 없으면 건물의 기본 용도를 따른다.
 */
export function effectiveUnitUsage(building: Pick<Building, 'type'>, unit: Unit): UnitUsage {
  if (unit.isRestaurant) return '상가'
  return unit.usageType ?? building.type
}

/** `출입불가`는 과거의 건물 접근 기록용 가짜 세대다. */
export function isLegacyNoEntryUnit(unit: Pick<Unit, 'number'>): boolean {
  return unit.number.trim() === '출입불가'
}

export function unitsForUsage(building: Building, filter: UnitUsageFilter): Unit[] {
  const realUnits = building.units.filter((unit) => !isLegacyNoEntryUnit(unit))
  if (filter === '전체') return realUnits
  return realUnits.filter((unit) => effectiveUnitUsage(building, unit) === filter)
}

/** 세대가 아직 없는 건물은 건물 기본 용도의 필터에 남긴다. */
export function buildingHasUsage(building: Building, filter: UnitUsageFilter): boolean {
  if (filter === '전체') return true
  const realUnits = building.units.filter((unit) => !isLegacyNoEntryUnit(unit))
  if (realUnits.length === 0) return building.type === filter
  return realUnits.some((unit) => effectiveUnitUsage(building, unit) === filter)
}

/** 기존 핀·진행률 판정에 용도별 세대만 넘기기 위한 안전한 뷰다. */
export function scopeBuildingToUsage(building: Building, filter: UnitUsageFilter): Building {
  if (filter === '전체') {
    const units = unitsForUsage(building, filter)
    return units.length === building.units.length ? building : { ...building, units }
  }
  return { ...building, units: unitsForUsage(building, filter) }
}
