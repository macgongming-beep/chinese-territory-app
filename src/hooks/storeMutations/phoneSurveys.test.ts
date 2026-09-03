import { beforeEach, describe, expect, test, vi } from 'vitest'

const state = vi.hoisted(() => ({
  results: [] as Array<{ data: Array<{ id: number; place_id: string }> | null; error: { message: string } | null }>,
  upsert: vi.fn(),
  select: vi.fn(),
  toast: vi.fn(),
}))

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: () => ({ upsert: state.upsert }),
  },
}))
vi.mock('../../lib/toast', () => ({ showToast: state.toast }))

const { savePhoneSurveyRows } = await import('./phoneSurveys')

const row = {
  place_id: 'place-1',
  name: '테스트 업소',
  address: null,
  category: null,
  phone: null,
  restaurant: null,
  result: '있음' as const,
  checked_at: null,
  checked_by: null,
  memo: null,
  unit_id: null,
  uploaded_by: '관리자',
}

describe('전화 조사 대장 쓰기 결과 계약', () => {
  beforeEach(() => {
    state.results = []
    state.upsert.mockReset().mockImplementation(() => ({ select: state.select }))
    state.select.mockReset().mockImplementation(() => Promise.resolve(state.results.shift()))
    state.toast.mockClear()
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
  })

  test('RLS가 0행을 돌려주면 성공으로 보지 않는다', async () => {
    state.results.push({ data: [], error: null })

    await expect(savePhoneSurveyRows([row])).resolves.toBe(false)
    expect(state.select).toHaveBeenCalledWith('id, place_id')
    expect(state.toast).toHaveBeenCalledWith(expect.stringContaining('0건만 확인'), 'error')
  })

  test('요청한 모든 행이 확인된 때만 성공한다', async () => {
    state.results.push({ data: [{ id: 1, place_id: row.place_id }], error: null })

    await expect(savePhoneSurveyRows([row])).resolves.toBe(true)
  })

  test('일부 행만 반환되면 부분 성공으로 오인하지 않는다', async () => {
    state.results.push({ data: [{ id: 1, place_id: row.place_id }], error: null })

    await expect(savePhoneSurveyRows([row, { ...row, place_id: 'place-2' }])).resolves.toBe(false)
    expect(state.toast).toHaveBeenCalledWith(expect.stringContaining('1건만 확인'), 'error')
  })

  test('옛 설치본에 restaurant 칸이 없으면 그 칸만 빼고 다시 저장한다', async () => {
    state.results.push(
      { data: null, error: { message: 'column phone_surveys.restaurant does not exist' } },
      { data: [{ id: 1, place_id: row.place_id }], error: null },
    )

    await expect(savePhoneSurveyRows([row])).resolves.toBe(true)
    expect(state.upsert).toHaveBeenCalledTimes(2)
    expect(state.upsert.mock.calls[1][0][0]).not.toHaveProperty('restaurant')
  })
})
