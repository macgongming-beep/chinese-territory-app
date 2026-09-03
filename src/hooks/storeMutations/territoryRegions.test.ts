import { beforeEach, describe, expect, test, vi } from 'vitest'

const state = vi.hoisted(() => ({
  result: { data: [] as Array<{ id: number }>, error: null as unknown },
  select: vi.fn(),
  toast: vi.fn(),
}))

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: () => ({
      update: () => ({
        eq: () => ({
          select: state.select,
        }),
      }),
    }),
  },
}))
vi.mock('../../lib/toast', () => ({ showToast: state.toast }))

const { makeTerritoryRegionMutations } = await import('./territoryRegions')

describe('지역 수정 결과 계약', () => {
  beforeEach(() => {
    state.result = { data: [], error: null }
    state.select.mockReset().mockImplementation(() => Promise.resolve(state.result))
    state.toast.mockClear()
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
  })

  test('RLS가 0행을 돌려주면 성공으로 알리지 않고 편집 내용을 유지하게 false를 돌려준다', async () => {
    const fetchAll = vi.fn()
    const mutations = makeTerritoryRegionMutations({ fetchAll })

    await expect(mutations.updateTerritoryRegion(7, { city: '테스트시' })).resolves.toBe(false)
    expect(state.select).toHaveBeenCalledWith('id')
    expect(fetchAll).not.toHaveBeenCalled()
    expect(state.toast).toHaveBeenCalledWith(
      '지역을 수정하지 못했습니다.\n변경할 자료를 찾지 못했거나 권한이 없습니다.',
      'error',
    )
    expect(state.toast).not.toHaveBeenCalledWith('저장했습니다', expect.anything())
  })

  test('한 행이 바뀐 때만 새로고침하고 성공을 돌려준다', async () => {
    state.result = { data: [{ id: 7 }], error: null }
    const fetchAll = vi.fn().mockResolvedValue(undefined)
    const mutations = makeTerritoryRegionMutations({ fetchAll })

    await expect(mutations.updateTerritoryRegion(7, { city: '테스트시' })).resolves.toBe(true)
    expect(fetchAll).toHaveBeenCalledOnce()
    expect(state.toast).toHaveBeenCalledWith('저장했습니다')
  })
})
