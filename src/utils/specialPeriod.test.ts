import { describe, it, expect } from 'vitest'
import { findActivePeriod, findActivePeriodId } from './specialPeriod'
import type { SpecialPeriod } from '../types'

function p(over: Partial<SpecialPeriod> = {}): SpecialPeriod {
  return { id: 1, label: '특별봉사', startDate: '2026-06-01', endDate: '2026-06-30', color: 'orange', hasInvitation: false, ...over }
}

describe('findActivePeriod', () => {
  it('범위 안 날짜 → 해당 기간', () => {
    const periods = [p({ id: 1 })]
    expect(findActivePeriod(periods, '2026-06-15')?.id).toBe(1)
  })

  it('양 끝 포함 (start, end)', () => {
    const periods = [p()]
    expect(findActivePeriod(periods, '2026-06-01')).not.toBeNull()
    expect(findActivePeriod(periods, '2026-06-30')).not.toBeNull()
  })

  it('범위 밖 → null', () => {
    const periods = [p()]
    expect(findActivePeriod(periods, '2026-05-31')).toBeNull()
    expect(findActivePeriod(periods, '2026-07-01')).toBeNull()
  })

  it('periods 없으면 null', () => {
    expect(findActivePeriod(null, '2026-06-15')).toBeNull()
    expect(findActivePeriod(undefined, '2026-06-15')).toBeNull()
    expect(findActivePeriod([], '2026-06-15')).toBeNull()
  })

  it('여러 기간 중 매칭되는 것 반환', () => {
    const periods = [
      p({ id: 1, startDate: '2026-01-01', endDate: '2026-01-31' }),
      p({ id: 2, startDate: '2026-06-01', endDate: '2026-06-30' }),
    ]
    expect(findActivePeriod(periods, '2026-06-10')?.id).toBe(2)
  })
})

describe('findActivePeriodId', () => {
  it('활성 기간의 id, 없으면 null', () => {
    const periods = [p({ id: 7 })]
    expect(findActivePeriodId(periods, '2026-06-10')).toBe(7)
    expect(findActivePeriodId(periods, '2026-07-10')).toBeNull()
  })
})
