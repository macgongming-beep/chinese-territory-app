import { describe, expect, it } from 'vitest'
import { isBareUnitSearch, searchMapData } from './mapSearch'
import type { Building, InformalAsset, TerritoryCard } from '../types'

const cards = [{ id: 1, name: '처인구 고림동 9', region: '처인구', area: '고림동' }] as TerritoryCard[]
const buildings = [{
  id: 10,
  cardId: 1,
  name: '우일빌라 F동',
  address: '처인구 고림동 진덕로 25-1',
  type: '주택',
  lat: 37.2,
  lng: 127.2,
  units: [
    { id: 101, number: '201호', status: '미방문' },
    { id: 102, number: '진미식당', status: '미방문', isRestaurant: true },
  ],
}] as Building[]
const informalAssets = [{ id: 7, name: '경희대 우정원', memo: '정문 옆', parentId: null }] as InformalAsset[]

describe('map search', () => {
  it('does not fan out a bare unit number across every building', () => {
    expect(isBareUnitSearch('201호')).toBe(true)
    expect(searchMapData({ query: '201호', cards, buildings, informalAssets })).toEqual([])
  })

  it('finds a unit when the building gives it context', () => {
    expect(searchMapData({ query: '우일빌라 201', cards, buildings, informalAssets }))
      .toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'unit', unitId: 101, buildingId: 10 })]))
  })

  it('finds cards, buildings, restaurants and informal places', () => {
    expect(searchMapData({ query: '고림동 9', cards, buildings, informalAssets })[0]).toMatchObject({ kind: 'card', cardId: 1 })
    expect(searchMapData({ query: '진덕로 25-1', cards, buildings, informalAssets })).toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'building', buildingId: 10 })]))
    expect(searchMapData({ query: '진미', cards, buildings, informalAssets })[0]).toMatchObject({ kind: 'restaurant', unitId: 102 })
    expect(searchMapData({ query: '우정원', cards, buildings, informalAssets })[0]).toMatchObject({ kind: 'informal', informalId: 7 })
  })
})
