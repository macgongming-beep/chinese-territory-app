import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { showToast } from '../lib/toast'
import { getAuthToken } from '../lib/authToken'
import type { MentionUser } from './CommentSection'

type ChatMessage = {
  id: number
  event_id: number
  author_id: number | null
  author_name: string
  message_type: 'text' | 'image' | 'system'
  content: string | null
  image_url: string | null
  image_expired?: boolean
  mention_ids: number[] | null
  mention_names: string[] | null
  created_at: string
  deleted_at: string | null
}

type ChatRoomProps = {
  eventId: number
  eventTitle: string
  currentVisitor: string
  currentUserId?: number | null
  users?: MentionUser[]
  compact?: boolean
}

function getMentionQuery(value: string) {
  const match = value.match(/(^|\s)@([^\s@]*)$/)
  return match ? match[2] : null
}

function insertMention(value: string, userName: string) {
  return value.replace(/(^|\s)@([^\s@]*)$/, `$1@${userName} `)
}

function getMentionPayload(value: string, users: MentionUser[]) {
  const mentioned = users.filter((user) => value.includes(`@${user.name}`))
  return {
    ids: mentioned.map((user) => user.id),
    names: mentioned.map((user) => user.name),
  }
}

function formatChatTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function createUploadPath(eventId: number, file: File) {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
  return `event-${eventId}/${id}.${ext}`
}

export function ChatRoom({
  eventId,
  eventTitle,
  currentVisitor,
  currentUserId: _currentUserId,
  users = [],
  compact = false,
}: ChatRoomProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(false)
  const [missingTable, setMissingTable] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const mentionQuery = getMentionQuery(draft)
  const mentionSuggestions = useMemo(() => {
    if (mentionQuery === null) return []
    return users
      .filter((user) => user.name !== currentVisitor && user.name.includes(mentionQuery))
      .slice(0, 6)
  }, [currentVisitor, mentionQuery, users])

  const fetchMessages = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('chat_messages')
      .select('id, event_id, author_id, author_name, message_type, content, image_url, image_expired, mention_ids, mention_names, created_at, deleted_at')
      .eq('event_id', eventId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true })

    if (error) {
      console.warn('채팅 메시지를 불러오지 못했습니다. chat_messages 테이블이 아직 없을 수 있습니다.', error)
      setMissingTable(true)
      setMessages([])
      setLoading(false)
      return
    }

    setMissingTable(false)
    setMessages((data as ChatMessage[]) ?? [])
    setLoading(false)
  }

  // 읽음 처리 (진입 시 + 이탈 시)
  const markChatRead = async () => {
    const token = getAuthToken()
    if (!token) return
    await supabase.rpc('update_chat_read', {
      p_token: token,
      p_event_id: eventId,
    })
  }

  useEffect(() => {
    void fetchMessages()
    void markChatRead() // 진입 시 즉시 읽음 처리

    const channel = supabase
      .channel(`chat:${eventId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'chat_messages', filter: `event_id=eq.${eventId}` },
        () => {
          void fetchMessages()
          if (!document.hidden) void markChatRead() // 활성 화면이면 즉시 갱신
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
      void markChatRead() // 이탈 시 한 번 더 (안전)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId])

  const sendTextMessage = async () => {
    const content = draft.trim()
    if (!content) return

    const token = getAuthToken()
    if (!token) {
      showToast('로그인 정보가 만료되었습니다. 다시 로그인해주세요.', 'error')
      return
    }

    const mentions = getMentionPayload(content, users)

    const { error } = await supabase.rpc('send_chat_message', {
      p_token: token,
      p_event_id: eventId,
      p_content: content,
      p_mention_ids: mentions.ids,
      p_mention_names: mentions.names,
    })

    if (error) {
      console.error('send_chat_message RPC 실패', error)
      showToast(error.message ?? '메시지를 보내지 못했습니다.', 'error')
      return
    }

    setDraft('')
    await fetchMessages()
  }

  const uploadPhoto = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      showToast('이미지 파일만 첨부할 수 있습니다.', 'error')
      return
    }

    const token = getAuthToken()
    if (!token) {
      showToast('로그인 정보가 만료되었습니다. 다시 로그인해주세요.', 'error')
      return
    }

    setUploading(true)
    const path = createUploadPath(eventId, file)
    const { error: uploadError } = await supabase.storage
      .from('chat-attachments')
      .upload(path, file, { cacheControl: '3600', contentType: file.type, upsert: false })

    if (uploadError) {
      console.error('사진 업로드 실패', uploadError)
      showToast('사진을 업로드하지 못했습니다. chat-attachments Storage 버킷을 확인해 주세요.', 'error')
      setUploading(false)
      return
    }

    const { data } = supabase.storage.from('chat-attachments').getPublicUrl(path)
    const caption = draft.trim() || null
    const captionMentions = caption ? getMentionPayload(caption, users) : { ids: [], names: [] }

    const { error } = await supabase.rpc('send_chat_image', {
      p_token: token,
      p_event_id: eventId,
      p_image_url: data.publicUrl,
      p_caption: caption,
      p_mention_ids: captionMentions.ids,
      p_mention_names: captionMentions.names,
    })

    if (error) {
      console.error('send_chat_image RPC 실패', error)
      const { error: removeError } = await supabase.storage.from('chat-attachments').remove([path])
      if (removeError) {
        console.warn('사진 메시지 저장 실패 후 업로드 파일 정리에 실패했습니다.', removeError)
      }
      showToast(error.message ?? '사진 메시지를 저장하지 못했습니다.', 'error')
      setUploading(false)
      return
    }

    setDraft('')
    setUploading(false)
    await fetchMessages()
  }

  if (missingTable) {
    return (
      <section className={`chat-room${compact ? ' chat-room--compact' : ''}`}>
        <div className="chat-empty">채팅 기능은 V1+ SQL 적용 후 사용할 수 있습니다.</div>
      </section>
    )
  }

  return (
    <section className={`chat-room${compact ? ' chat-room--compact' : ''}`}>
      <div className="chat-room__head">
        <div>
          <strong>채팅</strong>
          <span>{eventTitle}</span>
        </div>
        <em>{messages.length}개</em>
      </div>

      <div className="chat-messages">
        {loading && messages.length === 0 ? (
          <div className="chat-empty">채팅을 불러오는 중...</div>
        ) : messages.length === 0 ? (
          <div className="chat-empty">아직 메시지가 없습니다.</div>
        ) : (
          messages.map((message) => {
            const mine = message.author_name === currentVisitor
            const system = message.message_type === 'system'
            return (
              <article
                className={[
                  'chat-message',
                  mine ? 'is-mine' : '',
                  system ? 'is-system' : '',
                ].filter(Boolean).join(' ')}
                key={message.id}
              >
                {!mine && !system && <div className="chat-message__avatar">{message.author_name.slice(0, 1)}</div>}
                <div className="chat-message__bubble">
                  {!system && (
                    <div className="chat-message__meta">
                      <strong>{message.author_name}</strong>
                      <span>{formatChatTime(message.created_at)}</span>
                    </div>
                  )}
                  {message.image_url && !message.image_expired && (
                    <a href={message.image_url} rel="noreferrer" target="_blank">
                      <img alt="채팅 첨부 이미지" src={message.image_url} />
                    </a>
                  )}
                  {message.message_type === 'image' && message.image_expired && (
                    <div style={{
                      padding: '12px 14px',
                      background: '#f1f5f9',
                      borderRadius: 8,
                      color: '#94a3b8',
                      fontSize: 13,
                      fontStyle: 'italic',
                      textAlign: 'center',
                    }}>
                      📷 [사진 만료됨]
                      <div style={{ fontSize: 11, marginTop: 4 }}>
                        6개월 보관 후 자동 삭제됩니다
                      </div>
                    </div>
                  )}
                  {message.content && <p>{message.content}</p>}
                </div>
              </article>
            )
          })
        )}
      </div>

      <div className="chat-composer">
        <input
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.nativeEvent.isComposing) void sendTextMessage()
          }}
          placeholder="메시지 입력. @이름으로 언급할 수 있습니다."
          value={draft}
        />
        {mentionSuggestions.length > 0 && (
          <div className="mention-menu mention-menu--chat">
            {mentionSuggestions.map((user) => (
              <button
                key={user.id}
                onClick={() => setDraft((value) => insertMention(value, user.name))}
                type="button"
              >
                <span>{user.name.slice(0, 1)}</span>
                {user.name}
              </button>
            ))}
          </div>
        )}
        <input
          accept="image/*"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) void uploadPhoto(file)
            event.target.value = ''
          }}
          ref={fileInputRef}
          type="file"
        />
        <button
          className="chat-composer__photo"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
          type="button"
        >
          {uploading ? '...' : '사진'}
        </button>
        <button disabled={!draft.trim()} onClick={sendTextMessage} type="button">전송</button>
      </div>
    </section>
  )
}
