// 공유 화면의 팀 묶기 — 실제 운영 데이터 모양으로 시험한다.
// 일정 394: 팀 6 여섯 명이 전부 자료 32(경희대(우정원))를 받았는데
// 화면에는 '카드 미배정' 으로 떴다.
import { describe, test, expect } from 'vitest'
import { buildSharedAssignmentTeams } from './sharedAssignmentTeams'
import type { Building, CalendarEvent, EventInformalAssignment, EventRestaurantAssignment, InformalAsset } from '../../types'

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

  test('식당만 맡은 팀은 식당 세대 이름을 보여 준다', () => {
    const buildings = [{
      id: 81,
      name: 'AK몰',
      address: '기흥역로 63',
      units: [{ id: 901, number: '4층 메이탄' }],
    }] as Building[]
    const restaurants = members.map((userName, index) => ({
      id: index + 1,
      eventId: 394,
      userName,
      buildingId: 81,
      unitId: 901,
    })) as EventRestaurantAssignment[]

    const teams = buildSharedAssignmentTeams(event, [], [], [], buildings, restaurants)
    expect(teams[0].cardNames).toEqual(['4층 메이탄'])
  })

  test('다른 일정의 식당은 보이지 않는다', () => {
    const buildings = [{ id: 81, name: 'AK몰', address: '기흥역로 63', units: [] }] as Building[]
    const restaurants = [{
      id: 1,
      eventId: 999,
      userName: members[0],
      buildingId: 81,
      unitId: null,
    }] as EventRestaurantAssignment[]

    const teams = buildSharedAssignmentTeams(event, [], [], [], buildings, restaurants)
    expect(teams[0].cardNames).toEqual([])
  })
})

describe('다른 일정의 배정이 새어 들어오지 않는다', () => {
  // 실제로 이렇게 됐다: 오늘 일정(342)은 배정이 하나도 없는데,
  // 어제 일정(394)에서 받은 '경희대(홈플러스)' 가 오늘 팀 밑에 붙어 보였다.
  // 저장소에는 모든 일정의 배정이 들어 있는데 **이름만 보고 걸렀기 때문**이다.
  const otherEventInformal: EventInformalAssignment[] = members.map((userName, i) => ({
    id: 100 + i, eventId: 999, userName, assetId: 33,   // ← 다른 일정
    assignedBy: '관리자', assignedAt: '2026-08-26T04:00:00Z', memo: '',
  } as EventInformalAssignment))

  test('다른 일정의 비공식은 안 보인다', () => {
    const teams = buildSharedAssignmentTeams(event, [], assets, otherEventInformal)
    expect(teams[0].cardNames).toEqual([])
  })

  test('이 일정 것만 골라 보여준다', () => {
    const teams = buildSharedAssignmentTeams(event, [], assets, [...otherEventInformal, ...informal])
    expect(teams[0].cardNames).toEqual(['경희대(우정원)'])   // 33(다른 일정)은 없다
  })
})
