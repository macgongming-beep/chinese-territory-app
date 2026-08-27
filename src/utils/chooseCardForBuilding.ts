// 새 건물을 어느 구역 카드에 넣을지 정한다.
//
// ⚠ **화면 필터를 보지 않는다.** 예전에는 `filteredCards` 를 봐서
//   기흥구로 걸러놓고 건물을 추가하면 저장되는 카드가 달라졌고,
//   필터 결과가 비어 있으면 주소가 멀쩡해도 자동 배정이 통째로 실패했다.
//   같은 입력이면 화면 상태와 무관하게 같은 결과가 나와야 한다.
//
// CSV 가져오기(csvBuildingImport)도 같은 순서를 쓴다. 두 경로가 갈라지면
// "손으로 넣은 건물과 CSV 로 넣은 건물이 다른 카드에 들어가는" 일이 생긴다.
import type { CardBoundary, TerritoryCard } from '../types'
import { findCardForCoordinates } from './mapUtils'

export type ChooseCardInput = {
  /** 사용자가 직접 고른 카드. 'auto' 면 알아서 정한다 */
  chosen: number | 'auto'
  latLng: { lat: number; lng: number } | null
  address: string
  /** **거르지 않은 전체 카드** */
  cards: TerritoryCard[]
  cardBoundaries: CardBoundary[]
  /** 어디에도 안 맞을 때 떨어뜨릴 '미배정 건물' 카드 */
  unassignedCardId?: number | null
}

export type ChooseCardResult =
  | { cardId: number; how: 'chosen' | 'boundary' | 'address' | 'unassigned' | 'firstCard' }
  | { cardId: null; how: 'none' }

/** 주소의 동 이름으로 카드를 찾는다 */
function byAddress(address: string, cards: TerritoryCard[]): number | null {
  const dong = /([가-힣]+동)/.exec(address ?? '')?.[1]
  if (!dong) return null
  const found = cards.find((c) => c.area && (c.area.includes(dong) || dong.includes(c.area)))
  return found?.id ?? null
}

export function chooseCardForBuilding(input: ChooseCardInput): ChooseCardResult {
  if (input.chosen !== 'auto') return { cardId: input.chosen, how: 'chosen' }

  // ① 좌표가 구역선 안이면 그 카드 — 주소보다 확실하다
  if (input.latLng) {
    const byBoundary = findCardForCoordinates(input.latLng.lat, input.latLng.lng, input.cardBoundaries)
    if (byBoundary) return { cardId: byBoundary, how: 'boundary' }
  }

  // ② 주소의 동 이름
  const byDong = byAddress(input.address, input.cards)
  if (byDong !== null) return { cardId: byDong, how: 'address' }

  // ③ 미배정 건물 카드
  if (input.unassignedCardId != null) return { cardId: input.unassignedCardId, how: 'unassigned' }

  // ④ 그것도 없으면 첫 카드. **사용자의 입력을 잃는 것보다 낫다** —
  //    좌표를 못 찾아도 건물은 만들어져야 하고, 나중에 옮길 수 있다.
  //    문제였던 건 배열이 아니라 **필터**였다: filteredCards[0] 은 화면 상태에 따라
  //    달라졌지만, 거르지 않은 cards[0] 은 같은 입력이면 항상 같다.
  //    다만 조용히 넣지 않는다 — 호출부가 어느 카드인지 알려 준다.
  if (input.cards.length > 0) return { cardId: input.cards[0].id, how: 'firstCard' }

  return { cardId: null, how: 'none' }
}
