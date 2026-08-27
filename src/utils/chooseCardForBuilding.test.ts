import { describe, test, expect } from 'vitest'
import { chooseCardForBuilding } from './chooseCardForBuilding'
import type { CardBoundary, TerritoryCard } from '../types'

const card = (id: number, area: string) => ({ id, name: `처인구 ${area} ${id}`, region: '처인구', area } as TerritoryCard)
const CARDS = [card(1, '유방동'), card(2, '김량장동'), card(9, '')]
const square: CardBoundary = {
  cardId: 2,
  points: [{ lat: 37.2, lng: 127.1 }, { lat: 37.3, lng: 127.1 }, { lat: 37.3, lng: 127.3 }, { lat: 37.2, lng: 127.3 }],
} as CardBoundary

const base = { chosen: 'auto' as const, latLng: null, address: '', cards: CARDS, cardBoundaries: [] as CardBoundary[] }

describe('chooseCardForBuilding', () => {
  test('직접 고른 카드가 최우선', () => {
    expect(chooseCardForBuilding({ ...base, chosen: 7 })).toEqual({ cardId: 7, how: 'chosen' })
  })

  test('구역선이 주소보다 우선', () => {
    // 주소는 유방동(카드 1)인데 좌표는 카드 2 의 구역선 안이다
    const r = chooseCardForBuilding({
      ...base, address: '처인구 유방동 1', latLng: { lat: 37.25, lng: 127.19 }, cardBoundaries: [square],
    })
    expect(r).toEqual({ cardId: 2, how: 'boundary' })
  })

  test('구역선 밖이면 주소의 동으로', () => {
    const r = chooseCardForBuilding({ ...base, address: '처인구 유방동 1', latLng: { lat: 38, lng: 128 }, cardBoundaries: [square] })
    expect(r).toEqual({ cardId: 1, how: 'address' })
  })

  test('아무것도 안 맞으면 미배정 카드', () => {
    const r = chooseCardForBuilding({ ...base, address: '어딘가 1', unassignedCardId: 9 })
    expect(r).toEqual({ cardId: 9, how: 'unassigned' })
  })

  test('미배정 카드도 없으면 첫 카드 — 사용자의 입력을 잃지 않는다', () => {
    // 좌표를 못 찾아도 건물은 만들어져야 한다. 나중에 옮길 수 있다.
    // 문제였던 건 배열이 아니라 **필터**였다 (filteredCards[0] 은 화면 따라 달라졌다).
    const r = chooseCardForBuilding({ ...base, address: '어딘가 1' })
    expect(r).toEqual({ cardId: 1, how: 'firstCard' })
  })

  test('카드가 하나도 없으면 null', () => {
    const r = chooseCardForBuilding({ ...base, address: '어딘가 1', cards: [] })
    expect(r).toEqual({ cardId: null, how: 'none' })
  })

  test('⚠ 화면 필터와 무관하다 — 카드 목록이 같으면 결과가 같다', () => {
    // 예전에는 filteredCards 를 봐서, 필터를 바꾸면 저장 카드가 달라졌다.
    // 이제 인자에 '거르지 않은 전체'만 들어오므로 필터가 끼어들 자리가 없다.
    const a = chooseCardForBuilding({ ...base, address: '처인구 유방동 1' })
    const b = chooseCardForBuilding({ ...base, address: '처인구 유방동 1', cards: [...CARDS].reverse() })
    expect(a.cardId).toBe(1)
    expect(b.cardId).toBe(1)   // 순서가 바뀌어도 같다
  })

  test('동 이름이 없는 주소는 미배정으로', () => {
    const r = chooseCardForBuilding({ ...base, address: '번지수만 12-3', unassignedCardId: 9 })
    expect(r.how).toBe('unassigned')
  })
})
