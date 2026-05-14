// 앱 업데이트 카드 — 설정에서 새 버전 확인/적용
import { useState } from 'react'
import { useAppUpdate } from '../hooks/useAppUpdate'

export function AppUpdateCard({ variant = 'desktop' }: { variant?: 'desktop' | 'mobile' }) {
  const { updateAvailable, checking, applying, check, apply } = useAppUpdate()
  const [checkedJustNow, setCheckedJustNow] = useState(false)

  async function handleCheck() {
    setCheckedJustNow(false)
    const has = await check()
    if (!has) {
      setCheckedJustNow(true)
      setTimeout(() => setCheckedJustNow(false), 3000)
    }
  }

  if (variant === 'mobile') {
    return (
      <div
        style={{
          background: '#fff',
          borderRadius: 14,
          padding: 16,
          border: '1px solid #e2e8f0',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20 }}>{updateAvailable ? '🆕' : '✅'}</span>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#1e293b' }}>
              {updateAvailable ? '새 버전이 있습니다' : '최신 버전 사용 중'}
            </p>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: '#64748b' }}>
              {updateAvailable
                ? '아래 버튼을 누르면 새 버전으로 전환됩니다'
                : checkedJustNow
                  ? '방금 확인했어요'
                  : '주기적으로 자동 확인합니다'}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {updateAvailable ? (
            <button
              type="button"
              onClick={apply}
              disabled={applying}
              style={{
                flex: 1,
                padding: '10px 12px',
                borderRadius: 10,
                border: 'none',
                background: '#2563eb',
                color: '#fff',
                fontSize: 14,
                fontWeight: 700,
                cursor: applying ? 'wait' : 'pointer',
              }}
            >
              {applying ? '적용 중...' : '🚀 지금 업데이트'}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleCheck}
              disabled={checking}
              style={{
                flex: 1,
                padding: '10px 12px',
                borderRadius: 10,
                border: '1px solid #cbd5e1',
                background: '#fff',
                color: '#475569',
                fontSize: 14,
                fontWeight: 600,
                cursor: checking ? 'wait' : 'pointer',
              }}
            >
              {checking ? '확인 중...' : '업데이트 확인'}
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <article className="desk-card ds-card">
      <div className="desk-card__head">
        <h2 className="desk-card__title">
          <span className="desk-card__title-dot" />앱 업데이트
        </h2>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <span style={{ fontSize: 22 }}>{updateAvailable ? '🆕' : '✅'}</span>
        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#1e293b' }}>
            {updateAvailable ? '새 버전이 있습니다' : '최신 버전 사용 중'}
          </p>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: '#64748b' }}>
            {updateAvailable
              ? '버튼을 누르면 새 버전으로 즉시 전환됩니다'
              : checkedJustNow
                ? '방금 확인했어요'
                : '30분마다 자동으로 확인합니다'}
          </p>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        {updateAvailable ? (
          <button
            type="button"
            onClick={apply}
            disabled={applying}
            style={{
              padding: '9px 16px',
              borderRadius: 8,
              border: 'none',
              background: '#2563eb',
              color: '#fff',
              fontSize: 13,
              fontWeight: 700,
              cursor: applying ? 'wait' : 'pointer',
            }}
          >
            {applying ? '적용 중...' : '🚀 지금 업데이트'}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleCheck}
            disabled={checking}
            style={{
              padding: '9px 16px',
              borderRadius: 8,
              border: '1px solid #cbd5e1',
              background: '#fff',
              color: '#475569',
              fontSize: 13,
              fontWeight: 600,
              cursor: checking ? 'wait' : 'pointer',
            }}
          >
            {checking ? '확인 중...' : '업데이트 확인'}
          </button>
        )}
      </div>
    </article>
  )
}
