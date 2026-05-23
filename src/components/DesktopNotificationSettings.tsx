import { useNavigate } from 'react-router-dom'
import { NotificationSettings } from './NotificationSettings'

export function DesktopNotificationSettings({ userId }: { userId: number }) {
  const navigate = useNavigate()

  return (
    <div className="desk-settings-subpage" style={{ maxWidth: 640 }}>
      <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--gray-900)', marginBottom: 24 }}>알림 설정</h2>
      <div className="desktop-profile-stack" style={{ display: 'grid', gap: 24 }}>
        <article className="desk-card ds-card">
          <NotificationSettings userId={userId} />
        </article>
      </div>
    </div>
  )
}
