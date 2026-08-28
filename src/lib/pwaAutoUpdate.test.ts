import { describe, test, expect } from 'vitest'
import { shouldAutoApply, COLD_START_MS } from './pwaAutoUpdate'

const base = { msSinceStart: 1000, alreadyApplied: false, userIsTyping: false }

describe('새 버전 자동 적용 판정', () => {
  test('막 켠 직후면 적용한다 (어른들이 버튼을 못 찾는다)', () => {
    expect(shouldAutoApply(base)).toBe(true)
  })

  test('창을 놓치면 저절로는 안 한다 — 쓰던 것이 날아가면 안 된다', () => {
    expect(shouldAutoApply({ ...base, msSinceStart: COLD_START_MS + 1 })).toBe(false)
  })

  test('⚠ 이미 한 번 했으면 안 한다 — 안 보면 새로고침이 무한 반복된다', () => {
    expect(shouldAutoApply({ ...base, alreadyApplied: true })).toBe(false)
  })

  test('입력 중이면 켠 직후라도 안 한다', () => {
    expect(shouldAutoApply({ ...base, userIsTyping: true })).toBe(false)
  })

  test('경계: 딱 맞으면 한다', () => {
    expect(shouldAutoApply({ ...base, msSinceStart: COLD_START_MS })).toBe(true)
  })
})
