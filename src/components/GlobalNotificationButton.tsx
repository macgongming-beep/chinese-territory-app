// 글로벌 알림 + 채팅 버튼 (우상단 fixed)
// - 알림: 안 읽음 카운트
// - 채팅: 안 읽음 카운트 (참여 일정의 미읽 메시지)
// - 클릭 시 각 모달 슬라이드 다운
// - 추후 헤더 통합 시 제거 예정 (임시 진입점)
import { useState } from 'react'
import { useNotifications } from '../hooks/useNotifications'
import { useUserChats } from '../hooks/useUserChats'
import { NotificationCenter } from './NotificationCenter'
import { GlobalChatModal } from './GlobalChatModal'

export function GlobalNotificationButton({
  userId,
  userName,
}: {
  userId: number
  userName: string
}) {
  const [openNotif, setOpenNotif] = useState(false)
  const [openChat, setOpenChat] = useState(false)
  const { unreadCount: unreadNotif } = useNotifications(userId)
  const { totalUnread: unreadChat } = useUserChats(userId, userName)

  return (
    <>
      <div
        style={{
          position: 'fixed',
          top: 14,
          right: 14,
          zIndex: 900,
          display: 'flex',
          gap: 8,
        }}
      >
        <FloatingActionButton
          icon="💬"
          label="채팅"
          count={unreadChat}
          onClick={() => setOpenChat(true)}
        />
        <FloatingActionButton
          icon="🔔"
          label="알림"
          count={unreadNotif}
          onClick={() => setOpenNotif(true)}
        />
      </div>

      {openNotif && <NotificationCenter userId={userId} onClose={() => setOpenNotif(false)} />}
      {openChat && (
        <GlobalChatModal userId={userId} userName={userName} onClose={() => setOpenChat(false)} />
      )}
    </>
  )
}

function FloatingActionButton({
  icon,
  label,
  count,
  onClick,
}: {
  icon: string
  label: string
  count: number
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      title={count > 0 ? `${label} ${count}개` : label}
      aria-label={count > 0 ? `${label} ${count}개` : label}
      style={{
        position: 'relative',
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
      <span aria-hidden="true">{icon}</span>
      {count > 0 && (
        <span
          style={{
            position: 'absolute',
            top: 2,
            right: 2,
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
          {count > 99 ? '99+' : count}
        </span>
      )}
    </button>
  )
}
