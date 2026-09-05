import type { Building, InformalAsset, TerritoryCard } from '../types'

export type MapSearchResult = {
  key: string
  kind: 'card' | 'building' | 'unit' | 'restaurant' | 'informal'
  title: string
  subtitle: string
  cardId?: number
  buildingId?: number
  unitId?: number
  informalId?: number
  informalChildId?: number
}

export function normalizeMapSearch(value: string): string {
  return value.toLocaleLowerCase('ko-KR').replace(/[\s.,()-]/g, '')
}

export function isBareUnitSearch(value: string): boolean {
  return /^\s*\d+(?:-\d+)?\s*호?\s*$/.test(value)
}

function matchRank(query: string, queryTokens: string[], values: string[]): number | null {
  const normalized = values.map(normalizeMapSearch).filter(Boolean)
  if (normalized.some((value) => value === query)) return 0
  if (normalized.some((value) => value.startsWith(query))) return 1
  if (normalized.some((value) => value.includes(query))) return 2
  if (queryTokens.length > 1 && normalized.some((value) => queryTokens.every((token) => value.includes(token)))) return 3
  return null
}

export function searchMapData({
  query,
  cards,
  buildings,
  informalAssets,
  limit = 24,
}: {
  query: string
  cards: TerritoryCard[]
  buildings: Building[]
  informalAssets: InformalAsset[]
  limit?: number
}): MapSearchResult[] {
  const normalizedQuery = normalizeMapSearch(query)
  if (!normalizedQuery) return []
  const queryTokens = query.trim().split(/\s+/).map(normalizeMapSearch).filter(Boolean)

  const ranked: Array<MapSearchResult & { rank: number }> = []
  const cardById = new Map(cards.map((card) => [card.id, card]))

  for (const card of cards) {
    const rank = matchRank(normalizedQuery, queryTokens, [card.name, card.region, card.area, `${card.region}${card.area}${card.name}`])
    if (rank === null) continue
    ranked.push({
      key: `card:${card.id}`,
      kind: 'card',
      title: card.name,
      subtitle: [card.region, card.area].filter(Boolean).join(' · '),
      cardId: card.id,
      rank,
    })
  }

  const allowUnitResults = !isBareUnitSearch(query)
  for (const building of buildings) {
    const card = cardById.get(building.cardId)
    const buildingRank = matchRank(normalizedQuery, queryTokens, [
      building.name,
      building.address,
      `${building.name}${building.address}`,
    ])
    if (buildingRank !== null) {
      ranked.push({
        key: `building:${building.id}`,
        kind: 'building',
        title: building.name || building.address,
        subtitle: building.address,
        cardId: building.cardId,
        buildingId: building.id,
        rank: buildingRank + 1,
      })
    }

    for (const unit of building.units) {
      const kind = unit.isRestaurant ? 'restaurant' : 'unit'
      if (kind === 'unit' && !allowUnitResults) continue
      const rank = matchRank(normalizedQuery, queryTokens, [
        kind === 'restaurant' ? unit.number : '',
        `${building.name}${unit.number}`,
        `${building.address}${unit.number}`,
      ])
      if (rank === null) continue
      ranked.push({
        key: `${kind}:${unit.id}`,
        kind,
        title: kind === 'restaurant' ? unit.number : `${building.name || building.address} · ${unit.number}`,
        subtitle: kind === 'restaurant'
          ? building.address
          : [building.address, card?.name].filter(Boolean).join(' · '),
        cardId: building.cardId,
        buildingId: building.id,
        unitId: unit.id,
        rank,
      })
    }
  }

  for (const asset of informalAssets) {
    const rank = matchRank(normalizedQuery, queryTokens, [asset.name, asset.memo ?? ''])
    if (rank === null) continue
    ranked.push({
      key: `informal:${asset.id}`,
      kind: 'informal',
      title: asset.name,
      subtitle: asset.memo?.trim() || '',
      informalId: asset.parentId ?? asset.id,
      informalChildId: asset.parentId ? asset.id : undefined,
      rank: rank + 1,
    })
  }

  return ranked
    .sort((a, b) => a.rank - b.rank || a.title.localeCompare(b.title, 'ko-KR', { numeric: true }))
    .slice(0, limit)
    .map(({ rank: _rank, ...result }) => result)
}
