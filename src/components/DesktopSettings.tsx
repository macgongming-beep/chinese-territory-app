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
  onCreateSpecialPeriod?: (input: { label: string; startDate: string; endDate: string; color: string; hasInvitation?: boolean }) => Promise<void> | void
  onUpdateSpecialPeriod?: (id: number, input: { label: string; startDate: string; endDate: string; color: string; hasInvitation?: boolean }) => Promise<void> | void
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

  // 관리 도구 — 자동 초기화 설정
  const [resetEnabled, setResetEnabled]     = useState(true)
  const [resetDays, setResetDays]           = useState(90)
  const [resetSettingsLoaded, setResetSettingsLoaded] = useState(false)
  const [resetSaving, setResetSaving]       = useState(false)
  const [manualResetting, setManualResetting] = useState(false)
  const [manualResetResult, setManualResetResult] = useState<number | null>(null)

  // 관리 도구 — 방문기록 삭제
  const [purgeCutoffYear, setPurgeCutoffYear]   = useState(new Date().getFullYear() - 1)
  const [purgeCutoffMonth, setPurgeCutoffMonth] = useState(new Date().getMonth() + 1)
  const [purgePreview, setPurgePreview]         = useState<number | null>(null)
  const [purgePreviewLoading, setPurgePreviewLoading] = useState(false)
  const [showPurgeModal, setShowPurgeModal]     = useState(false)
  const [purgeError, setPurgeError]             = useState(false)
  const [purging, setPurging]                   = useState(false)
  const [purgeResult, setPurgeResult]           = useState<number | null>(null)

  useEffect(() => {
    if (!isAdminLike(actualRole)) return
    supabase.from('app_settings').select('key, value').in('key', ['visit_reset_enabled', 'visit_reset_days_met'])
      .then(({ data }) => {
        if (!data) return
        data.forEach((row) => {
          if (row.key === 'visit_reset_enabled') setResetEnabled(row.value === 'true')
          if (row.key === 'visit_reset_days_met') setResetDays(Number(row.value) || 90)
        })
        setResetSettingsLoaded(true)
      })
  }, [actualRole])

  const saveResetSettings = async () => {
    setResetSaving(true)
    await supabase.from('app_settings').upsert([
      { key: 'visit_reset_enabled',  value: String(resetEnabled) },
      { key: 'visit_reset_days_met', value: String(resetDays) },
    ])
    setResetSaving(false)
  }

  const runManualReset = async () => {
    if (!window.confirm('만남 상태인 모든 세대를 지금 즉시 미방문으로 초기화할까요?\n방문 기록은 유지됩니다.')) return
    setManualResetting(true)
    setManualResetResult(null)
    const { data } = await supabase.rpc('manual_reset_met_units')
    setManualResetResult(typeof data === 'number' ? data : null)
    setManualResetting(false)
  }

  const purgeCutoffStr = `${purgeCutoffYear}-${String(purgeCutoffMonth).padStart(2, '0')}-01`

  const loadPurgePreview = async () => {
    setPurgePreviewLoading(true)
    setPurgePreview(null)
    setPurgeError(false)
    const { data, error } = await supabase.rpc('count_old_visit_histories', { cutoff_date: purgeCutoffStr })
    if (error || typeof data !== 'number') {
      setPurgeError(true)
    } else {
      setPurgePreview(data)
    }
    setPurgePreviewLoading(false)
    setShowPurgeModal(true)
  }

  const runPurge = async () => {
    if (purgePreview === null || purgePreview === 0) return
    setPurging(true)
    setPurgeResult(null)
    const { data } = await supabase.rpc('delete_old_visit_histories', { cutoff_date: purgeCutoffStr })
    setPurgeResult(typeof data === 'number' ? data : null)
    setPurgePreview(null)
    setPurging(false)
    setShowPurgeModal(false)
  }

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

                {/* 관리 도구 — admin/developer 만 */}
                {isAdminLike(actualRole) && resetSettingsLoaded && (
                  <>
                    {/* 만남 자동 초기화 카드 */}
                    <article className="desk-card ds-card">
                      <div className="desk-card__head">
                        <h2 className="desk-card__title"><span className="desk-card__title-dot" />만남 자동 초기화</h2>
                      </div>
                      <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--gray-500)', lineHeight: 1.6 }}>
                        만남 기록 후 설정한 일수가 지나면 자동으로 미방문으로 초기화됩니다. 방문 기록은 보존됩니다.
                      </p>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, cursor: 'pointer' }}>
                        <input type="checkbox" checked={resetEnabled} onChange={(e) => setResetEnabled(e.target.checked)}
                          style={{ width: 15, height: 15, accentColor: 'var(--primary-500)' }} />
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--gray-800)' }}>자동 초기화 활성화</span>
                      </label>
                      {resetEnabled && (
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                          <span style={{ fontSize: 13, color: 'var(--gray-600)', whiteSpace: 'nowrap' }}>만남 후</span>
                          <input type="number" min={7} max={730} value={resetDays}
                            onChange={(e) => setResetDays(Math.max(7, Math.min(730, Number(e.target.value))))}
                            style={{ width: 68, padding: '6px 10px', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', fontSize: 13, fontFamily: 'inherit', background: 'var(--bg-card)', color: 'var(--gray-900)' }} />
                          <span style={{ fontSize: 13, color: 'var(--gray-600)' }}>일 후 자동 초기화</span>
                        </label>
                      )}
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button className="ds-btn ds-btn-primary" onClick={saveResetSettings} disabled={resetSaving} type="button" style={{ opacity: resetSaving ? 0.6 : 1 }}>
                          {resetSaving ? '저장 중…' : '설정 저장'}
                        </button>
                        <button className="ds-btn" onClick={runManualReset} disabled={manualResetting} type="button" style={{ opacity: manualResetting ? 0.6 : 1 }}>
                          {manualResetting ? '초기화 중…' : '지금 즉시 초기화'}
                        </button>
                      </div>
                      {manualResetResult !== null && (
                        <p style={{ marginTop: 10, fontSize: 12, color: 'var(--primary-600)', fontWeight: 600 }}>
                          ✓ {manualResetResult}개 세대가 미방문으로 초기화됐습니다
                        </p>
                      )}
                    </article>

                    {/* 방문기록 삭제 카드 */}
                    <article className="desk-card ds-card">
                      <div className="desk-card__head">
                        <h2 className="desk-card__title"><span className="desk-card__title-dot ds-dot-warning" />방문기록 삭제</h2>
                      </div>
                      <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--gray-500)', lineHeight: 1.6 }}>
                        선택한 날짜 이전 방문기록을 영구 삭제합니다. 기록이 모두 삭제된 세대는 <strong>미방문</strong>으로 자동 초기화되고, 잔여 기록이 있는 세대는 최신 기록 기준으로 상태가 보정됩니다.
                      </p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
                        <select value={purgeCutoffYear} onChange={(e) => { setPurgeCutoffYear(Number(e.target.value)); setPurgePreview(null); setPurgeError(false) }}
                          style={{ padding: '7px 10px', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', fontSize: 13, fontFamily: 'inherit', background: 'var(--bg-card)', color: 'var(--gray-900)' }}>
                          {Array.from({ length: 7 }, (_, i) => new Date().getFullYear() - i).map((y) => (
                            <option key={y} value={y}>{y}년</option>
                          ))}
                        </select>
                        <select value={purgeCutoffMonth} onChange={(e) => { setPurgeCutoffMonth(Number(e.target.value)); setPurgePreview(null); setPurgeError(false) }}
                          style={{ padding: '7px 10px', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', fontSize: 13, fontFamily: 'inherit', background: 'var(--bg-card)', color: 'var(--gray-900)' }}>
                          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                            <option key={m} value={m}>{m}월</option>
                          ))}
                        </select>
                        <span style={{ fontSize: 12, color: 'var(--gray-500)' }}>이전 기록 삭제</span>
                      </div>
                      <button className="ds-btn" onClick={loadPurgePreview} disabled={purgePreviewLoading} type="button" style={{ opacity: purgePreviewLoading ? 0.6 : 1 }}>
                        {purgePreviewLoading ? '조회 중…' : '삭제 건수 확인'}
                      </button>
                      {purgeResult !== null && (
                        <p style={{ marginTop: 10, fontSize: 12, color: 'var(--gray-500)', fontWeight: 600 }}>
                          ✓ {purgeResult}건이 삭제됐습니다
                        </p>
                      )}
                    </article>
                  </>
                )}

                {/* 방문기록 삭제 확인 모달 */}
                {showPurgeModal && (
                  <div className="cal-modal-backdrop" onClick={() => !purging && setShowPurgeModal(false)}>
                    <div className="cal-modal" style={{ maxWidth: 400, width: '100%' }} onClick={(e) => e.stopPropagation()}>
                      <div className="cal-modal-head">
                        <div className="cal-modal-title"><h2>방문기록 삭제 확인</h2></div>
                      </div>
                      <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                        {purgeError ? (
                          <div style={{ textAlign: 'center', padding: '16px 0' }}>
                            <p style={{ fontSize: 28, margin: '0 0 8px' }}>⚠️</p>
                            <p style={{ fontSize: 15, fontWeight: 700, margin: '0 0 4px', color: 'var(--gray-900)' }}>조회에 실패했습니다</p>
                            <p style={{ fontSize: 13, color: 'var(--gray-500)', margin: 0 }}>RPC 함수가 등록됐는지 확인해 주세요</p>
                          </div>
                        ) : purgePreview === 0 ? (
                          <div style={{ textAlign: 'center', padding: '16px 0' }}>
                            <p style={{ fontSize: 32, margin: '0 0 8px' }}>🔍</p>
                            <p style={{ fontSize: 15, fontWeight: 700, margin: '0 0 4px', color: 'var(--gray-900)' }}>삭제할 기록이 없습니다</p>
                            <p style={{ fontSize: 13, color: 'var(--gray-500)', margin: 0 }}>{purgeCutoffStr} 이전 방문기록이 없어요</p>
                          </div>
                        ) : (
                          <>
                            <div style={{ padding: '14px 16px', background: 'var(--danger-50, #fff5f5)', border: '1.5px solid #fca5a5', borderRadius: 'var(--radius-lg)' }}>
                              <p style={{ margin: '0 0 5px', fontSize: 13, fontWeight: 700, color: '#b91c1c' }}>삭제 후 복구 불가</p>
                              <p style={{ margin: 0, fontSize: 13, color: '#7f1d1d', lineHeight: 1.6 }}>
                                <strong>{purgeCutoffStr}</strong> 이전 방문기록 <strong>{purgePreview?.toLocaleString()}건</strong>이 영구 삭제됩니다.
                                세대 상태는 그대로 유지됩니다.
                              </p>
                            </div>
                            <div style={{ padding: '12px 14px', background: 'var(--gray-50)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                              <p style={{ margin: 0, fontSize: 12, color: 'var(--gray-600)', lineHeight: 1.7 }}>
                                • 방문 날짜·결과·방문자 기록이 삭제됩니다<br />
                                • 세대 상세 히스토리 목록에서 사라집니다<br />
                                • 이 작업은 되돌릴 수 없습니다
                              </p>
                            </div>
                          </>
                        )}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 24px 20px', borderTop: '1px solid var(--border-subtle)' }}>
                        <button className="ds-btn" onClick={() => setShowPurgeModal(false)} disabled={purging} type="button">취소</button>
                        {!purgeError && purgePreview !== null && purgePreview > 0 && (
                          <button className="ds-btn ds-btn-danger" onClick={runPurge} disabled={purging} type="button"
                            style={{ opacity: purging ? 0.6 : 1, fontWeight: 700 }}>
                            {purging ? '삭제 중…' : `${purgePreview.toLocaleString()}건 삭제`}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
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
