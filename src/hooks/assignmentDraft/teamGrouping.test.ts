// 배정을 팀으로 다시 묶는 규칙.
//
// **구역 카드가 없어도 팀은 팀이다.** 비공식 봉사만 맡은 6명이 6개 팀으로
// 쪼개져 화면에 뜬 적이 있다. teamKey 를 안 보고 카드로만 묶었기 때문이다.
import { describe, test, expect } from 'vitest'
import { buildDraftFromServer } from './persistence'
import type { CalendarEvent, EventCardAssignment } from '../../types'

const a = (userName: string, cardId: number | null, teamKey: string | null): EventCardAssignment => ({
  id: Math.random(), eventId: 1, userName,
  assignedCardId: cardId,
  assignedCardIds: cardId != null ? [cardId] : [],
  teamKey, assignedBy: '관리자', assignedAt: '2026-08-26T00:00:00Z', memo: '',
})

const ev = (cardAssignments: EventCardAssignment[]) =>
  ({ id: 1, cardAssignments, assignmentStatus: 'shared' } as unknown as CalendarEvent)

describe('팀 다시 묶기', () => {
  test('구역 카드가 없어도 teamKey 가 같으면 한 팀이다', () => {
    // 실제로 겪은 것: 비공식만 맡은 6명이 6팀으로 쪼개졌다
    const six = ['서은미', '전효원', '任昭娟', '최지원', '양소은', '강영은']
    const draft = buildDraftFromServer(ev(six.map((n) => a(n, null, 'team-abc'))))

    expect(draft.teams).toHaveLength(1)
    expect(draft.teams[0].members).toEqual(six)
    expect(draft.teams[0].cardIds).toEqual([])
  })

  test('teamKey 가 다르면 카드가 없어도 다른 팀이다', () => {
    const draft = buildDraftFromServer(ev([a('갑', null, 'team-1'), a('을', null, 'team-2')]))
    expect(draft.teams).toHaveLength(2)
  })

  test('카드가 있으면 예전처럼 카드로도 묶인다 (teamKey 없던 시절 데이터)', () => {
    const draft = buildDraftFromServer(ev([a('갑', 10, null), a('을', 10, null)]))
    expect(draft.teams).toHaveLength(1)
    expect(draft.teams[0].cardIds).toEqual([10])
  })

  test('teamKey 가 카드보다 우선한다 — 같은 구역을 두 팀이 맡을 수 있다', () => {
    const draft = buildDraftFromServer(ev([a('갑', 10, 'team-1'), a('을', 10, 'team-2')]))
    expect(draft.teams).toHaveLength(2)
  })
})
