import type { ReactNode } from 'react'
import { Component } from 'react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate } from 'react-router-dom'
import { t, type AppLanguage } from '../i18n'
import { useNotifications } from '../hooks/useNotifications'
import { useUserChats } from '../hooks/useUserChats'
import type { Role } from '../types'
import { NotificationCenter } from './NotificationCenter'
import { GlobalChatModal } from './GlobalChatModal'
import type { MentionUser } from './CommentSection'

type HeaderChatTarget = {
  eventId: number
  eventTitle: string
  eventDate: string
  eventTime: string | null
} | null

type AppHeaderVariant = 'mobile' | 'desktop'

type AppHeaderProps = {
  pageTitle: string
  variant?: AppHeaderVariant
  isHome?: boolean
  date?: Date | string
  subtitle?: ReactNode
  showBack?: boolean
  onBack?: () => void
  notificationCount?: number
  chatCount?: number
  userId?: number | null
  userName?: string
  role?: Role
  chatUsers?: MentionUser[]
  onOpenNotifications?: () => void
  onOpenChat?: () => void
  onOpenMenu?: () => void
  rightSlot?: ReactNode
  className?: string
  language?: AppLanguage
}

type AppHeaderActionButtonsProps = {
  userId?: number | null
  userName?: string
  notificationCount?: number
  chatCount?: number
  onOpenNotifications?: () => void
  onOpenChat?: () => void
  onOpenMenu?: () => void
  role?: Role
  chatUsers?: MentionUser[]
  className?: string
  buttonClassName?: string
  showMenu?: boolean
  language?: AppLanguage
}

type HeaderOverlayErrorBoundaryProps = {
  children: ReactNode
  onClose: () => void
  language?: AppLanguage
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
    const { language = 'ko' } = this.props
    if (!this.state.error) return this.props.children

    return (
      <div className="header-action-panel-backdrop" onClick={this.props.onClose}>
        <section className="header-action-panel" onClick={(event) => event.stopPropagation()}>
          <div className="header-action-panel__head">
            <h2>{t(language, 'header.errorTitle')}</h2>
            <button type="button" aria-label={t(language, 'header.close')} onClick={this.props.onClose}>×</button>
          </div>
          <div className="header-action-panel__empty">
            <strong>{t(language, 'header.errorDesc')}</strong>
            <p>{t(language, 'header.errorRefresh')}</p>
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

function HeaderActionIcon({ name }: { name: 'notification' | 'chat' | 'menu' }) {
  if (name === 'notification') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M18 9a6 6 0 1 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
        <path d="M10 21a2 2 0 0 0 4 0" />
      </svg>
    )
  }
  if (name === 'chat') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M21 12a8 8 0 0 1-8 8H7l-4 2 1.4-4.2A8 8 0 1 1 21 12Z" />
        <path d="M8 12h.01M12 12h.01M16 12h.01" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 5h.01M12 12h.01M12 19h.01" />
    </svg>
  )
}

function HeaderOverlayPortal({ children }: { children: ReactNode }) {
  if (typeof document === 'undefined') return null
  return createPortal(children, document.body)
}

export function AppHeaderActionButtons({
  userId,
  userName = '',
  role = 'user',
  chatUsers = [],
  notificationCount,
  chatCount,
  onOpenNotifications,
  onOpenChat,
  onOpenMenu,
  className = 'app-header__actions',
  buttonClassName = 'app-header__action',
  showMenu = true,
  language = 'ko',
}: AppHeaderActionButtonsProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const chatReturnToRef = useRef<string | null>(null)
  const [openNotifications, setOpenNotifications] = useState(false)
  const [openChat, setOpenChat] = useState(false)
  const [headerChatTarget, setHeaderChatTarget] = useState<HeaderChatTarget>(null)
  const { unreadCount, notifications: notifList, markRead: notifMarkRead, markAllRead: notifMarkAllRead, clearReadNotifications: notifClearRead } = useNotifications(userId ?? null)
  const { totalUnread, markChatReadLocally } = useUserChats(userId ?? null, userName)
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
    chatReturnToRef.current = `${location.pathname}${location.search}${location.hash}`
    setOpenChat(true)
  }

  const handleCloseChat = () => {
    const returnTo = chatReturnToRef.current
    setOpenChat(false)
    setHeaderChatTarget(null)
    chatReturnToRef.current = null

    if (!returnTo) return

    const current = `${location.pathname}${location.search}${location.hash}`
    if (current !== returnTo) {
      navigate(returnTo, { replace: true })
    }
  }

  const handleOpenChatRoom = (chat: NonNullable<HeaderChatTarget>) => {
    const returnTo = chatReturnToRef.current
    setHeaderChatTarget(chat)
    setOpenChat(true)
    if (returnTo) {
      window.setTimeout(() => {
        const current = `${window.location.pathname}${window.location.search}${window.location.hash}`
        if (current !== returnTo) {
          navigate(returnTo, { replace: true })
        }
      }, 0)
    }
  }

  useEffect(() => {
    function onOpenEventChat(e: Event) {
      const detail = (e as CustomEvent).detail as {
        eventId: number; eventTitle?: string; eventDate?: string; eventTime?: string | null
      } | null
      if (!detail || !detail.eventId) return
      chatReturnToRef.current = `${location.pathname}${location.search}${location.hash}`
      handleOpenChatRoom({
        eventId: detail.eventId,
        eventTitle: detail.eventTitle ?? '봉사 채팅',
        eventDate: detail.eventDate ?? '',
        eventTime: detail.eventTime ?? null,
      })
    }
    window.addEventListener('app:open-event-chat', onOpenEventChat)
    return () => window.removeEventListener('app:open-event-chat', onOpenEventChat)
  }, [location.pathname, location.search, location.hash])

  return (
    <>
      <div className={className}>
        <button
          type="button"
          className={buttonClassName}
          aria-label={resolvedNotificationCount ? t(language, 'header.notificationCount').replace('{count}', String(resolvedNotificationCount)) : t(language, 'header.notifications')}
          onClick={handleOpenNotifications}
        >
          <HeaderActionIcon name="notification" />
          <IconBadge count={resolvedNotificationCount} />
        </button>
        <button
          type="button"
          className={buttonClassName}
          aria-label={resolvedChatCount ? t(language, 'header.chatCount').replace('{count}', String(resolvedChatCount)) : t(language, 'header.chats')}
          onClick={handleOpenChat}
        >
          <HeaderActionIcon name="chat" />
          <IconBadge count={resolvedChatCount} />
        </button>
        {showMenu ? (
          <button type="button" className={buttonClassName} aria-label={t(language, 'header.menu')} onClick={onOpenMenu}>
            <HeaderActionIcon name="menu" />
          </button>
        ) : null}
      </div>

      {openNotifications ? (
        <HeaderOverlayPortal>
          <HeaderOverlayErrorBoundary  onClose={() => setOpenNotifications(false)}>
            <NotificationCenter
              language={language}
              userId={userId ?? null}
              userName={userName}
              onClose={() => setOpenNotifications(false)}
              notifications={notifList}
              markRead={notifMarkRead}
              markAllRead={notifMarkAllRead}
              clearReadNotifications={notifClearRead}
            />
          </HeaderOverlayErrorBoundary>
        </HeaderOverlayPortal>
      ) : null}
      {openChat ? (
        <HeaderOverlayPortal>
          <HeaderOverlayErrorBoundary  onClose={handleCloseChat}>
            <GlobalChatModal
              language={language}
              userId={userId ?? null}
              userName={userName}
              role={role}
              users={chatUsers}
              selectedChat={headerChatTarget}
              onSelectChat={handleOpenChatRoom}
              onBackToList={() => setHeaderChatTarget(null)}
              onClose={handleCloseChat}
              onChatRead={markChatReadLocally}
            />
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
  role,
  chatUsers,
  onOpenNotifications,
  onOpenChat,
  onOpenMenu,
  rightSlot,
  className,
  language = 'ko',
}: AppHeaderProps) {
  const headerSubtitle = isHome && date ? formatHeaderDate(date) : subtitle
  const rootClassName = ['app-header', `app-header--${variant}`, className].filter(Boolean).join(' ')

  return (
    <header className={rootClassName}>
      <div className="app-header__left">
        {showBack ? (
          <button type="button" className="app-header__back" aria-label={t(language, 'header.back')} onClick={onBack}>
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
          role={role}
          chatUsers={chatUsers}
          notificationCount={notificationCount}
          chatCount={chatCount}
          onOpenNotifications={onOpenNotifications}
          onOpenChat={onOpenChat}
          onOpenMenu={onOpenMenu}
          language={language}
          className="app-header__actions-inline"
        />
      </div>
    </header>
  )
}
