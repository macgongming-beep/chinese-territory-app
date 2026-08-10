import { describe, it, expect } from 'vitest'
import { suggestNextUnitNumber } from './nextUnitNumber'

describe('suggestNextUnitNumber', () => {
  it('호수가 하나도 없으면 101 부터', () => {
    expect(suggestNextUnitNumber([])).toBe('101')
  })

  it('가장 큰 호수 다음 번호를 추천한다', () => {
    expect(suggestNextUnitNumber(['101', '102', '103'])).toBe('104')
  })

  it('순서가 뒤섞여 있어도 최대값 기준', () => {
    expect(suggestNextUnitNumber(['201', '105', '102'])).toBe('202')
  })

  it('지하 호수(B101)는 계산에서 뺀다', () => {
    expect(suggestNextUnitNumber(['B101', 'B102', '101'])).toBe('102')
  })

  it('숫자가 아닌 호수만 있으면 101 부터', () => {
    expect(suggestNextUnitNumber(['출입불가', 'B101'])).toBe('101')
  })

  it('앞자리 0 으로 맞춘 건물은 자리수를 유지한다', () => {
    expect(suggestNextUnitNumber(['0101', '0102'])).toBe('0103')
  })

  it('층이 올라가도 그대로 이어붙인다 (999 → 1000)', () => {
    expect(suggestNextUnitNumber(['999'])).toBe('1000')
  })
})
