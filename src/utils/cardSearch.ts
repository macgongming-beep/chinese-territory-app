import type { TerritoryCard } from '../types'

const collator = new Intl.Collator('ko-KR', { numeric: true, sensitivity: 'base' })

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
