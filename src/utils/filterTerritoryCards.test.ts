// 구역 카드 필터의 숨은 계약. "왜 이 카드가 목록에 없지" 의 답이 여기 있다.
import { describe, test, expect } from 'vitest'
import { filterTerritoryCards, type CardFilters, type CardFilterDeps } from './filterTerritoryCards'
import type { TerritoryCard } from '../types'

const card = (id: number, over: Partial<TerritoryCard> = {}): TerritoryCard => ({
  id, name: `처인구 유방동 ${id}`, region: '처인구', area: '유방동',
  type: '주택', buildings: 1, units: 10, completed: 0,
  regularVisits: 0, regularVisitPoints: [], progress: 0,
  assignedLeader: null, assignedUsers: [], status: '진행중',
  ...over,
} as TerritoryCard)

const ALL: CardFilters = {
  region: '전체', area: '전체', assignment: '전체', leader: '전체',
  regularVisit: '전체', status: '전체',
}
const deps = (over: Partial<CardFilterDeps> = {}): CardFilterDeps => ({
  leadersOf: () => [],
  hasRegularVisit: () => false,
  ...over,
})
const ids = (cards: TerritoryCard[]) => cards.map((c) => c.id)

describe('지역·동', () => {
  test('지역으로 거른다', () => {
    const list = [card(1), card(2, { region: '기흥구' })]
    expect(ids(filterTerritoryCards(list, { ...ALL, region: '처인구' }, deps()))).toEqual([1])
  })
  test('동으로 거른다', () => {
    const list = [card(1), card(2, { area: '김량장동' })]
    expect(ids(filterTerritoryCards(list, { ...ALL, area: '김량장동' }, deps()))).toEqual([2])
  })
})

describe('인도자 배정', () => {
  const d = deps({ leadersOf: (c) => (c.id === 1 ? ['김민준'] : []) })
  test("'배정' 은 인도자가 있는 것만", () => {
    expect(ids(filterTerritoryCards([card(1), card(2)], { ...ALL, assignment: '배정' }, d))).toEqual([1])
  })
  test("'미배정' 은 인도자가 없는 것만", () => {
    expect(ids(filterTerritoryCards([card(1), card(2)], { ...ALL, assignment: '미배정' }, d))).toEqual([2])
  })
  test('특정 인도자로 거른다', () => {
    expect(ids(filterTerritoryCards([card(1), card(2)], { ...ALL, leader: '김민준' }, d))).toEqual([1])
  })
})

describe('정기방문 · 중국어 세대', () => {
  test('정기방문 있음/없음', () => {
    const d = deps({ hasRegularVisit: (c) => c.id === 1 })
    expect(ids(filterTerritoryCards([card(1), card(2)], { ...ALL, regularVisit: '있음' }, d))).toEqual([1])
    expect(ids(filterTerritoryCards([card(1), card(2)], { ...ALL, regularVisit: '없음' }, d))).toEqual([2])
  })
})

describe('상태 — 여기가 헷갈리는 곳', () => {
  // '대상없음' = **건물도 세대도 0개**인 빈 카드 (isEmptyTerritoryCard)
  const 대상없음 = card(3, { buildings: 0, units: 0, status: '진행중' })

  test("'완료·제외' 는 완료와 대상없음을 **한 묶음**으로 본다", () => {
    const list = [card(1, { status: '진행중' }), card(2, { status: '완료', progress: 100, completed: 10 }), 대상없음]
    const got = ids(filterTerritoryCards(list, { ...ALL, status: '완료·제외' }, deps()))
    expect(got).toContain(2)
    expect(got).toContain(3)
    expect(got).not.toContain(1)
  })

  test("⚠ '진행중' 으로 거르면 **대상없음은 빠진다** — status 가 진행중이어도", () => {
    // 이게 "왜 이 카드가 안 보이지" 의 흔한 답이다.
    // 건물도 세대도 없는 빈 카드는 할 일이 없으므로 진행중 목록에 안 넣는다.
    const got = ids(filterTerritoryCards([card(1, { status: '진행중' }), 대상없음], { ...ALL, status: '진행중' }, deps()))
    expect(got).toEqual([1])
  })

  test("'전체' 면 대상없음도 나온다", () => {
    const got = ids(filterTerritoryCards([card(1), 대상없음], ALL, deps()))
    expect(got).toContain(3)
  })
})

describe('여러 조건이 겹칠 때', () => {
  test('모두 만족해야 남는다 (AND)', () => {
    const list = [
      card(1, { region: '처인구' }),
      card(2, { region: '처인구', area: '김량장동' }),
      card(3, { region: '기흥구' }),
    ]
    const d = deps({ leadersOf: (c) => (c.id === 2 ? ['김민준'] : []) })
    const got = ids(filterTerritoryCards(list, { ...ALL, region: '처인구', assignment: '배정' }, d))
    expect(got).toEqual([2])
  })

  test('아무 조건도 없으면 전부 남는다', () => {
    expect(ids(filterTerritoryCards([card(1), card(2)], ALL, deps())).length).toBe(2)
  })
})
