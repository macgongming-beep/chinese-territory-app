// 전화 조사 시트 업로드가 값을 제대로 읽는지 지키는 테스트.
//
// 이 판정들은 화면이 아니라 CSV 안의 글자에 달려 있어, 조용히 어긋나면
// "올렸는데 아무 일도 안 일어남" 또는 "엉뚱하게 들어감" 으로 나타난다.
import { describe, it, expect } from 'vitest'
import { looksTruthy, normalizeUnitStatus, parseCsvDate } from './csvBuildingImport'

describe('전화 조사 시트 값 읽기', () => {
  it("중국어 '있음' 은 참으로 읽는다", () => {
    expect(looksTruthy('있음')).toBe(true)
    expect(looksTruthy('Y')).toBe(true)
    expect(looksTruthy('예')).toBe(true)
  })

  it("중국어 '없음'·'미확인' 은 참이 아니다 (등록되면 안 되는 곳)", () => {
    expect(looksTruthy('없음')).toBe(false)
    expect(looksTruthy('미확인')).toBe(false)
  })

  it('수집상태 값이 방문 결과로 새어 들어가지 않는다', () => {
    // 시트의 수집상태(신규/유지/정보변경)는 방문 결과가 아니다.
    // 칸 이름을 '상태' 로 두면 이 값들이 방문 결과로 읽히므로
    // 규격서에서 '수집상태' 로 쓰게 했다. 만약 들어오더라도 미방문이어야 한다.
    expect(normalizeUnitStatus('신규')).toBe('미방문')
    expect(normalizeUnitStatus('유지')).toBe('미방문')
    expect(normalizeUnitStatus('정보변경')).toBe('미방문')
  })

  it('방문 결과는 그대로 읽는다 (일반 CSV 는 영향 없음)', () => {
    expect(normalizeUnitStatus('만남')).toBe('만남')
    expect(normalizeUnitStatus('부재')).toBe('부재')
    expect(normalizeUnitStatus('대상외')).toBe('대상외')
  })

  it("'한국' 이 들어간 상호를 대상외로 오독하지 않는지 — 알려진 한계", () => {
    // normalizeUnitStatus 는 '한국' 을 대상외로 본다. 방문 결과 칸에는 맞지만
    // 상호명이 이 함수를 타면 '한국순대' 가 대상외가 된다.
    // 지금은 상태 칸에만 쓰이므로 문제없다. 상호명에 쓰지 말 것.
    expect(normalizeUnitStatus('한국순대')).toBe('대상외')
  })
})

describe('확인일 읽기 — 엑셀이 내보내는 여러 형태', () => {
  const day = (iso: string | null) => (iso ? iso.slice(0, 10) : null)

  it('0 을 붙이지 않아도 읽는다 (엑셀 기본 표시가 이렇다)', () => {
    expect(day(parseCsvDate('2026.8.13'))).toBe('2026-08-13')
    expect(day(parseCsvDate('2026/8/13'))).toBe('2026-08-13')
    expect(day(parseCsvDate('2026-8-13'))).toBe('2026-08-13')
  })

  it('0 을 붙인 형태도 그대로', () => {
    expect(day(parseCsvDate('2026-08-13'))).toBe('2026-08-13')
  })

  it('엑셀이 숫자로 내보낸 날짜도 읽는다', () => {
    // 46247 = 2026-08-13 (엑셀 기준일 1899-12-30)
    expect(day(parseCsvDate('46247'))).toBe('2026-08-13')
  })

  it('한글 날짜도 읽는다', () => {
    expect(day(parseCsvDate('2026년 8월 13일'))).toBe('2026-08-13')
  })

  it('날짜가 아니면 null (엉뚱한 값이 날짜로 둔갑하지 않게)', () => {
    expect(parseCsvDate('')).toBeNull()
    expect(parseCsvDate('미확인')).toBeNull()
    expect(parseCsvDate('2026')).toBeNull()
  })
})
