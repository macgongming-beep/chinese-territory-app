// DesktopTerritory 를 테스트에서 그리기 위한 최소 props.
//
// 이 화면은 props 를 51개 받는다. 그 자체가 이번 구조 개선의 이유다.
// 여기서 필수 props 를 가짜로 채워 두면, 각 테스트는 관심 있는 것만 덮어쓰면 된다.
import { vi } from 'vitest'
import type { Building, CardBoundary, GeoPoint, TerritoryCard, Unit, VisitHistory } from '../types'

/**
 * 구역 카드 하나. 이름은 '지역 동 번호' 형식이라 거기서 region·area 를 뽑는다.
 * 집계 필드(buildings/units/…)는 화면이 그리다 터지지 않게 0 으로 채운다.
 */
export function testCard(id: number, name: string, extra: Partial<TerritoryCard> = {}): TerritoryCard {
  const [region = '', area = ''] = name.split(' ')
  return {
    id, name, area, region,
    type: '주택',
    buildings: 0, units: 0, completed: 0,
    regularVisits: 0, regularVisitPoints: [],
    progress: 0,
    assignedLeader: null, assignedUsers: [],
    status: '미배정',
    ...extra,
  } as TerritoryCard
}

/** 건물 하나. units 를 안 주면 세대 하나가 딸린다. */
export function testBuilding(id: number, cardId: number, name: string, units?: Unit[]): Building {
  return {
    id, cardId, name,
    address: `경기도 용인시 수지구 ${name}로 ${id}`,
    type: '주택',
    lat: 37.5, lng: 127.1,
    units: units ?? [testUnit(id * 100 + 1, '101호')],
  }
}

/** 세대 하나 */
export function testUnit(id: number, number: string, extra: Partial<Unit> = {}): Unit {
  return { id, number, status: '미방문', ...extra } as Unit
}

/** 사각형 구역선. [minLat, minLng, maxLat, maxLng] */
export function testBoundary(cardId: number, [minLat, minLng, maxLat, maxLng]: [number, number, number, number]): CardBoundary {
  const points: GeoPoint[] = [
    { lat: minLat, lng: minLng }, { lat: minLat, lng: maxLng },
    { lat: maxLat, lng: maxLng }, { lat: maxLat, lng: minLng },
  ]
  return { cardId, points }
}

/** 모든 콜백을 기록만 하는 가짜로 채운다. 테스트가 호출 여부를 볼 수 있다. */
export function territoryProps(overrides: Record<string, unknown> = {}) {
  const noop = () => {}
  const asyncNoop = async () => {}
  return {
    language: 'ko' as const,
    buildings: [] as Building[],
    cardBoundaries: [] as CardBoundary[],
    cards: [] as TerritoryCard[],
    visitHistories: [] as VisitHistory[],
    role: 'admin' as const,

    onSetCardLeaders: vi.fn(noop),
    onSetMultipleCardLeaders: vi.fn(noop),
    onDeleteBuildings: vi.fn(noop),
    onDeleteCards: vi.fn(noop),
    onMergeDuplicateBuildings: vi.fn(asyncNoop),
    onImportBuildings: vi.fn(async () => ({ inserted: 0, skipped: 0 })),
    onMoveBuildingToCard: vi.fn(noop),
    onReassignBuildingsToCards: vi.fn(async () => ({ updated: 0, failed: 0 })),
    onUpdateBuilding: vi.fn(noop),
    onToggleChinese: vi.fn(noop),
    onToggleRegularVisit: vi.fn(noop),
    onSetRegularVisitor: vi.fn(noop),
    onAddUnit: vi.fn(noop),
    onDeleteUnit: vi.fn(noop),
    onUpdateUnitFlags: vi.fn(noop),
    onUpdateUnitStatus: vi.fn(noop),
    // 계약이 Promise<boolean> 이다. 기본은 성공.
    // 실패를 보고 싶은 테스트는 async () => false 로 덮어쓴다.
    onAddVisitHistory: vi.fn(async () => true),
    onUpdateVisitHistory: vi.fn(async () => true),
    onOpenCardMap: vi.fn(noop),
    onOpenBuildingMap: vi.fn(noop),
    onCreateCard: vi.fn(async () => 1),

    ...overrides,
  }
}
