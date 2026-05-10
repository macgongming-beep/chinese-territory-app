// 글로벌 알림 버튼 (우상단 fixed)
// - 안 읽음 카운트 배지
// - 클릭 시 NotificationCenter 슬라이드 다운
// - 추후 헤더 통합 시 제거 예정 (임시 진입점)
import { useState } from 'react'
import { useNotifications } from '../hooks/useNotifications'
import { NotificationCenter } from './NotificationCenter'

export function GlobalNotificationButton({ userId }: { userId: number }) {
  const [open, setOpen] = useState(false)
  const { unreadCount } = useNotifications(userId)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title={unreadCount > 0 ? `알림 ${unreadCount}개` : '알림'}
        aria-label={unreadCount > 0 ? `알림 ${unreadCount}개` : '알림'}
        style={{
          position: 'fixed',
          top: 14,
          right: 14,
          zIndex: 900,
          width: 44,
          height: 44,
          borderRadius: '50%',
          border: 'none',
          background: '#ffffff',
          color: '#1e293b',
          fontSize: 22,
          cursor: 'pointer',
          boxShadow: '0 2px 10px rgba(0,0,0,0.10)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        type="button"
      >
        <span aria-hidden="true">🔔</span>
        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: 4,
              right: 4,
              minWidth: 18,
              height: 18,
              padding: '0 5px',
              borderRadius: 9,
              background: '#dc2626',
              color: '#fff',
              fontSize: 11,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '2px solid #fff',
            }}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>
      {open && <NotificationCenter userId={userId} onClose={() => setOpen(false)} />}
    </>
  )
}
