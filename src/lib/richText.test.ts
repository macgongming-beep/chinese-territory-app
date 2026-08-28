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

describe('편집기가 만든 링크가 살아남나', () => {
  test('createLink 가 만드는 모양 그대로 통과한다', () => {
    // document.execCommand('createLink') 는 이렇게 만든다
    const out = sanitizeRichText('<a href="https://www.jw.org/ko/">기사 읽기</a>')
    expect(out).toContain('href="https://www.jw.org/ko/"')
    expect(out).toContain('>기사 읽기<')
    expect(out).toContain('target="_blank"')
    expect(out).toContain('rel="noopener noreferrer"')
  })

  test('링크 안의 서식도 살아남는다', () => {
    const out = sanitizeRichText('<a href="https://a.example.com"><b>굵은 링크</b></a>')
    expect(out).toContain('href="https://a.example.com"')
    expect(out).toContain('<b>굵은 링크</b>')
  })

  test('색과 크기를 준 글자에 링크를 걸어도 된다', () => {
    const out = sanitizeRichText('<span style="color:red"><a href="https://a.example.com">빨간 링크</a></span>')
    expect(out).toContain('href="https://a.example.com"')
    expect(out).toContain('빨간 링크')
  })
})

describe('인용문 (들여쓰기 + 왼쪽 줄)', () => {
  test('blockquote 가 살아남는다', () => {
    const out = sanitizeRichText('<blockquote>"왜 종교에 관심이 없으세요?"</blockquote>')
    expect(out).toContain('<blockquote>')
    expect(out).toContain('왜 종교에 관심이 없으세요?')
  })

  test('인용문 안의 서식과 링크도 살아남는다', () => {
    const out = sanitizeRichText('<blockquote><b>굵게</b> <a href="https://a.example.com">링크</a></blockquote>')
    expect(out).toContain('<blockquote>')
    expect(out).toContain('<b>굵게</b>')
    expect(out).toContain('href="https://a.example.com"')
  })

  test('인용문 안의 위험한 것은 여전히 막힌다', () => {
    const out = sanitizeRichText('<blockquote onclick="alert(1)"><script>x</script>글자</blockquote>')
    expect(out).not.toContain('onclick')
    expect(out).not.toContain('script')
    expect(out).toContain('글자')
  })

  test('회색 글자도 살아남는다', () => {
    const out = sanitizeRichText('<span style="color: rgb(107, 114, 128)">회색</span>')
    expect(out).toContain('회색')
    expect(out).toContain('color')
  })
})

describe('문서에서 붙여넣은 서식이 살아남나', () => {
  test('⚠ 번호 목록이 살아남는다 — 예전엔 통째로 잘려 한 문단으로 뭉쳤다', () => {
    const pasted = '<h3>三个主要建议</h3><ol><li>看法要积极。</li><li>聆听与理解。</li><li>分享适合对方的资料。</li></ol>'
    const out = sanitizeRichText(pasted)
    expect(out).toContain('<ol>')
    expect((out.match(/<li>/g) ?? []).length).toBe(3)
    expect(out).toContain('<h3>')
  })

  test('글머리 목록도 살아남는다', () => {
    const out = sanitizeRichText('<ul><li>가</li><li>나</li></ul>')
    expect(out).toContain('<ul>')
    expect((out.match(/<li>/g) ?? []).length).toBe(2)
  })

  test('중간부터 시작하는 번호(start)도 지킨다', () => {
    const out = sanitizeRichText('<ol start="3"><li>셋째</li></ol>')
    expect(out).toContain('start="3"')
  })

  test('소제목 h1~h4 가 살아남는다', () => {
    for (const h of ['h1', 'h2', 'h3', 'h4']) {
      expect(sanitizeRichText(`<${h}>제목</${h}>`)).toContain(`<${h}>`)
    }
  })

  test('목록 안의 링크와 서식도 살아남는다', () => {
    const out = sanitizeRichText('<ol><li><b>굵게</b> <a href="https://a.example.com">링크</a></li></ol>')
    expect(out).toContain('<li>')
    expect(out).toContain('<b>굵게</b>')
    expect(out).toContain('href="https://a.example.com"')
  })

  test('목록 안에 위험한 것을 숨겨도 막힌다', () => {
    const out = sanitizeRichText('<ol><li onclick="alert(1)"><script>x</script>글자</li></ol>')
    expect(out).not.toContain('onclick')
    expect(out).not.toContain('script')
    expect(out).toContain('글자')
  })
})

describe('구분선', () => {
  test('hr 이 살아남는다', () => {
    expect(sanitizeRichText('앞<hr>뒤')).toContain('<hr>')
  })
  test('편집기가 만드는 모양도 살아남는다', () => {
    // execCommand('insertHorizontalRule') 은 <hr> 를 div 안에 넣기도 한다
    const out = sanitizeRichText('<div>앞</div><hr><div>뒤</div>')
    expect(out).toContain('<hr>')
    expect(out).toContain('앞')
    expect(out).toContain('뒤')
  })
})
