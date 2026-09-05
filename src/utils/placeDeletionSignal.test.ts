import { describe, expect, it } from 'vitest'
import type { Building, EventRestaurantAssignment, PlaceDeletionSignal, ReturnVisit } from '../types'
import { isRestaurantAssignmentDeleted, resolvePlaceDeletionScope } from './placeDeletionSignal'

const building = {
  id: 10,
  units: [{ id: 21 }, { id: 22 }],
} as Building

const returnVisits = [
  { id: 31, buildingId: 10, unitId: 21 },
  { id: 32, buildingId: 10, unitId: 22 },
] as ReturnVisit[]

const assignment = (unitId: number): EventRestaurantAssignment => ({
  id: unitId,
  eventId: 1,
  userName: '사용자',
  buildingId: 10,
  unitId,
  assignedBy: '관리자',
  assignedAt: '2026-09-06T00:00:00Z',
  memo: '',
})

describe('장소 삭제 신호 범위', () => {
  it('건물 삭제는 하위 세대와 정기방문을 모두 포함한다', () => {
    const signal: PlaceDeletionSignal = {
      targetType: 'building', buildingId: 10, unitId: null, unitIds: [], returnVisitIds: [],
    }
    const scope = resolvePlaceDeletionScope([building], returnVisits, signal)

    expect([...scope.unitIds]).toEqual([21, 22])
    expect([...scope.returnVisitIds]).toEqual([31, 32])
    expect(isRestaurantAssignmentDeleted(assignment(22), signal, scope.unitIds)).toBe(true)
  })

  it('세대 하나 삭제는 같은 건물의 다른 세대 배정을 지우지 않는다', () => {
    const signal: PlaceDeletionSignal = {
      targetType: 'unit', buildingId: 10, unitId: 21, unitIds: [21], returnVisitIds: [31],
    }
    const scope = resolvePlaceDeletionScope([building], returnVisits, signal)

    expect([...scope.returnVisitIds]).toEqual([31])
    expect(isRestaurantAssignmentDeleted(assignment(21), signal, scope.unitIds)).toBe(true)
    expect(isRestaurantAssignmentDeleted(assignment(22), signal, scope.unitIds)).toBe(false)
  })
})
