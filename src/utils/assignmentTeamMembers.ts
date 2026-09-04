import type { CalendarEvent } from '../types'

function cardIds(assignment: CalendarEvent['cardAssignments'][number]): number[] {
  const ids = assignment.assignedCardIds?.length
    ? assignment.assignedCardIds
    : assignment.assignedCardId != null
      ? [assignment.assignedCardId]
      : []
  return [...new Set(ids)]
}

/** 공유된 배정에서 한 사람과 실제로 같은 팀인 사람만 돌려준다. */
export function getAssignmentTeamMembers(event: CalendarEvent, userName: string): string[] {
  const mine = event.cardAssignments.find((assignment) => assignment.userName === userName)
  if (!mine) return []

  let members: string[]
  if (mine.teamKey) {
    members = event.cardAssignments
      .filter((assignment) => assignment.teamKey === mine.teamKey)
      .map((assignment) => assignment.userName)
  } else {
    const mineCardIds = new Set(cardIds(mine))
    // teamKey 이전 자료는 카드로만 팀을 복원할 수 있다. 카드도 없으면 다른
    // 비공식 팀과 구별할 근거가 없으므로 전원을 합치지 않고 본인만 보여 준다.
    members = mineCardIds.size === 0
      ? [mine.userName]
      : event.cardAssignments
        .filter((assignment) => cardIds(assignment).some((id) => mineCardIds.has(id)))
        .map((assignment) => assignment.userName)
  }

  return [userName, ...members.filter((member) => member !== userName)]
}
