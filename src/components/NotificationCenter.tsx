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

const notificationIconProps = {
  width: 18,
  height: 18,
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  style: { display: 'block', flexShrink: 0 },
} as const

function NotificationIcon({ name }: { name: NotificationIconName }) {
  if (name === 'notice') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" {...notificationIconProps}>
        <path d="M4 12h3l8-5v10l-8-5H4Z" />
        <path d="M7 12v5a2 2 0 0 0 2 2h1" />
      </svg>
    )
  }
  if (name === 'calendar') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" {...notificationIconProps}>
        <path d="M7 3v4M17 3v4M4 9h16" />
        <rect x="4" y="5" width="16" height="16" rx="3" />
      </svg>
    )
  }
  if (name === 'message' || name === 'chat') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" {...notificationIconProps}>
        <path d="M21 12a8 8 0 0 1-8 8H7l-4 2 1.4-4.2A8 8 0 1 1 21 12Z" />
        <path d="M8 12h.01M12 12h.01M16 12h.01" />
      </svg>
    )
  }
  if (name === 'mention') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" {...notificationIconProps}>
        <path d="M16 8v5a3 3 0 1 1-1.1-2.3" />
        <path d="M16 13a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8" />
      </svg>
    )
  }
  if (name === 'play') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" {...notificationIconProps}>
        <path d="M8 5v14l11-7Z" />
      </svg>
    )
  }
  if (name === 'stop') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" {...notificationIconProps}>
        <rect x="6" y="6" width="12" height="12" rx="2" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...notificationIconProps}>
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
        background: 'rgba(26,26,24,0.28)',
      }}
      onClick={onClose}
    >
      <div
        className="header-action-panel"
        style={{
          position: 'absolute',
          top: 8,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 'calc(100% - 16px)',
          maxWidth: 480,
          maxHeight: 'calc(100% - 16px)',
          background: 'var(--bg)',
          border: '1px solid var(--line)',
          borderRadius: 14,
          boxShadow: '0 16px 48px rgba(0,0,0,0.18)',
          display: 'flex',
          flexDirection: 'column',
          boxSizing: 'border-box',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 16px', borderBottom: '1px solid var(--line)',
        }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 17, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.01em' }}>알림</span>
            {totalUnread > 0 && (
              <span style={{
                fontSize: 11.5, fontWeight: 700,
                color: 'var(--status-danger)',
                background: 'var(--status-danger-bg)',
                borderRadius: 999, padding: '2px 9px',
                fontVariantNumeric: 'tabular-nums',
              }}>{totalUnread}</span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {totalUnread > 0 && (
              <button
                onClick={markAllRead}
                style={{
                  height: 28, minHeight: 28, padding: '0 10px',
                  borderRadius: 8, border: '1px solid var(--line-2)',
                  background: 'var(--surface)', color: 'var(--text)',
                  fontSize: 12, fontWeight: 600, cursor: 'pointer',
                }}
                type="button"
              >모두 읽음</button>
            )}
            <button
              onClick={onClose}
              style={{
                width: 30, height: 30, minHeight: 30,
                background: 'transparent', border: 'none',
                color: 'var(--text)', cursor: 'pointer',
                display: 'grid', placeItems: 'center',
                borderRadius: 8,
              }}
              aria-label="닫기"
              type="button"
            >
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                <line x1="6" y1="6" x2="18" y2="18" />
                <line x1="18" y1="6" x2="6" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* 본문 */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 12px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {!userId ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--muted)' }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>로그인 정보 확인이 필요합니다</p>
              <p style={{ margin: '6px 0 0', fontSize: 12.5 }}>다시 로그인하면 알림을 불러올 수 있습니다.</p>
            </div>
          ) : !hasAny ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--muted)' }}>
              <p style={{ margin: 0, fontSize: 14 }}>아직 알림이 없습니다</p>
            </div>
          ) : (
            <>
              {(unreadOthers.length > 0 || unreadChatGroups.length > 0) && (
                <>
                  <span style={{
                    fontSize: 12, fontWeight: 600, color: 'var(--muted)',
                    padding: '0 4px 6px',
                  }}>새 알림</span>
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
                </>
              )}
              {(readOthers.length > 0 || readChatGroups.length > 0) && (
                <>
                  <span style={{
                    fontSize: 12, fontWeight: 600, color: 'var(--muted)',
                    padding: '12px 4px 6px',
                  }}>이전 알림</span>
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
                </>
              )}
            </>
          )}
        </div>
      </div>

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
        width: '100%', padding: '12px',
        background: isAllRead ? 'transparent' : 'rgba(26,26,24,0.04)',
        border: 'none', borderRadius: 10,
        cursor: 'pointer', textAlign: 'left',
        minHeight: 0,
      }}
      type="button"
    >
      <div style={{
        flexShrink: 0, width: 32, height: 32, borderRadius: 8,
        background: 'var(--ink)', color: '#fff',
        display: 'grid', placeItems: 'center',
      }}>
        <NotificationIcon name={meta.icon} />
      </div>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flex: 1, minWidth: 0 }}>
            {group.unreadCount > 0 && (
              <span style={{ width: 6, height: 6, borderRadius: 99, background: 'var(--status-danger)', flexShrink: 0 }} />
            )}
            <span style={{
              fontSize: 14, fontWeight: 600, color: 'var(--ink)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {eventTitle}
            </span>
          </div>
          {participantCount > 0 && (
            <span style={{ flexShrink: 0, fontSize: 12, color: 'var(--muted)' }}>
              {participantCount}명
            </span>
          )}
        </div>
        {latestBody && (
          <span style={{
            fontSize: 12, color: 'var(--muted)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{latestBody}</span>
        )}
        <span style={{ fontSize: 12, color: 'var(--muted-2)' }}>
          {formatRelativeTime(group.latest.createdAt)}
        </span>
      </div>
      {group.unreadCount > 0 && (
        <span style={{
          flexShrink: 0, alignSelf: 'center',
          minWidth: 18, padding: '2px 6px',
          borderRadius: 99, background: 'var(--status-danger)', color: '#fff',
          fontSize: 10, fontWeight: 700,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          fontVariantNumeric: 'tabular-nums',
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
  const meta = TYPE_LABEL[n.type] ?? { icon: 'bell' as const, color: 'var(--text)', bg: 'var(--tint)' }
  const isChat = n.type === 'chat'

  return (
    <button
      onClick={() => onClick(n)}
      style={{
        display: 'flex', gap: 12, alignItems: 'flex-start',
        width: '100%', padding: '12px',
        background: n.isRead ? 'transparent' : 'rgba(26,26,24,0.04)',
        border: 'none', borderRadius: 10,
        cursor: 'pointer', textAlign: 'left',
        minHeight: 0,
      }}
      type="button"
    >
      <div style={{
        flexShrink: 0, width: 32, height: 32, borderRadius: 8,
        background: isChat ? 'var(--ink)' : 'var(--tint)',
        color: isChat ? '#fff' : 'var(--text)',
        display: 'grid', placeItems: 'center',
      }}>
        <NotificationIcon name={meta.icon} />
      </div>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          {!n.isRead && (
            <span style={{
              width: 6, height: 6, borderRadius: 99, background: 'var(--status-danger)', flexShrink: 0,
            }} />
          )}
          <span style={{
            fontSize: 14, fontWeight: n.isRead ? 500 : 600, color: 'var(--ink)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {n.title}
          </span>
        </div>
        {n.body && (
          <span style={{
            fontSize: 12, color: 'var(--muted)',
            overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box',
            WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', lineHeight: 1.4,
          }}>{n.body}</span>
        )}
        <span style={{ fontSize: 12, color: 'var(--muted-2)' }}>
          {formatRelativeTime(n.createdAt)}
        </span>
      </div>
    </button>
  )
}
