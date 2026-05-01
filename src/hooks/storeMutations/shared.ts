/**
 * storeMutations 도메인 파일들이 공유하는 유틸리티
 */
import { supabase } from '../../lib/supabase'
import { showToast } from '../../lib/toast'

export { supabase, showToast }

/** YYYY-MM-DD (로컬) */
export function getLocalDateString() {
  const date = new Date()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

/** localStorage 의 currentVisitor 를 직접 사용 */
export function getCurrentVisitor(): string {
  return localStorage.getItem('currentVisitor') ?? '김민준'
}

export function reportMutationError(message: string, error: unknown) {
  console.error(message, error)
  showToast(message, 'error')
}
