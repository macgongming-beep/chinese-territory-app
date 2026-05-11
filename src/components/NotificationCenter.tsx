// 알림 센터 (헤더 🔔 클릭 시 슬라이드 다운)
import { useNavigate } from 'react-router-dom'
import { useNotifications, type AppNotification, type NotificationType } from '../hooks/useNotifications'
import { normalizeAppLink } from '../utils/appNavigation'

const TYPE_LABEL: Record<NotificationType, { icon: string; color: string }> = {
  notice: { icon: '📢', color: '#2563eb' },
  event_change: { icon: '📅', color: '#d97706' },
  comment: { icon: '💬', color: '#0891b2' },
  mention: { icon: '@', color: '#7c3aed' },
  chat: { icon: '💭', color: '#0891b2' },
  service_started: { icon: '▶️', color: '#16a34a' },
  service_ended: { icon: '⏹', color: '#64748b' },
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
  onClose,
}: {
  userId: number | null
  onClose: () => void
}) {
  const navigate = useNavigate()
  const { notifications, markRead, markAllRead } = useNotifications(userId)

  const unread = notifications.filter((n) => !n.isRead)
  const readGroup = notifications.filter((n) => n.isRead)

  async function handleClickItem(n: AppNotification) {
    if (!n.isRead) await markRead(n.id)
    onClose()
    const targetLink = normalizeAppLink(n.link)
    if (targetLink) {
      navigate(targetLink)
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50000,
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
          animation: 'notifSlideIn 0.25s ease-out',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 16px 12px', borderBottom: '1px solid #f1f5f9',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#1e293b' }}>알림</h2>
            {unread.length > 0 && (
              <span style={{
                fontSize: 11, fontWeight: 700, color: '#fff', background: '#dc2626',
                borderRadius: 99, padding: '2px 8px',
              }}>{unread.length}</span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {unread.length > 0 && (
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
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {!userId ? (
            <div style={{
              padding: '60px 20px', textAlign: 'center', color: '#94a3b8',
            }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>🔔</div>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#475569' }}>로그인 정보 확인이 필요합니다</p>
              <p style={{ margin: '6px 0 0', fontSize: 12 }}>다시 로그인하면 알림을 불러올 수 있습니다.</p>
            </div>
          ) : notifications.length === 0 ? (
            <div style={{
              padding: '60px 20px', textAlign: 'center', color: '#94a3b8',
            }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>🔔</div>
              <p style={{ margin: 0, fontSize: 14 }}>아직 알림이 없습니다</p>
            </div>
          ) : (
            <>
              {unread.length > 0 && (
                <div>
                  <p style={{
                    margin: 0, padding: '12px 16px 6px', fontSize: 11, fontWeight: 700,
                    color: '#94a3b8', letterSpacing: '0.04em', textTransform: 'uppercase',
                  }}>📌 새 알림</p>
                  {unread.map((n) => (
                    <NotificationItem key={n.id} notification={n} onClick={handleClickItem} />
                  ))}
                </div>
              )}
              {readGroup.length > 0 && (
                <div>
                  <p style={{
                    margin: 0, padding: '16px 16px 6px', fontSize: 11, fontWeight: 700,
                    color: '#94a3b8', letterSpacing: '0.04em', textTransform: 'uppercase',
                  }}>이전 알림</p>
                  {readGroup.map((n) => (
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

function NotificationItem({
  notification: n,
  onClick,
}: {
  notification: AppNotification
  onClick: (n: AppNotification) => void
}) {
  const meta = TYPE_LABEL[n.type] ?? { icon: '🔔', color: '#64748b' }

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
        flexShrink: 0, width: 32, height: 32, borderRadius: 8,
        background: meta.color + '15', color: meta.color,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 16, fontWeight: 700,
      }}>
        {meta.icon}
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
