// 화면 위에 띄우는 것(알림·채팅·확인창)이 붙을 자리.
//
// ⚠ **`document.body` 에 붙이면 안 된다.** 글씨 크기(zoom)는 `#root` 에 걸리므로
//   body 로 포털한 것은 **확대 범위 밖**이 된다 — 큰 글씨로 설정한 분이
//   알림창만 작게 보게 된다. 리뷰에서 잡혔다.
//
//   그래서 `#root` **안에** 자리를 하나 만들고 모든 포털이 여기를 쓴다.

const ID = 'app-overlay-root'

export function getOverlayRoot(): HTMLElement | null {
  if (typeof document === 'undefined') return null
  const existing = document.getElementById(ID)
  if (existing) return existing

  const root = document.getElementById('root')
  // #root 가 없으면 만들지 않는다. body 로 떨어뜨리면 확대 밖이 되는데,
  // 그건 조용히 잘못 보이는 상태라 차라리 안 그리는 편이 낫다… 가 아니라,
  // 화면이 안 뜨는 게 더 나쁘다. body 로 붙이되 그건 예외 상황이다.
  const parent = root ?? document.body
  const el = document.createElement('div')
  el.id = ID
  parent.appendChild(el)
  return el
}
