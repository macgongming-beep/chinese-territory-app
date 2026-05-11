import type { ReactNode } from 'react'
import { Component } from 'react'
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useNotifications } from '../hooks/useNotifications'
import { useUserChats } from '../hooks/useUserChats'
import { NotificationCenter } from './NotificationCenter'
import { GlobalChatModal } from './GlobalChatModal'

type AppHeaderVariant = 'mobile' | 'desktop'

type AppHeaderProps = {
  pageTitle: string
  variant?: AppHeaderVariant
  isHome?: boolean
  date?: Date | string
  subtitle?: string
  showBack?: boolean
  onBack?: () => void
  notificationCount?: number
  chatCount?: number
  userId?: number | null
  userName?: string
  onOpenNotifications?: () => void
  onOpenChat?: () => void
  onOpenMenu?: () => void
  rightSlot?: ReactNode
  className?: string
}

type AppHeaderActionButtonsProps = {
  userId?: number | null
  userName?: string
  notificationCount?: number
  chatCount?: number
  onOpenNotifications?: () => void
  onOpenChat?: () => void
  onOpenMenu?: () => void
  className?: string
  buttonClassName?: string
  showMenu?: boolean
}

type HeaderOverlayErrorBoundaryProps = {
  children: ReactNode
  onClose: () => void
}

type HeaderOverlayErrorBoundaryState = {
  error: Error | null
}

class HeaderOverlayErrorBoundary extends Component<HeaderOverlayErrorBoundaryProps, HeaderOverlayErrorBoundaryState> {
  state: HeaderOverlayErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error) {
    console.error('[header overlay] render failed', error)
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div className="header-action-panel-backdrop" onClick={this.props.onClose}>
        <section className="header-action-panel" onClick={(event) => event.stopPropagation()}>
          <div className="header-action-panel__head">
            <h2>불러오지 못했습니다</h2>
            <button type="button" aria-label="닫기" onClick={this.props.onClose}>×</button>
          </div>
          <div className="header-action-panel__empty">
            <strong>패널을 여는 중 문제가 발생했습니다.</strong>
            <p>새로고침 후 다시 시도해 주세요.</p>
            <small>{this.state.error.message}</small>
          </div>
        </section>
      </div>
    )
  }
}

function formatHeaderDate(date: Date | string) {
  const value = typeof date === 'string' ? new Date(date) : date

  if (Number.isNaN(value.getTime())) {
    return typeof date === 'string' ? date : ''
  }

  const weekdays = ['일', '월', '화', '수', '목', '금', '토']
  return `${value.getFullYear()}년 ${value.getMonth() + 1}월 ${value.getDate()}일(${weekdays[value.getDay()]})`
}

function IconBadge({ count }: { count?: number }) {
  if (!count || count <= 0) return null

  return (
    <span className="app-header__badge" aria-hidden="true">
      {count > 99 ? '99+' : count}
    </span>
  )
}

function HeaderOverlayPortal({ children }: { children: ReactNode }) {
  if (typeof document === 'undefined') return null
  return createPortal(children, document.body)
}

export function AppHeaderActionButtons({
  userId,
  userName = '',
  notificationCount,
  chatCount,
  onOpenNotifications,
  onOpenChat,
  onOpenMenu,
  className = 'app-header__actions',
  buttonClassName = 'app-header__action',
  showMenu = true,
}: AppHeaderActionButtonsProps) {
  const [openNotifications, setOpenNotifications] = useState(false)
  const [openChat, setOpenChat] = useState(false)
  const { unreadCount } = useNotifications(userId ?? null)
  const { totalUnread } = useUserChats(userId ?? null, userName)
  const resolvedNotificationCount = notificationCount ?? unreadCount
  const resolvedChatCount = chatCount ?? totalUnread

  const handleOpenNotifications = () => {
    if (onOpenNotifications) {
      onOpenNotifications()
      return
    }
    setOpenNotifications(true)
  }

  const handleOpenChat = () => {
    if (onOpenChat) {
      onOpenChat()
      return
    }
    setOpenChat(true)
  }

  return (
    <>
      <div className={className}>
        <button
          type="button"
          className={buttonClassName}
          aria-label={resolvedNotificationCount ? `알림 ${resolvedNotificationCount}개` : '알림'}
          onClick={handleOpenNotifications}
        >
          <span aria-hidden="true">🔔</span>
          <IconBadge count={resolvedNotificationCount} />
        </button>
        <button
          type="button"
          className={buttonClassName}
          aria-label={resolvedChatCount ? `채팅 ${resolvedChatCount}개` : '채팅'}
          onClick={handleOpenChat}
        >
          <span aria-hidden="true">💬</span>
          <IconBadge count={resolvedChatCount} />
        </button>
        {showMenu ? (
          <button type="button" className={buttonClassName} aria-label="더보기" onClick={onOpenMenu}>
            <span aria-hidden="true">⋮</span>
          </button>
        ) : null}
      </div>

      {openNotifications ? (
        <HeaderOverlayPortal>
          <HeaderOverlayErrorBoundary onClose={() => setOpenNotifications(false)}>
            <NotificationCenter userId={userId ?? null} onClose={() => setOpenNotifications(false)} />
          </HeaderOverlayErrorBoundary>
        </HeaderOverlayPortal>
      ) : null}
      {openChat ? (
        <HeaderOverlayPortal>
          <HeaderOverlayErrorBoundary onClose={() => setOpenChat(false)}>
            <GlobalChatModal userId={userId ?? null} userName={userName} onClose={() => setOpenChat(false)} />
          </HeaderOverlayErrorBoundary>
        </HeaderOverlayPortal>
      ) : null}
    </>
  )
}

export function AppHeader({
  pageTitle,
  variant = 'mobile',
  isHome = false,
  date,
  subtitle,
  showBack = false,
  onBack,
  notificationCount,
  chatCount,
  userId,
  userName,
  onOpenNotifications,
  onOpenChat,
  onOpenMenu,
  rightSlot,
  className,
}: AppHeaderProps) {
  const headerSubtitle = isHome && date ? formatHeaderDate(date) : subtitle
  const rootClassName = ['app-header', `app-header--${variant}`, className].filter(Boolean).join(' ')

  return (
    <header className={rootClassName}>
      <div className="app-header__left">
        {showBack ? (
          <button type="button" className="app-header__back" aria-label="뒤로가기" onClick={onBack}>
            ‹
          </button>
        ) : null}

        <div className="app-header__title-group">
          <h1 className="app-header__title">{pageTitle}</h1>
          {headerSubtitle ? <p className="app-header__subtitle">{headerSubtitle}</p> : null}
        </div>
      </div>

      <div className="app-header__actions">
        {rightSlot}
        <AppHeaderActionButtons
          userId={userId}
          userName={userName}
          notificationCount={notificationCount}
          chatCount={chatCount}
          onOpenNotifications={onOpenNotifications}
          onOpenChat={onOpenChat}
          onOpenMenu={onOpenMenu}
          className="app-header__actions-inline"
        />
      </div>
    </header>
  )
}
