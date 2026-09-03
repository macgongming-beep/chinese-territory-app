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
      insert: () => ({ select: state.select }),
      delete: () => ({ eq: () => ({ select: state.select }) }),
    }),
  },
}))
vi.mock('../../lib/toast', () => ({ showToast: state.toast }))

const { deleteServiceSuggestion, saveServiceSuggestion } = await import('./serviceSuggestions')

const input = {
  title: '테스트 제안',
  show_title_on_home: false,
  tags: [],
  is_visible: false,
  content: [],
}

describe('대화 방법 제안 쓰기 결과 계약', () => {
  beforeEach(() => {
    state.result = { data: [], error: null }
    state.select.mockReset().mockImplementation(() => Promise.resolve(state.result))
    state.toast.mockClear()
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
  })

  test.each([
    ['추가', () => saveServiceSuggestion(input)],
    ['수정', () => saveServiceSuggestion({ ...input, id: 7 })],
    ['삭제', () => deleteServiceSuggestion(7)],
  ])('RLS가 0행을 돌려주면 %s을 성공으로 보지 않는다', async (_label, mutate) => {
    await expect(mutate()).resolves.toBe(false)
    expect(state.select).toHaveBeenCalledWith('id')
    expect(state.toast).toHaveBeenCalledWith(
      expect.stringContaining('변경할 자료를 찾지 못했거나 권한이 없습니다.'),
      'error',
    )
  })

  test.each([
    ['추가', () => saveServiceSuggestion(input)],
    ['수정', () => saveServiceSuggestion({ ...input, id: 7 })],
    ['삭제', () => deleteServiceSuggestion(7)],
  ])('한 행이 바뀐 때만 %s 성공을 돌려준다', async (_label, mutate) => {
    state.result = { data: [{ id: 7 }], error: null }
    await expect(mutate()).resolves.toBe(true)
  })
})
