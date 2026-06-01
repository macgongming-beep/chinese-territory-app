// 호수 일괄 생성 — PC(AddUnitRow)·모바일(MobileMap) 공유
// 층 범위 + 층당 호수 + 시작 호번호 (+ 지하) → 호수 문자열 배열

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
