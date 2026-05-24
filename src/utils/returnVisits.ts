import type { AppLanguage } from '../i18n'
import type { ReturnVisit, ReturnVisitLog } from '../types'

export function normalizeVisitorName(value: string | null | undefined) {
  return (value ?? '').trim().replace(/\s+/g, '')
}

export function getUserReturnVisits(returnVisits: ReturnVisit[], currentVisitor: string) {
  const current = normalizeVisitorName(currentVisitor)
  return returnVisits.filter(
    (visit) => normalizeVisitorName(visit.assignedUserName) === current || normalizeVisitorName(visit.createdBy) === current,
  )
}

export function getLatestReturnVisitDate(returnVisits: ReturnVisit[], returnVisitLogs: ReturnVisitLog[]) {
  const returnVisitIds = new Set(returnVisits.map((visit) => visit.id))
  const dates = [
    ...returnVisits.map((visit) => visit.lastVisitedAt).filter((value): value is string => !!value),
    ...returnVisitLogs
      .filter((log) => returnVisitIds.has(log.returnVisitId))
      .map((log) => log.visitedAt)
      .filter((value): value is string => !!value),
  ]

  return dates.sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] ?? null
}

export function formatRelativeVisitDate(value: string | null | undefined, language: AppLanguage = 'ko') {
  if (!value) {
    if (language === 'zh') return '还没有'
    if (language === 'en') return 'No visits yet'
    return '아직 없음'
  }

  const visited = new Date(value)
  if (Number.isNaN(visited.getTime())) {
    if (language === 'zh') return '还没有'
    if (language === 'en') return 'No visits yet'
    return '아직 없음'
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  visited.setHours(0, 0, 0, 0)
  const diffDays = Math.max(0, Math.floor((today.getTime() - visited.getTime()) / 86_400_000))

  if (diffDays === 0) {
    if (language === 'zh') return '今天'
    if (language === 'en') return 'Today'
    return '오늘'
  }
  if (diffDays === 1) {
    if (language === 'zh') return '昨天'
    if (language === 'en') return 'Yesterday'
    return '어제'
  }
  if (diffDays < 7) {
    if (language === 'zh') return `${diffDays}天前`
    if (language === 'en') return `${diffDays}d ago`
    return `${diffDays}일 전`
  }
  if (diffDays < 30) {
    const weeks = Math.max(1, Math.floor(diffDays / 7))
    if (language === 'zh') return `${weeks}周前`
    if (language === 'en') return `${weeks}w ago`
    return `${weeks}주 전`
  }

  const months = Math.max(1, Math.floor(diffDays / 30))
  if (language === 'zh') return `${months}个月前`
  if (language === 'en') return `${months}mo ago`
  return `${months}개월 전`
}
