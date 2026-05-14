import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { getAuthToken } from '../lib/authToken'
import type { CalendarEvent } from '../types'

type ChatListMessage = {
  id: number
  event_id: number
  author_name: string
  message_type: 'text' | 'image' | 'system'
  content: string | null
  created_at: string
}

type ChatListProps = {
  events: CalendarEvent[]
  activeEventId?: number | null
  onSelectEvent?: (eventId: number) => void
}

function formatRelativeTime(value?: string) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const diffMinutes = Math.floor((Date.now() - date.getTime()) / 60000)
  if (diffMinutes < 1) return '방금'
  if (diffMinutes < 60) return `${diffMinutes}분 전`
  if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)}시간 전`
  return `${date.getMonth() + 1}/${date.getDate()}`
}

export function ChatList({ events, activeEventId, onSelectEvent }: ChatListProps) {
  const [messages, setMessages] = useState<ChatListMessage[]>([])
  const [missingTable, setMissingTable] = useState(false)

  const eventIds = useMemo(() => events.map((event) => event.id), [events])

  useEffect(() => {
    const fetchMessages = async () => {
      if (eventIds.length === 0) {
        setMessages([])
        return
      }

      const token = getAuthToken()
      let data: ChatListMessage[] | null = null
      let error: unknown = null

      if (token) {
        const rpcResult = await supabase.rpc('get_chat_message_previews', {
          p_token: token,
          p_event_ids: eventIds,
        })

        if (rpcResult.error) {
          console.warn('채팅 목록 RPC 조회 실패:', rpcResult.error)
          error = rpcResult.error
        } else {
          data = (rpcResult.data as ChatListMessage[]) ?? []
          error = null
        }
      }

      if (error || !data) {
        console.warn('채팅 목록을 불러오지 못했습니다.', error)
        setMissingTable(true)
        setMessages([])
        return
      }

      setMissingTable(false)
      setMessages(data)
    }

    void fetchMessages()
  }, [eventIds])

  const rows = events.map((event) => {
    const eventMessages = messages.filter((message) => message.event_id === event.id)
    const latest = eventMessages[0]
    return { event, latest, count: eventMessages.length }
  })

  if (missingTable) {
    return <div className="chat-list-empty">채팅 목록은 V1+ SQL 적용 후 표시됩니다.</div>
  }

  return (
    <div className="chat-list">
      {rows.length === 0 ? (
        <div className="chat-list-empty">표시할 일정이 없습니다.</div>
      ) : (
        rows.map(({ event, latest, count }) => (
          <button
            className={`chat-list-row${activeEventId === event.id ? ' is-active' : ''}`}
            key={event.id}
            onClick={() => onSelectEvent?.(event.id)}
            type="button"
          >
            <span className="chat-list-row__time">{event.time || '시간 미정'}</span>
            <span className="chat-list-row__body">
              <strong>{event.title}</strong>
              <em>
                {latest
                  ? `${latest.author_name}: ${latest.content || (latest.message_type === 'image' ? '사진' : '시스템 메시지')}`
                  : '아직 메시지가 없습니다'}
              </em>
            </span>
            <span className="chat-list-row__meta">
              {count > 0 && <strong>{count}</strong>}
              <small>{formatRelativeTime(latest?.created_at)}</small>
            </span>
          </button>
        ))
      )}
    </div>
  )
}
