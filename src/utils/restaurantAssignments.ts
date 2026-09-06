import type { CalendarEvent, EventRestaurantAssignment } from '../types'

/** 세대 상세에는 끝난 일정이 아니라 오늘 이후의 실제 식당 배정만 보여준다. */
export function getCurrentRestaurantAssignmentsForUnit(
  assignments: EventRestaurantAssignment[],
  events: CalendarEvent[],
  unitId: number,
  today: string,
): EventRestaurantAssignment[] {
  const currentEventIds = new Set(
    events
      .filter((event) => event.date >= today)
      .map((event) => event.id),
  )

  return assignments.filter(
    (assignment) => assignment.unitId === unitId && currentEventIds.has(assignment.eventId),
  )
}
