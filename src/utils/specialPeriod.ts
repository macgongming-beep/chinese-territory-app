// 특별봉사 기간 판정 — 앱 전반에서 복붙되던 날짜 범위 판정 로직을 단일화.
//   '2026-06-06' 같은 YYYY-MM-DD 문자열 비교 (start <= date <= end, 양끝 포함)

import type { SpecialPeriod } from '../types'

// 주어진 날짜가 속한 특별봉사 기간을 반환 (없으면 null)
export function findActivePeriod(
  periods: SpecialPeriod[] | null | undefined,
  dateStr: string,
): SpecialPeriod | null {
  if (!periods) return null
  return periods.find((p) => dateStr >= p.startDate && dateStr <= p.endDate) ?? null
}

// 활성 기간의 id 만 필요할 때
export function findActivePeriodId(
  periods: SpecialPeriod[] | null | undefined,
  dateStr: string,
): number | null {
  return findActivePeriod(periods, dateStr)?.id ?? null
}
