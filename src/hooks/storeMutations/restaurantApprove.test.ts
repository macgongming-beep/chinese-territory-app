// 식당 승인 — **가게 하나가 세대 하나다.**
//
// ⚠ 2026-09-05 운영에서 두 건이 조용히 사라졌다. 이미 식당이 있는 건물에
//   새 식당을 승인했더니 units[0] 을 재사용해서 세대가 안 생겼고, 신청만
//   '승인됨' 으로 바뀌었다. 화면엔 오류도 안 떴다.
import { describe, test, expect, vi, beforeEach } from 'vitest'
import type { Building } from '../../types'

const calls = vi.hoisted(() => ({ inserted: [] as Array<Record<string, unknown>> }))
vi.mock('./shared', () => {
  const table = (name: string) => ({
    update: () => ({ eq: () => ({
      select: () => Promise.resolve({ data: [{ id: 9 }], error: null }),
      then: (f: (v: unknown) => void) => f({ error: null }),
    }) }),
    insert: (row: Record<string, unknown>) => {
      if (name === 'units') calls.inserted.push(row)
      const res = { data: { id: 999 }, error: null }
      return { select: () => ({ single: () => Promise.resolve(res) }), then: (f: (v: unknown) => void) => f({ error: null }) }
    },
    select: () => ({
      eq: () => ({
        limit: () => ({ single: () => Promise.resolve({ data: { id: 1 }, error: null }) }),
        single: () => Promise.resolve({ data: { memo: '', visited_at: null, requested_by: '' }, error: null }),
        select: () => Promise.resolve({ data: [{ id: 9 }], error: null }),
      }),
    }),
  })
  return {
    supabase: { from: table },
    showToast: () => {},
    reportMutationError: () => {},
    ensureAffectedRows: () => true,
    getCurrentVisitor: () => '관리자',
  }
})

const bld = (units: Array<{ id: number; number: string }>): Building =>
  ({ id: 1332, cardId: 1, name: '명지로40번길 8', address: '명지로40번길 8', type: '상가',
     lat: 37, lng: 127, units }) as Building

beforeEach(() => { calls.inserted = [] })

describe('식당 승인은 가게마다 세대를 만든다', () => {
  test('⚠ 이미 다른 식당이 있어도 **새 세대를 만든다**', async () => {
    const { makeRestaurantServiceMutations } = await import('./restaurantService')
    const m = makeRestaurantServiceMutations({
      fetchAll: async () => {}, buildings: [bld([{ id: 2305, number: '신연진마라탕' }])], cardBoundaries: [],
    })
    await m.approveRestaurantRequest(9, { name: '过桥米线', address: '명지로40번길 8', reviewer: '관리자', existingBuildingId: 1332 })
    expect(calls.inserted.map((r) => r.number)).toEqual(['过桥米线'])
  })

  test('같은 이름을 두 번 승인하면 세대를 또 만들지 않는다', async () => {
    const { makeRestaurantServiceMutations } = await import('./restaurantService')
    const m = makeRestaurantServiceMutations({
      fetchAll: async () => {}, buildings: [bld([{ id: 2305, number: '过桥米线' }])], cardBoundaries: [],
    })
    await m.approveRestaurantRequest(9, { name: '过桥米线', address: '명지로40번길 8', reviewer: '관리자', existingBuildingId: 1332 })
    expect(calls.inserted).toHaveLength(0)
  })

  test('세대가 하나도 없는 건물에도 만든다', async () => {
    const { makeRestaurantServiceMutations } = await import('./restaurantService')
    const m = makeRestaurantServiceMutations({
      fetchAll: async () => {}, buildings: [bld([])], cardBoundaries: [],
    })
    await m.approveRestaurantRequest(9, { name: '진미운남쌀국수', address: '명지로40번길 8', reviewer: '관리자', existingBuildingId: 1332 })
    expect(calls.inserted.map((r) => r.number)).toEqual(['진미운남쌀국수'])
  })
})
