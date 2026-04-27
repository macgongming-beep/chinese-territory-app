import type { Role } from '../types'
import { roleLabels } from '../types'

export function DesktopSettings({
  currentVisitor,
  actualRole,
  forceMobileView,
  onSetForceMobileView,
  onLogout,
}: {
  currentVisitor: string
  actualRole: Role
  forceMobileView: boolean
  onSetForceMobileView: (value: boolean) => void
  onLogout: () => void
}) {
  return (
    <section className="desktop-content" style={{ padding: '32px', maxWidth: '640px' }}>
      <div style={{ marginBottom: '24px' }}>
        <p style={{ fontSize: '13px', color: 'var(--ink-500)', margin: '0 0 4px' }}>설정</p>
        <h1 style={{ fontSize: '22px', fontWeight: 700, margin: 0 }}>앱 설정</h1>
      </div>

      <div className="detail-card" style={{ marginBottom: '16px' }}>
        <h2 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '12px' }}>계정 관리</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px', color: 'var(--ink-500)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>내 이름</span>
            <strong style={{ color: 'var(--ink-900)' }}>{currentVisitor}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>권한</span>
            <strong style={{ color: 'var(--ink-900)' }}>{roleLabels[actualRole]}</strong>
          </div>
        </div>
        <div style={{ marginTop: '16px', display: 'flex', gap: '8px' }}>
          <button
            className="action-button danger-action"
            onClick={onLogout}
            style={{ flex: 1 }}
            type="button"
          >
            로그아웃
          </button>
        </div>
      </div>

      <div className="detail-card">
        <h2 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '12px' }}>앱 정보</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px', color: 'var(--ink-500)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>앱 이름</span>
            <strong style={{ color: 'var(--ink-900)' }}>중화권 구역 관리</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>버전</span>
            <strong style={{ color: 'var(--ink-900)' }}>1.0.0</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>현재 사용자</span>
            <strong style={{ color: 'var(--ink-900)' }}>{currentVisitor}</strong>
          </div>
        </div>
      </div>

      {actualRole === 'admin' && (
        <div className="detail-card">
          <h2 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '12px' }}>개발 도구</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', color: 'var(--ink-500)' }}>모바일 미리보기</span>
              <button
                className={`toggle-button ${forceMobileView ? 'active' : ''}`}
                onClick={() => onSetForceMobileView(!forceMobileView)}
                type="button"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  border: '1px solid var(--ink-200)',
                  backgroundColor: forceMobileView ? 'var(--primary-100)' : 'transparent',
                  color: forceMobileView ? 'var(--primary-600)' : 'var(--ink-500)',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  if (!forceMobileView) {
                    e.currentTarget.style.backgroundColor = 'var(--ink-50)'
                    e.currentTarget.style.borderColor = 'var(--ink-300)'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!forceMobileView) {
                    e.currentTarget.style.backgroundColor = 'transparent'
                    e.currentTarget.style.borderColor = 'var(--ink-200)'
                  }
                }}
              >
                {forceMobileView ? '모바일 보기 (활성)' : '모바일 보기'}
              </button>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--ink-400)', margin: 0 }}>
              데스크톱 폭에서 모바일 화면을 확인할 수 있습니다.
            </p>
          </div>
        </div>
      )}
    </section>
  )
}
