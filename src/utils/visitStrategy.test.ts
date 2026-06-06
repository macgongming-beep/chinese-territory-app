import { describe, it, expect } from 'vitest'
import { getSlotMatrix, isAllSlotsAbsent } from './visitStrategy'
import type { VisitHistory } from '../types'

function h(over: Partial<VisitHistory>): VisitHistory {
  return {
    id: 1, unitId: 1, visitor: '김민준', result: '부재',
    timeSlot: '오전', visitedAt: '2026-06-01', // 2026-06-01 = 월요일(평일)
    ...over,
  } as VisitHistory
}

describe('getSlotMatrix', () => {
  it('평일/주말 × 오전/오후/저녁 6칸 매트릭스', () => {
    const m = getSlotMatrix([])
    expect(m).toHaveLength(2)       // 평일, 주말
    expect(m[0]).toHaveLength(3)    // 오전, 오후, 저녁
  })

  it('방문을 올바른 칸에 집계 (평일 오전 부재)', () => {
    const m = getSlotMatrix([h({ visitedAt: '2026-06-01', timeSlot: '오전', result: '부재' })])
    const cell = m[0][0] // 평일 오전
    expect(cell.total).toBe(1)
    expect(cell.absences).toBe(1)
    expect(cell.meetings).toBe(0)
    expect(cell.lastDate).toBe('2026-06-01')
  })

  it('주말(토요일) 만남 집계', () => {
    // 2026-06-06 = 토요일
    const m = getSlotMatrix([h({ visitedAt: '2026-06-06', timeSlot: '오후', result: '만남' })])
    const cell = m[1][1] // 주말 오후
    expect(cell.meetings).toBe(1)
    expect(cell.dayType).toBe('주말')
  })

  it('timeSlot/visitedAt 없으면 무시', () => {
    const m = getSlotMatrix([h({ timeSlot: undefined }), h({ visitedAt: undefined })])
    expect(m.flat().every((c) => c.total === 0)).toBe(true)
  })

  it('lastDate 는 가장 최근 날짜', () => {
    const m = getSlotMatrix([
      h({ visitedAt: '2026-06-01', timeSlot: '오전' }),
      h({ visitedAt: '2026-06-08', timeSlot: '오전' }), // 둘 다 월요일 오전
    ])
    expect(m[0][0].lastDate).toBe('2026-06-08')
  })
})

describe('isAllSlotsAbsent', () => {
  it('3슬롯 이상 시도 + 전부 부재(만남 0) → true', () => {
    const m = getSlotMatrix([
      h({ visitedAt: '2026-06-01', timeSlot: '오전', result: '부재' }),
      h({ visitedAt: '2026-06-01', timeSlot: '오후', result: '부재' }),
      h({ visitedAt: '2026-06-01', timeSlot: '저녁', result: '부재' }),
    ])
    expect(isAllSlotsAbsent(m)).toBe(true)
  })

  it('만남이 한 번이라도 있으면 false', () => {
    const m = getSlotMatrix([
      h({ visitedAt: '2026-06-01', timeSlot: '오전', result: '부재' }),
      h({ visitedAt: '2026-06-01', timeSlot: '오후', result: '부재' }),
      h({ visitedAt: '2026-06-01', timeSlot: '저녁', result: '만남' }),
    ])
    expect(isAllSlotsAbsent(m)).toBe(false)
  })

  it('시도 슬롯 3개 미만이면 false', () => {
    const m = getSlotMatrix([
      h({ visitedAt: '2026-06-01', timeSlot: '오전', result: '부재' }),
      h({ visitedAt: '2026-06-01', timeSlot: '오후', result: '부재' }),
    ])
    expect(isAllSlotsAbsent(m)).toBe(false)
  })
})
