import { useEffect, useRef } from 'react'

/**
 * 딥링크(?openEvent=X)로 열린 오버레이가 **닫힐 때** 한 발짝 더 물러난다.
 *
 * 왜 필요한가: 홈에서 일정을 누르면 /calendar 로 넘어간 뒤 상세를 연다.
 * 그래서 상세만 닫으면 홈이 아니라 캘린더가 남는다.
 *
 * 왜 이렇게까지 하는가: "열린 값이 없다" 만 보면 안 된다.
 * 딥링크가 여는 그 순간에도 값은 아직 null 이라(상태 반영 전),
 * 열리기도 전에 물러나 **상세가 아예 안 열렸다.**
 * 그래서 **null 이 아니었다가 null 이 된 순간**만 닫힘으로 본다.
 */
export function useDeepLinkBack(openId: number | null, goBack: () => void) {
  const cameFromDeepLink = useRef(false)
  const prevId = useRef<number | null>(null)
  const goBackRef = useRef(goBack)
  useEffect(() => { goBackRef.current = goBack }, [goBack])

  useEffect(() => {
    const prev = prevId.current
    prevId.current = openId
    if (openId !== null) return
    if (prev === null) return              // 열린 적이 없다 — 닫힌 게 아니다
    if (!cameFromDeepLink.current) return  // 딥링크로 연 게 아니다
    cameFromDeepLink.current = false
    goBackRef.current()
  }, [openId])

  return { markDeepLink: () => { cameFromDeepLink.current = true } }
}
