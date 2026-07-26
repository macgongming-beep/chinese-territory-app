// 화면 이동(지도 등 다른 라우트) 후 돌아왔을 때 필터·탭 선택을 유지하기 위한 state.
// - sessionStorage 사용: 탭을 닫으면 초기화(다음 방문은 깨끗한 기본값), 새로고침/뒤로가기는 유지
// - 저장 실패(프라이빗 모드 등)해도 일반 useState 처럼 동작
import { useEffect, useState } from 'react'

export function useSessionState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === 'undefined') return initial
    try {
      const raw = window.sessionStorage.getItem(key)
      return raw === null ? initial : (JSON.parse(raw) as T)
    } catch {
      return initial
    }
  })

  useEffect(() => {
    try {
      window.sessionStorage.setItem(key, JSON.stringify(value))
    } catch {
      // 저장 실패는 무시 (기능은 그대로 동작)
    }
  }, [key, value])

  return [value, setValue] as const
}
