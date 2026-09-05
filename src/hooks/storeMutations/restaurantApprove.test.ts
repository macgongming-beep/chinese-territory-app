import { beforeEach, describe, expect, test, vi } from 'vitest'
import type { Building } from '../../types'

const calls = vi.hoisted(() => ({ rpc: [] as Array<{ name: string; args: Record<string, unknown> }> }))

vi.mock('../../lib/authToken', () => ({ getAuthToken: () => '00000000-0000-0000-0000-000000000009' }))
vi.mock('./shared', () => ({
  supabase: {
    rpc: (name: string, args: Record<string, unknown>) => {
      calls.rpc.push({ name, args })
      return Promise.resolve({ data: { building_id: 1332, unit_id: 999 }, error: null })
    },
  },
  showToast: vi.fn(),
  reportMutationError: vi.fn(),
  ensureAffectedRows: () => true,
}))

beforeEach(() => { calls.rpc = [] })

describe('식당 승인은 DB 트랜잭션 하나로 처리한다', () => {
  test('기존 건물 승인은 하나의 RPC에 건물과 신청 정보를 넘긴다', async () => {
    const { makeRestaurantServiceMutations } = await import('./restaurantService')
    const fetchAll = vi.fn()
    const buildings = [{ id: 1332, units: [] }] as unknown as Building[]
    const mutations = makeRestaurantServiceMutations({ fetchAll, buildings, cardBoundaries: [] })

    await mutations.approveRestaurantRequest(9, {
      name: '过桥米线', address: '명지로40번길 8', reviewer: '관리자', existingBuildingId: 1332,
    })

    expect(calls.rpc).toEqual([{
      name: 'approve_restaurant_request_tx',
      args: expect.objectContaining({ p_request_id: 9, p_name: '过桥米线', p_existing_building_id: 1332 }),
    }])
    expect(fetchAll).toHaveBeenCalledOnce()
  })

  test('새 건물도 승인 RPC 한 번만 호출한다', async () => {
    const { makeRestaurantServiceMutations } = await import('./restaurantService')
    const mutations = makeRestaurantServiceMutations({ fetchAll: vi.fn(), buildings: [], cardBoundaries: [] })
    await mutations.approveRestaurantRequest(10, {
      name: '진미운남쌀국수', address: '용인시 처인구 새길 1', reviewer: '관리자', lat: 37, lng: 127,
    })
    expect(calls.rpc).toHaveLength(1)
    expect(calls.rpc[0].name).toBe('approve_restaurant_request_tx')
  })
})
