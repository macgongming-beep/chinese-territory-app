// 호수 일괄 생성 — PC(AddUnitRow)·모바일(MobileMap) 공유
// 층 범위 + 층당 호수 + 시작 호번호 (+ 지하) → 호수 문자열 배열

import { normalizeUnitNumber } from './duplicateBuildingMerge'

export type BulkUnitOptions = {
  startFloor: number
  endFloor: number
  unitsPerFloor: number
  startUnit: number
  hasBasement?: boolean
  basementFloors?: number
}

export function generateBulkUnits(opts: BulkUnitOptions): string[] {
  const list: string[] = []
  const upf = Math.max(1, opts.unitsPerFloor)
  const su = Math.max(1, opts.startUnit)

  // 지하 (B층 → B101, B102...) — 깊은 층부터
  if (opts.hasBasement) {
    const bf = Math.max(1, opts.basementFloors ?? 1)
    for (let f = bf; f >= 1; f--) {
      for (let u = su; u < su + upf; u++) {
        list.push(`B${f}${String(u).padStart(2, '0')}`)
      }
    }
  }

  // 지상
  const sf = Math.max(1, opts.startFloor)
  const ef = Math.max(sf, opts.endFloor)
  for (let f = sf; f <= ef; f++) {
    for (let u = su; u < su + upf; u++) {
      list.push(`${f}${String(u).padStart(2, '0')}`)
    }
  }
  return list
}

/**
 * 이미 있는 호수와 입력 안의 중복을 표기 차이까지 포함해 제외한다.
 * 화면의 미리보기용 판정이며, 저장 시에는 서버가 같은 판정을 다시 한다.
 */
export function filterNewUnitNumbers(candidates: string[], existingNumbers: Iterable<string>) {
  const seen = new Set(Array.from(existingNumbers, normalizeUnitNumber))
  const newNumbers: string[] = []
  const skippedNumbers: string[] = []

  for (const raw of candidates) {
    const number = raw.trim()
    const key = normalizeUnitNumber(number)
    if (!key || seen.has(key)) {
      if (number) skippedNumbers.push(number)
      continue
    }
    seen.add(key)
    newNumbers.push(number)
  }

  return { newNumbers, skippedNumbers }
}
