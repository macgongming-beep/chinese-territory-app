import { describe, it, expect } from 'vitest'
import {
  normalizeCardSearch,
  getTerritoryCardOperationalState,
  isEmptyTerritoryCard,
  sortTerritoryCardsByOperationalPriority,
} from './cardSearch'
import type { TerritoryCard } from '../types'

function card(over: Partial<TerritoryCard> = {}): TerritoryCard {
  return {
    id: 1, name: 'A', area: '동탄', region: '화성', type: '주택' as TerritoryCard['type'],
    buildings: 1, units: 5, completed: 0, regularVisits: 0, regularVisitPoints: [],
    progress: 0, assignedLeader: null, assignedUsers: [], status: '미배정',
    ...over,
  }
}

describe('normalizeCardSearch', () => {
  it('소문자화 + 공백제거 + "동" 제거', () => {
    expect(normalizeCardSearch('  동탄 1동 ')).toBe('탄1')
    expect(normalizeCardSearch('ABC')).toBe('abc')
  })
})

describe('getTerritoryCardOperationalState', () => {
  it('건물·세대 없으면 대상없음', () => {
    expect(getTerritoryCardOperationalState(card({ buildings: 0, units: 0 }))).toBe('대상없음')
  })
  it('progress 100 또는 status 완료 → 완료', () => {
    expect(getTerritoryCardOperationalState(card({ progress: 100 }))).toBe('완료')
    expect(getTerritoryCardOperationalState(card({ status: '완료' }))).toBe('완료')
  })
  it('progress>0 또는 진행중 → 진행중', () => {
    expect(getTerritoryCardOperationalState(card({ progress: 40 }))).toBe('진행중')
    expect(getTerritoryCardOperationalState(card({ status: '진행중' }))).toBe('진행중')
  })
  it('정기방문 있으면 정기방문', () => {
    expect(getTerritoryCardOperationalState(card({ regularVisits: 2 }))).toBe('정기방문')
  })
  it('아무것도 없으면 방문필요', () => {
    expect(getTerritoryCardOperationalState(card())).toBe('방문필요')
  })
})

describe('isEmptyTerritoryCard', () => {
  it('건물·세대 0이면 빈 카드', () => {
    expect(isEmptyTerritoryCard(card({ buildings: 0, units: 0 }))).toBe(true)
    expect(isEmptyTerritoryCard(card({ buildings: 1, units: 0 }))).toBe(false)
  })
})

describe('sortTerritoryCardsByOperationalPriority', () => {
  it('진행중 → 방문필요 → 정기방문 → 완료 → 대상없음 순', () => {
    const cards = [
      card({ id: 1, name: '완료', progress: 100 }),
      card({ id: 2, name: '진행중', progress: 50 }),
      card({ id: 3, name: '대상없음', buildings: 0, units: 0 }),
      card({ id: 4, name: '방문필요' }),
      card({ id: 5, name: '정기방문', regularVisits: 1 }),
    ]
    const sorted = sortTerritoryCardsByOperationalPriority(cards).map((c) => c.name)
    expect(sorted).toEqual(['진행중', '방문필요', '정기방문', '완료', '대상없음'])
  })

  it('원본 배열을 변형하지 않음 (slice)', () => {
    const cards = [card({ id: 1 }), card({ id: 2 })]
    const copy = [...cards]
    sortTerritoryCardsByOperationalPriority(cards)
    expect(cards).toEqual(copy)
  })
})
