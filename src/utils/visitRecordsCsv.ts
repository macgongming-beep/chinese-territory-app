// 방문 기록(visit_histories) 전용 CSV — 봉사 로그(감사 로그)와 달리 누락 없는 완전한 방문 데이터.
// unitId → 건물/세대, 건물.cardId → 카드/구 로 enrich.
import type { Building, TerritoryCard, VisitHistory } from '../types'

const HEADERS = ['방문일', '시간대', '구', '카드', '건물', '세대', '방문자', '결과', '유형', '메모'] as const

function escapeCsv(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
}

export function buildVisitRecordsCsv(
  histories: VisitHistory[],
  buildings: Building[],
  cards: TerritoryCard[],
): string {
  // unitId → { building, unitNumber } 역인덱스
  const unitIndex = new Map<number, { building: Building; unitNumber: string }>()
  for (const b of buildings) {
    for (const u of b.units ?? []) {
      unitIndex.set(u.id, { building: b, unitNumber: u.number })
    }
  }
  const cardById = new Map<number, TerritoryCard>(cards.map((c) => [c.id, c]))

  const rows = [...histories]
    .sort((a, b) => (b.visitedAt + String(b.id)).localeCompare(a.visitedAt + String(a.id)))
    .map((h) => {
      const hit = unitIndex.get(h.unitId)
      const building = hit?.building
      const card = building ? cardById.get(building.cardId) : undefined
      return [
        h.visitedAt ?? '',
        h.timeSlot ?? '',
        card?.region ?? '',
        card?.name ?? '',
        building?.name ?? '',
        hit?.unitNumber ?? '',
        h.visitor ?? '',
        h.result ?? '',
        h.visitType === 'restaurant' ? '식당' : '카드',
        h.memo ?? '',
      ].map((v) => escapeCsv(String(v))).join(',')
    })

  return [HEADERS.join(','), ...rows].join('\n')
}
