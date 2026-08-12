import { describe, it, expect } from 'vitest'
import { getRestaurantRows, countRestaurants, isChineseResidenceUnit, getRestaurantUnits } from './restaurants'
import type { Building, Unit } from '../types'

function unit(id: number, number: string, extra: Partial<Unit> = {}): Unit {
  return { id, number, status: '미방문', ...extra }
}
function building(id: number, units: Unit[], extra: Partial<Building> = {}): Building {
  return { id, cardId: 1, name: `건물${id}`, address: `주소${id}`, type: '상가', lat: 37, lng: 127, units, ...extra } as Building
}

describe('식당 판정', () => {
  it('식당 표시된 세대만 식당으로 센다', () => {
    const b = building(1, [
      unit(1, '라홍방마라탕', { isRestaurant: true }),
      unit(2, '더진국'),
      unit(3, '정가미 감자탕', { isRestaurant: true }),
    ])
    expect(getRestaurantUnits(b).map((u) => u.number)).toEqual(['라홍방마라탕', '정가미 감자탕'])
    expect(countRestaurants([b])).toBe(2)
  })

  it('중국어 사용 여부와 식당 여부는 별개다', () => {
    // 중국어를 쓰지 않는 식당 — 예전 구조에서는 표현할 수 없었다
    const b = building(1, [unit(1, '봉추찜닭', { isRestaurant: true, isChinese: false })])
    expect(countRestaurants([b])).toBe(1)
  })

  it("대상외로 찍어도 목록에서 사라지지 않고 표시만 된다", () => {
    const b = building(1, [unit(1, '파랑새', { isRestaurant: true, status: '대상외' })])
    const [row] = getRestaurantRows([b])
    expect(row.name).toBe('파랑새')
    expect(row.isExcluded).toBe(true)
  })

  it('세대 없이 건물에만 식당 표시가 있는 옛 데이터도 한 줄로 나온다', () => {
    const b = building(1, [], { isRestaurant: true, name: '중부대로 1294' })
    const rows = getRestaurantRows([b])
    expect(rows).toHaveLength(1)
    expect(rows[0].unitId).toBeNull()
    expect(rows[0].name).toBe('중부대로 1294')
  })

  it('식당이 아닌 건물은 나오지 않는다', () => {
    expect(getRestaurantRows([building(1, [unit(1, '101호')])])).toEqual([])
  })

  it('중국인 거주 세대에서 식당은 빠진다 (통계 섞임 방지)', () => {
    const 거주 = unit(1, '101호', { isChinese: true })
    const 식당 = unit(2, '마라탕', { isChinese: true, isRestaurant: true })
    expect(isChineseResidenceUnit(거주)).toBe(true)
    expect(isChineseResidenceUnit(식당)).toBe(false)
  })

  it('건물 유형이 주택이어도 식당 세대는 숨기지 않는다 (잘못 등록을 감춤 방지)', () => {
    const b = building(1, [unit(1, '마라탕', { isRestaurant: true })], { type: '주택' })
    expect(countRestaurants([b])).toBe(1)
  })
})
