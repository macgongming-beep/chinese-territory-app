import { beforeEach, describe, expect, test, vi } from 'vitest'

/**
 * 구역선 저장·삭제가 **성공 여부를 돌려주는지** 본다.
 * PostgREST 는 RLS 로 막힌 UPDATE/DELETE 에 오류가 아니라 0행을 준다.
 * 결과를 안 보면 화면이 성공처럼 닫히고, 한참 그린 구역선이 소리 없이 사라진다.
 */
const state = vi.hoisted(() => ({
  result: { data: [] as Array<{ card_id: number }>, error: null as unknown },
  select: vi.fn(),
  toast: vi.fn(),
}))

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: () => ({
      upsert: () => ({ select: state.select }),
      delete: () => ({ eq: () => ({ select: state.select }) }),
    }),
  },
}))
vi.mock('../../lib/toast', () => ({ showToast: state.toast }))

const { makeCardBoundaryMutations } = await import('./cardBoundaries')

const 삼각형 = [{ lat: 37.1, lng: 127.1 }, { lat: 37.2, lng: 127.2 }, { lat: 37.3, lng: 127.1 }]

describe('구역선 쓰기 결과 계약', () => {
  beforeEach(() => {
    state.result = { data: [], error: null }
    state.select.mockReset().mockImplementation(() => Promise.resolve(state.result))
    state.toast.mockClear()
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
  })

  const make = (fetchAll = vi.fn()) =>
    makeCardBoundaryMutations({ fetchAll, cardBoundaries: [], buildings: [] })

  test('저장이 0행이면 성공으로 보지 않는다', async () => {
    const fetchAll = vi.fn()
    await expect(make(fetchAll).saveCardBoundary(7, 삼각형)).resolves.toBe(false)
    expect(fetchAll).not.toHaveBeenCalled()
    expect(state.toast).not.toHaveBeenCalledWith(
      expect.stringContaining('구역선이 저장됐습니다'), undefined,
    )
  })

  test('저장이 0행이면 이유를 화면에 알린다', async () => {
    await make().saveCardBoundary(7, 삼각형)
    expect(state.toast).toHaveBeenCalledWith(
      expect.stringContaining('변경할 자료를 찾지 못했거나 권한이 없습니다.'), 'error',
    )
  })

  test('한 행이 확인돼야 저장 성공을 돌려준다', async () => {
    state.result = { data: [{ card_id: 7 }], error: null }
    const fetchAll = vi.fn().mockResolvedValue(undefined)
    await expect(make(fetchAll).saveCardBoundary(7, 삼각형)).resolves.toBe(true)
    expect(fetchAll).toHaveBeenCalledOnce()
  })

  test('점이 3개 미만이면 서버를 부르지 않는다', async () => {
    await expect(make().saveCardBoundary(7, 삼각형.slice(0, 2))).resolves.toBe(false)
    expect(state.select).not.toHaveBeenCalled()
  })

  test('삭제가 0행이면 성공으로 보지 않는다', async () => {
    const fetchAll = vi.fn()
    await expect(make(fetchAll).deleteCardBoundary(7)).resolves.toBe(false)
    expect(fetchAll).not.toHaveBeenCalled()
    expect(state.toast).not.toHaveBeenCalledWith(
      expect.stringContaining('구역선이 삭제됐습니다'), expect.anything(),
    )
  })

  test('한 행이 지워져야 삭제 성공을 돌려준다', async () => {
    state.result = { data: [{ card_id: 7 }], error: null }
    const fetchAll = vi.fn().mockResolvedValue(undefined)
    await expect(make(fetchAll).deleteCardBoundary(7)).resolves.toBe(true)
    expect(fetchAll).toHaveBeenCalledOnce()
  })
})
