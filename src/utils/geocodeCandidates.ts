// 주소 하나로 지오코딩 후보 여러 개를 만든다.
//
// 왜: 사람이 적은 주소는 지도가 못 알아듣는 모양이 많다.
//   · 시/도가 빠짐 ('처인구 유림로147번길 55-2')
//   · 도로명 앞에 동이 붙음 ('유방동 유림로147번길')
//   · 뒤에 건물 이름이 붙음 ('유림로147번길 55-2 엠제이오사옥')  ← 실제로 여기서 막혔다
// 하나씩 시도해 처음 맞는 것을 쓴다.
import { getRegions } from '../lib/regions'
import { shortAddress } from './shortAddress'

export function getGeocodeCandidates(address: string): string[] {
  const normalized = (address ?? '').replace(/\s+/g, ' ').trim()
  if (!normalized) return []

  // 구 → 시. 지역 목록에서 만든다 — 지역을 늘려도 이 매핑만 옛 값으로 남지 않게
  const guToCity: Record<string, string> = Object.fromEntries(
    getRegions().filter((r) => r.city).map((r) => [r.name, r.city]),
  )

  const tokens = normalized.split(' ')
  const isDongToken = (t: string) => /동$/.test(t)
  const isRoadToken = (t: string) => /(로|길)/.test(t)
  const withoutDongBeforeRoad = tokens
    .filter((t, i) => !(isDongToken(t) && tokens.slice(i + 1).some(isRoadToken)))
    .join(' ')
  const withoutGyeonggiDo = normalized.replace(/^경기도\s+/, '경기 ')
  const withoutGyeonggiDoAndDong = withoutDongBeforeRoad.replace(/^경기도\s+/, '경기 ')

  // 도로명+번지까지만 남긴 것. 뒤에 붙은 건물 이름을 떼는 데 쓴다
  const roadOnly = shortAddress(normalized)

  const hasCity = /(시|도)\s/.test(normalized) || /^(경기|서울)/.test(normalized)
  const guToken = tokens.find((t) => t in guToCity)
  const cityQualified: string[] = []
  if (!hasCity && guToken) {
    const city = guToCity[guToken]
    cityQualified.push(`경기도 ${city} ${normalized}`, `경기 ${city} ${normalized}`)
  } else if (!hasCity && !guToken) {
    cityQualified.push(`경기도 용인시 ${normalized}`)
  }

  // 도로명만 남긴 것도 시를 붙여 시도한다 (그대로는 어디 도로인지 모른다)
  const roadWithCity: string[] = []
  if (roadOnly && roadOnly !== normalized) {
    const city = guToken ? guToCity[guToken] : '용인시'
    roadWithCity.push(`경기도 ${city} ${roadOnly}`, `경기 ${city} ${roadOnly}`, roadOnly)
  }

  return Array.from(new Set([
    ...cityQualified,
    normalized,
    withoutDongBeforeRoad,
    withoutGyeonggiDo,
    withoutGyeonggiDoAndDong,
    ...roadWithCity,
  ].filter(Boolean)))
}
