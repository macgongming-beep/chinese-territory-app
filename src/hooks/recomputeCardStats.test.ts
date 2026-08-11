// 서버 재조회 없이 카드 통계를 다시 계산하는 로직 검증.
// 방문 기록·세대 추가 후에도 진행률과 세대 수가 맞아야 한다.
import { describe, it, expect } from 'vitest'
import { recomputeCardStats } from './storeTransforms'
import type { Building, TerritoryCard, Unit } from '../types'

function unit(id: number, status: Unit['status'], extra: Partial<Unit> = {}): Unit {
  return { id, number: String(id), status, ...extra }
}

function building(id: number, cardId: number, units: Unit[], name = `건물${id}`): Building {
  return { id, cardId, name, address: '주소', type: '주택', lat: 37.2, lng: 127.1, units } as Building
}

const card: TerritoryCard = {
  id: 1, name: '카드1', area: '고림동', region: '처인구', type: '주택', status: '진행중',
  buildings: 0, units: 0, completed: 0, progress: 0,
  regularVisits: 0, regularVisitPoints: [], assignedLeader: '', assignedLeaders: [], assignedUsers: [],
} as TerritoryCard

describe('recomputeCardStats', () => {
  it('세대가 없으면 100% (돌 곳이 없으므로 완료로 본다)', () => {
    const r = recomputeCardStats(card, [])
    expect(r.units).toBe(0)
    expect(r.progress).toBe(100)
  })

  it('미방문·부재는 아직 완료가 아니다 (지도 판정과 같은 규칙)', () => {
    const bs = [building(1, 1, [unit(1, '만남'), unit(2, '부재'), unit(3, '미방문'), unit(4, '대상외')])]
    const r = recomputeCardStats(card, bs)
    expect(r.units).toBe(4)
    expect(r.completed).toBe(2)      // 만남 · 대상외
    expect(r.progress).toBe(50)
  })

  it('세대를 추가하면 진행률이 내려간다 (분모 증가)', () => {
    const before = recomputeCardStats(card, [building(1, 1, [unit(1, '만남')])])
    expect(before.progress).toBe(100)
    const after = recomputeCardStats(card, [building(1, 1, [unit(1, '만남'), unit(2, '미방문')])])
    expect(after.units).toBe(2)
    expect(after.progress).toBe(50)
  })

  it('다른 카드의 건물은 세지 않는다', () => {
    const bs = [building(1, 1, [unit(1, '만남')]), building(2, 99, [unit(2, '미방문'), unit(3, '미방문')])]
    const r = recomputeCardStats(card, bs)
    expect(r.buildings).toBe(1)
    expect(r.units).toBe(1)
  })

  it('정기방문 지점도 함께 갱신된다', () => {
    const bs = [building(1, 1, [unit(1, '만남', { isRegularVisit: true, regularVisitor: '최윤민' }), unit(2, '미방문')])]
    const r = recomputeCardStats(card, bs)
    expect(r.regularVisits).toBe(1)
    expect(r.regularVisitPoints[0].visitor).toBe('최윤민')
  })

  it('카드의 다른 정보(이름·인도자)는 건드리지 않는다', () => {
    const r = recomputeCardStats({ ...card, assignedLeader: '박진호' }, [building(1, 1, [unit(1, '만남')])])
    expect(r.name).toBe('카드1')
    expect(r.assignedLeader).toBe('박진호')
  })
})
