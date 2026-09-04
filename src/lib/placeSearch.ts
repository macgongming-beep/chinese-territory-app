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
export type PlaceSearchResult =
  | { ok: true; places: PlaceCandidate[] }
  /**
   * ⚠ 실패를 빈 결과로 뭉뚱그리지 않는다. 그러면 "검색 결과 없음" 과
   *   "검색이 고장남" 이 화면에서 같아 보여 원인을 못 찾는다.
   */
  | { ok: false; reason: 'no_session' | 'rejected' | 'unavailable' }

export async function searchPlaces(query: string): Promise<PlaceSearchResult> {
  const q = query.trim()
  if (!q) return { ok: true, places: [] }
  const token = getAuthToken()
  if (!token) return { ok: false, reason: 'no_session' }

  const { data, error } = await supabase.functions.invoke('search-place', {
    body: { query: q },
    headers: { 'x-session-token': token },
  })
  if (error) {
    console.warn('[searchPlaces] search-place 호출 실패', error)
    // 401 은 '세션이 거부됨' 이다. 연결 문제와 같은 문구로 묶으면 원인을 못 찾는다.
    const status = (error as { context?: { status?: number } })?.context?.status
    return { ok: false, reason: status === 401 ? 'rejected' : 'unavailable' }
  }
  const body = data as { places?: unknown; error?: unknown }
  if (body?.error) {
    console.warn('[searchPlaces] search-place 가 오류를 돌려줌', body.error)
    return { ok: false, reason: 'unavailable' }
  }
  const places = Array.isArray(body?.places) ? body.places : []

  return {
    ok: true,
    places: places.filter((place): place is PlaceCandidate => {
      const p = place as Partial<PlaceCandidate>
      return typeof p?.name === 'string' && p.name.length > 0
        && typeof p.lat === 'number' && typeof p.lng === 'number'
    }),
  }
}
