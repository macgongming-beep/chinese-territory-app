import { supabase } from './supabase'
import { getAuthToken } from './authToken'

export type PlaceCandidate = {
  name: string
  address: string
  category: string
  lat: number
  lng: number
}

/**
 * 장소 이름으로 좌표 후보를 찾는다.
 *
 * ⚠ 지도 SDK 의 geocode 는 **주소만** 받는다. '용인 강남대학교' 같은 이름은
 *   못 찾는다. 그래서 Edge Function(search-place)을 거쳐 네이버 지역 검색을 쓴다.
 * ⚠ 서버 키가 필요해 브라우저에서 직접 못 부른다. 함수가 창구다.
 *
 * 최대 5개까지 온다 (네이버 지역 검색의 상한).
 */
export async function searchPlaces(query: string): Promise<PlaceCandidate[]> {
  const q = query.trim()
  if (!q) return []
  const token = getAuthToken()
  if (!token) return []

  const { data, error } = await supabase.functions.invoke('search-place', {
    body: { query: q },
    headers: { 'x-session-token': token },
  })
  if (error) return []
  const places = (data as { places?: unknown })?.places
  if (!Array.isArray(places)) return []

  return places.filter((place): place is PlaceCandidate => {
    const p = place as Partial<PlaceCandidate>
    return typeof p?.name === 'string' && p.name.length > 0
      && typeof p.lat === 'number' && typeof p.lng === 'number'
  })
}
