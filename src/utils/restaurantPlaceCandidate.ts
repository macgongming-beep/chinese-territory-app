import type { Building, CardBoundary } from '../types'
import type { PlaceCandidate } from '../lib/placeSearch'
import { normalizeCardSearch } from './cardSearch'
import { findCardForCoordinates, isValidMapCoordinate } from './mapUtils'
import { shortAddress } from './shortAddress'

export type RestaurantPlaceStatus = 'registered' | 'existing-building' | 'new'
export type RestaurantPlaceScope = 'card' | 'unassigned' | 'outside'

export type ClassifiedRestaurantPlace = PlaceCandidate & {
  buildingId: number | null
  status: RestaurantPlaceStatus
  scope: RestaurantPlaceScope
}

function distanceMeters(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const rad = Math.PI / 180
  const dLat = (bLat - aLat) * rad
  const dLng = (bLng - aLng) * rad
  const value = Math.sin(dLat / 2) ** 2
    + Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLng / 2) ** 2
  return 6371000 * 2 * Math.asin(Math.min(1, Math.sqrt(value)))
}

function findExistingBuilding(place: PlaceCandidate, buildings: Building[]): Building | null {
  const key = normalizeCardSearch(shortAddress(place.address))
  const matches = buildings.filter((building) => {
    if (normalizeCardSearch(shortAddress(building.address)) !== key) return false
    if (!isValidMapCoordinate(building.lat, building.lng)) return true
    return distanceMeters(building.lat, building.lng, place.lat, place.lng) <= 200
  })
  return matches.length === 1 ? matches[0] : null
}

function getScope(place: PlaceCandidate, buildings: Building[], boundaries: CardBoundary[]): RestaurantPlaceScope {
  if (findCardForCoordinates(place.lat, place.lng, boundaries) != null) return 'card'
  const located = buildings.filter((building) => isValidMapCoordinate(building.lat, building.lng))
  if (located.length === 0) return 'unassigned'
  const padding = 0.05
  const lats = located.map((building) => building.lat)
  const lngs = located.map((building) => building.lng)
  const nearby = place.lat >= Math.min(...lats) - padding && place.lat <= Math.max(...lats) + padding
    && place.lng >= Math.min(...lngs) - padding && place.lng <= Math.max(...lngs) + padding
  return nearby ? 'unassigned' : 'outside'
}

export function classifyRestaurantPlaces(
  places: PlaceCandidate[],
  buildings: Building[],
  boundaries: CardBoundary[],
): ClassifiedRestaurantPlace[] {
  return places.map((place) => {
    const building = findExistingBuilding(place, buildings)
    const name = normalizeCardSearch(place.name)
    const registered = building?.units.some((unit) => unit.isRestaurant && normalizeCardSearch(unit.number) === name) ?? false
    const status: RestaurantPlaceStatus = registered ? 'registered' : building ? 'existing-building' : 'new'
    return {
      ...place,
      buildingId: building?.id ?? null,
      status,
      scope: getScope(place, buildings, boundaries),
    }
  }).sort((a, b) => {
    const scopeRank = { card: 0, unassigned: 1, outside: 2 }
    const statusRank = { registered: 0, 'existing-building': 1, new: 2 }
    return scopeRank[a.scope] - scopeRank[b.scope] || statusRank[a.status] - statusRank[b.status]
  })
}
