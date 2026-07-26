// OS·스와이프 뒤로가기용 "닫기 핸들러 스택".
//
// 왜 필요한가: 오버레이가 겹칠 때(예: 배정 에디터 위의 구역 배분) 각자
// window 에 popstate 리스너를 달면 한 번의 제스처에 모든 층이 반응해
// 여러 단계가 한꺼번에 닫힌다(등록 순서상 바깥 층이 먼저 실행됨).
// → 여기서 스택을 관리해 "가장 위에 있는 한 층"만 닫는다.
//
// 사용법:
//   useEffect(() => (open ? pushBackHandler(() => close()) : undefined), [open])

type Entry = { handler: () => void; poppedByGesture: boolean }

const stack: Entry[] = []
let listening = false
// 코드로 호출한 history.back() 이 만든 popstate 는 무시 (사용자 제스처가 아님)
let suppressUntil = 0

function onPop() {
  if (Date.now() < suppressUntil) {
    suppressUntil = 0
    return
  }
  const top = stack[stack.length - 1]
  if (!top) return
  top.poppedByGesture = true
  top.handler()
}

/**
 * 더미 히스토리를 하나 쌓고 뒤로가기 핸들러를 스택 최상단에 등록한다.
 * 반환된 함수를 호출하면(보통 effect cleanup) 등록이 해제되고,
 * 제스처가 아닌 코드로 닫힌 경우엔 쌓아둔 더미 히스토리도 정리한다.
 */
export function pushBackHandler(handler: () => void): () => void {
  const entry: Entry = { handler, poppedByGesture: false }
  stack.push(entry)
  window.history.pushState({ backStackDepth: stack.length }, '')

  if (!listening) {
    window.addEventListener('popstate', onPop)
    listening = true
  }

  return () => {
    const index = stack.indexOf(entry)
    if (index >= 0) stack.splice(index, 1)
    if (!entry.poppedByGesture) {
      suppressUntil = Date.now() + 400
      window.history.back()
    }
  }
}
