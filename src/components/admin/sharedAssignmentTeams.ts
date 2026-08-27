// 공유된 배정을 팀으로 다시 묶는다.
//
// 화면에서 떼어낸 이유: 시험하기 위해서다. '고쳤는데 화면이 안 바뀐다' 를
// 만났을 때, 논리가 맞는지 배선이 틀렸는지 가르려면 이 함수만 따로 돌려봐야 한다.
// 실제로 그렇게 해서 원인(호출부가 데이터를 안 넘김)을 찾았다.
import type { CalendarEvent, EventInformalAssignment, InformalAsset, TerritoryCard } from '../../types'

function getAssignmentCardIds(assignment: CalendarEvent['cardAssignments'][number]) {
  const ids = assignment.assignedCardIds?.length
    ? assignment.assignedCardIds
    : assignment.assignedCardId
      ? [assignment.assignedCardId]
      : []
  return Array.from(new Set(ids.filter((id): id is number => typeof id === 'number' && id > 0))).sort((a, b) => a - b)
}

export function buildSharedAssignmentTeams(
  event: CalendarEvent,
  cards: TerritoryCard[],
  informalAssets: InformalAsset[] = [],
  informalAssignments: EventInformalAssignment[] = [],
) {
  const cardNameById = new Map(cards.map((card) => [card.id, card.name]))
  const assetNameById = new Map(informalAssets.map((a) => [a.id, a.name]))
  const grouped = new Map<string, { members: string[]; cardIds: number[] }>()

  event.cardAssignments.forEach((assignment) => {
    const cardIds = getAssignmentCardIds(assignment)
    // teamKey 가 있으면 그걸로 묶는다. 구역 카드가 없어도 팀은 팀이다 —
    // 예전에는 카드 없는 사람을 각자 한 팀으로 쪼갰다 (비공식만 맡은 6명이 6팀이 됐다)
    const key = assignment.teamKey
      ? `team:${assignment.teamKey}`
      : cardIds.length ? cardIds.join(',') : `member:${assignment.userName}`
    const existing = grouped.get(key) ?? { members: [], cardIds }
    existing.members.push(assignment.userName)
    grouped.set(key, existing)
  })

  return Array.from(grouped.values()).map((team, index) => {
    const cardNames = team.cardIds.map((id) => cardNameById.get(id)).filter((name): name is string => Boolean(name))
    // 구역이 없으면 그 팀이 맡은 비공식 자료 이름을 대신 보여 준다.
    // 예전에는 그냥 '카드 미배정' 이라, 비공식을 받은 팀이 아무 일도 안 받은
    // 것처럼 보였다.
    if (cardNames.length === 0) {
      const mine = new Set(team.members)
      cardNames.push(...Array.from(new Set(
        informalAssignments
          // ⚠ **이 일정 것만.** 저장소엔 모든 일정의 배정이 들어 있어서,
          //   이름만 보고 걸렀더니 다른 일정에서 받은 비공식이 여기 붙어 보였다.
          .filter((a) => a.eventId === event.id && mine.has(a.userName))
          .map((a) => assetNameById.get(a.assetId))
          .filter((n): n is string => Boolean(n)),
      )))
    }
    return {
      id: `${team.cardIds.join('-') || 'none'}-${index}`,
      label: `팀 ${index + 1}`,
      members: team.members,
      cardNames,
    }
  })
}
