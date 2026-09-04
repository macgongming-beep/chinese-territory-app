import { describe, expect, test } from 'vitest'
import type { CalendarEvent } from '../types'
import { getAssignmentTeamMembers } from './assignmentTeamMembers'

function eventWith(assignments: Array<{ userName: string; teamKey?: string | null; cardId?: number | null }>): CalendarEvent {
  return {
    id: 1,
    cardAssignments: assignments.map((assignment, index) => ({
      id: index + 1,
      eventId: 1,
      userName: assignment.userName,
      assignedCardId: assignment.cardId ?? null,
      assignedCardIds: assignment.cardId ? [assignment.cardId] : [],
      teamKey: assignment.teamKey ?? null,
      assignedBy: '관리자',
      assignedAt: '2026-09-04T00:00:00Z',
      memo: '',
    })),
  } as CalendarEvent
}

describe('나의 봉사 팀원 묶기', () => {
  test('카드가 없는 비공식 팀도 teamKey가 같은 사람끼리만 묶는다', () => {
    const event = eventWith([
      { userName: '나', teamKey: 'team-1' },
      { userName: '동료1', teamKey: 'team-1' },
      { userName: '동료2', teamKey: 'team-1' },
      { userName: '다른팀1', teamKey: 'team-2' },
      { userName: '다른팀2', teamKey: 'team-2' },
    ])

    expect(getAssignmentTeamMembers(event, '나')).toEqual(['나', '동료1', '동료2'])
  })

  test('같은 카드를 맡아도 teamKey가 다르면 다른 팀이다', () => {
    const event = eventWith([
      { userName: '나', teamKey: 'team-1', cardId: 7 },
      { userName: '동료', teamKey: 'team-1', cardId: 7 },
      { userName: '다른팀', teamKey: 'team-2', cardId: 7 },
    ])

    expect(getAssignmentTeamMembers(event, '나')).toEqual(['나', '동료'])
  })

  test('옛 배정은 같은 카드 기준으로 묶고, 카드도 없으면 전원을 합치지 않는다', () => {
    const withCards = eventWith([
      { userName: '나', cardId: 7 },
      { userName: '동료', cardId: 7 },
      { userName: '다른팀', cardId: 8 },
    ])
    expect(getAssignmentTeamMembers(withCards, '나')).toEqual(['나', '동료'])

    const withoutCards = eventWith([{ userName: '나' }, { userName: '알수없는팀원' }])
    expect(getAssignmentTeamMembers(withoutCards, '나')).toEqual(['나'])
  })
})
