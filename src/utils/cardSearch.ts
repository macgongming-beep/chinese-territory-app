import type { TerritoryCard } from '../types'

const collator = new Intl.Collator('ko-KR', { numeric: true, sensitivity: 'base' })

export type TerritoryCardOperationalState = '방문필요' | '진행중' | '정기방문' | '완료' | '대상없음'

const operationalStateOrder: Record<TerritoryCardOperationalState, number> = {
  진행중: 0,
  방문필요: 1,
  정기방문: 2,
  완료: 3,
  대상없음: 4,
}

export function normalizeCardSearch(value: string) {
  return value.toLowerCase().replace(/\s+/g, '').replace(/동/g, '')
}

export function compareTerritoryCards(a: TerritoryCard, b: TerritoryCard) {
  const region = collator.compare(a.region, b.region)
  if (region !== 0) return region

  const area = collator.compare(a.area, b.area)
  if (area !== 0) return area

  return collator.compare(a.name, b.name)
}

export function sortTerritoryCards(cards: TerritoryCard[]) {
  return cards.slice().sort(compareTerritoryCards)
}

export function isEmptyTerritoryCard(card: TerritoryCard) {
  return (card.buildings ?? 0) <= 0 && (card.units ?? 0) <= 0
}

export function getTerritoryCardOperationalState(card: TerritoryCard): TerritoryCardOperationalState {
  if (isEmptyTerritoryCard(card)) return '대상없음'
  if ((card.progress ?? 0) >= 100 || card.status === '완료') return '완료'
  if ((card.progress ?? 0) > 0 || card.status === '진행중') return '진행중'
  if ((card.regularVisits ?? 0) > 0) return '정기방문'
  return '방문필요'
}

export function compareTerritoryCardsByOperationalPriority(a: TerritoryCard, b: TerritoryCard) {
  const stateDiff =
    operationalStateOrder[getTerritoryCardOperationalState(a)] -
    operationalStateOrder[getTerritoryCardOperationalState(b)]
  if (stateDiff !== 0) return stateDiff

  return compareTerritoryCards(a, b)
}

export function sortTerritoryCardsByOperationalPriority(cards: TerritoryCard[]) {
  return cards.slice().sort(compareTerritoryCardsByOperationalPriority)
}
