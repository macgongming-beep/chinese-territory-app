// 봉사 로그 (감사 로그) 조회 — 인도자/관리자/개발자만
// get_service_logs RPC (토큰 검증 + 인도자는 자기 카드만)
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { getAuthToken } from '../lib/authToken'

export type ServiceLog = {
  id: number
  sessionId: number | null
  eventId: number | null
  eventTitle: string | null
  eventDate: string | null
  cardId: number | null
  cardName: string | null
  actorId: number | null
  actorName: string
  action: string
  targetType: string | null
  targetId: number | null
  details: Record<string, unknown>
  createdAt: string
}

type RawLog = {
  id: number
  session_id: number | null
  event_id: number | null
  event_title: string | null
  event_date: string | null
  card_id: number | null
  card_name: string | null
  actor_id: number | null
  actor_name: string
  action: string
  target_type: string | null
  target_id: number | null
  details: Record<string, unknown>
  created_at: string
}

function toLog(raw: RawLog): ServiceLog {
  return {
    id: raw.id,
    sessionId: raw.session_id,
    eventId: raw.event_id,
    eventTitle: raw.event_title,
    eventDate: raw.event_date,
    cardId: raw.card_id,
    cardName: raw.card_name,
    actorId: raw.actor_id,
    actorName: raw.actor_name,
    action: raw.action,
    targetType: raw.target_type,
    targetId: raw.target_id,
    details: raw.details ?? {},
    createdAt: raw.created_at,
  }
}

export type ServiceLogFilter = {
  eventId?: number | null
  cardId?: number | null
  limit?: number
}

export function useServiceLogs(filter: ServiceLogFilter = {}) {
  const [logs, setLogs] = useState<ServiceLog[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    const token = getAuthToken()
    if (!token) {
      setError('로그인이 필요합니다')
      setLogs([])
      return
    }

    setLoading(true)
    setError(null)

    const { data, error: rpcError } = await supabase.rpc('get_service_logs', {
      p_token: token,
      p_filter_event_id: filter.eventId ?? null,
      p_filter_card_id: filter.cardId ?? null,
      p_limit: filter.limit ?? 200,
    })

    setLoading(false)

    if (rpcError) {
      console.warn('[service_logs] RPC failed:', rpcError)
      setError(rpcError.message ?? '봉사 로그 조회 실패')
      setLogs([])
      return
    }

    setLogs(((data ?? []) as RawLog[]).map(toLog))
  }, [filter.eventId, filter.cardId, filter.limit])

  useEffect(() => {
    fetch()
  }, [fetch])

  return { logs, loading, error, refetch: fetch }
}

// 액션 한글 라벨
export const ACTION_LABEL: Record<string, { label: string; color: string; bg: string }> = {
  session_started: { label: '봉사 시작', color: '#15803d', bg: '#dcfce7' },
  session_ended:   { label: '봉사 종료', color: '#475569', bg: '#f1f5f9' },
  joined:          { label: '참여',      color: '#1d4ed8', bg: '#dbeafe' },
  left:            { label: '이탈',      color: '#64748b', bg: '#f1f5f9' },
  visit_recorded:  { label: '방문 기록', color: '#0369a1', bg: '#e0f2fe' },
  visit_updated:   { label: '방문 수정', color: '#0369a1', bg: '#e0f2fe' },
  visit_deleted:   { label: '방문 삭제', color: '#b91c1c', bg: '#fee2e2' },
  memo_added:      { label: '메모 추가', color: '#6d28d9', bg: '#ede9fe' },
  unit_flag_changed: { label: '플래그',  color: '#b45309', bg: '#fef3c7' },
  building_added:  { label: '건물 추가', color: '#15803d', bg: '#dcfce7' },
  building_updated: { label: '건물 수정', color: '#0369a1', bg: '#e0f2fe' },
  chat_message:    { label: '채팅',      color: '#0369a1', bg: '#e0f2fe' },
  chat_image:      { label: '사진 전송', color: '#0369a1', bg: '#e0f2fe' },
  message_deleted: { label: '메시지 삭제', color: '#b91c1c', bg: '#fee2e2' },
}

export function getActionMeta(action: string) {
  return ACTION_LABEL[action] ?? { label: action, color: '#64748b', bg: '#f1f5f9' }
}

// CSV 변환
export function logsToCSV(logs: ServiceLog[]): string {
  const headers = [
    '시각',
    '봉사일',
    '카드',
    '일정 제목',
    '행위자',
    '액션',
    '대상 종류',
    '대상 ID',
    '상세',
  ]

  const rows = logs.map((log) => [
    log.createdAt,
    log.eventDate ?? '',
    log.cardName ?? '',
    log.eventTitle ?? '',
    log.actorName,
    getActionMeta(log.action).label,
    log.targetType ?? '',
    log.targetId !== null ? String(log.targetId) : '',
    JSON.stringify(log.details),
  ])

  // CSV 이스케이프 (쉼표/줄바꿈/큰따옴표 처리)
  const escape = (v: string) => {
    if (/[",\n]/.test(v)) {
      return `"${v.replace(/"/g, '""')}"`
    }
    return v
  }

  const lines = [headers.map(escape).join(','), ...rows.map((r) => r.map(escape).join(','))]
  return lines.join('\n')
}

export function downloadCSV(filename: string, content: string) {
  const blob = new Blob(['﻿' + content], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
