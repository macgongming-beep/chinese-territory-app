// 방문기록/세대속성 엑셀 왕복 — 순수 파싱 로직 안전망
// (데이터를 직접 수정하는 기능이므로 값 해석 규칙을 고정)
import { describe, it, expect } from 'vitest'
import { csvEscape, toCsv, parseCsv, normalizeDate, parseYN, isDeleteMark } from '../utils/roundTripCsv'

describe('parseCsv', () => {
  it('기본 행/열 분리', () => {
    expect(parseCsv('a,b,c\n1,2,3')).toEqual([['a', 'b', 'c'], ['1', '2', '3']])
  })
  it('따옴표 안 쉼표/줄바꿈/이스케이프 따옴표', () => {
    expect(parseCsv('"메모, 포함","줄\n바꿈","он said ""hi"""')).toEqual([['메모, 포함', '줄\n바꿈', 'он said "hi"']])
  })
  it('\\r\\n(엑셀 저장)과 BOM 허용', () => {
    expect(parseCsv('﻿a,b\r\n1,2\r\n')).toEqual([['a', 'b'], ['1', '2']])
  })
  it('빈 행/공백뿐인 행 제거', () => {
    expect(parseCsv('a,b\n\n , \n1,2')).toEqual([['a', 'b'], ['1', '2']])
  })
})

describe('toCsv / csvEscape (왕복)', () => {
  it('쉼표·따옴표·줄바꿈 값이 왕복 후 동일', () => {
    const rows = [['id', '메모'], ['1', '문 앞, "쪽지" 남김\n재방문']]
    expect(parseCsv(toCsv(rows))).toEqual(rows)
  })
  it('일반 값은 그대로', () => {
    expect(csvEscape('만남')).toBe('만남')
  })
})

describe('normalizeDate', () => {
  it('다양한 구분자/한자리 월일 → YYYY-MM-DD', () => {
    expect(normalizeDate('2026-7-5')).toBe('2026-07-05')
    expect(normalizeDate('2026.07.05')).toBe('2026-07-05')
    expect(normalizeDate('2026/7/15')).toBe('2026-07-15')
    expect(normalizeDate('2026-07-05 14:00')).toBe('2026-07-05') // 시간 붙어도 날짜만
  })
  it('형식 오류는 null', () => {
    expect(normalizeDate('7/5')).toBeNull()
    expect(normalizeDate('어제')).toBeNull()
    expect(normalizeDate('')).toBeNull()
  })
})

describe('parseYN', () => {
  it('참 값', () => {
    for (const v of ['Y', 'y', 'O', '1', '예', 'TRUE', 'yes']) expect(parseYN(v)).toBe(true)
  })
  it('거짓 값 (빈칸 포함)', () => {
    for (const v of ['', 'N', 'n', '0', '아니오', 'FALSE', 'no', '  ']) expect(parseYN(v)).toBe(false)
  })
  it('알 수 없는 값은 null (오류 처리 대상)', () => {
    expect(parseYN('중국인')).toBeNull()
    expect(parseYN('ㅇ')).toBeNull()
  })
})

describe('isDeleteMark', () => {
  it('빈칸 = 삭제 아님', () => {
    expect(isDeleteMark('')).toBe(false)
    expect(isDeleteMark('  ')).toBe(false)
  })
  it('X/O/Y/1/삭제 = 삭제', () => {
    for (const v of ['X', 'x', 'O', 'Y', '1', '삭제']) expect(isDeleteMark(v)).toBe(true)
  })
  it('알 수 없는 표시는 null (오류 처리 대상)', () => {
    expect(isDeleteMark('지우기')).toBeNull()
  })
})
