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

export function parseCardBoundaryBackup(text: string): CardBoundary[] {
  const parsed = JSON.parse(text) as {
    cards?: Array<{ cardId?: unknown; boundary?: unknown }>
  }
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
      return { lat, lng }
    })
    return { cardId, points }
  }).filter((boundary) => boundary.points.length >= 3)
}
