// 정기방문 상세 화면 (풀스크린).
// 디자인 핸드오프 대기 — 톤/간격/위계는 디자이너가 정리할 예정.
// 기능/플로우는 살아있게 미리 구성.

import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { AppLanguage } from '../i18n'
import { t } from '../i18n'
import type { Building, ReturnVisit, ReturnVisitLog } from '../types'
import { formatRelativeVisitDate } from '../utils/returnVisits'

type Props = {
  language: AppLanguage
  returnVisits: ReturnVisit[]
  returnVisitLogs: ReturnVisitLog[]
  buildings: Building[]
  currentVisitor: string
  onAddReturnVisitLog?: (returnVisitId: number, result: '만남' | '부재' | null, memo: string) => Promise<void>
  onUpdateReturnVisitLog?: (id: number, result: '만남' | '부재' | null, memo: string) => Promise<void>
  onDeleteReturnVisitLog?: (id: number) => Promise<void>
  onDeleteReturnVisit?: (id: number) => Promise<void>
  onUpdateReturnVisitNickname?: (id: number, nickname: string) => Promise<void>
  onUpdateReturnVisitAddress?: (id: number, address: string) => Promise<void>
}

function fmtFullDate(value: string, language: AppLanguage) {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  const m = d.getMonth() + 1
  const day = d.getDate()
  if (language === 'zh') return `${d.getFullYear()}年${m}月${day}日`
  if (language === 'en') return `${d.toLocaleString('en-US', { month: 'short' })} ${day}, ${d.getFullYear()}`
  const dow = ['일', '월', '화', '수', '목', '금', '토'][d.getDay()]
  return `${d.getFullYear()}년 ${m}월 ${day}일 (${dow})`
}

export function MobileRegularVisitDetail({
  language,
  returnVisits,
  returnVisitLogs,
  buildings,
  currentVisitor,
  onAddReturnVisitLog,
  onUpdateReturnVisitLog,
  onDeleteReturnVisitLog,
  onDeleteReturnVisit,
  onUpdateReturnVisitNickname,
  onUpdateReturnVisitAddress,
}: Props) {
  void currentVisitor
  const navigate = useNavigate()
  const { id } = useParams()
  const rvId = Number(id)
  const rv = returnVisits.find((item) => item.id === rvId)

  const [logResult, setLogResult] = useState<'만남' | '부재' | null>(null)
  const [logMemo, setLogMemo] = useState('')
  const [logSaving, setLogSaving] = useState(false)
  const [editingLogId, setEditingLogId] = useState<number | null>(null)
  const [editLogResult, setEditLogResult] = useState<'만남' | '부재' | null>(null)
  const [editLogMemo, setEditLogMemo] = useState('')
  const [nicknameOpen, setNicknameOpen] = useState(false)
  const [nicknameValue, setNicknameValue] = useState('')
  const [addressOpen, setAddressOpen] = useState(false)
  const [addressValue, setAddressValue] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)

  const myLogs = useMemo(() => {
    if (!rv) return []
    return returnVisitLogs
      .filter((log) => log.returnVisitId === rv.id)
      .sort((a, b) => new Date(b.visitedAt).getTime() - new Date(a.visitedAt).getTime())
  }, [rv, returnVisitLogs])

  const latestVisit = useMemo(() => {
    if (!rv) return null
    const candidates = [
      rv.lastVisitedAt,
      ...myLogs.map((log) => log.visitedAt),
    ].filter((value): value is string => !!value)
    candidates.sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
    return candidates[0] ?? null
  }, [rv, myLogs])

  // 추론: 평균 방문 간격 (3건 이상일 때만)
  const avgIntervalDays = useMemo(() => {
    if (myLogs.length < 3) return null
    const sorted = [...myLogs].sort((a, b) => new Date(a.visitedAt).getTime() - new Date(b.visitedAt).getTime())
    const intervals: number[] = []
    for (let i = 1; i < sorted.length; i += 1) {
      const diff = (new Date(sorted[i].visitedAt).getTime() - new Date(sorted[i - 1].visitedAt).getTime()) / 86_400_000
      if (diff > 0) intervals.push(diff)
    }
    if (intervals.length === 0) return null
    return Math.round(intervals.reduce((a, b) => a + b, 0) / intervals.length)
  }, [myLogs])

  if (!rv) {
    return (
      <main className="mobile-rv-detail-shell">
        <header className="mobile-rv-detail-header">
          <button className="mobile-rv-back-btn" onClick={() => navigate(-1)} type="button" aria-label="뒤로">‹</button>
          <h1>{t(language, 'territory.regularVisit')}</h1>
        </header>
        <div className="mobile-rv-detail-empty">
          <p>정기방문 항목을 찾을 수 없습니다.</p>
          <button type="button" onClick={() => navigate('/territory?section=regular')}>
            목록으로
          </button>
        </div>
      </main>
    )
  }

  const label = rv.nickname || rv.displayName
  const building = buildings.find((b) => b.id === rv.buildingId)
  const lastVisitLabel = latestVisit ? formatRelativeVisitDate(latestVisit, language) : t(language, 'home.noVisitYet')

  const handleAddLog = async () => {
    if (!onAddReturnVisitLog) return
    if (!logResult && !logMemo.trim()) return
    setLogSaving(true)
    try {
      await onAddReturnVisitLog(rv.id, logResult, logMemo.trim())
      setLogResult(null)
      setLogMemo('')
    } finally {
      setLogSaving(false)
    }
  }

  const handleSaveEditLog = async (logId: number) => {
    if (!onUpdateReturnVisitLog) return
    setLogSaving(true)
    try {
      await onUpdateReturnVisitLog(logId, editLogResult, editLogMemo.trim())
      setEditingLogId(null)
    } finally {
      setLogSaving(false)
    }
  }

  const handleDeleteLog = async (logId: number) => {
    if (!onDeleteReturnVisitLog) return
    if (!window.confirm('이 기록을 삭제할까요?')) return
    await onDeleteReturnVisitLog(logId)
  }

  const handleDeleteRv = async () => {
    if (!onDeleteReturnVisit) return
    if (!window.confirm(t(language, 'territory.deleteRegularConfirm'))) return
    await onDeleteReturnVisit(rv.id)
    navigate('/territory?section=regular')
  }

  const handleOpenMap = () => {
    if (building) {
      navigate(`/map?cardId=${building.cardId}`)
      return
    }
    if (rv.address) {
      navigate(`/map?addr=${encodeURIComponent(rv.address)}&pinLabel=${encodeURIComponent(label)}`)
    }
  }

  return (
    <main className="mobile-rv-detail-shell">
      {/* 헤더 */}
      <header className="mobile-rv-detail-header">
        <button className="mobile-rv-back-btn" onClick={() => navigate(-1)} type="button" aria-label="뒤로">‹</button>
        <h1>{t(language, 'territory.regularVisit')}</h1>
        <div className="mobile-rv-header-menu">
          <button type="button" onClick={() => setMenuOpen((v) => !v)} aria-label="더보기">⋮</button>
          {menuOpen && (
            <>
              <div onClick={() => setMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 30 }} />
              <div className="mobile-rv-menu-dropdown">
                <button type="button" onClick={() => { setMenuOpen(false); setNicknameOpen(true); setNicknameValue(rv.nickname || rv.displayName) }}>
                  {t(language, 'territory.editNickname')}
                </button>
                <button type="button" onClick={() => { setMenuOpen(false); setAddressOpen(true); setAddressValue(rv.address) }}>
                  {t(language, 'territory.editAddress')}
                </button>
                <button type="button" className="danger" onClick={() => { setMenuOpen(false); handleDeleteRv() }}>
                  {t(language, 'common.delete')}
                </button>
              </div>
            </>
          )}
        </div>
      </header>

      {/* 본문 */}
      <div className="mobile-rv-detail-body">
        {/* Hero */}
        <section className="mobile-rv-hero">
          <h2 className="mobile-rv-hero-title">{label}</h2>
          {rv.address && <p className="mobile-rv-hero-address">{rv.address}</p>}
          <div className="mobile-rv-hero-meta">
            {rv.lastResult && (
              <span className={`mobile-rv-result-chip is-${rv.lastResult === '만남' ? 'met' : 'absent'}`}>
                {rv.lastResult}
              </span>
            )}
            <span className="mobile-rv-hero-meta-text">
              {t(language, 'home.lastVisit')} · {lastVisitLabel}
            </span>
          </div>
        </section>

        {/* 액션 행 */}
        <section className="mobile-rv-action-row">
          <button
            type="button"
            className="mobile-rv-action mobile-rv-action--primary"
            onClick={() => document.getElementById('rv-add-log-form')?.scrollIntoView({ behavior: 'smooth' })}
          >
            <span aria-hidden>＋</span>
            {t(language, 'territory.log')}
          </button>
          {(building || rv.address) && (
            <button type="button" className="mobile-rv-action" onClick={handleOpenMap}>
              <span aria-hidden>◎</span>
              {t(language, 'zone.map')}
            </button>
          )}
        </section>

        {/* 추가 기록 폼 */}
        <section id="rv-add-log-form" className="mobile-rv-card">
          <h3 className="mobile-rv-section-title">기록 추가</h3>
          <div className="mobile-rv-result-toggle">
            <button
              type="button"
              className={logResult === '만남' ? 'is-active' : ''}
              onClick={() => setLogResult((prev) => (prev === '만남' ? null : '만남'))}
            >
              만남
            </button>
            <button
              type="button"
              className={logResult === '부재' ? 'is-active' : ''}
              onClick={() => setLogResult((prev) => (prev === '부재' ? null : '부재'))}
            >
              부재
            </button>
          </div>
          <textarea
            className="mobile-rv-memo-input"
            value={logMemo}
            onChange={(e) => setLogMemo(e.target.value)}
            placeholder={t(language, 'territory.memoPlaceholder')}
            rows={2}
          />
          <button
            type="button"
            className="mobile-rv-save-btn"
            disabled={logSaving || (!logResult && !logMemo.trim())}
            onClick={handleAddLog}
          >
            {logSaving ? '…' : t(language, 'common.save')}
          </button>
        </section>

        {/* 다음 방문 권장 (옵션) */}
        {avgIntervalDays && (
          <section className="mobile-rv-card mobile-rv-insight">
            <p>
              평균 방문 간격 <b>{avgIntervalDays}일</b>
              {latestVisit && (() => {
                const lastTime = new Date(latestVisit).getTime()
                const nextTime = lastTime + avgIntervalDays * 86_400_000
                const d = new Date(nextTime)
                const m = d.getMonth() + 1
                const day = d.getDate()
                return ` · 다음 권장 ${m}/${day}`
              })()}
            </p>
          </section>
        )}

        {/* 히스토리 */}
        <section className="mobile-rv-history">
          <h3 className="mobile-rv-section-title">
            방문 기록 <span className="rv-count">{myLogs.length}건</span>
          </h3>
          {myLogs.length === 0 ? (
            <p className="mobile-rv-history-empty">아직 기록이 없습니다.</p>
          ) : (
            <ul className="mobile-rv-history-list">
              {myLogs.map((log) => {
                const isEdit = editingLogId === log.id
                return (
                  <li key={log.id} className="mobile-rv-history-item">
                    <div className="mobile-rv-history-row1">
                      <span className="mobile-rv-history-date">{fmtFullDate(log.visitedAt, language)}</span>
                      {log.result && (
                        <span className={`mobile-rv-result-chip is-${log.result === '만남' ? 'met' : 'absent'}`}>
                          {log.result}
                        </span>
                      )}
                      <span className="mobile-rv-history-actions">
                        {!isEdit && onUpdateReturnVisitLog && (
                          <button type="button" onClick={() => { setEditingLogId(log.id); setEditLogResult(log.result); setEditLogMemo(log.memo) }}>
                            {t(language, 'common.edit')}
                          </button>
                        )}
                        {!isEdit && onDeleteReturnVisitLog && (
                          <button type="button" className="danger" onClick={() => handleDeleteLog(log.id)}>
                            {t(language, 'common.delete')}
                          </button>
                        )}
                      </span>
                    </div>
                    {isEdit ? (
                      <div className="mobile-rv-history-edit">
                        <div className="mobile-rv-result-toggle">
                          <button type="button" className={editLogResult === '만남' ? 'is-active' : ''} onClick={() => setEditLogResult((prev) => prev === '만남' ? null : '만남')}>만남</button>
                          <button type="button" className={editLogResult === '부재' ? 'is-active' : ''} onClick={() => setEditLogResult((prev) => prev === '부재' ? null : '부재')}>부재</button>
                        </div>
                        <textarea
                          className="mobile-rv-memo-input"
                          value={editLogMemo}
                          onChange={(e) => setEditLogMemo(e.target.value)}
                          rows={2}
                        />
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          <button type="button" onClick={() => setEditingLogId(null)}>{t(language, 'common.cancel')}</button>
                          <button type="button" disabled={logSaving} onClick={() => handleSaveEditLog(log.id)}>
                            {logSaving ? '…' : t(language, 'common.save')}
                          </button>
                        </div>
                      </div>
                    ) : (
                      log.memo && <p className="mobile-rv-history-memo">{log.memo}</p>
                    )}
                    {log.createdBy && !isEdit && (
                      <p className="mobile-rv-history-author">{log.createdBy}</p>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>

      {/* 별칭 편집 모달 */}
      {nicknameOpen && (
        <div className="mobile-rv-modal-backdrop" onClick={() => setNicknameOpen(false)}>
          <div className="mobile-rv-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{t(language, 'territory.editNickname')}</h3>
            <input
              type="text"
              value={nicknameValue}
              onChange={(e) => setNicknameValue(e.target.value)}
              placeholder={rv.displayName}
              autoFocus
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setNicknameOpen(false)}>{t(language, 'common.cancel')}</button>
              <button
                type="button"
                onClick={async () => {
                  if (!onUpdateReturnVisitNickname) return
                  await onUpdateReturnVisitNickname(rv.id, nicknameValue)
                  setNicknameOpen(false)
                }}
              >
                {t(language, 'common.save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 주소 편집 모달 */}
      {addressOpen && (
        <div className="mobile-rv-modal-backdrop" onClick={() => setAddressOpen(false)}>
          <div className="mobile-rv-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{t(language, 'territory.editAddress')}</h3>
            <input
              type="text"
              value={addressValue}
              onChange={(e) => setAddressValue(e.target.value)}
              placeholder={t(language, 'territory.addressPlaceholderShort')}
              autoFocus
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setAddressOpen(false)}>{t(language, 'common.cancel')}</button>
              <button
                type="button"
                onClick={async () => {
                  if (!onUpdateReturnVisitAddress) return
                  await onUpdateReturnVisitAddress(rv.id, addressValue)
                  setAddressOpen(false)
                }}
              >
                {t(language, 'common.save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
