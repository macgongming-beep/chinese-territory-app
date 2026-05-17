import type { Role } from '../../types'

const ROLE_LABEL: Record<Role, string> = {
  admin: '관리자',
  developer: '관리자', // developer 는 다른 사람에게 admin 으로 표시
  leader: '인도자',
  user: '봉사자',
}

// dot 색 위계: admin = ink, leader = muted, user = muted-2
function dotColor(role: Role): string {
  if (role === 'admin' || role === 'developer') return 'var(--ink)'
  if (role === 'leader') return 'var(--muted)'
  return 'var(--muted-2)'
}

export function RoleBadge({ role }: { role: Role }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        fontSize: 11.5,
        fontWeight: 600,
        padding: '3px 9px',
        borderRadius: 999,
        background: 'var(--tint)',
        color: 'var(--text)',
        letterSpacing: 0,
      }}
    >
      <span
        aria-hidden
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: dotColor(role),
        }}
      />
      {ROLE_LABEL[role]}
    </span>
  )
}
