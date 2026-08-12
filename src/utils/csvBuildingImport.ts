/**
 * CSV 건물 데이터 import 관련 타입 + 순수 유틸리티 함수
 * DesktopTerritory 의 CSV 파싱 로직을 분리한 파일
 */
import type { Building, UnitStatus } from '../types'

// ── 타입 ────────────────────────────────────────────────────────

export type CsvVisitHistory = {
  visitedAt: string   // ISO datetime string
  result: string      // UnitStatus value
  visitor: string
  timeSlot?: string
  memo?: string
}

export type CsvUnitImport = {
  number: string
  status: UnitStatus
  isChinese: boolean
  /** 이 세대가 식당인가 (업종과 별개 — 상가 중 식당만 true) */
  isRestaurant: boolean
  /** 네이버 업체ID — 다음 수집 때 이 세대를 정확히 다시 찾는 열쇠 */
  naverPlaceId?: string
  isRegularVisit: boolean
  regularVisitor?: string
  regularVisitorStartDate?: string
  memo?: string
  visitHistories: CsvVisitHistory[]
}

export type CsvBuildingImport = {
  cardId: number
  name: string
  address: string
  type: Building['type']
  lat: number
  lng: number
  warning?: string
  units: CsvUnitImport[]
}

export type CsvPreviewRow = CsvBuildingImport & {
  rowNumber: number
  cardName: string
}

export type CsvSkippedRow = {
  rowNumber: number
  reason: string
  hint: string
  address?: string
  rawRow?: string[]
}

// ── 유틸리티 함수 ────────────────────────────────────────────────

export function normalizeCsvKey(value: string) {
  return value.trim().toLowerCase().replace(/[\s_-]/g, '')
}

export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let current = ''
  let row: string[] = []
  let inQuotes = false

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]
    const next = text[i + 1]

    if (char === '"' && inQuotes && next === '"') {
      current += '"'
      i += 1
      continue
    }
    if (char === '"') {
      inQuotes = !inQuotes
      continue
    }
    if (char === ',' && !inQuotes) {
      row.push(current.trim())
      current = ''
      continue
    }
    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') i += 1
      row.push(current.trim())
      if (row.some(Boolean)) rows.push(row)
      row = []
      current = ''
      continue
    }
    current += char
  }

  row.push(current.trim())
  if (row.some(Boolean)) rows.push(row)
  return rows
}

export function splitUnitNumbers(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(/[|;/,\n]+/)
        .map((unit) => unit.trim())
        .filter(Boolean),
    ),
  )
}

export function normalizeUnitStatus(value: string): UnitStatus {
  const text = value.trim()
  if (text.includes('만남')) return '만남'
  if (text.includes('초대장') || text.includes('초대')) return '만남'   // 초대장 → 만남 (invitation_left는 별도)
  if (text.includes('부재')) return '부재'
  if (text.includes('대상외') || text.includes('한국')) return '대상외'
  // 정기방문은 result값 아님 → 만남으로 처리 (regular_visits로 별도 등록)
  if (text.includes('정기') || text.includes('재방')) return '만남'
  return '미방문'
}

export function isInvitationLeft(value: string): boolean {
  return value.trim().includes('초대장') || value.trim().includes('초대')
}

export function looksTruthy(value: string): boolean {
  return /^(true|yes|y|1|중국어|중국인|중국|정기|재방|있음|ㅇ|예)$/i.test(value.trim())
}

/**
 * 엑셀에서 온 날짜를 너그럽게 읽는다.
 *
 * 사람에게 "0 을 붙여 적으세요" 라고 시키면 언젠가 까먹고, 그러면 날짜가
 * 조용히 사라진다 (오류도 안 난다). 그래서 흔한 형태를 모두 받아 준다.
 *   2026-08-13 · 2026.8.13 · 2026/8/13 · 2026년 8월 13일
 *   46247      ← 엑셀이 날짜를 숫자로 내보낸 경우 (1899-12-30 기준 일련번호)
 */
export function parseCsvDate(value: string): string | null {
  const raw = value.trim()
  if (!raw) return null

  // 엑셀 날짜 일련번호 (예: 46247 = 2026-08-13)
  if (/^\d{5}$/.test(raw)) {
    const serial = Number(raw)
    // 1900 년 윤년 버그 때문에 엑셀의 기준일은 1899-12-30 이다
    const ms = Date.UTC(1899, 11, 30) + serial * 86400000
    const d = new Date(ms + 12 * 3600000)
    return isNaN(d.getTime()) ? null : d.toISOString()
  }

  const cleaned = raw
    .replace(/년|월/g, '-')
    .replace(/일/g, '')
    .replace(/[./\s]/g, '-')
    .replace(/-+/g, '-')
    .replace(/-$/, '')
  const m = cleaned.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (!m) return null
  const [, y, mo, day] = m
  const iso = `${y}-${mo.padStart(2, '0')}-${day.padStart(2, '0')}`
  const d = new Date(iso + 'T12:00:00+09:00')
  return isNaN(d.getTime()) ? null : d.toISOString()
}

export function normalizeTimeSlot(value: string): string {
  if (!value) return '오전'
  if (value.includes('오후') || /pm/i.test(value)) return '오후'
  if (value.includes('저녁') || value.includes('밤') || /eve/i.test(value)) return '저녁'
  return '오전'
}

export function normalizeWarning(value: string): string | undefined {
  const v = value.trim()
  if (!v) return undefined
  if (looksTruthy(v)) return '방문금지'
  return v
}

export function createCsvUnits(
  unitValue: string,
  input: {
    status: UnitStatus
    isChinese: boolean
    regularVisitor: string
    regularVisitorStartDate?: string
    memo: string
    isRestaurant?: boolean
    naverPlaceId?: string
    visitHistories?: CsvVisitHistory[]
  },
): CsvUnitImport[] {
  const unitNumbers = splitUnitNumbers(unitValue)
  const numbers = unitNumbers.length > 0 ? unitNumbers : ['1층']
  return numbers.map((number) => ({
    number,
    status: input.status,
    isChinese: input.isChinese || Boolean(input.regularVisitor) || input.status === '만남' || input.status === '부재',
    isRestaurant: input.isRestaurant ?? false,
    naverPlaceId: input.naverPlaceId,
    isRegularVisit: Boolean(input.regularVisitor),
    regularVisitor: input.regularVisitor || undefined,
    regularVisitorStartDate: input.regularVisitorStartDate || undefined,
    memo: input.memo || undefined,
    visitHistories: input.visitHistories ?? [],
  }))
}

function csvCell(value: string | number): string {
  const text = String(value)
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function downloadCsvExample(): void {
  const headers = [
    '카드명', '지역', '동', '주소', '건물명', '유형', '호수', '상태',
    '구분', '방문금지', '정기방문자', '정기방문시작일', '메모',
    '방문일자', '방문결과', '방문자', '시간대', '방문메모',
  ]
  const data = [
    ['처인구 고림동 1', '처인구', '고림동', '경기도 용인시 처인구 고진로 45', '동아빌라', '주택', '301호', '만남',
      '중국어', '', '박진호', '2024-01-15', '정기방문 등록',
      '2024-03-10', '만남', '홍길동', '오후', '친절하게 받아줌'],
    ['처인구 고림동 1', '처인구', '고림동', '경기도 용인시 처인구 고진로 45', '동아빌라', '주택', '301호', '만남',
      '중국어', '', '박진호', '2024-01-15', '',
      '2024-04-05', '부재', '홍길동', '오전', ''],
    ['처인구 고림동 1', '처인구', '고림동', '경기도 용인시 처인구 경안천로 232', '감자탕형제들', '상가', '1층', '부재',
      '대상외', '', '', '', '',
      '', '', '', '', ''],
    ['', '처인구', '김량장동', '경기도 용인시 처인구 금령로 108-1', '신나는가게', '상가', '1층', '미방문',
      '중국어', '방문거절 이력있음', '', '', '',
      '2024-02-20', '거절', '김철수', '오전', '다시 오지 말라고 함'],
  ]
  const csvContent = [headers, ...data].map((row) => row.map(csvCell).join(',')).join('\n')
  const blob = new Blob(['﻿' + csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.setAttribute('href', url)
  link.setAttribute('download', 'building_import_example.csv')
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
