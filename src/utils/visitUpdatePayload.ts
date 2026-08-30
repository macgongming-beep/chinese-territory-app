import type { TimeSlot, UnitStatus } from '../types'

export type VisitUpdateInput = {
  result: UnitStatus
  timeSlot: TimeSlot
  memo: string
  visitedAt: string
  /** 관리자·인도자가 편집기에서 고친 경우에만 온다 */
  visitor?: string
}

/**
 * 방문 기록 수정 시 DB 에 보낼 값.
 *
 * ⚠ **방문자는 준 경우에만 넣는다.** `visitor` 를 안 넘기는 화면(모바일 등)에서
 *   `undefined` 를 그대로 보내면 이름이 지워진다 — 누가 갔는지 영영 모르게 된다.
 * ⚠ 공백만 들어온 것도 무시한다. 같은 이유다.
 */
export function buildVisitUpdatePayload(input: VisitUpdateInput): Record<string, unknown> {
  const visitor = input.visitor?.trim()
  return {
    result: input.result,
    time_slot: input.timeSlot,
    memo: input.memo.trim() || null,
    visited_at: input.visitedAt,
    ...(visitor ? { visitor_name: visitor } : {}),
  }
}
