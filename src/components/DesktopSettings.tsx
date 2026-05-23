import { NavLink, Outlet } from 'react-router-dom'
import type { Role } from '../types'
import { roleLabels } from '../types'

function isAdminLike(role: Role): boolean {
  return role === 'admin' || role === 'developer'
}

function SidebarLink({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <NavLink
      to={to}
      style={({ isActive }) => ({
        display: 'flex', alignItems: 'center', gap: 12, width: '100%',
        padding: '12px 16px', borderRadius: 10,
        background: isActive ? 'var(--gray-100)' : 'transparent',
        color: isActive ? 'var(--gray-900)' : 'var(--gray-700)',
        fontWeight: isActive ? 700 : 500,
        textDecoration: 'none', transition: 'background 0.15s, color 0.15s'
      })}
    >
      <span style={{ display: 'grid', placeItems: 'center', color: 'inherit' }}>
        {icon}
      </span>
      <span style={{ fontSize: 14 }}>{label}</span>
    </NavLink>
  )
}

export function DesktopSettings({
  currentVisitor,
  actualRole,
  onLogout,
}: {
  currentVisitor: string
  currentUserId: number
  actualRole: Role
  onLogout: () => void
}) {
  return (
    <div style={{ display: 'flex', width: '100%', maxWidth: 1000, margin: '0 auto', height: 'calc(100vh - 64px)', padding: '24px 20px' }}>
      
      {/* Sidebar */}
      <aside style={{ width: 260, flexShrink: 0, paddingRight: 24, borderRight: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column' }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--gray-900)', marginBottom: 24, paddingLeft: 8 }}>설정</h1>
        
        <div style={{ display: 'grid', gap: 4, marginBottom: 24 }}>
          <SidebarLink
            to="/settings/profile"
            icon={<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>}
            label="내 정보"
          />
        </div>

        <div style={{ display: 'grid', gap: 4, marginBottom: 24 }}>
          <h3 style={{ fontSize: 12, fontWeight: 700, color: 'var(--gray-500)', marginBottom: 8, paddingLeft: 16, textTransform: 'uppercase', letterSpacing: 0.5 }}>소식 & 알림</h3>
          {isAdminLike(actualRole) && (
            <SidebarLink
              to="/settings/notices"
              icon={<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>}
              label="공지사항"
            />
          )}
          <SidebarLink
            to="/settings/notification"
            icon={<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>}
            label="알림 디바이스 설정"
          />
        </div>

        {isAdminLike(actualRole) && (
          <div style={{ display: 'grid', gap: 4, marginBottom: 24 }}>
            <h3 style={{ fontSize: 12, fontWeight: 700, color: 'var(--gray-500)', marginBottom: 8, paddingLeft: 16, textTransform: 'uppercase', letterSpacing: 0.5 }}>관리 (Admin)</h3>
            <SidebarLink
              to="/settings/users"
              icon={<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>}
              label="사용자 관리"
            />
            <SidebarLink
              to="/settings/signup-requests"
              icon={<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle><line x1="20" y1="8" x2="20" y2="14"></line><line x1="23" y1="11" x2="17" y2="11"></line></svg>}
              label="가입 신청 관리"
            />
            <SidebarLink
              to="/settings/service-logs"
              icon={<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M7 8h10M7 12h10M7 16h6" /></svg>}
              label="봉사 로그 조회"
            />
            <SidebarLink
              to="/settings/special-periods"
              icon={<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>}
              label="특별 봉사 시즌"
            />
            <SidebarLink
              to="/settings/data-management"
              icon={<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"></ellipse><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path></svg>}
              label="데이터 관리"
            />
          </div>
        )}

        <div style={{ marginTop: 'auto', display: 'grid', gap: 4 }}>
          <button
            onClick={onLogout}
            style={{
              display: 'flex', alignItems: 'center', gap: 12, width: '100%',
              padding: '12px 16px', borderRadius: 10, border: 'none',
              background: 'transparent', color: 'var(--gray-700)', fontWeight: 500,
              cursor: 'pointer', textAlign: 'left', transition: 'background 0.15s, color 0.15s'
            }}
            type="button"
            onMouseOver={(e) => { e.currentTarget.style.background = 'var(--gray-100)'; e.currentTarget.style.color = 'var(--danger-600)' }}
            onMouseOut={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--gray-700)' }}
          >
            <span style={{ display: 'grid', placeItems: 'center', color: 'inherit' }}>
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
            </span>
            <span style={{ fontSize: 14 }}>로그아웃</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main style={{ flex: 1, paddingLeft: 40, overflowY: 'auto' }}>
        <div style={{ maxWidth: 640 }}>
          <Outlet />
        </div>
      </main>
      
    </div>
  )
}
