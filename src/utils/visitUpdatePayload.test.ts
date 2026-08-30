import { describe, test, expect } from 'vitest'
import { buildVisitUpdatePayload } from './visitUpdatePayload'

const base = { result: '만남', timeSlot: '오후', memo: ' 메모 ', visitedAt: '2026-08-30' } as const

describe('방문 기록 수정 값', () => {
  test('기본 칸들이 그대로 나간다', () => {
    expect(buildVisitUpdatePayload({ ...base })).toEqual({
      result: '만남', time_slot: '오후', memo: '메모', visited_at: '2026-08-30',
    })
  })

  test('⚠ 방문자를 **안 주면 아예 안 보낸다** — 보내면 이름이 지워진다', () => {
    expect(buildVisitUpdatePayload({ ...base })).not.toHaveProperty('visitor_name')
    expect(buildVisitUpdatePayload({ ...base, visitor: undefined })).not.toHaveProperty('visitor_name')
  })

  test('⚠ 공백만 줘도 안 보낸다 — 이름 없는 기록이 생기면 안 된다', () => {
    expect(buildVisitUpdatePayload({ ...base, visitor: '   ' })).not.toHaveProperty('visitor_name')
  })

  test('방문자를 주면 그 이름으로 바꾼다 (앞뒤 공백은 턴다)', () => {
    expect(buildVisitUpdatePayload({ ...base, visitor: ' 정찬양 ' }).visitor_name).toBe('정찬양')
  })

  test('메모가 비면 null 로 (빈 문자열이 남으면 화면에 빈 줄이 생긴다)', () => {
    expect(buildVisitUpdatePayload({ ...base, memo: '   ' }).memo).toBeNull()
  })
})
