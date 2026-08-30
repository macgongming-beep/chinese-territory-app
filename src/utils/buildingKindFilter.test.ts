import { describe, test, expect } from 'vitest'
import { kindToFilters, filtersToKind } from './buildingKindFilter'

describe('한 줄로 합친 구분 필터', () => {
  test('누르면 두 상태가 함께 정해진다', () => {
    expect(kindToFilters('전체')).toEqual({ type: '전체', restaurant: '전체' })
    expect(kindToFilters('주택')).toEqual({ type: '주택', restaurant: '전체' })
    expect(kindToFilters('상가')).toEqual({ type: '상가', restaurant: '전체' })
  })

  test('⚠ 식당은 유형을 안 좁힌다 — 주택 식당이 7개 있다', () => {
    expect(kindToFilters('식당')).toEqual({ type: '전체', restaurant: '식당' })
  })
})

describe('어느 버튼이 켜져 보이나', () => {
  test('그대로 되짚어진다', () => {
    for (const k of ['전체', '주택', '상가', '식당'] as const) {
      const f = kindToFilters(k)
      expect(filtersToKind(f.type, f.restaurant), k).toBe(k)
    }
  })

  test('⚠ 식당이 걸려 있으면 유형보다 먼저 보인다', () => {
    // 세대 목록에서 유형만 따로 바꾸면 이런 조합이 생긴다.
    // '상가' 로 보이면 식당 필터가 걸린 줄 모른다.
    expect(filtersToKind('상가', '식당')).toBe('식당')
  })

  test("⚠ '식당 아님' 은 합친 줄에 없다 — 아무 버튼도 안 켠다", () => {
    expect(filtersToKind('전체', '식당 아님')).toBeNull()
  })
})
