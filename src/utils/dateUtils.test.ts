import { describe, it, expect, vi, afterEach } from 'vitest'
import { getLocalDateString } from './dateUtils'

describe('getLocalDateString', () => {
  afterEach(() => vi.useRealTimers())

  it('YYYY-MM-DD 형식 (월/일 0-padding)', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 0, 5, 9, 0, 0)) // 2026-01-05 로컬
    expect(getLocalDateString()).toBe('2026-01-05')
  })

  it('두 자리 월/일도 정상', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 11, 25, 23, 30, 0)) // 2026-12-25 로컬
    expect(getLocalDateString()).toBe('2026-12-25')
  })

  it('로컬 자정 직전에도 그날 날짜 유지 (UTC 변환 아님)', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 5, 30, 23, 59, 0)) // 2026-06-30 23:59 로컬
    expect(getLocalDateString()).toBe('2026-06-30')
  })
})
