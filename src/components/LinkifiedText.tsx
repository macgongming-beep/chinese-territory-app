// 본문 속 URL 을 눌러서 열 수 있는 링크로 표시 (댓글·채팅 공용)
// - 네이버 지도 공유(https://naver.me/...) 처럼 붙여넣는 링크를 바로 열 수 있게
// - dangerouslySetInnerHTML 을 쓰지 않고 텍스트/링크 조각으로 나눠 렌더 (XSS 안전)
// - 새 탭 + noopener/noreferrer (탭 탈취 방지)

import { URL_PATTERN, splitTrailingPunctuation, toHref } from '../utils/linkify'

export function LinkifiedText({ text }: { text: string }) {
  const parts = text.split(URL_PATTERN)

  return (
    <>
      {parts.map((part, index) => {
        // split 결과에서 홀수 인덱스가 매칭된 URL
        if (index % 2 === 0) return part
        const [url, trailing] = splitTrailingPunctuation(part)
        const href = toHref(url)
        return (
          <span key={index}>
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(event) => event.stopPropagation()}
              style={{ color: 'var(--primary-600, #1E5BD0)', textDecoration: 'underline', overflowWrap: 'anywhere' }}
            >
              {url}
            </a>
            {trailing}
          </span>
        )
      })}
    </>
  )
}
