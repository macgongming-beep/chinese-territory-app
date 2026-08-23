// DesktopTerritory 를 테스트에서 그리기 위한 최소 props.
//
// 이 화면은 props 를 51개 받는다. 그 자체가 이번 구조 개선의 이유다.
// 여기서 필수 props 를 가짜로 채워 두면, 각 테스트는 관심 있는 것만 덮어쓰면 된다.
import { vi } from 'vitest'
import type { Building, CardBoundary, TerritoryCard, VisitHistory } from '../types'

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
    onAddVisitHistory: vi.fn(noop),
    onUpdateVisitHistory: vi.fn(noop),
    onOpenCardMap: vi.fn(noop),
    onOpenBuildingMap: vi.fn(noop),
    onCreateCard: vi.fn(async () => 1),

    ...overrides,
  }
}
