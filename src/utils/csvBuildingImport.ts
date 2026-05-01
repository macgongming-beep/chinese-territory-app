/**
 * CSV 건물 데이터 import 관련 타입 + 순수 유틸리티 함수
 * DesktopTerritory 의 CSV 파싱 로직을 분리한 파일
 */
import type { Building, UnitStatus } from '../types'

// ── 타입 ────────────────────────────────────────────────────────

export type CsvUnitImport = {
  number: string
  status: UnitStatus
  isChinese: boolean
  isRegularVisit: boolean
  regularVisitor?: string
  memo?: string
}

export type CsvBuildingImport = {
  cardId: number
  name: string
  address: string
  type: Building['type']
  lat: number
  lng: number
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
  if (text.includes('만남') || text.includes('초대장')) return '만남'
  if (text.includes('부재') || text.includes('삭제')) return '부재'
  if (text.includes('한국')) return '한국인'
  if (text.includes('거절')) return '거절'
  if (text.includes('확인') || text.includes('재확인')) return '확인필요'
  return '미방문'
}

export function looksTruthy(value: string): boolean {
  return /^(true|yes|y|1|중국인|중국|정기|재방|있음|ㅇ|예)$/i.test(value.trim())
}

export function createCsvUnits(
  unitValue: string,
  input: {
    status: UnitStatus
    isChinese: boolean
    regularVisitor: string
    memo: string
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
    memo: input.memo || undefined,
  }))
}

function csvCell(value: string | number): string {
  const text = String(value)
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function downloadCsvExample(): void {
  const headers = ['카드명', '지역', '동', '카드번호', '주소', '건물명', '유형', '호수', '상태', '중국인', '정기방문자', '메모', '위도', '경도', '원본역번']
  const data = [
    ['처인구 고림동 1', '처인구', '고림동', '1', '경기도 용인시 처인구 경안천로 232', '감자탕형제들', '상가', '1층', '부재', '중국인', '', '중국인 없음', '', '', '1'],
    ['처인구 고림동 1', '처인구', '고림동', '1', '경기도 용인시 처인구 고진로 45', '동아빌라 301호', '주택', '301호', '만남', '중국인', '박진호', '정기방문 등록', '', '', '5'],
    ['', '처인구', '김량장동', '1', '경기도 용인시 처인구 금령로 108-1', '김밥천국', '상가', '1층', '미방문', '', '', '', '', '', '17'],
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
