// 구역 표 정렬. 화면 안에 있을 때는 "왜 이 순서인지" 확인할 방법이 없었다.
import { describe, test, expect } from 'vitest'
import { compareBuildingsForTable, comparePointRowsForTable, type PointRow } from './territoryTableSort'
import type { Building } from '../types'

const b = (over: Partial<Building>): Building => ({
  id: 1, cardId: 1, name: '가나빌라', address: '유방동 1', type: '주택',
  lat: 0, lng: 0, units: [],
} as unknown as Building)
const B = (id: number, name: string, cardId = 1, over: Partial<Building> = {}) =>
  ({ ...b({}), id, name, cardId, ...over } as Building)

const names: Record<number, string> = { 1: '처인구 유방동 1', 2: '처인구 김량장동 2', 9: '미배정 건물' }
const opts = (key: string, dir: 'asc' | 'desc' = 'asc', over = {}) => ({
  sort: { key, dir }, cardName: (id: number) => names[id] ?? '',
  unassignedFirst: false, unassignedCardId: 9, ...over,
})
const sortB = (list: Building[], o: ReturnType<typeof opts>) =>
  [...list].sort((x, y) => compareBuildingsForTable(x, y, o)).map((x) => x.name)

describe('건물 표 정렬', () => {
  test('이름순 — 숫자를 사람처럼 읽는다 (2 < 10)', () => {
    const list = [B(1, '가 10'), B(2, '가 2')]
    expect(sortB(list, opts('건물'))).toEqual(['가 2', '가 10'])
  })

  test('내림차순은 뒤집힌다', () => {
    const list = [B(1, '가 2'), B(2, '가 10')]
    expect(sortB(list, opts('건물', 'desc'))).toEqual(['가 10', '가 2'])
  })

  test('미배정 건물은 **방향과 상관없이** 맨 위다', () => {
    // 내림차순으로 바꿔도 맨 아래로 안 내려간다. 처리해야 할 것이기 때문.
    const list = [B(1, '가'), B(2, '나', 9), B(3, '다')]
    expect(sortB(list, opts('건물', 'asc', { unassignedFirst: true }))[0]).toBe('나')
    expect(sortB(list, opts('건물', 'desc', { unassignedFirst: true }))[0]).toBe('나')
  })

  test('카드 필터가 걸려 있으면 미배정을 올리지 않는다', () => {
    const list = [B(1, '가'), B(2, '나', 9)]
    expect(sortB(list, opts('건물', 'asc'))).toEqual(['가', '나'])
  })

  test('카드순은 카드 이름으로 (id 가 아니라)', () => {
    const list = [B(1, '가', 1), B(2, '나', 2)]
    // '처인구 김량장동 2' < '처인구 유방동 1'
    expect(sortB(list, opts('카드'))).toEqual(['나', '가'])
  })
})

describe('건물 표 — 식당순', () => {
  const withRestaurants = (id: number, name: string, n: number) =>
    ({ ...B(id, name), units: Array.from({ length: n }, (_, i) => ({ id: i, number: `${i}`, isRestaurant: true })) } as unknown as Building)

  test('오름차순은 식당이 적은 것부터', () => {
    const list = [withRestaurants(1, '많다', 3), withRestaurants(2, '없다', 0)]
    expect(sortB(list, opts('식당'))).toEqual(['없다', '많다'])
  })

  test('식당 개수가 같으면 이름순 — **여기는 방향을 안 탄다**', () => {
    // 내림차순이어도 동점끼리는 이름 오름차순이다
    const list = [withRestaurants(1, '나', 2), withRestaurants(2, '가', 2)]
    expect(sortB(list, opts('식당', 'desc'))).toEqual(['가', '나'])
  })
})

const P = (unit: string, status: string, visitedAt?: string, cardId = 1, bname = '가'): PointRow => ({
  building: { cardId, name: bname, address: '주소' },
  unit: { number: unit, status } as PointRow['unit'],
  latestHistory: visitedAt ? { visitedAt } : null,
})
const sortP = (list: PointRow[], key: string, dir: 'asc' | 'desc' = 'asc') =>
  [...list].sort((x, y) => comparePointRowsForTable(x, y, { sort: { key, dir }, cardName: (id) => names[id] ?? '' }))
    .map((r) => r.unit.number)

describe('세대 표 정렬', () => {
  test('상태순은 미방문 → 부재 → 만남 → 대상외', () => {
    const list = [P('1', '대상외'), P('2', '미방문'), P('3', '만남'), P('4', '부재')]
    expect(sortP(list, '상태')).toEqual(['2', '4', '3', '1'])
  })

  test('같은 상태끼리는 호수순 — **여기도 방향을 안 탄다**', () => {
    const list = [P('102', '만남'), P('101', '만남')]
    expect(sortP(list, '상태', 'desc')).toEqual(['101', '102'])
  })

  test('모르는 상태는 맨 뒤로', () => {
    const list = [P('1', '이상한상태'), P('2', '미방문')]
    expect(sortP(list, '상태')).toEqual(['2', '1'])
  })
})

describe('세대 표 — 최근 방문순', () => {
  test('최근 순 (내림차순)', () => {
    const list = [P('1', '만남', '2026-01-01'), P('2', '만남', '2026-06-01')]
    expect(sortP(list, '최근방문', 'desc')).toEqual(['2', '1'])
  })

  test('오래된 순 (오름차순)', () => {
    const list = [P('1', '만남', '2026-06-01'), P('2', '만남', '2026-01-01')]
    expect(sortP(list, '최근방문', 'asc')).toEqual(['2', '1'])
  })

  test('방문한 적 없는 세대는 **어느 방향이든 맨 뒤**', () => {
    // '오래된 순' 으로 봐도 맨 앞에 안 온다.
    // 방문한 적 없는 것은 '가장 오래된' 게 아니라 '기록이 없는' 것이다.
    const list = [P('1', '미방문'), P('2', '만남', '2026-01-01')]
    expect(sortP(list, '최근방문', 'asc')).toEqual(['2', '1'])
    expect(sortP(list, '최근방문', 'desc')).toEqual(['2', '1'])
  })

  test('둘 다 기록이 없으면 호수순', () => {
    const list = [P('102', '미방문'), P('101', '미방문')]
    expect(sortP(list, '최근방문', 'desc')).toEqual(['101', '102'])
  })
})
