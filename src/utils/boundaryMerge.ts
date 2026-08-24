import { union, type MultiPolygon, type Polygon } from 'polygon-clipping'
import type { CardBoundary, GeoPoint } from '../types'

type BoundaryMergeResult = {
  points: GeoPoint[]
  multiPolygonCount: number
}

function closeRing(points: GeoPoint[]): [number, number][] {
  const ring = points.map((point) => [point.lng, point.lat] as [number, number])
  const first = ring[0]
  const last = ring[ring.length - 1]
  if (first && last && (first[0] !== last[0] || first[1] !== last[1])) {
    ring.push([first[0], first[1]])
  }
  return ring
}

function polygonArea(ring: [number, number][]): number {
  let sum = 0
  for (let i = 0; i < ring.length; i += 1) {
    const current = ring[i]
    const next = ring[(i + 1) % ring.length]
    if (!current || !next) continue
    sum += current[0] * next[1] - next[0] * current[1]
  }
  return Math.abs(sum / 2)
}

function largestExteriorRing(result: MultiPolygon): [number, number][] | null {
  let best: [number, number][] | null = null
  let bestArea = 0

  result.forEach((polygon) => {
    const exterior = polygon[0] as [number, number][] | undefined
    if (!exterior || exterior.length < 4) return
    const area = polygonArea(exterior)
    if (area > bestArea) {
      bestArea = area
      best = exterior
    }
  })

  return best
}

// 좌표 격자 스냅 — 손으로 그린 인접 구역선의 미세 틈 보정
function snapToGrid(ring: [number, number][], decimals: number): [number, number][] {
  const f = Math.pow(10, decimals)
  return ring.map(([x, y]) => [Math.round(x * f) / f, Math.round(y * f) / f])
}

// 볼록 껍질(Convex Hull) — 스냅핑으로도 안 될 때 최후 fallback
function convexHull(points: [number, number][]): [number, number][] {
  if (points.length < 3) return points
  const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1])
  const cross = (O: [number, number], A: [number, number], B: [number, number]) =>
    (A[0] - O[0]) * (B[1] - O[1]) - (A[1] - O[1]) * (B[0] - O[0])
  const lower: [number, number][] = []
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2]!, lower[lower.length - 1]!, p) <= 0) lower.pop()
    lower.push(p)
  }
  const upper: [number, number][] = []
  for (let i = sorted.length - 1; i >= 0; i -= 1) {
    const p = sorted[i]!
    while (upper.length >= 2 && cross(upper[upper.length - 2]!, upper[upper.length - 1]!, p) <= 0) upper.pop()
    upper.push(p)
  }
  lower.pop()
  upper.pop()
  return [...lower, ...upper]
}

export function mergeCardBoundaryPoints(boundaries: CardBoundary[]): BoundaryMergeResult | null {
  const polygons = boundaries
    .filter((boundary) => boundary.points.length >= 3)
    .map((boundary) => [closeRing(boundary.points)] as Polygon)

  if (polygons.length === 0) return null
  if (polygons.length === 1) {
    return {
      points: polygons[0][0].slice(0, -1).map(([lng, lat]) => ({ lat, lng })),
      multiPolygonCount: 1,
    }
  }

  if (!polygons[0]) return null

  // 1차: 원본 좌표로 union 시도
  // 2차: 5자리 스냅(~1m)으로 재시도
  // 3차: 4자리 스냅(~11m)으로 재시도  — 손으로 그린 인접 구역선 대부분 해결
  // 최후: 볼록 껍질
  for (const snapDecimals of [null, 5, 4]) {
    let tryPolygons = polygons
    if (snapDecimals !== null) {
      tryPolygons = polygons.map(([ring]) => [snapToGrid(ring!, snapDecimals)] as Polygon)
    }
    const [fp, ...rp] = tryPolygons
    if (!fp) break
    const merged = union(fp, ...rp)
    if (merged.length === 1) {
      const exterior = largestExteriorRing(merged)
      if (exterior) {
        return {
          points: exterior.slice(0, -1).map(([lng, lat]) => ({ lat, lng })),
          multiPolygonCount: 1,
        }
      }
    }
  }

  // 최후 fallback: 모든 꼭짓점의 볼록 껍질
  const allPoints = polygons.flatMap(([ring]) => ring ?? [])
  const hull = convexHull(allPoints)
  if (hull.length < 3) return null
  return {
    points: hull.map(([lng, lat]) => ({ lat, lng })),
    multiPolygonCount: 1,
  }
}

const BACKUP_TYPE = 'chs-yongin-card-boundaries'

export function downloadCardBoundaryBackup(cards: Array<{ id: number; name: string; region: string; area: string }>, boundaries: CardBoundary[]) {
  const boundaryMap = new Map(boundaries.map((boundary) => [boundary.cardId, boundary.points]))
  const payload = {
    type: 'chs-yongin-card-boundaries',
    version: 1,
    exportedAt: new Date().toISOString(),
    cards: cards
      .filter((card) => boundaryMap.has(card.id))
      .map((card) => ({
        cardId: card.id,
        cardName: card.name,
        region: card.region,
        area: card.area,
        boundary: boundaryMap.get(card.id) ?? [],
      })),
  }
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `card-boundaries-${new Date().toISOString().slice(0, 10)}.json`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export type BoundaryBackupEntry = {
  cardId: number
  cardName: string
  region: string
  area: string
  points: GeoPoint[]
}

/** 좌표가 지구 위의 점인가. 위도 999 같은 값이 통과하면 지도가 엉뚱한 데로 간다 */
function isEarthPoint(p: GeoPoint): boolean {
  return Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180
}

/** 면이 되는가. 같은 점 세 개나 일직선 세 개는 구역선이 아니다 */
function hasArea(points: GeoPoint[]): boolean {
  let twice = 0
  for (let i = 0; i < points.length; i++) {
    const a = points[i]
    const b = points[(i + 1) % points.length]
    twice += a.lng * b.lat - b.lng * a.lat
  }
  return Math.abs(twice) > 1e-12
}

export function parseCardBoundaryBackup(text: string): BoundaryBackupEntry[] {
  const parsed = JSON.parse(text) as {
    type?: unknown
    cards?: Array<{ cardId?: unknown; cardName?: unknown; region?: unknown; area?: unknown; boundary?: unknown }>
  }
  // 아무 JSON 이나 받으면 엉뚱한 파일로 구역선을 덮게 된다
  if (parsed.type !== BACKUP_TYPE) throw new Error('not a boundary backup')
  if (!Array.isArray(parsed.cards)) throw new Error('invalid backup')

  return parsed.cards.map((item) => {
    const cardId = Number(item.cardId)
    if (!Number.isFinite(cardId)) throw new Error('invalid card id')
    if (!Array.isArray(item.boundary)) throw new Error('invalid boundary')
    const points = item.boundary.map((point) => {
      const candidate = point as Partial<GeoPoint>
      const lat = Number(candidate.lat)
      const lng = Number(candidate.lng)
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw new Error('invalid point')
      const p = { lat, lng }
      if (!isEarthPoint(p)) throw new Error('point out of range')
      return p
    })
    return {
      cardId,
      cardName: String(item.cardName ?? ''),
      region: String(item.region ?? ''),
      area: String(item.area ?? ''),
      points,
    }
  }).filter((entry) => entry.points.length >= 3 && hasArea(entry.points))
}

export type RestoreRefusal = { cardId: number; cardName: string; reason: '없는 카드' | '다른 카드' }

export type RestorePlan = {
  apply: CardBoundary[]
  refused: RestoreRefusal[]
}

/**
 * 백업을 지금 카드에 맞춰 본다. **숫자 id 만 믿지 않는다.**
 *
 * 다른 회중의 백업이나 오래된 백업은 id 가 우연히 겹칠 수 있고, 그러면
 * 엉뚱한 카드의 구역선을 덮는다. 되돌릴 방법이 없다. 그래서 이름까지 맞는
 * 것만 넣고 나머지는 거절한 이유와 함께 돌려준다.
 */
export function planBoundaryRestore(
  entries: BoundaryBackupEntry[],
  currentCards: Array<{ id: number; name: string }>,
): RestorePlan {
  const byId = new Map(currentCards.map((c) => [c.id, c]))
  const apply: CardBoundary[] = []
  const refused: RestoreRefusal[] = []

  for (const entry of entries) {
    const card = byId.get(entry.cardId)
    if (!card) {
      refused.push({ cardId: entry.cardId, cardName: entry.cardName, reason: '없는 카드' })
      continue
    }
    // 이름이 안 적힌 옛 백업은 id 만으로 받는다 — 그 시절엔 이름을 안 적었다
    if (entry.cardName && entry.cardName !== card.name) {
      refused.push({ cardId: entry.cardId, cardName: entry.cardName, reason: '다른 카드' })
      continue
    }
    apply.push({ cardId: entry.cardId, points: entry.points })
  }
  return { apply, refused }
}
