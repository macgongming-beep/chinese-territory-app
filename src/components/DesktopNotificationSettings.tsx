import { NotificationSettings } from './NotificationSettings'
import type { Role } from '../types'

export function DesktopNotificationSettings({ userId, role }: { userId: number; role: Role }) {
  

  return (
    <div className="desk-settings-subpage" style={{ maxWidth: 640 }}>
      <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--gray-900)', marginBottom: 24 }}>알림 설정</h2>
      <div className="desktop-profile-stack" style={{ display: 'grid', gap: 24 }}>
        <article className="desk-card ds-card">
          <NotificationSettings userId={userId} role={role} />
        </article>
      </div>
    </div>
  )
}
