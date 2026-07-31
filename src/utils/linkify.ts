// 본문 속 URL 감지 (댓글·채팅 링크화 공용 로직)

// http(s):// 로 시작하거나 www. 로 시작하는 토큰
// split() 에 쓰므로 캡처 그룹 1개 유지 — 홀수 인덱스가 URL 이 된다.
export const URL_PATTERN = /(https?:\/\/[^\s<>()[\]{}"']+|www\.[^\s<>()[\]{}"']+)/gi

/** 링크 끝에 붙기 쉬운 문장부호를 링크에서 분리 ("...naver.me/x." → ["...naver.me/x", "."]) */
export function splitTrailingPunctuation(raw: string): [string, string] {
  const match = raw.match(/[.,;:!?)\]}]+$/)
  if (!match) return [raw, '']
  return [raw.slice(0, raw.length - match[0].length), match[0]]
}

/** www. 로 시작하면 https 를 붙여 실제 이동 가능한 주소로 */
export function toHref(url: string): string {
  return /^www\./i.test(url) ? `https://${url}` : url
}
