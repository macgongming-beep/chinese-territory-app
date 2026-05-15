// 모바일 PWA용 풀-투-리프레시
// 화면 최상단에서 아래로 당기면 새로고침
import { useEffect, useRef, useState } from 'react'

const THRESHOLD = 70 // px
const DEBOUNCE_MS = 5000 // 마지막 새로고침 후 5초 내 재호출 차단

export function PullToRefresh({ onRefresh }: { onRefresh: () => Promise<void> | void }) {
  const startYRef = useRef<number | null>(null)
  const lastRefreshAtRef = useRef(0)
  const [pullY, setPullY] = useState(0)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    const onTouchStart = (e: TouchEvent) => {
      // 화면 최상단에 있을 때만
      if (window.scrollY > 0 || refreshing) {
        startYRef.current = null
        return
      }
      // 터치 시작점이 자기만의 스크롤 컨테이너 안이고 그 컨테이너가
      // 위로 더 스크롤 가능하면 풀-투-리프레시 무시 (예: 채팅 메시지 목록)
      let el = e.target as HTMLElement | null
      while (el && el !== document.body) {
        const style = window.getComputedStyle(el)
        const overflowY = style.overflowY
        if ((overflowY === 'auto' || overflowY === 'scroll') && el.scrollTop > 0) {
          startYRef.current = null
          return
        }
        el = el.parentElement
      }
      startYRef.current = e.touches[0].clientY
    }

    const onTouchMove = (e: TouchEvent) => {
      if (startYRef.current === null) return
      const delta = e.touches[0].clientY - startYRef.current
      if (delta <= 0) {
        setPullY(0)
        return
      }
      // 저항 효과 (당길수록 점점 천천히)
      const resisted = Math.min(delta * 0.5, THRESHOLD * 1.8)
      setPullY(resisted)
    }

    const onTouchEnd = async () => {
      const shouldRefresh = pullY >= THRESHOLD && !refreshing
      startYRef.current = null
      setPullY(0)
      if (shouldRefresh) {
        // 디바운스: 마지막 새로고침 후 5초 내면 무시
        if (Date.now() - lastRefreshAtRef.current < DEBOUNCE_MS) return
        lastRefreshAtRef.current = Date.now()
        setRefreshing(true)
        try {
          await onRefresh()
        } finally {
          setRefreshing(false)
        }
      }
    }

    document.addEventListener('touchstart', onTouchStart, { passive: true })
    document.addEventListener('touchmove', onTouchMove, { passive: true })
    document.addEventListener('touchend', onTouchEnd, { passive: true })
    document.addEventListener('touchcancel', onTouchEnd, { passive: true })

    return () => {
      document.removeEventListener('touchstart', onTouchStart)
      document.removeEventListener('touchmove', onTouchMove)
      document.removeEventListener('touchend', onTouchEnd)
      document.removeEventListener('touchcancel', onTouchEnd)
    }
  }, [pullY, refreshing, onRefresh])

  const visible = pullY > 10 || refreshing
  const ready = pullY >= THRESHOLD

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        display: visible ? 'flex' : 'none',
        alignItems: 'center',
        justifyContent: 'center',
        height: refreshing ? 50 : Math.min(pullY, THRESHOLD + 20),
        background: '#f8fafc',
        borderBottom: '1px solid #e2e8f0',
        transition: refreshing ? 'height 0.2s' : 'none',
        pointerEvents: 'none',
      }}
      aria-hidden={!visible}
    >
      <span style={{ fontSize: 13, fontWeight: 600, color: '#64748b' }}>
        {refreshing ? '🔄 새로고침 중...' : ready ? '↑ 놓으면 새로고침' : '↓ 당겨서 새로고침'}
      </span>
    </div>
  )
}
