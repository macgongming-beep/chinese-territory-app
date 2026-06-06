import { describe, it, expect } from 'vitest'
import { sanitizeRichText, isRichTextEmpty } from './richText'

describe('sanitizeRichText', () => {
  it('굵게/밑줄/색 태그는 유지', () => {
    expect(sanitizeRichText('<b>굵게</b>')).toContain('<b>굵게</b>')
    expect(sanitizeRichText('<u>밑줄</u>')).toContain('<u>밑줄</u>')
    const colored = sanitizeRichText('<span style="color: rgb(255, 0, 0)">빨강</span>')
    expect(colored).toContain('빨강')
    expect(colored).toContain('color')
  })

  it('script 태그/이벤트 핸들러 제거', () => {
    expect(sanitizeRichText('<script>alert(1)</script>안녕')).not.toContain('script')
    expect(sanitizeRichText('<b onclick="evil()">x</b>')).not.toContain('onclick')
  })

  it('링크/이미지 제거 (FORBID_TAGS)', () => {
    expect(sanitizeRichText('<a href="http://x">링크</a>')).not.toContain('<a')
    expect(sanitizeRichText('<img src=x onerror=alert(1)>')).not.toContain('<img')
  })

  it('순수 텍스트는 그대로', () => {
    expect(sanitizeRichText('그냥 텍스트')).toBe('그냥 텍스트')
  })

  it('null/undefined 안전', () => {
    expect(sanitizeRichText('')).toBe('')
  })
})

describe('isRichTextEmpty', () => {
  it('빈 값/태그만 → true', () => {
    expect(isRichTextEmpty('')).toBe(true)
    expect(isRichTextEmpty(null)).toBe(true)
    expect(isRichTextEmpty('<div><br></div>')).toBe(true)
    expect(isRichTextEmpty('&nbsp;')).toBe(true)
  })
  it('텍스트 있으면 false', () => {
    expect(isRichTextEmpty('<b>내용</b>')).toBe(false)
    expect(isRichTextEmpty('안녕')).toBe(false)
  })
})
