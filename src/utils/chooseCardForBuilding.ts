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
  | { cardId: number; how: 'chosen' | 'boundary' | 'address' | 'unassigned' }
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

  // ④ 첫 카드로 떨어뜨리지 **않는다.**
  //    한때 '입력을 잃지 않으려고' 남겼는데 전제가 틀렸다 —
  //    AddBuildingModal 은 저장이 실패하면 창을 열어 두고 입력을 지킨다.
  //    반면 cards[0] 은 목록 순서가 바뀌면 엉뚱한 카드에 저장한다.
  return { cardId: null, how: 'none' }
}
