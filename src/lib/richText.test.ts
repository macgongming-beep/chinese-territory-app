// 제안 본문 정제. 관리자가 쓴 HTML 을 회중 전체가 보므로 여기가 뚫리면 XSS 다.
import { describe, test, expect } from 'vitest'
import { sanitizeRichText, isSafeHref, isRichTextEmpty } from './richText'

describe('isSafeHref', () => {
  test('http(s) 만 연다', () => {
    expect(isSafeHref('https://www.jw.org/ko/')).toBe(true)
    expect(isSafeHref('http://example.com')).toBe(true)
  })
  test('공격 통로는 막는다', () => {
    for (const bad of ['javascript:alert(1)', 'data:text/html,<script>', 'vbscript:x', '  javascript:x', '/relative', '']) {
      expect(isSafeHref(bad)).toBe(false)
    }
  })
})

describe('sanitizeRichText — 링크', () => {
  test('맨 주소를 누를 수 있게 바꾼다', () => {
    const out = sanitizeRichText('영상 보기 https://www.jw.org/ko/ 여기서')
    expect(out).toContain('<a href="https://www.jw.org/ko/"')
    expect(out).toContain('영상 보기')
    expect(out).toContain('여기서')
  })

  test('새 창으로 열고 rel 을 붙인다', () => {
    // rel 이 없으면 열린 쪽이 원래 창을 조작할 수 있다
    const out = sanitizeRichText('https://www.jw.org/ko/')
    expect(out).toContain('target="_blank"')
    expect(out).toContain('rel="noopener noreferrer"')
  })

  test('직접 쓴 링크도 살린다', () => {
    const out = sanitizeRichText('<a href="https://www.jw.org/ko/">영상</a>')
    expect(out).toContain('href="https://www.jw.org/ko/"')
    expect(out).toContain('>영상<')
  })

  test('이미 링크인 글자는 두 번 감싸지 않는다', () => {
    const out = sanitizeRichText('<a href="https://www.jw.org/ko/">https://www.jw.org/ko/</a>')
    expect((out.match(/<a /g) ?? []).length).toBe(1)
  })

  test('여러 개도 각각 바꾼다', () => {
    const out = sanitizeRichText('https://a.example.com 과 https://b.example.com')
    expect((out.match(/<a /g) ?? []).length).toBe(2)
  })

  test('문장 끝 마침표는 주소에 안 넣는다', () => {
    const out = sanitizeRichText('여기다 https://www.jw.org/ko/)')
    expect(out).toContain('href="https://www.jw.org/ko/"')
  })
})

describe('sanitizeRichText — 막아야 하는 것', () => {
  test('javascript: 링크는 주소를 벗기고 글자만 남긴다', () => {
    const out = sanitizeRichText('<a href="javascript:alert(1)">눌러</a>')
    expect(out).not.toContain('javascript')
    expect(out).toContain('눌러')      // 내용은 사라지지 않는다
  })

  test('script 는 통째로 없앤다', () => {
    const out = sanitizeRichText('앞<script>alert(1)</script>뒤')
    expect(out).not.toContain('script')
    expect(out).toContain('앞')
  })

  test('onerror 같은 이벤트 속성은 없앤다', () => {
    const out = sanitizeRichText('<div onerror="alert(1)">x</div>')
    expect(out).not.toContain('onerror')
  })

  test('img · iframe 은 없앤다', () => {
    expect(sanitizeRichText('<img src=x onerror=alert(1)>')).not.toContain('img')
    expect(sanitizeRichText('<iframe src="https://x.com"></iframe>')).not.toContain('iframe')
  })

  test('굵게·밑줄·색은 그대로 둔다', () => {
    const out = sanitizeRichText('<b>굵게</b> <u>밑줄</u> <span style="color:red">빨강</span>')
    expect(out).toContain('<b>굵게</b>')
    expect(out).toContain('<u>밑줄</u>')
    expect(out).toContain('빨강')
  })
})

describe('isRichTextEmpty', () => {
  test('태그만 있으면 비어 있다', () => {
    expect(isRichTextEmpty('<p><br></p>')).toBe(true)
    expect(isRichTextEmpty('')).toBe(true)
    expect(isRichTextEmpty(null)).toBe(true)
  })
  test('글자가 있으면 안 비어 있다', () => {
    expect(isRichTextEmpty('<p>가</p>')).toBe(false)
  })
})
