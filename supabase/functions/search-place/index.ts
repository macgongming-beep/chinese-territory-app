// Supabase Edge Function: search-place
//
// 장소 이름으로 좌표를 찾는다. 지도 SDK 의 geocode 는 **주소만** 받아서
// '용인 강남대학교' 같은 이름은 못 찾는다. 그래서 NAVER API HUB 의
// 지역 검색(NAVER_SCH_LOCAL)을 쓴다.
//
// ⚠ 브라우저에서 직접 못 부른다 (CORS + 서버 키). 그래서 이 함수가 창구다.
//
// 환경변수 (supabase secrets set):
//   - NAVER_APIHUB_CLIENT_ID      NCP API HUB Client ID
//   - NAVER_APIHUB_CLIENT_SECRET  NCP API HUB Client Secret
//   - SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (자동)
//
// 배포: supabase functions deploy search-place --no-verify-jwt
//
// ⚠ --no-verify-jwt 이지만 **아무나 쓸 수 있는 건 아니다.** 이 앱의 세션 토큰을
//   x-session-token 헤더로 받아 verify_session 으로 확인한다. 안 그러면 함수
//   주소만 알면 우리 할당량을 남이 쓴다.

// @ts-ignore Deno
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const API_BASE = 'https://naverapihub.apigw.ntruss.com'
/** 지역 검색은 한 번에 최대 5개까지만 준다 */
const MAX_RESULTS = 5

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  // ⚠ supabase-js 는 x-client-info 를 자동으로 붙인다. 허용 목록에 없으면
  //   브라우저 예비요청(preflight)에서 막혀 호출 자체가 실패한다.
  //   curl 은 예비요청을 안 보내므로 이 문제를 못 잡는다 — 실제로 그렇게 놓쳤다.
  'Access-Control-Allow-Headers':
    'authorization, content-type, x-session-token, x-client-info, apikey, accept-profile',
  'Access-Control-Max-Age': '86400',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })

/** 네이버가 제목에 <b> 태그를 섞어 준다. 그대로 보여 주면 태그가 글자로 보인다. */
function stripTags(value: string): string {
  return String(value ?? '')
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .trim()
}

/**
 * mapx/mapy → 위경도.
 * 문서는 WGS84 라고만 하고 단위를 안 밝힌다. 실제로는 십진도를 1e7 배 한
 * 정수(예: 1270716000)로 오는 경우가 있어 둘 다 받는다.
 * ⚠ 한국 범위를 벗어나면 버린다 — 좌표가 이상하면 지도가 엉뚱한 곳으로 간다.
 */
function toDegrees(raw: unknown): number | null {
  const n = Number(raw)
  if (!Number.isFinite(n) || n === 0) return null
  const value = Math.abs(n) > 1000 ? n / 1e7 : n
  return Number.isFinite(value) ? value : null
}

function inKorea(lat: number | null, lng: number | null): boolean {
  return lat !== null && lng !== null
    && lat > 32 && lat < 40 && lng > 123 && lng < 133
}

// @ts-ignore Deno 환경
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  // @ts-ignore Deno
  const clientId = Deno.env.get('NAVER_APIHUB_CLIENT_ID')
  // @ts-ignore Deno
  const clientSecret = Deno.env.get('NAVER_APIHUB_CLIENT_SECRET')
  if (!clientId || !clientSecret) return json({ error: 'not_configured' }, 500)

  // ── 우리 앱 사용자인지 확인한다 ────────────────────
  const token = req.headers.get('x-session-token')
  if (!token) return json({ error: 'unauthorized' }, 401)
  try {
    // @ts-ignore Deno
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data, error } = await supabase.rpc('verify_session', { p_token: token })
    if (error || !data) return json({ error: 'unauthorized' }, 401)
  } catch {
    return json({ error: 'unauthorized' }, 401)
  }

  let query = ''
  try {
    const body = await req.json()
    query = String(body?.query ?? '').trim()
  } catch {
    return json({ error: 'bad_request' }, 400)
  }
  if (!query) return json({ places: [] })

  const url = `${API_BASE}/search/v1/local?query=${encodeURIComponent(query)}`
    + `&display=${MAX_RESULTS}`

  let response: Response
  try {
    response = await fetch(url, {
      headers: {
        'X-NCP-APIGW-API-KEY-ID': clientId,
        'X-NCP-APIGW-API-KEY': clientSecret,
      },
    })
  } catch {
    return json({ error: 'upstream_unreachable' }, 502)
  }

  if (!response.ok) {
    // 상태만 돌려준다 — 남의 오류 본문을 그대로 흘리지 않는다
    return json({ error: 'upstream_error', status: response.status }, 502)
  }

  const payload = await response.json().catch(() => null)
  const items: unknown[] = Array.isArray(payload?.items) ? payload.items : []

  const places = items
    .map((raw) => {
      const item = raw as Record<string, unknown>
      const lat = toDegrees(item.mapy)
      const lng = toDegrees(item.mapx)
      if (!inKorea(lat, lng)) return null
      return {
        name: stripTags(String(item.title ?? '')),
        address: stripTags(String(item.roadAddress ?? item.address ?? '')),
        category: stripTags(String(item.category ?? '')),
        lat,
        lng,
      }
    })
    .filter((place): place is NonNullable<typeof place> => place !== null && Boolean(place.name))

  return json({ places })
})
