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
  if (text.includes('한국')) return '대상외'
  // 정기방문은 result값 아님 → 만남으로 처리 (regular_visits로 별도 등록)
  if (text.includes('정기') || text.includes('재방')) return '만남'
  return '미방문'
}

export function isInvitationLeft(value: string): boolean {
  return value.trim().includes('초대장') || value.trim().includes('초대')
}

export function looksTruthy(value: string): boolean {
  return /^(true|yes|y|1|중국인|중국|정기|재방|있음|ㅇ|예)$/i.test(value.trim())
}

export function parseCsvDate(value: string): string | null {
  const cleaned = value.trim().replace(/[./]/g, '-')
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) {
    const d = new Date(cleaned + 'T12:00:00+09:00')
    return isNaN(d.getTime()) ? null : d.toISOString()
  }
  return null
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
    visitHistories?: CsvVisitHistory[]
  },
): CsvUnitImport[] {
  const unitNumbers = splitUnitNumbers(unitValue)
  const numbers = unitNumbers.length > 0 ? unitNumbers : ['1층']
  return numbers.map((number) => ({
    number,
    status: input.status,
    isChinese: input.isChinese || Boolean(input.regularVisitor) || input.status === '만남' || input.status === '부재',
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
      '중국인', '', '박진호', '2024-01-15', '정기방문 등록',
      '2024-03-10', '만남', '홍길동', '오후', '친절하게 받아줌'],
    ['처인구 고림동 1', '처인구', '고림동', '경기도 용인시 처인구 고진로 45', '동아빌라', '주택', '301호', '만남',
      '중국인', '', '박진호', '2024-01-15', '',
      '2024-04-05', '부재', '홍길동', '오전', ''],
    ['처인구 고림동 1', '처인구', '고림동', '경기도 용인시 처인구 경안천로 232', '감자탕형제들', '상가', '1층', '부재',
      '대상외', '', '', '', '',
      '', '', '', '', ''],
    ['', '처인구', '김량장동', '경기도 용인시 처인구 금령로 108-1', '신나는가게', '상가', '1층', '미방문',
      '중국인', '방문거절 이력있음', '', '', '',
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
