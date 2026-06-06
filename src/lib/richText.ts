// 자유양식 제안 본문의 리치텍스트(굵게/밑줄/색) 정제.
// 관리자가 작성한 HTML 을 다른 사용자에게 보여주므로 XSS 방지를 위해
// DOMPurify 로 허용 태그/속성만 남긴다.

import DOMPurify from 'dompurify'

// 굵게(b/strong), 기울임(i/em), 밑줄(u), 색/span, 줄바꿈(br/div/p), 글자색(font)
const ALLOWED_TAGS = ['b', 'strong', 'i', 'em', 'u', 'span', 'br', 'div', 'p', 'font']
const ALLOWED_ATTR = ['style', 'color']

export function sanitizeRichText(html: string): string {
  return DOMPurify.sanitize(html ?? '', {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    // 링크/이미지/스크립트 등은 통째로 제거
    FORBID_TAGS: ['a', 'img', 'script', 'style', 'iframe'],
  })
}

// 빈 내용 판정 (태그만 있고 텍스트 없으면 비어있는 것으로) — 저장/표시 분기용
export function isRichTextEmpty(html: string | null | undefined): boolean {
  if (!html) return true
  const text = html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim()
  return text.length === 0
}
