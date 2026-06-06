import { describe, it, expect } from 'vitest'
import { matchesName } from './koreanSearch'

describe('matchesName', () => {
  it('빈 쿼리는 모두 통과', () => {
    expect(matchesName('김민준', '')).toBe(true)
    expect(matchesName('김민준', '   ')).toBe(true)
  })

  it('이름 부분일치', () => {
    expect(matchesName('김민준', '민준')).toBe(true)
    expect(matchesName('김민준', '김')).toBe(true)
    expect(matchesName('김민준', '준')).toBe(true)
    expect(matchesName('김민준', '영희')).toBe(false)
  })

  it('초성 검색 (연속)', () => {
    expect(matchesName('김민준', 'ㄱㅁㅈ')).toBe(true)
    expect(matchesName('김민준', 'ㅁㅈ')).toBe(true)
    expect(matchesName('김민준', 'ㄱㅁ')).toBe(true)
  })

  it('초성 불일치', () => {
    expect(matchesName('김민준', 'ㅂㅅ')).toBe(false)
    expect(matchesName('김민준', 'ㅈㅁ')).toBe(false) // 순서 다름
  })

  it('초성과 완성형 혼용 쿼리는 완성형 부분일치만', () => {
    // 'ㄱ민' 같은 혼용은 초성 쿼리도 아니고 부분일치도 아님
    expect(matchesName('김민준', 'ㄱ민')).toBe(false)
  })

  it('공백/대소문자 정규화', () => {
    expect(matchesName('John Kim', 'johnkim')).toBe(true)
    expect(matchesName('김 민준', '김민준')).toBe(true)
  })

  it('받침 있는 초성도 정확히 추출', () => {
    // 박상철 → ㅂㅅㅊ
    expect(matchesName('박상철', 'ㅂㅅㅊ')).toBe(true)
    expect(matchesName('박상철', 'ㅂㅊ')).toBe(false) // 'ㅂㅊ'는 연속 아님
  })
})
