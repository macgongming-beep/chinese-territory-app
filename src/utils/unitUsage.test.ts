import { describe, expect, it } from 'vitest'
import type { Building, Unit } from '../types'
import { getPinGroup } from './buildingPin'
import { buildingHasUsage, effectiveUnitUsage, scopeBuildingToUsage, unitsForUsage } from './unitUsage'

const unit = (id: number, over: Partial<Unit> = {}): Unit => ({ id, number: String(id), status: '미방문', ...over })
const building = (over: Partial<Building> = {}): Building => ({
  id: 1, cardId: 1, name: '주상복합', address: '주소', type: '주택', lat: 37, lng: 127,
  units: [], ...over,
})

describe('세대 실제 용도', () => {
  it('식당 > 세대 예외 > 건물 기본값 순으로 판정한다', () => {
    const b = building({ type: '주택' })
    expect(effectiveUnitUsage(b, unit(1))).toBe('주택')
    expect(effectiveUnitUsage(b, unit(2, { usageType: '상가' }))).toBe('상가')
    expect(effectiveUnitUsage(b, unit(3, { usageType: '주택', isRestaurant: true }))).toBe('상가')
  })

  it('주상복합을 용도별로 같은 규칙으로 좁힌다', () => {
    const b = building({
      unitsSurveyed: true,
      units: [
        unit(1, { usageType: '상가', status: '만남' }),
        unit(2, { usageType: '상가', status: '만남' }),
        ...Array.from({ length: 8 }, (_, index) => unit(index + 3)),
      ],
    })
    expect(unitsForUsage(b, '상가')).toHaveLength(2)
    expect(unitsForUsage(b, '주택')).toHaveLength(8)
    expect(scopeBuildingToUsage(b, '전체').units).toHaveLength(10)
    expect(getPinGroup(scopeBuildingToUsage(b, '상가'))).toBe('완료')
    expect(getPinGroup(scopeBuildingToUsage(b, '주택'))).toBe('방문필요')
    expect(getPinGroup(scopeBuildingToUsage(b, '전체'))).toBe('방문필요')
  })

  it('가짜 출입불가 세대를 용도 통계에서 빼고 빈 건물은 기본 용도에 남긴다', () => {
    const b = building({ units: [unit(1, { number: '출입불가' })] })
    expect(unitsForUsage(b, '전체')).toHaveLength(0)
    expect(buildingHasUsage(b, '주택')).toBe(true)
    expect(buildingHasUsage(b, '상가')).toBe(false)
  })
})
