import { beforeEach, describe, expect, test, vi } from 'vitest'

const toast = vi.hoisted(() => vi.fn())
vi.mock('../../lib/supabase', () => ({ supabase: {} }))
vi.mock('../../lib/toast', () => ({ showToast: toast }))

const { ensureAffectedRows } = await import('./shared')

describe('쓰기 결과 행 확인', () => {
  beforeEach(() => toast.mockClear())

  test('한 행 이상 바뀌면 성공으로 본다', () => {
    expect(ensureAffectedRows([{ id: 1 }], '저장 실패')).toBe(true)
    expect(toast).not.toHaveBeenCalled()
  })

  test.each([null, undefined, []])('0행 결과 %s는 실패로 알린다', (data) => {
    expect(ensureAffectedRows(data, '저장 실패')).toBe(false)
    expect(toast).toHaveBeenCalledWith(
      '저장 실패\n변경할 자료를 찾지 못했거나 권한이 없습니다.',
      'error',
    )
  })
})
