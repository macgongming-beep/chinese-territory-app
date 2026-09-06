import { describe, expect, test } from 'vitest'
import type { CalendarEvent, EventRestaurantAssignment } from '../types'
import { getCurrentRestaurantAssignmentsForUnit } from './restaurantAssignments'

const event = (id: number, date: string) => ({ id, date } as CalendarEvent)
const assignment = (id: number, eventId: number, unitId: number | null) => ({
  id,
  eventId,
  unitId,
} as EventRestaurantAssignment)

describe('세대 상세의 식당 봉사 배정', () => {
  test('지난 일정은 숨기고 오늘과 앞으로의 배정만 보여준다', () => {
    const result = getCurrentRestaurantAssignmentsForUnit(
      [
        assignment(1, 11, 101),
        assignment(2, 12, 101),
        assignment(3, 13, 101),
        assignment(4, 13, 202),
      ],
      [event(11, '2026-07-26'), event(12, '2026-09-06'), event(13, '2026-09-07')],
      101,
      '2026-09-06',
    )

    expect(result.map((item) => item.id)).toEqual([2, 3])
  })

  test('일정이 없어진 고아 배정은 현재 배정처럼 표시하지 않는다', () => {
    const result = getCurrentRestaurantAssignmentsForUnit(
      [assignment(1, 999, 101)],
      [],
      101,
      '2026-09-06',
    )

    expect(result).toEqual([])
  })
})
