// 네이버 지오코딩 Promise 래퍼 (여러 컴포넌트에서 복붙되던 SDK 호출 단일화)
//
// ⚠️ naver.maps.Service.geocode 는 반드시 메서드로 호출해야 함(this 바인딩).
//    구조분해하면 콜백이 안 오므로 항상 naver.maps.Service.geocode(...) 형태 유지.
/* eslint-disable @typescript-eslint/no-explicit-any -- 네이버 지도 SDK 무타입 */

import { normalizeMapCoordinates } from '../utils/mapUtils'
import type { GeoPoint } from '../types'

function getNaver(): any {
  return (window as any).naver
}

// SDK 로드 여부
export function isNaverMapsReady(): boolean {
  const naver = getNaver()
  return !!naver?.maps?.Service
}

// 단일 주소 → 좌표. SDK 미로드/빈쿼리/실패 시 null.
export function geocodeQuery(query: string): Promise<GeoPoint | null> {
  return new Promise((resolve) => {
    const naver = getNaver()
    const q = query.trim()
    if (!naver?.maps?.Service || !q) {
      resolve(null)
      return
    }
    naver.maps.Service.geocode({ query: q }, (status: any, response: any) => {
      if (status === naver.maps.Service.Status.OK && response?.v2?.addresses?.length > 0) {
        const r = response.v2.addresses[0]
        resolve(normalizeMapCoordinates(Number(r.y), Number(r.x)))
        return
      }
      resolve(null)
    })
  })
}

// 여러 후보 주소를 순서대로 시도해 첫 성공 좌표 반환 (모두 실패 시 null)
export async function geocodeFirstMatch(candidates: string[]): Promise<GeoPoint | null> {
  for (const candidate of candidates) {
    const coords = await geocodeQuery(candidate)
    if (coords) return coords
  }
  return null
}
