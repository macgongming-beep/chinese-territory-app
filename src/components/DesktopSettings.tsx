import { useState, useEffect } from 'react'
import type { Role, SpecialPeriod } from '../types'
import { PERIOD_COLORS, roleLabels } from '../types'
import { supabase } from '../lib/supabase'

function formatLoginAt(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

function calculateEndDate(start: string, days: number): string {
  if (!start) return ''
  const d = new Date(start)
  d.setDate(d.getDate() + days - 1)
  return d.toISOString().slice(0, 10)
}

export function DesktopSettings({
  currentVisitor,
  currentUserId,
  actualRole,
  onLogout,
  specialPeriods = [],
  onCreateSpecialPeriod,
  onDeleteSpecialPeriod,
}: {
  currentVisitor: string
  currentUserId: number
  actualRole: Role
  onLogout: () => void
  specialPeriods?: SpecialPeriod[]
  onCreateSpecialPeriod?: (input: { label: string; startDate: string; endDate: string; color: string }) => Promise<void> | void
  onDeleteSpecialPeriod?: (id: number) => Promise<void> | void
}) {
  const todayStr = new Date().toISOString().slice(0, 10)
  const activePeriod = specialPeriods.find((period) => todayStr >= period.startDate && todayStr <= period.endDate)
  const upcomingPeriods = specialPeriods.filter((period) => todayStr < period.startDate).sort((a, b) => a.startDate.localeCompare(b.startDate))
  const pastPeriods = specialPeriods.filter((period) => todayStr > period.endDate).sort((a, b) => b.startDate.localeCompare(a.startDate))

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [newStartDate, setNewStartDate] = useState(todayStr)
  const [newDurationDays, setNewDurationDays] = useState(7)
  const [submitting, setSubmitting] = useState(false)

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

  const newEndDate = calculateEndDate(newStartDate, newDurationDays)
  const dDay = (() => {
    if (!activePeriod) return null
    const end = new Date(activePeriod.endDate)
    const today = new Date(todayStr)
    return Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  })()

  const handleCreate = async () => {
    if (!newLabel.trim() || !newStartDate || !newEndDate || !onCreateSpecialPeriod) return
    const overlaps = specialPeriods.find((period) => !(newEndDate < period.startDate || newStartDate > period.endDate))
    if (overlaps) {
      alert(`기존 시즌 "${overlaps.label}" (${overlaps.startDate} ~ ${overlaps.endDate})와 겹칩니다.`)
      return
    }
    setSubmitting(true)
    await Promise.resolve(onCreateSpecialPeriod({
      label: newLabel.trim(),
      startDate: newStartDate,
      endDate: newEndDate,
      color: PERIOD_COLORS.find((color) => color.label === '주황')?.value ?? PERIOD_COLORS[0].value,
    }))
    setShowCreateModal(false)
    setNewLabel('')
    setNewStartDate(todayStr)
    setNewDurationDays(7)
    setSubmitting(false)
  }

  return (
    <section className="desk-settings-page">
      <header className="desk-settings-head">
        <div>
          <p>설정</p>
          <h1>앱 설정</h1>
        </div>
      </header>

      <div className="desk-settings-stack">
        <article className="desk-card ds-card">
          <div className="desk-card__head">
            <h2 className="desk-card__title"><span className="desk-card__title-dot" />계정</h2>
          </div>
          <div className="ds-account-row">
            <div className="ds-avatar" aria-hidden="true">{currentVisitor.slice(0, 1) || '사'}</div>
            <div className="ds-account-main">
              <strong>{currentVisitor}</strong>
              <span>{roleLabels[actualRole]} · 경기지부</span>
            </div>
            <div className="ds-account-actions">
              <button className="ds-btn ds-btn-secondary" type="button">계정 관리</button>
              <button className="ds-btn ds-btn-danger" onClick={onLogout} type="button">로그아웃</button>
            </div>
          </div>
        </article>

        <article className="desk-card ds-card">
          <div className="desk-card__head">
            <h2 className="desk-card__title"><span className="desk-card__title-dot" />앱 정보</h2>
          </div>
          <dl className="ds-info-grid">
            <div>
              <dt>앱 이름</dt>
              <dd>Chinese Territory Manager</dd>
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

        {/* ── 나의 로그인 기록 ── */}
        <article className="desk-card ds-card">
          <div className="desk-card__head">
            <h2 className="desk-card__title"><span className="desk-card__title-dot" />나의 로그인 기록</h2>
          </div>
          {myLogs.length === 0 ? (
            <p style={{ fontSize: '13px', color: 'var(--gray-400)', margin: 0 }}>기록이 없습니다. 다음 로그인부터 저장됩니다.</p>
          ) : (
            <div>
              {/* 최근 로그인 — 항상 표시 */}
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

              {/* 이전 기록 토글 */}
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

        <article className="desk-card ds-card">
          <div className="desk-card__head">
            <h2 className="desk-card__title"><span className="desk-card__title-dot ds-dot-warning" />특별 봉사 시즌</h2>
            {actualRole === 'admin' && (
              <button className="ds-btn ds-btn-primary ds-btn-sm" onClick={() => setShowCreateModal(true)} type="button">
                + 새 시즌
              </button>
            )}
          </div>

          {activePeriod ? (
            <div className="ds-season-banner">
              <span className="ds-season-dot" aria-hidden="true" />
              <div className="ds-season-main">
                <strong>{activePeriod.label}</strong>
                <span className="tnum">{activePeriod.startDate} ~ {activePeriod.endDate}</span>
                <p>기간 동안의 모든 방문 기록은 자동으로 이 시즌에 태깅됩니다. 방문 모달에 초대장 남김 체크박스가 표시됩니다.</p>
              </div>
              <div className="ds-season-actions">
                {dDay !== null && (
                  <span className="ds-dday tnum">{dDay > 0 ? `D-${dDay}` : dDay === 0 ? '오늘 마지막 날' : `D+${Math.abs(dDay)}`}</span>
                )}
                {actualRole === 'admin' && (
                  <button
                    className="ds-btn ds-btn-ghost ds-btn-sm"
                    onClick={() => {
                      if (window.confirm(`"${activePeriod.label}" 시즌을 즉시 종료할까요? 이미 기록된 방문은 보존됩니다.`)) {
                        void onDeleteSpecialPeriod?.(activePeriod.id)
                      }
                    }}
                    type="button"
                  >
                    종료/삭제
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="ds-empty-season">
              <strong>진행 중인 특별 봉사가 없습니다.</strong>
              <span>새 시즌을 추가하면 방문 기록에 시즌 정보가 자동으로 연결됩니다.</span>
            </div>
          )}

          {(upcomingPeriods.length > 0 || pastPeriods.length > 0) && (
            <div className="ds-season-lists">
              {upcomingPeriods.length > 0 && (
                <section>
                  <h3>예정</h3>
                  {upcomingPeriods.map((period) => (
                    <div className="ds-season-row" key={period.id}>
                      <div>
                        <strong>{period.label}</strong>
                        <span className="tnum">{period.startDate} ~ {period.endDate}</span>
                      </div>
                      <button
                        className="ds-btn ds-btn-ghost ds-btn-sm"
                        onClick={() => {
                          if (window.confirm(`"${period.label}" 예정 시즌을 삭제할까요?`)) void onDeleteSpecialPeriod?.(period.id)
                        }}
                        type="button"
                      >
                        삭제
                      </button>
                    </div>
                  ))}
                </section>
              )}
              {pastPeriods.length > 0 && (
                <section>
                  <h3>지난 시즌</h3>
                  {pastPeriods.slice(0, 5).map((period) => (
                    <div className="ds-season-row muted" key={period.id}>
                      <div>
                        <strong>{period.label}</strong>
                        <span className="tnum">{period.startDate} ~ {period.endDate}</span>
                      </div>
                      <button
                        className="ds-btn ds-btn-ghost ds-btn-sm"
                        onClick={() => {
                          if (window.confirm(`"${period.label}" 시즌을 삭제할까요? 방문 기록은 보존됩니다.`)) void onDeleteSpecialPeriod?.(period.id)
                        }}
                        type="button"
                      >
                        삭제
                      </button>
                    </div>
                  ))}
                </section>
              )}
            </div>
          )}
        </article>
      </div>

      {showCreateModal && (
        <div className="cal-modal-backdrop" onClick={() => setShowCreateModal(false)}>
          <div className="cal-modal ds-season-modal" onClick={(event) => event.stopPropagation()}>
            <div className="cal-modal-head">
              <div className="cal-modal-title"><h2>새 특별봉사 시즌</h2></div>
            </div>
            <div className="ds-season-form">
              <label>
                <span>라벨</span>
                <input
                  placeholder="예) 봄 특별봉사 2026"
                  value={newLabel}
                  onChange={(event) => setNewLabel(event.target.value)}
                />
              </label>
              <label>
                <span>시작일</span>
                <input type="date" value={newStartDate} onChange={(event) => setNewStartDate(event.target.value)} />
              </label>
              <label>
                <span>기간</span>
                <div className="ds-duration-row">
                  <input
                    className="tnum"
                    min={1}
                    type="number"
                    value={newDurationDays}
                    onChange={(event) => setNewDurationDays(Math.max(1, Number(event.target.value)))}
                  />
                  <div>
                    {[3, 5, 7, 10, 14].map((days) => (
                      <button
                        className={newDurationDays === days ? 'active' : ''}
                        key={days}
                        onClick={() => setNewDurationDays(days)}
                        type="button"
                      >
                        {days}일
                      </button>
                    ))}
                  </div>
                </div>
              </label>
              <div className="ds-end-preview">
                <span>종료일</span>
                <strong className="tnum">{newEndDate || '-'}</strong>
              </div>
            </div>
            <div className="cal-modal-foot">
              <button className="cal-cancel-btn" onClick={() => setShowCreateModal(false)} type="button">취소</button>
              <button className="cal-save-btn" disabled={!newLabel.trim() || submitting} onClick={() => void handleCreate()} type="button">
                {submitting ? '생성 중...' : '시즌 생성'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
