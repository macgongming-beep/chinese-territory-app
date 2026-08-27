// 자유양식 제안 본문의 리치텍스트(굵게/밑줄/색/링크) 정제.
// 관리자가 작성한 HTML 을 다른 사용자에게 보여주므로 XSS 방지를 위해
// DOMPurify 로 허용 태그/속성만 남긴다.

import DOMPurify from 'dompurify'

// 굵게(b/strong), 기울임(i/em), 밑줄(u), 색/span, 줄바꿈(br/div/p), 글자색(font), 링크(a)
const ALLOWED_TAGS = ['b', 'strong', 'i', 'em', 'u', 'span', 'br', 'div', 'p', 'font', 'a']
const ALLOWED_ATTR = ['style', 'color', 'href', 'target', 'rel']

/** http(s) 만 연다. javascript: · data: 같은 건 링크가 아니라 공격 통로다 */
export function isSafeHref(raw: string | null | undefined): boolean {
  const v = (raw ?? '').trim()
  if (!v) return false
  return /^https?:\/\//i.test(v)
}

let hookInstalled = false
function installHook() {
  if (hookInstalled) return
  hookInstalled = true
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node.nodeName !== 'A') return
    const el = node as HTMLAnchorElement
    if (!isSafeHref(el.getAttribute('href'))) {
      // 주소가 수상하면 링크를 벗기고 **글자는 남긴다** (내용이 사라지지 않게)
      el.removeAttribute('href')
      return
    }
    // 새 창으로. rel 이 없으면 열린 쪽이 원래 창을 조작할 수 있다
    el.setAttribute('target', '_blank')
    el.setAttribute('rel', 'noopener noreferrer')
  })
}

/** 글자 안의 맨 주소를 누를 수 있는 링크로 바꾼다 (이미 링크인 곳은 건드리지 않는다) */
function linkifyTextNodes(root: ParentNode) {
  const urlPattern = /https?:\/\/[^\s<>"')\]]+/g
  const walker = document.createTreeWalker(root as Node, NodeFilter.SHOW_TEXT)
  const targets: Text[] = []
  let n = walker.nextNode()
  while (n) {
    const text = n as Text
    // 이미 <a> 안이면 그대로 둔다
    if (!text.parentElement?.closest('a') && urlPattern.test(text.data)) targets.push(text)
    urlPattern.lastIndex = 0
    n = walker.nextNode()
  }
  for (const text of targets) {
    const frag = document.createDocumentFragment()
    let last = 0
    for (const m of text.data.matchAll(urlPattern)) {
      const url = m[0]
      if (m.index! > last) frag.appendChild(document.createTextNode(text.data.slice(last, m.index)))
      const a = document.createElement('a')
      a.setAttribute('href', url)
      a.setAttribute('target', '_blank')
      a.setAttribute('rel', 'noopener noreferrer')
      a.textContent = url
      frag.appendChild(a)
      last = m.index! + url.length
    }
    if (last < text.data.length) frag.appendChild(document.createTextNode(text.data.slice(last)))
    text.replaceWith(frag)
  }
}

export function sanitizeRichText(html: string): string {
  installHook()
  // ① 먼저 위험한 것을 걷어낸다
  const clean = DOMPurify.sanitize(html ?? '', {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    FORBID_TAGS: ['img', 'script', 'style', 'iframe'],
  })
  // ② 그다음 남은 **글자** 안의 맨 주소를 링크로 만든다.
  //    정제 뒤에 하므로 우리가 만드는 <a> 만 생긴다 (직접 만드니 안전하다).
  const holder = document.createElement('div')
  holder.innerHTML = clean
  linkifyTextNodes(holder)
  return holder.innerHTML
}

// 빈 내용 판정 (태그만 있고 텍스트 없으면 비어있는 것으로) — 저장/표시 분기용
export function isRichTextEmpty(html: string | null | undefined): boolean {
  if (!html) return true
  const text = html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim()
  return text.length === 0
}
