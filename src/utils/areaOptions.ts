// 동(구역 단위) 목록을 실제 카드에서 뽑는다.
//
// 왜: 예전에는 territoryStructure.ts 에 동 이름을 박아 뒀는데, 구역이 늘어도
// 코드를 고치지 않으면 목록이 안 늘어나서 실제와 어긋났다.
// (카드 608장 중 387장이 목록에 없는 동에 있었다. 화성시는 4개 전부 어긋났다)
//
// 대신 하드코딩이 해 주던 '맞춤법 검사기' 역할이 사라진다. 새 동을 직접 입력하면
// '백암면 '(공백)이나 '백앙면' 이 정식 항목으로 굳어져 한 동이 둘로 갈라진다.
// 사람 이름이 갈려 통계가 반토막 났던 것과 같은 사고라, 여기서 미리 막는다.

import { territoryAreasByRegion } from '../data/territoryStructure'
import type { TerritoryCard } from '../types'

export const UNASSIGNED_AREA = '미배정'

/** 앞뒤·가운데 공백을 정리한다. '백암면 ' 과 '백암면' 이 갈리지 않게. */
export function normalizeAreaName(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ')
}

/**
 * 실제 카드에 쓰인 동 목록. 카드가 한 장도 없는 지역은 옛 구조 데이터로 넘어간다
 * (아무것도 못 고르는 상태를 피하려는 안전망일 뿐, 정답은 실제 데이터다).
 */
export function getAreaOptions(cards: TerritoryCard[], region: string): string[] {
  const used = new Set<string>()
  for (const card of cards) {
    if (region && card.region !== region) continue
    const area = normalizeAreaName(card.area ?? '')
    if (area && area !== UNASSIGNED_AREA) used.add(area)
  }
  if (used.size === 0) {
    const seed = territoryAreasByRegion[region as keyof typeof territoryAreasByRegion] ?? []
    for (const area of seed) used.add(area)
  }
  return [...used].sort((a, b) => a.localeCompare(b, 'ko'))
}

/** 필터용 — 실제 목록 뒤에 '미배정' 을 붙인다 (카드가 있을 때만). */
export function getAreaFilterOptions(cards: TerritoryCard[], region: string): string[] {
  const options = getAreaOptions(cards, region)
  const hasUnassigned = cards.some(
    (card) => (!region || card.region === region) && card.area === UNASSIGNED_AREA,
  )
  return hasUnassigned ? [...options, UNASSIGNED_AREA] : options
}

/** 한 글자 고치면 같아지는가 (백앙면 ↔ 백암면) */
function isOneEditApart(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false
  const [short, long] = a.length <= b.length ? [a, b] : [b, a]
  let i = 0
  let j = 0
  let edits = 0
  while (i < short.length && j < long.length) {
    if (short[i] === long[j]) { i += 1; j += 1; continue }
    edits += 1
    if (edits > 1) return false
    if (short.length === long.length) i += 1
    j += 1
  }
  return edits + (long.length - j) <= 1
}

/**
 * 이미 있는 동 중에 '이걸 말한 것 같은' 이름을 찾는다. 없으면 null.
 * 똑같은 이름은 오타가 아니므로 제외한다.
 */
export function findSimilarArea(input: string, existing: string[]): string | null {
  const name = normalizeAreaName(input)
  if (!name) return null
  const bare = name.replace(/\s/g, '')
  for (const other of existing) {
    if (other === name) continue
    const otherBare = other.replace(/\s/g, '')
    // '백암 면' 처럼 공백만 다른 경우
    if (otherBare === bare) return other
    if (isOneEditApart(bare, otherBare)) return other
  }
  return null
}
