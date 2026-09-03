import { beforeEach, describe, expect, test, vi } from 'vitest'

const state = vi.hoisted(() => ({
  result: { data: [] as Array<{ id: number }>, error: null as unknown },
  select: vi.fn(),
  toast: vi.fn(),
}))

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: () => ({
      update: () => ({ eq: () => ({ select: state.select }) }),
      delete: () => ({ eq: () => ({ select: state.select }) }),
    }),
    storage: { from: vi.fn() },
  },
}))
vi.mock('../../lib/toast', () => ({ showToast: state.toast }))

const { makeV2AssignmentMutations } = await import('./v2Assignments')

describe('비공식 그룹 쓰기 결과 계약', () => {
  beforeEach(() => {
    state.result = { data: [], error: null }
    state.select.mockReset().mockImplementation(() => Promise.resolve(state.result))
    state.toast.mockClear()
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
  })

  test.each([
    ['이름 변경', (mutations: ReturnType<typeof makeV2AssignmentMutations>) => mutations.renameInformalGroup(7, '새 이름')],
    ['삭제', (mutations: ReturnType<typeof makeV2AssignmentMutations>) => mutations.deleteInformalGroup(7)],
  ])('RLS가 0행을 돌려주면 %s을 성공으로 보지 않는다', async (_label, mutate) => {
    const fetchAll = vi.fn()
    const mutations = makeV2AssignmentMutations({ fetchAll })

    await expect(mutate(mutations)).resolves.toBe(false)
    expect(state.select).toHaveBeenCalledWith('id')
    expect(fetchAll).not.toHaveBeenCalled()
    expect(state.toast).toHaveBeenCalledWith(
      expect.stringContaining('변경할 자료를 찾지 못했거나 권한이 없습니다.'),
      'error',
    )
  })

  test.each([
    ['이름 변경', (mutations: ReturnType<typeof makeV2AssignmentMutations>) => mutations.renameInformalGroup(7, '새 이름')],
    ['삭제', (mutations: ReturnType<typeof makeV2AssignmentMutations>) => mutations.deleteInformalGroup(7)],
  ])('한 행이 바뀐 때만 %s 성공을 돌려준다', async (_label, mutate) => {
    state.result = { data: [{ id: 7 }], error: null }
    const fetchAll = vi.fn().mockResolvedValue(undefined)
    const mutations = makeV2AssignmentMutations({ fetchAll })

    await expect(mutate(mutations)).resolves.toBe(true)
    expect(fetchAll).toHaveBeenCalledOnce()
  })
})
