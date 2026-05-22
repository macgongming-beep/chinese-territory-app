import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Role, SpecialPeriod } from '../types'
import { roleLabels } from '../types'
import { supabase } from '../lib/supabase'
import { PwaInstallSection } from './PwaInstall'
import { NotificationSettings } from './NotificationSettings'
import { AppUpdateCard } from './AppUpdateCard'
import { SpecialPeriodSettings } from './SpecialPeriodSettings'
function isAdminLike(role: Role): boolean {
  return role === 'admin' || role === 'developer'
}

function formatLoginAt(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}


type GroupId = 'notifications' | 'account' | 'env' | 'admin'

const STORAGE_KEY_EXPANDED = 'desk-settings-expanded-v1'

function getInitialExpanded(): Set<GroupId> {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_EXPANDED)
    if (saved) {
      const ids = JSON.parse(saved) as GroupId[]
      return new Set(ids)
    }
  } catch { /* ignore */ }
  // 기본: 알림 & 디바이스만 펼침. 나머지는 접힘 (자주 안 봄)
  return new Set<GroupId>(['notifications'])
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="14" height="14" viewBox="0 0 14 14" fill="none"
      style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }}
      aria-hidden
    >
      <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function DesktopSettings({
  currentVisitor,
  currentUserId,
  actualRole,
  onLogout,
  specialPeriods = [],
  onCreateSpecialPeriod,
  onUpdateSpecialPeriod,
  onDeleteSpecialPeriod,
}: {
  currentVisitor: string
  currentUserId: number
  actualRole: Role
  onLogout: () => void
  specialPeriods?: SpecialPeriod[]
  onCreateSpecialPeriod?: (input: { label: string; startDate: string; endDate: string; color: string }) => Promise<void> | void
  onUpdateSpecialPeriod?: (id: number, input: { label: string; startDate: string; endDate: string; color: string }) => Promise<void> | void
  onDeleteSpecialPeriod?: (id: number) => Promise<void> | void
}) {
  const navigate = useNavigate()
  // 아코디언 펼침 상태
  const [expanded, setExpanded] = useState<Set<GroupId>>(() => getInitialExpanded())
  const toggleGroup = (id: GroupId) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      try { localStorage.setItem(STORAGE_KEY_EXPANDED, JSON.stringify([...next])) } catch { /* ignore */ }
      return next
    })
  }
  const [myLogs, setMyLogs]           = useState<{ id: number; logged_in_at: string }[]>([])
  const [showOldLogs, setShowOldLogs] = useState(false)

  useEffect(() => {
    // 최근 7일 로그인 기록만 조회 (RPC 사용)
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    supabase
      .rpc('get_login_logs', {
        p_user_id: currentUserId,
        p_since: since,
        p_limit: 50,
      })
      .then(({ data, error }) => {
        if (error) { console.error('[settings] login_logs fetch failed:', error); return }
        setMyLogs((data ?? []) as { id: number; logged_in_at: string }[])
      })
  }, [currentUserId])

  return (
    <section className="desk-settings-page">
      <header className="page-header">
        <div className="page-header-text">
          <h1 className="page-header-title">앱 설정</h1>
        </div>
      </header>

      <div className="desk-settings-stack">

        {/* ──────────────────────────── GROUP: 알림 & 디바이스 ─── */}
        <section className="ds-group">
          <button
            className="ds-group-head"
            onClick={() => toggleGroup('notifications')}
            aria-expanded={expanded.has('notifications')}
            type="button"
          >
            <div>
              <strong>알림 & 디바이스</strong>
              <span>알림 설정 · PWA 설치 · 앱 업데이트</span>
            </div>
            <ChevronIcon open={expanded.has('notifications')} />
          </button>
          {expanded.has('notifications') && (
            <div className="ds-group-body">
              <article className="desk-card ds-card" style={{ padding: 0, background: 'transparent', border: 'none' }}>
                <NotificationSettings userId={currentUserId} />
              </article>
              <article className="desk-card ds-card" style={{ padding: 0, background: 'transparent', border: 'none' }}>
                <PwaInstallSection />
              </article>
              <AppUpdateCard variant="desktop" />
            </div>
          )}
        </section>

        {/* ──────────────────────────── GROUP: 계정 & 보안 ─── */}
        <section className="ds-group">
          <button
            className="ds-group-head"
            onClick={() => toggleGroup('account')}
            aria-expanded={expanded.has('account')}
            type="button"
          >
            <div>
              <strong>계정 & 보안</strong>
              <span>{currentVisitor} · {roleLabels[actualRole]} · 로그인 기록</span>
            </div>
            <ChevronIcon open={expanded.has('account')} />
          </button>
          {expanded.has('account') && (
            <div className="ds-group-body">
              <article className="desk-card ds-card">
                <div className="desk-card__head">
                  <h2 className="desk-card__title"><span className="desk-card__title-dot" />계정</h2>
                </div>
                <div className="ds-account-row">
                  <div className="ds-avatar" aria-hidden="true">{currentVisitor.slice(0, 1) || '사'}</div>
                  <div className="ds-account-main">
                    <strong>{currentVisitor}</strong>
                    <span>{roleLabels[actualRole]}</span>
                  </div>
                  <div className="ds-account-actions">
                    <button className="ds-btn ds-btn-danger" onClick={onLogout} type="button">로그아웃</button>
                  </div>
                </div>
              </article>

              {/* ── 나의 로그인 기록 ── */}
              <article className="desk-card ds-card">
                <div className="desk-card__head">
                  <h2 className="desk-card__title"><span className="desk-card__title-dot" />나의 로그인 기록</h2>
                </div>
                {myLogs.length === 0 ? (
                  <p style={{ fontSize: '13px', color: 'var(--gray-400)', margin: 0 }}>기록이 없습니다. 다음 로그인부터 저장됩니다.</p>
                ) : (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 0', borderBottom: myLogs.length > 1 ? '1px solid var(--border-subtle)' : 'none' }}>
                      <svg width="14" height="14" viewBox="0 0 12 12" fill="none" style={{ color: 'var(--success-600)', flexShrink: 0 }}>
                        <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.3" />
                        <path d="M6 3.5v2.75l1.5 1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                      </svg>
                      <span style={{ fontSize: '13px', color: 'var(--gray-500)' }}>최근 로그인</span>
                      <strong style={{ fontSize: '13px', color: 'var(--gray-900)', fontVariantNumeric: 'tabular-nums', marginLeft: 'auto' }}>
                        {formatLoginAt(myLogs[0].logged_in_at)}
                      </strong>
                    </div>
                    {myLogs.length > 1 && (
                      <>
                        <button
                          onClick={() => setShowOldLogs((v) => !v)}
                          style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--primary-600)', background: 'none', border: 'none', cursor: 'pointer', padding: '8px 0 0', fontWeight: 600 }}
                          type="button"
                        >
                          이전 기록 {myLogs.length - 1}건
                          <svg width="11" height="11" viewBox="0 0 12 12" fill="none" style={{ transform: showOldLogs ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}>
                            <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>
                        {showOldLogs && (
                          <div style={{ marginTop: '6px', borderRadius: '8px', border: '1px solid var(--border-default)', background: 'var(--bg-subtle)', maxHeight: '200px', overflowY: 'auto' }}>
                            {myLogs.slice(1).map((log) => (
                              <div key={log.id} style={{ padding: '7px 12px', fontSize: '12px', color: 'var(--gray-600)', fontVariantNumeric: 'tabular-nums', borderBottom: '1px solid var(--border-subtle)' }}>
                                {formatLoginAt(log.logged_in_at)}
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </article>
            </div>
          )}
        </section>

        {/* ──────────────────────────── GROUP: 관리 도구 (leader/admin/dev) ─── */}
        {(actualRole === 'leader' || isAdminLike(actualRole)) && (
          <section className="ds-group">
            <button
              className="ds-group-head"
              onClick={() => toggleGroup('admin')}
              aria-expanded={expanded.has('admin')}
              type="button"
            >
              <div>
                <strong>관리 도구</strong>
                <span>{isAdminLike(actualRole) ? '봉사 로그 · 특별 봉사 시즌' : '봉사 로그'}</span>
              </div>
              <ChevronIcon open={expanded.has('admin')} />
            </button>
            {expanded.has('admin') && (
              <div className="ds-group-body">
                <article className="desk-card ds-card">
                  <div className="desk-card__head">
                    <h2 className="desk-card__title"><span className="desk-card__title-dot" />봉사 로그</h2>
                  </div>
                  <button
                    onClick={() => navigate('/service-logs')}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12, width: '100%',
                      padding: '12px 16px', borderRadius: 10, border: '1px solid var(--border-default)',
                      background: 'var(--bg-card)', cursor: 'pointer', textAlign: 'left',
                    }}
                    type="button"
                  >
                    <span style={{
                      display: 'grid', width: 36, height: 36, placeItems: 'center',
                      borderRadius: 10, background: 'var(--gray-100)', color: 'var(--gray-700)',
                      flexShrink: 0,
                    }} aria-hidden>
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="4" width="18" height="16" rx="2" />
                        <path d="M7 8h10M7 12h10M7 16h6" />
                      </svg>
                    </span>
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--gray-800)' }}>봉사 로그 보기</p>
                      <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--gray-600)' }}>
                        {actualRole === 'leader' ? '담당 카드 봉사 활동 로그' : '회중 전체 봉사 활동 감사 로그'}
                      </p>
                    </div>
                    <span style={{ color: 'var(--gray-400)', fontSize: 18 }}>›</span>
                  </button>
                </article>

                {/* 특별 봉사 시즌 — admin/developer 만 */}
                {isAdminLike(actualRole) && (
                  <SpecialPeriodSettings
                    isAdmin
                    specialPeriods={specialPeriods}
                    onCreateSpecialPeriod={onCreateSpecialPeriod}
                    onUpdateSpecialPeriod={onUpdateSpecialPeriod}
                    onDeleteSpecialPeriod={onDeleteSpecialPeriod}
                  />
                )}
              </div>
            )}
          </section>
        )}

        {/* ──────────────────────────── GROUP: 환경 (맨 아래) ─── */}
        <section className="ds-group">
          <button
            className="ds-group-head"
            onClick={() => toggleGroup('env')}
            aria-expanded={expanded.has('env')}
            type="button"
          >
            <div>
              <strong>환경</strong>
              <span>앱 정보</span>
            </div>
            <ChevronIcon open={expanded.has('env')} />
          </button>
          {expanded.has('env') && (
            <div className="ds-group-body">
              <article className="desk-card ds-card">
                <div className="desk-card__head">
                  <h2 className="desk-card__title"><span className="desk-card__title-dot" />앱 정보</h2>
                </div>
                <dl className="ds-info-grid">
                  <div>
                    <dt>앱 이름</dt>
                    <dd>Field Map · Yongin</dd>
                  </div>
                  <div>
                    <dt>버전</dt>
                    <dd className="tnum">1.0.0</dd>
                  </div>
                  <div>
                    <dt>현재 사용자</dt>
                    <dd>{currentVisitor}</dd>
                  </div>
                </dl>
              </article>
            </div>
          )}
        </section>
      </div>

    </section>
  )
}
