// 공유 화면의 팀 묶기 — 실제 운영 데이터 모양으로 시험한다.
// 일정 394: 팀 6 여섯 명이 전부 자료 32(경희대(우정원))를 받았는데
// 화면에는 '카드 미배정' 으로 떴다.
import { describe, test, expect } from 'vitest'
import { buildSharedAssignmentTeams } from './AdminEventDetailSheet'
import type { CalendarEvent, EventInformalAssignment, InformalAsset } from '../../types'

const members = ['崔芝園최지원', '全孝元전효원', '姜英银강영은', '徐银美서은미', '杨笑恩양소은', '任昭娟임소연']

const event = {
  id: 394,
  assignmentStatus: 'shared',
  cardAssignments: members.map((userName, i) => ({
    id: i + 1, eventId: 394, userName,
    assignedCardId: null, assignedCardIds: [],
    teamKey: 'team-server-6-', assignedBy: '관리자',
    assignedAt: '2026-08-26T04:00:00Z', memo: '',
  })),
} as unknown as CalendarEvent

const assets: InformalAsset[] = [
  { id: 32, name: '경희대(우정원)' } as InformalAsset,
  { id: 33, name: '경희대(홈플러스)' } as InformalAsset,
]

const informal: EventInformalAssignment[] = members.map((userName, i) => ({
  id: i + 1, eventId: 394, userName, assetId: 32,
  assignedBy: '관리자', assignedAt: '2026-08-26T04:00:00Z', memo: '',
}))

describe('공유 화면 팀 묶기', () => {
  test('여섯 명이 한 팀으로 묶인다', () => {
    const teams = buildSharedAssignmentTeams(event, [], assets, informal)
    expect(teams).toHaveLength(1)
    expect(teams[0].members).toHaveLength(6)
  })

  test('구역이 없으면 비공식 자료 이름을 보여 준다', () => {
    const teams = buildSharedAssignmentTeams(event, [], assets, informal)
    expect(teams[0].cardNames).toEqual(['경희대(우정원)'])
  })

  test('비공식도 없으면 빈 목록이다 (화면이 미배정으로 그린다)', () => {
    const teams = buildSharedAssignmentTeams(event, [], assets, [])
    expect(teams[0].cardNames).toEqual([])
  })
})
