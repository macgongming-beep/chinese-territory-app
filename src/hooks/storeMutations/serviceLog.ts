// log_service_action RPC 호출 헬퍼 (공용)
// 실패 시 console.warn 만 — 메인 액션 흐름을 방해하지 않음
import { supabase } from '../../lib/supabase'
import { getAuthToken } from '../../lib/authToken'

export type ServiceLogInput = {
  sessionId?: number | null
  eventId?: number | null
  cardId?: number | null
  action: string
  targetType?: string | null
  targetId?: number | null
  details?: Record<string, unknown>
}

export async function logServiceAction(input: ServiceLogInput): Promise<void> {
  const token = getAuthToken()
  if (!token) return // 토큰 없으면 조용히 스킵
  const { error } = await supabase.rpc('log_service_action', {
    p_token: token,
    p_session_id: input.sessionId ?? null,
    p_event_id: input.eventId ?? null,
    p_card_id: input.cardId ?? null,
    p_action: input.action,
    p_target_type: input.targetType ?? null,
    p_target_id: input.targetId ?? null,
    p_details: input.details ?? {},
  })
  if (error) {
    // eslint-disable-next-line no-console
    console.warn('[service_log] failed:', input.action, error)
  }
}
