/**
 * storeMutations 도메인 파일들이 공유하는 유틸리티
 */
import { supabase } from '../../lib/supabase'
import { showToast } from '../../lib/toast'
import { msg } from '../../lib/msg'

export { supabase, showToast }
// 공용 dateUtils 로 통합 (기존 ./shared import 경로 유지를 위해 재export)
export { getLocalDateString } from '../../utils/dateUtils'

/**
 * localStorage 의 currentVisitor.
 * ⚠️ 폴백 없음 — 없으면 빈 문자열. (예전 '김민준' 폴백은 데이터 오염 원인이라 제거)
 */
export function getCurrentVisitor(): string {
  return localStorage.getItem('currentVisitor') ?? ''
}

/**
 * 방문/기록 등 "누가 했는지" 이름이 꼭 필요한 mutation 가드.
 * 이름이 비어있으면 토스트 띄우고 null 반환 → 호출부는 즉시 return.
 * (잘못된 이름으로 조용히 기록하느니 막는다)
 */
export function requireVisitor(): string | null {
  const name = getCurrentVisitor().trim()
  if (!name) {
    showToast(msg('로그인 정보가 없어 기록할 수 없습니다. 다시 로그인해 주세요.'), 'error')
    return null
  }
  return name
}

export function reportMutationError(message: string, error: unknown) {
  console.error(message, error)
  showToast(message, 'error')
}
