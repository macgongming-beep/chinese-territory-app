import { supabase } from './shared'
import { getAuthToken } from '../../lib/authToken'

export async function createSystemChatMessage(eventId: number | null | undefined, content: string) {
  if (!eventId || !content.trim()) return

  const token = getAuthToken()
  if (!token) return

  const { error } = await supabase.rpc('create_system_chat_message', {
    p_token: token,
    p_event_id: eventId,
    p_content: content.trim(),
  })

  if (error) {
    console.warn('시스템 채팅 메시지를 저장하지 못했습니다. V1+ 채팅 RPC 적용 여부를 확인해 주세요.', error)
  }
}
