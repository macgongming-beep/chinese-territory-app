// 구역 화면 표의 정렬 규칙.
//
// DesktopTerritory 안에 있어서 "왜 이 순서로 나오나" 를 확인할 방법이 없었다.
// 방향(오름/내림)을 **일부러 무시하는** 규칙이 몇 개 섞여 있는데,
// 화면 안에 있을 때는 그게 의도인지 실수인지 알 수 없었다.
import type { Building, Unit, VisitHistory } from '../types'
import { getRestaurantUnits } from './restaurants'

export type SortDir = 'asc' | 'desc'
export type BuildingSortKey = '카드' | '건물' | '주소' | '유형' | '식당'
export type PointSortKey = '카드' | '건물' | '세대' | '상태' | '최근 방문'

/** 한글·숫자를 사람이 읽는 순서로 (2 < 10) */
export const naturalCompare = (x: string, y: string) =>
  x.localeCompare(y, 'ko', { numeric: true, sensitivity: 'base' })

const STATUS_ORDER: Record<string, number> = { 미방문: 0, 부재: 1, 만남: 2, 대상외: 3, 거절: 4 }

export type BuildingSortOptions = {
  sort: { key: BuildingSortKey; dir: SortDir }
  /** 카드 id → 카드 이름 */
  cardName: (cardId: number) => string
  /** 미배정 건물을 맨 위로 올릴지 (카드 필터가 '전체' 일 때만) */
  unassignedFirst: boolean
  unassignedCardId: number | null
}

export function compareBuildingsForTable(
  a: Building, b: Building, opts: BuildingSortOptions,
): number {
  // 미배정 건물은 **방향과 상관없이** 항상 맨 위다.
  // 내림차순으로 바꿔도 맨 아래로 내려가지 않는다 — 처리해야 할 것이기 때문이다.
  if (opts.unassignedFirst && opts.unassignedCardId) {
    const aUn = a.cardId === opts.unassignedCardId
    const bUn = b.cardId === opts.unassignedCardId
    if (aUn && !bUn) return -1
    if (!aUn && bUn) return 1
  }
  const dir = opts.sort.dir === 'asc' ? 1 : -1
  if (opts.sort.key === '카드') {
    return naturalCompare(opts.cardName(a.cardId), opts.cardName(b.cardId)) * dir
  }
  if (opts.sort.key === '건물') return naturalCompare(a.name, b.name) * dir
  if (opts.sort.key === '주소') return naturalCompare(a.address, b.address) * dir
  if (opts.sort.key === '유형') return naturalCompare(a.type, b.type) * dir
  if (opts.sort.key === '식당') {
    const ra = getRestaurantUnits(a).length
    const rb = getRestaurantUnits(b).length
    if (ra !== rb) return (ra - rb) * dir
    // 같은 개수끼리는 이름순. **여기는 방향을 안 탄다**
    return naturalCompare(a.name, b.name)
  }
  return 0
}

export type PointRow = {
  building: Pick<Building, 'cardId' | 'name' | 'address'>
  unit: Pick<Unit, 'number' | 'status'>
  latestHistory?: Pick<VisitHistory, 'visitedAt'> | null
}

export type PointSortOptions = {
  sort: { key: PointSortKey; dir: SortDir }
  cardName: (cardId: number) => string
}

export function comparePointRowsForTable(
  a: PointRow, b: PointRow, opts: PointSortOptions,
): number {
  const dir = opts.sort.dir === 'asc' ? 1 : -1
  const label = (r: PointRow) => r.building.name || r.building.address
  if (opts.sort.key === '카드') {
    const byCard = naturalCompare(opts.cardName(a.building.cardId), opts.cardName(b.building.cardId))
    if (byCard !== 0) return byCard * dir
    return naturalCompare(label(a), label(b)) * dir
  }
  if (opts.sort.key === '건물') return naturalCompare(label(a), label(b)) * dir
  if (opts.sort.key === '세대') return naturalCompare(a.unit.number, b.unit.number) * dir
  if (opts.sort.key === '상태') {
    const sa = STATUS_ORDER[a.unit.status] ?? 9
    const sb = STATUS_ORDER[b.unit.status] ?? 9
    if (sa !== sb) return (sa - sb) * dir
    // 같은 상태끼리는 호수순. **여기는 방향을 안 탄다**
    return naturalCompare(a.unit.number, b.unit.number)
  }
  if (opts.sort.key === '최근 방문') {
    // 기록 없는 세대는 **방향과 상관없이** 언제나 뒤로.
    // '오래된 순' 으로 봐도 맨 앞에 안 온다 (방문한 적 없는 건 '가장 오래된' 게 아니다)
    const da = a.latestHistory?.visitedAt ?? ''
    const db = b.latestHistory?.visitedAt ?? ''
    if (!da && !db) return naturalCompare(a.unit.number, b.unit.number)
    if (!da) return 1
    if (!db) return -1
    return da < db ? -dir : da > db ? dir : 0
  }
  // 모르는 키는 아무것도 안 한다.
  // 예전에는 여기로 다 떨어져서 '최근방문'(띄어쓰기 없음) 같은 오타가
  // 조용히 동작하는 척했다 — 화면은 '최근 방문' 인데 유틸 타입은 붙여 썼다.
  return 0
}
