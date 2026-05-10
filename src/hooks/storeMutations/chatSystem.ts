import { supabase } from './shared'

export async function createSystemChatMessage(eventId: number | null | undefined, content: string) {
  if (!eventId || !content.trim()) return

  const { error } = await supabase.from('chat_messages').insert({
    event_id: eventId,
    author_id: null,
    author_name: '시스템',
    message_type: 'system',
    content: content.trim(),
    mention_ids: [],
    mention_names: [],
  })

  if (error) {
    console.warn('시스템 채팅 메시지를 저장하지 못했습니다. chat_messages 테이블이 아직 없을 수 있습니다.', error)
  }
}
