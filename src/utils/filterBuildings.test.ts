import { describe, test, expect } from 'vitest'
import {
  filterBuildingsByScope, filterBuildingsByTraits,
  buildingHasMemo, buildingHasRegularVisit,
} from './filterBuildings'
import type { Building, TerritoryCard, Unit } from '../types'

const unit = (over: Partial<Unit> = {}): Unit =>
  ({ id: 1, number: '101', status: '미방문', isChinese: false, isRestaurant: false, isRegularVisit: false, ...over } as Unit)
const bld = (id: number, over: Partial<Building> = {}): Building =>
  ({ id, cardId: 1, name: `건물${id}`, address: '주소', type: '주택', lat: 0, lng: 0, isChineseHeavy: false, units: [unit()], ...over } as Building)

const CARDS: Record<number, TerritoryCard> = {
  1: { id: 1, region: '처인구', area: '유방동' } as TerritoryCard,
  2: { id: 2, region: '기흥구', area: '신갈동' } as TerritoryCard,
}
const cardOf = (id: number) => CARDS[id]
const SCOPE = { region: '전체', area: '전체', card: '전체' as const, type: '전체' }
const TRAITS = { regularVisit: '전체', memo: '전체', restaurant: '전체' }
const ids = (list: Building[]) => list.map((b) => b.id)

describe('① 범위', () => {
  test('지역·동으로 거른다', () => {
    const list = [bld(1), bld(2, { cardId: 2 })]
    expect(ids(filterBuildingsByScope(list, { ...SCOPE, region: '기흥구' }, cardOf))).toEqual([2])
    expect(ids(filterBuildingsByScope(list, { ...SCOPE, area: '유방동' }, cardOf))).toEqual([1])
  })

  test('카드로 거른다', () => {
    const list = [bld(1), bld(2, { cardId: 2 })]
    expect(ids(filterBuildingsByScope(list, { ...SCOPE, card: 2 }, cardOf))).toEqual([2])
  })

  test('유형으로 거른다', () => {
    const list = [bld(1), bld(2, { type: '상가' })]
    expect(ids(filterBuildingsByScope(list, { ...SCOPE, type: '상가' }, cardOf))).toEqual([2])
  })

  test('⚠ 카드를 못 찾는 건물은 아예 빠진다', () => {
    // 지역·동을 판단할 수 없어서다. 삭제된 카드에 딸린 고아 건물이 여기 걸린다
    const list = [bld(1), bld(2, { cardId: 999 })]
    expect(ids(filterBuildingsByScope(list, SCOPE, cardOf))).toEqual([1])
  })
})

describe('② 속성', () => {
  test('정기방문 있음/없음', () => {
    const list = [bld(1, { units: [unit({ isRegularVisit: true })] }), bld(2)]
    expect(ids(filterBuildingsByTraits(list, { ...TRAITS, regularVisit: '있음' }))).toEqual([1])
    expect(ids(filterBuildingsByTraits(list, { ...TRAITS, regularVisit: '없음' }))).toEqual([2])
  })

  test('메모는 건물 메모와 세대 메모를 **둘 다** 본다', () => {
    const list = [
      bld(1, { memo: '건물 메모' }),
      bld(2, { units: [unit({ memo: '세대 메모' })] }),
      bld(3),
    ]
    expect(ids(filterBuildingsByTraits(list, { ...TRAITS, memo: '있음' }))).toEqual([1, 2])
  })

  test('공백만 있는 메모는 없는 것으로 본다', () => {
    const list = [bld(1, { memo: '   ' })]
    expect(ids(filterBuildingsByTraits(list, { ...TRAITS, memo: '있음' }))).toEqual([])
  })


  test('식당 / 식당 아님', () => {
    const list = [bld(1, { units: [unit({ isRestaurant: true })] }), bld(2)]
    expect(ids(filterBuildingsByTraits(list, { ...TRAITS, restaurant: '식당' }))).toEqual([1])
    expect(ids(filterBuildingsByTraits(list, { ...TRAITS, restaurant: '식당 아님' }))).toEqual([2])
  })
})

describe('두 단계는 따로다', () => {
  test('⚠ 세대 목록은 범위까지만 쓴다 — 건물 속성에 끌려가면 안 된다', () => {
    // 건물이 '메모 없음' 이어도 그 안 세대는 세대 화면에 나와야 한다.
    // 그래서 범위와 속성을 따로 둔다.
    const list = [bld(1), bld(2, { memo: '메모' })]
    const scoped = filterBuildingsByScope(list, SCOPE, cardOf)
    expect(ids(scoped)).toEqual([1, 2])
    expect(ids(filterBuildingsByTraits(scoped, { ...TRAITS, memo: '있음' }))).toEqual([2])
  })
})

describe('작은 판정들', () => {
  test('buildingHasMemo', () => {
    expect(buildingHasMemo(bld(1))).toBe(false)
    expect(buildingHasMemo(bld(1, { memo: '가' }))).toBe(true)
    expect(buildingHasMemo(bld(1, { units: [unit({ memo: '가' })] }))).toBe(true)
  })
  test('buildingHasRegularVisit', () => {
    expect(buildingHasRegularVisit(bld(1))).toBe(false)
    expect(buildingHasRegularVisit(bld(1, { units: [unit({ isRegularVisit: true })] }))).toBe(true)
  })
})
