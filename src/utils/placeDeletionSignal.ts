import type { Building, EventRestaurantAssignment, PlaceDeletionSignal, ReturnVisit } from '../types'

export function resolvePlaceDeletionScope(
  buildings: Building[],
  returnVisits: ReturnVisit[],
  signal: PlaceDeletionSignal,
) {
  const unitIds = new Set(signal.unitIds)
  if (signal.unitId !== null) unitIds.add(signal.unitId)
  if (signal.targetType === 'building' && signal.buildingId !== null) {
    buildings
      .find((building) => building.id === signal.buildingId)
      ?.units.forEach((unit) => unitIds.add(unit.id))
  }

  const returnVisitIds = new Set(signal.returnVisitIds)
  returnVisits.forEach((visit) => {
    if ((visit.unitId !== null && unitIds.has(visit.unitId))
        || (signal.targetType === 'building' && visit.buildingId === signal.buildingId)) {
      returnVisitIds.add(visit.id)
    }
  })

  return { unitIds, returnVisitIds }
}

export function isRestaurantAssignmentDeleted(
  assignment: EventRestaurantAssignment,
  signal: PlaceDeletionSignal,
  unitIds: Set<number>,
) {
  return signal.targetType === 'building'
    ? assignment.buildingId === signal.buildingId
    : assignment.unitId !== null && unitIds.has(assignment.unitId)
}
