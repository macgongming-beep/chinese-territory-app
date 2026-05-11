// 글로벌 채팅 목록 모달 (헤더 💬 클릭 시 슬라이드 다운)
// 메시지 미리보기 X (사생활 보호 결정)
import { useNavigate } from 'react-router-dom'
import { useUserChats, type UserChat } from '../hooks/useUserChats'
import { normalizeAppLink } from '../utils/appNavigation'

function formatChatDate(iso: string | null, eventDate: string): string {
  if (!iso) {
    // 메시지 없으면 일정 날짜
    const d = new Date(eventDate)
    return `${d.getMonth() + 1}/${d.getDate()}`
  }
  const t = new Date(iso).getTime()
  const now = Date.now()
  const diff = Math.max(0, now - t)
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return `방금`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}분 전`
  const hr = Math.floor(min / 60)
  if (hr < 24) {
    const d = new Date(iso)
    return `${d.getHours() < 12 ? '오전' : '오후'} ${d.getHours() % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')}`
  }
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

function formatEventLabel(eventDate: string, eventTime: string | null): string {
  const d = new Date(eventDate)
  const weekdays = ['일', '월', '화', '수', '목', '금', '토']
  const dateLabel = `${d.getMonth() + 1}/${d.getDate()} (${weekdays[d.getDay()]})`
  return eventTime ? `${dateLabel} ${eventTime}` : dateLabel
}

export function GlobalChatModal({
  userId,
  userName,
  onClose,
}: {
  userId: number
  userName: string
  onClose: () => void
}) {
  const navigate = useNavigate()
  const { activeChats, lockedChats, loading } = useUserChats(userId, userName)

  const handleClick = (chat: UserChat) => {
    onClose()
    navigate(normalizeAppLink(`/calendar/events/${chat.eventId}/chat`) ?? '/calendar')
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1500,
        background: 'rgba(15,23,42,0.5)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: '100%',
          maxWidth: 440,
          height: '100%',
          background: '#fff',
          display: 'flex',
          flexDirection: 'column',
          animation: 'chatSlideIn 0.25s ease-out',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 16px 12px', borderBottom: '1px solid #f1f5f9',
        }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#1e293b' }}>채팅</h2>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', fontSize: 22, color: '#94a3b8',
              cursor: 'pointer', padding: '0 6px',
            }}
            aria-label="닫기"
            type="button"
          >✕</button>
        </div>

        {/* 본문 */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading && activeChats.length === 0 && lockedChats.length === 0 && (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
              불러오는 중...
            </div>
          )}

          {!loading && activeChats.length === 0 && lockedChats.length === 0 && (
            <div style={{ padding: '60px 20px', textAlign: 'center', color: '#94a3b8' }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>💬</div>
              <p style={{ margin: 0, fontSize: 14 }}>참여한 봉사 채팅방이 없습니다</p>
              <p style={{ margin: '6px 0 0', fontSize: 12 }}>일정 상세에서 [참여]를 누르면 채팅방에 입장됩니다</p>
            </div>
          )}

          {/* 활성 채팅 */}
          {activeChats.length > 0 && (
            <div>
              <p style={{
                margin: 0, padding: '12px 16px 6px', fontSize: 11, fontWeight: 700,
                color: '#94a3b8', letterSpacing: '0.04em', textTransform: 'uppercase',
              }}>🟢 활성 (참여 중)</p>
              {activeChats.map((chat) => (
                <ChatRow key={chat.eventId} chat={chat} onClick={handleClick} />
              ))}
            </div>
          )}

          {/* 종료 채팅 */}
          {lockedChats.length > 0 && (
            <div>
              <p style={{
                margin: 0, padding: '16px 16px 6px', fontSize: 11, fontWeight: 700,
                color: '#94a3b8', letterSpacing: '0.04em', textTransform: 'uppercase',
              }}>🔒 종료 (보기 전용)</p>
              {lockedChats.map((chat) => (
                <ChatRow key={chat.eventId} chat={chat} onClick={handleClick} />
              ))}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes chatSlideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        @media (max-width: 480px) {
          @keyframes chatSlideIn {
            from { transform: translateY(-100%); }
            to { transform: translateY(0); }
          }
        }
      `}</style>
    </div>
  )
}

function ChatRow({ chat, onClick }: { chat: UserChat; onClick: (c: UserChat) => void }) {
  const isUnread = chat.unreadCount > 0

  return (
    <button
      onClick={() => onClick(chat)}
      style={{
        display: 'flex', gap: 12, alignItems: 'center',
        width: '100%', padding: '14px 16px',
        background: isUnread ? '#f0f9ff' : '#fff',
        border: 'none', borderBottom: '1px solid #f1f5f9',
        cursor: 'pointer', textAlign: 'left',
        opacity: chat.isLocked ? 0.7 : 1,
      }}
      type="button"
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          display: 'flex', alignItems: 'baseline', gap: 8,
          fontSize: 14, fontWeight: 700, color: '#1e293b',
          overflow: 'hidden',
        }}>
          {chat.hasEnded && !chat.isLocked && (
            <span style={{ fontSize: 10, color: '#64748b' }}>✓</span>
          )}
          <span style={{
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
          }}>{chat.eventTitle || formatEventLabel(chat.eventDate, chat.eventTime)}</span>
        </div>
        <p style={{
          margin: '3px 0 0', fontSize: 12, color: '#64748b',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {formatEventLabel(chat.eventDate, chat.eventTime)} · {chat.participantCount}명 참여
        </p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
        <span style={{ fontSize: 11, color: '#94a3b8' }}>
          {formatChatDate(chat.lastMessageAt, chat.eventDate)}
        </span>
        {isUnread && (
          <span style={{
            minWidth: 18, height: 18, padding: '0 5px', borderRadius: 9,
            background: '#dc2626', color: '#fff', fontSize: 11, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {chat.unreadCount > 99 ? '99+' : chat.unreadCount}
          </span>
        )}
      </div>
    </button>
  )
}
