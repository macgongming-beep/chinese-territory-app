import type { ReactNode } from 'react'

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
  onOpenNotifications?: () => void
  onOpenChat?: () => void
  onOpenMenu?: () => void
  rightSlot?: ReactNode
  className?: string
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
        <button
          type="button"
          className="app-header__action"
          aria-label={notificationCount ? `알림 ${notificationCount}개` : '알림'}
          onClick={onOpenNotifications}
        >
          <span aria-hidden="true">🔔</span>
          <IconBadge count={notificationCount} />
        </button>
        <button
          type="button"
          className="app-header__action"
          aria-label={chatCount ? `채팅 ${chatCount}개` : '채팅'}
          onClick={onOpenChat}
        >
          <span aria-hidden="true">💬</span>
          <IconBadge count={chatCount} />
        </button>
        <button type="button" className="app-header__action" aria-label="더보기" onClick={onOpenMenu}>
          <span aria-hidden="true">⋮</span>
        </button>
      </div>
    </header>
  )
}
