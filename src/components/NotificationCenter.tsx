// 알림 센터 (헤더 🔔 클릭 시 슬라이드 다운)
import { useNavigate } from 'react-router-dom'
import { useNotifications, type AppNotification, type NotificationType } from '../hooks/useNotifications'
import { useUserChats } from '../hooks/useUserChats'
import { normalizeAppLink } from '../utils/appNavigation'

const TYPE_LABEL: Record<NotificationType, { icon: NotificationIconName; color: string; bg: string }> = {
  notice: { icon: 'notice', color: '#2563eb', bg: '#eff4fe' },
  event_change: { icon: 'calendar', color: '#d97706', bg: '#fffbeb' },
  comment: { icon: 'message', color: '#0891b2', bg: '#ecfeff' },
  mention: { icon: 'mention', color: '#7c3aed', bg: '#f5f3ff' },
  chat: { icon: 'chat', color: '#0891b2', bg: '#ecfeff' },
  service_started: { icon: 'play', color: '#059669', bg: '#ecfdf5' },
  service_ended: { icon: 'stop', color: '#64748b', bg: '#f3f4f6' },
  assignment: { icon: 'mention', color: '#0d9488', bg: '#ccfbf1' },
}

// 채팅 알림 → 카톡 스타일 그룹 (event_id 기준)
function extractEventIdFromLink(link: string | null): number | null {
  if (!link) return null
  const m = link.match(/openChat=(\d+)/)
  return m ? Number(m[1]) : null
}

type ChatGroup = {
  eventId: number
  notifications: AppNotification[]
  latest: AppNotification
  unreadCount: number
}

function groupChatNotifications(items: AppNotification[]): {
  groups: ChatGroup[]
  others: AppNotification[]
} {
  const map = new Map<number, AppNotification[]>()
  const others: AppNotification[] = []
  for (const n of items) {
    const isChatKind = n.type === 'chat' || n.type === 'mention'
    const eventId = isChatKind ? extractEventIdFromLink(n.link) : null
    if (eventId !== null) {
      const arr = map.get(eventId) ?? []
      arr.push(n)
      map.set(eventId, arr)
    } else {
      others.push(n)
    }
  }
  const groups: ChatGroup[] = Array.from(map.entries()).map(([eventId, list]) => {
    // 최신순 정렬
    const sorted = [...list].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
    const unread = sorted.filter((n) => !n.isRead)
    return {
      eventId,
      notifications: sorted,
      latest: sorted[0],
      unreadCount: unread.length,
    }
  })
  // 그룹은 최신 알림 시각으로 정렬
  groups.sort(
    (a, b) => new Date(b.latest.createdAt).getTime() - new Date(a.latest.createdAt).getTime()
  )
  return { groups, others }
}

type NotificationIconName = 'notice' | 'calendar' | 'message' | 'mention' | 'chat' | 'play' | 'stop' | 'bell'

function NotificationIcon({ name }: { name: NotificationIconName }) {
  if (name === 'notice') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 12h3l8-5v10l-8-5H4Z" />
        <path d="M7 12v5a2 2 0 0 0 2 2h1" />
      </svg>
    )
  }
  if (name === 'calendar') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7 3v4M17 3v4M4 9h16" />
        <rect x="4" y="5" width="16" height="16" rx="3" />
      </svg>
    )
  }
  if (name === 'message' || name === 'chat') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M21 12a8 8 0 0 1-8 8H7l-4 2 1.4-4.2A8 8 0 1 1 21 12Z" />
        <path d="M8 12h.01M12 12h.01M16 12h.01" />
      </svg>
    )
  }
  if (name === 'mention') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M16 8v5a3 3 0 1 1-1.1-2.3" />
        <path d="M16 13a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8" />
      </svg>
    )
  }
  if (name === 'play') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M8 5v14l11-7Z" />
      </svg>
    )
  }
  if (name === 'stop') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="6" y="6" width="12" height="12" rx="2" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M18 9a6 6 0 1 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
      <path d="M10 21a2 2 0 0 0 4 0" />
    </svg>
  )
}

function formatRelativeTime(iso: string): string {
  const now = Date.now()
  const t = new Date(iso).getTime()
  const diff = Math.max(0, now - t)
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return `${sec}초 전`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}분 전`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}시간 전`
  const days = Math.floor(hr / 24)
  if (days < 7) return `${days}일 전`
  // 1주 이상은 날짜
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

export function NotificationCenter({
  userId,
  userName,
  onClose,
}: {
  userId: number | null
  userName?: string | null
  onClose: () => void
}) {
  const navigate = useNavigate()
  const { notifications, markRead, markAllRead } = useNotifications(userId)
  const { chats: userChats } = useUserChats(userId, userName ?? null, { realtime: false })

  const chatInfoMap = new Map<number, { title: string; participantCount: number }>()
  userChats.forEach((c) =>
    chatInfoMap.set(c.eventId, { title: c.eventTitle, participantCount: c.participantCount })
  )

  // 카톡 스타일: 채팅 알림 그룹화, 나머지는 그대로
  const { groups: chatGroups, others } = groupChatNotifications(notifications)

  // 표시 순서: 채팅 그룹 → 기타 알림 (안 읽음 우선)
  const unreadOthers = others.filter((n) => !n.isRead)
  const readOthers = others.filter((n) => n.isRead)
  const unreadChatGroups = chatGroups.filter((g) => g.unreadCount > 0)
  const readChatGroups = chatGroups.filter((g) => g.unreadCount === 0)

  const totalUnread =
    unreadOthers.length + chatGroups.reduce((sum, g) => sum + g.unreadCount, 0)
  const hasAny = notifications.length > 0

  async function handleClickItem(n: AppNotification) {
    if (!n.isRead) await markRead(n.id)
    onClose()
    const targetLink = normalizeAppLink(n.link)
    if (targetLink) {
      navigate(targetLink)
    }
  }

  async function handleClickChatGroup(group: ChatGroup) {
    // 그룹 내 안 읽음 모두 읽음 처리 (낙관적으로 동시 처리)
    const unreadIds = group.notifications.filter((n) => !n.isRead).map((n) => n.id)
    await Promise.all(unreadIds.map((id) => markRead(id)))
    onClose()
    const targetLink = normalizeAppLink(group.latest.link)
    if (targetLink) navigate(targetLink)
  }

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
          animation: 'notifSlideIn 0.25s ease-out',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="header-action-panel__head" style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 16px 12px', borderBottom: '1px solid #f1f5f9',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#1e293b' }}>알림</h2>
            {totalUnread > 0 && (
              <span style={{
                fontSize: 11, fontWeight: 700, color: '#fff', background: '#dc2626',
                borderRadius: 99, padding: '2px 8px',
              }}>{totalUnread}</span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {totalUnread > 0 && (
              <button
                onClick={markAllRead}
                style={{
                  padding: '6px 10px', borderRadius: 7, border: '1px solid #e2e8f0',
                  background: '#fff', color: '#64748b', fontSize: 12, fontWeight: 600,
                  cursor: 'pointer',
                }}
                type="button"
              >모두 읽음</button>
            )}
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
        </div>

        {/* 본문 */}
        <div className="header-action-panel__body" style={{ flex: 1, overflowY: 'auto' }}>
          {!userId ? (
            <div className="header-action-panel__empty" style={{
              padding: '60px 20px', textAlign: 'center', color: '#94a3b8',
            }}>
              <span style={{
                display: 'grid', width: 44, height: 44, placeItems: 'center',
                marginBottom: 8, borderRadius: 14, background: '#f3f4f6', color: '#6b7280',
              }}>
                <NotificationIcon name="bell" />
              </span>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#475569' }}>로그인 정보 확인이 필요합니다</p>
              <p style={{ margin: '6px 0 0', fontSize: 12 }}>다시 로그인하면 알림을 불러올 수 있습니다.</p>
            </div>
          ) : !hasAny ? (
            <div className="header-action-panel__empty" style={{
              padding: '60px 20px', textAlign: 'center', color: '#94a3b8',
            }}>
              <span style={{
                display: 'grid', width: 44, height: 44, placeItems: 'center',
                marginBottom: 8, borderRadius: 14, background: '#f3f4f6', color: '#6b7280',
              }}>
                <NotificationIcon name="bell" />
              </span>
              <p style={{ margin: 0, fontSize: 14 }}>아직 알림이 없습니다</p>
            </div>
          ) : (
            <>
              {(unreadOthers.length > 0 || unreadChatGroups.length > 0) && (
                <div>
                  <p style={{
                    margin: 0, padding: '12px 16px 6px', fontSize: 11, fontWeight: 700,
                    color: '#94a3b8', letterSpacing: '0.04em', textTransform: 'uppercase',
                  }}>새 알림</p>
                  {unreadChatGroups.map((g) => (
                    <ChatGroupItem
                      key={`chatgroup-${g.eventId}`}
                      group={g}
                      info={chatInfoMap.get(g.eventId)}
                      onClick={handleClickChatGroup}
                    />
                  ))}
                  {unreadOthers.map((n) => (
                    <NotificationItem key={n.id} notification={n} onClick={handleClickItem} />
                  ))}
                </div>
              )}
              {(readOthers.length > 0 || readChatGroups.length > 0) && (
                <div>
                  <p style={{
                    margin: 0, padding: '16px 16px 6px', fontSize: 11, fontWeight: 700,
                    color: '#94a3b8', letterSpacing: '0.04em', textTransform: 'uppercase',
                  }}>이전 알림</p>
                  {readChatGroups.map((g) => (
                    <ChatGroupItem
                      key={`chatgroup-${g.eventId}`}
                      group={g}
                      info={chatInfoMap.get(g.eventId)}
                      onClick={handleClickChatGroup}
                    />
                  ))}
                  {readOthers.map((n) => (
                    <NotificationItem key={n.id} notification={n} onClick={handleClickItem} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <style>{`
        @keyframes notifSlideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        @media (max-width: 480px) {
          @keyframes notifSlideIn {
            from { transform: translateY(-100%); }
            to { transform: translateY(0); }
          }
        }
      `}</style>
    </div>
  )
}

function ChatGroupItem({
  group,
  info,
  onClick,
}: {
  group: ChatGroup
  info?: { title: string; participantCount: number }
  onClick: (group: ChatGroup) => void
}) {
  const meta = TYPE_LABEL.chat
  const eventTitle = info?.title ?? '봉사 채팅'
  const participantCount = info?.participantCount ?? 0
  const isAllRead = group.unreadCount === 0
  // 최신 메시지 body 에서 author 분리: "author: content" 형태
  const latestBody = group.latest.body ?? ''
  return (
    <button
      onClick={() => onClick(group)}
      style={{
        display: 'flex', gap: 12, alignItems: 'flex-start',
        width: '100%', padding: '12px 16px',
        background: isAllRead ? '#fff' : '#f0f9ff',
        border: 'none', borderBottom: '1px solid #f1f5f9',
        cursor: 'pointer', textAlign: 'left',
      }}
      type="button"
    >
      <div style={{
        flexShrink: 0, width: 38, height: 38, borderRadius: 12,
        background: meta.bg, color: meta.color,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 700, position: 'relative',
      }}>
        <NotificationIcon name={meta.icon} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          fontSize: 13, fontWeight: 700, color: '#1e293b',
        }}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
            {eventTitle}
          </span>
          {participantCount > 0 && (
            <span style={{
              flexShrink: 0, fontSize: 11, fontWeight: 600, color: '#64748b',
            }}>
              {participantCount}명
            </span>
          )}
        </div>
        {latestBody && (
          <p style={{
            margin: '3px 0 0', fontSize: 12, color: '#64748b',
            overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box',
            WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', lineHeight: 1.4,
          }}>{latestBody}</p>
        )}
        <p style={{ margin: '4px 0 0', fontSize: 11, color: '#94a3b8' }}>
          {formatRelativeTime(group.latest.createdAt)}
        </p>
      </div>
      {group.unreadCount > 0 && (
        <span style={{
          flexShrink: 0, alignSelf: 'center',
          minWidth: 22, height: 22, padding: '0 7px',
          borderRadius: 99, background: '#dc2626', color: '#fff',
          fontSize: 11, fontWeight: 800,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {group.unreadCount > 99 ? '99+' : group.unreadCount}
        </span>
      )}
    </button>
  )
}

function NotificationItem({
  notification: n,
  onClick,
}: {
  notification: AppNotification
  onClick: (n: AppNotification) => void
}) {
  const meta = TYPE_LABEL[n.type] ?? { icon: 'bell' as const, color: '#64748b', bg: '#f3f4f6' }

  return (
    <button
      onClick={() => onClick(n)}
      style={{
        display: 'flex', gap: 12, alignItems: 'flex-start',
        width: '100%', padding: '12px 16px',
        background: n.isRead ? '#fff' : '#f0f9ff',
        border: 'none', borderBottom: '1px solid #f1f5f9',
        cursor: 'pointer', textAlign: 'left',
      }}
      type="button"
    >
      <div style={{
        flexShrink: 0, width: 34, height: 34, borderRadius: 12,
        background: meta.bg, color: meta.color,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 700,
      }}>
        <NotificationIcon name={meta.icon} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          fontSize: 13, fontWeight: 700, color: '#1e293b',
        }}>
          {!n.isRead && (
            <span style={{
              width: 6, height: 6, borderRadius: 99, background: '#dc2626', flexShrink: 0,
            }} />
          )}
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {n.title}
          </span>
        </div>
        {n.body && (
          <p style={{
            margin: '3px 0 0', fontSize: 12, color: '#64748b',
            overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box',
            WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', lineHeight: 1.4,
          }}>{n.body}</p>
        )}
        <p style={{ margin: '4px 0 0', fontSize: 11, color: '#94a3b8' }}>
          {formatRelativeTime(n.createdAt)}
        </p>
      </div>
    </button>
  )
}
