import { beforeEach, describe, expect, test, vi } from 'vitest'

const state = vi.hoisted(() => ({
  result: { data: [] as Array<{ id: number }>, error: null as unknown },
  select: vi.fn(),
  rpc: vi.fn(),
  toast: vi.fn(),
}))

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: () => ({
      update: () => ({ eq: () => ({ select: state.select }) }),
      insert: () => ({ select: state.select }),
      delete: () => ({ eq: () => ({ select: state.select }) }),
    }),
    rpc: state.rpc,
    storage: { from: vi.fn() },
  },
}))
vi.mock('../../lib/toast', () => ({ showToast: state.toast }))
vi.mock('../../lib/authToken', () => ({ getAuthToken: () => '00000000-0000-4000-8000-000000000001' }))

const { makeV2AssignmentMutations } = await import('./v2Assignments')

describe('비공식 그룹 쓰기 결과 계약', () => {
  beforeEach(() => {
    state.result = { data: [], error: null }
    state.select.mockReset().mockImplementation(() => Promise.resolve(state.result))
    state.rpc.mockReset().mockResolvedValue({ data: false, error: null })
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

  test.each([
    ['장소 생성', (mutations: ReturnType<typeof makeV2AssignmentMutations>) => mutations.createInformalPlace({
      name: '장소', createdBy: '관리자', lat: 37.2, lng: 127.1,
    })],
    ['모양 저장', (mutations: ReturnType<typeof makeV2AssignmentMutations>) => mutations.saveInformalShape(7, 'route', [
      { lat: 37.2, lng: 127.1 }, { lat: 37.3, lng: 127.2 },
    ])],
    ['장소 수정', (mutations: ReturnType<typeof makeV2AssignmentMutations>) => mutations.updateInformalPlace(7, { name: '새 이름' })],
    ['그룹 이동', (mutations: ReturnType<typeof makeV2AssignmentMutations>) => mutations.moveAssetToGroup(7, 3)],
  ])('비공식 자료 %s이 0행이면 성공으로 보지 않는다', async (_label, mutate) => {
    const fetchAll = vi.fn()
    const mutations = makeV2AssignmentMutations({ fetchAll })

    await expect(mutate(mutations)).resolves.toBe(false)
    expect(fetchAll).not.toHaveBeenCalled()
  })

  test.each([
    ['장소 생성', (mutations: ReturnType<typeof makeV2AssignmentMutations>) => mutations.createInformalPlace({
      name: '장소', createdBy: '관리자', lat: 37.2, lng: 127.1,
    })],
    ['모양 저장', (mutations: ReturnType<typeof makeV2AssignmentMutations>) => mutations.saveInformalShape(7, 'route', [
      { lat: 37.2, lng: 127.1 }, { lat: 37.3, lng: 127.2 },
    ])],
    ['장소 수정', (mutations: ReturnType<typeof makeV2AssignmentMutations>) => mutations.updateInformalPlace(7, { name: '새 이름' })],
    ['그룹 이동', (mutations: ReturnType<typeof makeV2AssignmentMutations>) => mutations.moveAssetToGroup(7, 3)],
  ])('비공식 자료 %s은 한 행이 확인돼야 성공한다', async (_label, mutate) => {
    state.result = { data: [{ id: 7 }], error: null }
    const fetchAll = vi.fn().mockResolvedValue(undefined)
    const mutations = makeV2AssignmentMutations({ fetchAll })

    await expect(mutate(mutations)).resolves.toBe(true)
    expect(fetchAll).toHaveBeenCalledOnce()
  })

  test('삭제 RPC가 false를 돌려주면 성공으로 보지 않는다', async () => {
    const fetchAll = vi.fn()
    const mutations = makeV2AssignmentMutations({ fetchAll })

    await expect(mutations.deleteInformalAsset(7)).resolves.toBe(false)
    expect(fetchAll).not.toHaveBeenCalled()
  })

  test('삭제 RPC가 true를 돌려준 때만 성공한다', async () => {
    state.rpc.mockResolvedValue({ data: true, error: null })
    const fetchAll = vi.fn().mockResolvedValue(undefined)
    const mutations = makeV2AssignmentMutations({ fetchAll })

    await expect(mutations.deleteInformalAsset(7)).resolves.toBe(true)
    expect(fetchAll).toHaveBeenCalledOnce()
  })
})
