import { describe, test, expect } from 'vitest'
import { willNotifyOnEventChange, isNotifiableDate } from './eventNotify'

const base = { date: '2026-09-01', time: '10:00', place: '신갈', mapLink: '', leader: '가, 나', title: '传道' }

describe('willNotifyOnEventChange', () => {
  test('아무것도 안 바뀌면 안 나간다', () => {
    expect(willNotifyOnEventChange(base, { ...base })).toBe(false)
  })

  test('메모만 바뀌는 건 애초에 안 본다 — 안 나간다', () => {
    // 메모는 인자에 없다. 트리거도 메모를 안 본다.
    expect(willNotifyOnEventChange(base, { ...base })).toBe(false)
  })

  for (const [key, next] of [
    ['date', '2026-09-02'], ['time', '11:00'], ['place', '기흥'],
    ['mapLink', 'http://x'], ['leader', '가, 다'], ['title', '집회'],
  ] as const) {
    test(`${key} 가 바뀌면 나간다`, () => {
      expect(willNotifyOnEventChange(base, { ...base, [key]: next })).toBe(true)
    })
  }

  test('앞뒤 공백만 다른 건 안 바뀐 것으로 본다', () => {
    expect(willNotifyOnEventChange(base, { ...base, place: '  신갈  ' })).toBe(false)
  })

  test('빈 문자열과 null 은 같다', () => {
    expect(willNotifyOnEventChange({ ...base, mapLink: null }, { ...base, mapLink: '' })).toBe(false)
  })
})

describe('isNotifiableDate', () => {
  test('오늘은 알린다', () => {
    expect(isNotifiableDate('2026-08-27', '2026-08-27')).toBe(true)
  })
  test('앞날은 알린다', () => {
    expect(isNotifiableDate('2026-08-28', '2026-08-27')).toBe(true)
  })
  test('지난 일정은 안 알린다', () => {
    expect(isNotifiableDate('2026-08-26', '2026-08-27')).toBe(false)
  })
})
