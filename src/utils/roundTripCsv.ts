// 방문기록/세대속성 엑셀 왕복 — 순수 CSV/값 파싱 유틸 (DataRoundTrip 에서 사용)
// ── CSV 유틸 ────────────────────────────────────────────────
export function csvEscape(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
}

export function toCsv(rows: string[][]): string {
  return rows.map((r) => r.map(csvEscape).join(',')).join('\n')
}

// 따옴표 인식 CSV 파서 (엑셀 저장 파일 호환, \r\n 허용)
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cur = ''
  let inQuotes = false
  const src = text.replace(/^\uFEFF/, '')
  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') { cur += '"'; i++ } else inQuotes = false
      } else cur += c
    } else if (c === '"') {
      inQuotes = true
    } else if (c === ',') {
      row.push(cur); cur = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++
      row.push(cur); cur = ''
      rows.push(row); row = []
    } else cur += c
  }
  if (cur !== '' || row.length > 0) { row.push(cur); rows.push(row) }
  // 완전 빈 행 제거
  return rows.filter((r) => r.some((c) => c.trim() !== ''))
}

export function downloadCsvFile(filename: string, csv: string) {
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// ── 값 파싱/검증 ────────────────────────────────────────────
export const VISIT_RESULTS = new Set(['만남', '부재', '대상외', '거절', '확인필요'])
export const TIME_SLOTS = new Set(['오전', '오후', '저녁'])

// 2026-7-5 / 2026.07.05 / 2026/7/5 → 2026-07-05
export function normalizeDate(v: string): string | null {
  const m = v.trim().match(/^(\d{4})[.\-/]\s?(\d{1,2})[.\-/]\s?(\d{1,2})/)
  if (!m) return null
  return `${m[1]}-${String(Number(m[2])).padStart(2, '0')}-${String(Number(m[3])).padStart(2, '0')}`
}

// Y/N 파싱: 알 수 없는 값이면 null (오류 처리)
export function parseYN(v: string): boolean | null {
  const t = v.trim().toUpperCase()
  if (t === '' || t === 'N' || t === 'NO' || t === 'FALSE' || t === '0' || t === '아니오') return false
  if (t === 'Y' || t === 'O' || t === 'YES' || t === 'TRUE' || t === '1' || t === '예') return true
  return null
}

export function isDeleteMark(v: string): boolean | null {
  const t = v.trim().toUpperCase()
  if (t === '') return false
  if (t === 'X' || t === 'O' || t === 'Y' || t === '1' || t === '삭제') return true
  return null // 알 수 없는 표시 → 오류
}

