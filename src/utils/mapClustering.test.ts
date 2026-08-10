import { describe, it, expect } from 'vitest'
import { clusterByGrid, getClusterThresholdKm } from './mapClustering'

const YONGIN = { lat: 37.2411, lng: 127.1776 }

function near(base: { lat: number; lng: number }, meters: number) {
  // 위도 방향으로 meters 만큼 떨어진 지점
  return { lat: base.lat + meters / 111320, lng: base.lng }
}

describe('getClusterThresholdKm', () => {
  it('많이 확대하면 묶지 않는다', () => {
    expect(getClusterThresholdKm(17)).toBe(0)
    expect(getClusterThresholdKm(20)).toBe(0)
  })

  it('줌이 낮을수록 더 넓게 묶는다', () => {
    expect(getClusterThresholdKm(16)).toBeLessThan(getClusterThresholdKm(14))
    expect(getClusterThresholdKm(14)).toBeLessThan(getClusterThresholdKm(11))
  })
})

describe('clusterByGrid', () => {
  it('묶지 않는 단계에서는 건물 하나당 마커 하나', () => {
    const items = [YONGIN, near(YONGIN, 10), near(YONGIN, 20)]
    const clusters = clusterByGrid(items, 0)
    expect(clusters).toHaveLength(3)
    expect(clusters.every((c) => c.items.length === 1)).toBe(true)
  })

  it('가까운 건물끼리 묶인다', () => {
    const items = [YONGIN, near(YONGIN, 5), near(YONGIN, 10)]
    const clusters = clusterByGrid(items, 1)
    expect(clusters).toHaveLength(1)
    expect(clusters[0].items).toHaveLength(3)
  })

  it('멀리 떨어진 건물은 따로 묶인다', () => {
    const items = [YONGIN, near(YONGIN, 5000)]
    const clusters = clusterByGrid(items, 0.2)
    expect(clusters).toHaveLength(2)
  })

  it('묶인 위치는 속한 건물들의 평균', () => {
    const a = { lat: 37.2, lng: 127.1 }
    const b = { lat: 37.2002, lng: 127.1002 }
    const [cluster] = clusterByGrid([a, b], 1)
    expect(cluster.lat).toBeCloseTo((a.lat + b.lat) / 2, 6)
    expect(cluster.lng).toBeCloseTo((a.lng + b.lng) / 2, 6)
  })

  it('건물이 하나도 없으면 마커도 없다', () => {
    expect(clusterByGrid([], 0.5)).toEqual([])
  })

  it('원래 항목을 그대로 담아 돌려준다 (건물 정보 유실 없음)', () => {
    const items = [
      { id: 1, lat: 37.2, lng: 127.1 },
      { id: 2, lat: 37.2001, lng: 127.1001 },
    ]
    const clusters = clusterByGrid(items, 1)
    const ids = clusters.flatMap((c) => c.items.map((i) => i.id)).sort()
    expect(ids).toEqual([1, 2])
  })

  it('건물이 많아도 모든 건물이 정확히 한 번씩 들어간다', () => {
    const items = Array.from({ length: 1000 }, (_, i) => ({
      id: i,
      lat: 37.2 + (i % 50) * 0.001,
      lng: 127.1 + Math.floor(i / 50) * 0.001,
    }))
    const clusters = clusterByGrid(items, 0.2)
    const total = clusters.reduce((sum, c) => sum + c.items.length, 0)
    expect(total).toBe(1000)
    expect(new Set(clusters.flatMap((c) => c.items.map((i) => i.id))).size).toBe(1000)
  })
})
