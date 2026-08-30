// 구역 카드 목록을 거른다.
//
// 조건이 여덟 개고 '완료·제외' 와 '대상없음' 이 얽혀 있다.
// 화면 안에 있을 때는 "왜 이 카드가 목록에 없지" 를 확인할 방법이 없었다.
//
// ⚠ 이 결과는 **표시용만이 아니다.** 예전에는 건물 저장 카드까지 여기서 골라
//   필터를 바꾸면 저장 결과가 달라졌다 (지금은 chooseCardForBuilding 이 따로 한다).
//   일괄 삭제 대상도 여기서 나온다 — 조건 하나가 바뀌면 지워지는 것이 바뀐다.
import type { TerritoryCard } from '../types'
import { compareTerritoryCardsByOperationalPriority, getTerritoryCardOperationalState } from './cardSearch'

export type CardFilters = {
  region: string
  area: string
  /** '전체' | '배정' | '미배정' */
  assignment: string
  leader: string
  /** '전체' | '있음' | '없음' */
  regularVisit: string
  /** '전체' | '있음' | '없음' */
  /** '전체' | '완료·제외' | 카드 상태값 */
  status: string
}

export type CardFilterDeps = {
  leadersOf: (card: TerritoryCard) => string[]
  hasRegularVisit: (card: TerritoryCard) => boolean
}

export function filterTerritoryCards(
  cards: readonly TerritoryCard[],
  f: CardFilters,
  deps: CardFilterDeps,
): TerritoryCard[] {
  return cards.filter((card) => {
    const state = getTerritoryCardOperationalState(card)
    if (f.region !== '전체' && card.region !== f.region) return false
    if (f.area !== '전체' && card.area !== f.area) return false

    const leaders = deps.leadersOf(card)
    if (f.assignment === '배정' && leaders.length === 0) return false
    if (f.assignment === '미배정' && leaders.length > 0) return false
    if (f.leader !== '전체' && !leaders.includes(f.leader)) return false

    const hasRegular = deps.hasRegularVisit(card)
    if (f.regularVisit === '있음' && !hasRegular) return false
    if (f.regularVisit === '없음' && hasRegular) return false

    if (f.status !== '전체') {
      if (f.status === '완료·제외') {
        // '완료' 와 '대상없음' 을 한 묶음으로 본다 — 둘 다 더 갈 필요가 없는 카드다
        if (state !== '완료' && state !== '대상없음') return false
      } else {
        // ⚠ 다른 상태로 거를 때는 '대상없음' 을 먼저 뺀다.
        //   건물도 세대도 없는 빈 카드는 status 가 '진행중' 이어도
        //   '진행중' 목록에 나오면 안 된다 — 할 일이 없는 카드다
        if (state === '대상없음') return false
        if (card.status !== f.status) return false
      }
    }
    return true
  }).sort(compareTerritoryCardsByOperationalPriority)
}
