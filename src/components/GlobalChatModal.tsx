// 글로벌 채팅 목록 모달 (헤더 💬 클릭 시 슬라이드 다운)
// 메시지 미리보기 X (사생활 보호 결정)
import { useState } from 'react'
import { useUserChats, type UserChat } from '../hooks/useUserChats'
import type { Role } from '../types'
import { ChatRoom } from './ChatRoom'
import type { MentionUser } from './CommentSection'

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
  role = 'user',
  users = [],
  onClose,
}: {
  userId: number | null
  userName: string
  role?: Role
  users?: MentionUser[]
  onClose: () => void
}) {
  const [selectedChat, setSelectedChat] = useState<UserChat | null>(null)
  const { activeChats, lockedChats, loading } = useUserChats(userId, userName)

  const handleClick = (chat: UserChat) => {
    setSelectedChat(chat)
  }

  const mentionUsers = users.length > 0
    ? users
    : userId
      ? [{ id: userId, name: userName, role }]
      : []

  return (
    <div
      className="header-action-panel-backdrop"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50000,
        background: 'rgba(15,23,42,0.5)',
      }}
      onClick={onClose}
    >
      <div
        className="header-action-panel"
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
        <div className="header-action-panel__head" style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 16px 12px', borderBottom: '1px solid #f1f5f9',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            {selectedChat && (
              <button
                aria-label="채팅 목록으로 돌아가기"
                onClick={() => setSelectedChat(null)}
                style={{
                  width: 32, height: 32, minHeight: 32, borderRadius: 999,
                  border: '1px solid #e2e8f0', background: '#fff',
                  color: '#334155', fontSize: 18, cursor: 'pointer',
                  display: 'grid', placeItems: 'center', padding: 0,
                }}
                type="button"
              >
                ‹
              </button>
            )}
            <div style={{ minWidth: 0 }}>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#1e293b' }}>
                {selectedChat ? selectedChat.eventTitle || '채팅방' : '채팅'}
              </h2>
              {selectedChat && (
                <p style={{
                  margin: '2px 0 0', color: '#64748b', fontSize: 12, fontWeight: 700,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {formatEventLabel(selectedChat.eventDate, selectedChat.eventTime)}
                </p>
              )}
            </div>
          </div>
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
        <div
          className={`header-action-panel__body${selectedChat ? ' header-action-panel__body--chat' : ''}`}
          style={{ flex: 1, overflowY: selectedChat ? 'hidden' : 'auto' }}
        >
          {selectedChat ? (
            <ChatRoom
              canAccess
              compact
              currentUserId={userId}
              currentVisitor={userName}
              eventId={selectedChat.eventId}
              eventTitle={selectedChat.eventTitle || formatEventLabel(selectedChat.eventDate, selectedChat.eventTime)}
              role={role}
              users={mentionUsers}
            />
          ) : !userId ? (
            <div className="header-action-panel__empty" style={{ padding: '60px 20px', textAlign: 'center', color: '#94a3b8' }}>
              <span style={{ fontSize: 36, marginBottom: 8 }}>💬</span>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#475569' }}>로그인 정보 확인이 필요합니다</p>
              <p style={{ margin: '6px 0 0', fontSize: 12 }}>다시 로그인하면 채팅 목록을 불러올 수 있습니다.</p>
            </div>
          ) : loading && activeChats.length === 0 && lockedChats.length === 0 && (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
              불러오는 중...
            </div>
          )}

          {!selectedChat && userId && !loading && activeChats.length === 0 && lockedChats.length === 0 && (
            <div className="header-action-panel__empty" style={{ padding: '60px 20px', textAlign: 'center', color: '#94a3b8' }}>
              <span style={{ fontSize: 36, marginBottom: 8 }}>💬</span>
              <p style={{ margin: 0, fontSize: 14 }}>참여한 봉사 채팅방이 없습니다</p>
              <p style={{ margin: '6px 0 0', fontSize: 12 }}>일정 상세에서 [참여]를 누르면 채팅방에 입장됩니다</p>
            </div>
          )}

          {/* 활성 채팅 */}
          {!selectedChat && activeChats.length > 0 && (
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
          {!selectedChat && lockedChats.length > 0 && (
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
