import { useState } from 'react'
import type { SpecialPeriod } from '../types'

export function SpecialPeriodSettings({
  specialPeriods = [],
  isAdmin,
  onCreateSpecialPeriod,
  onDeleteSpecialPeriod,
}: {
  specialPeriods?: SpecialPeriod[]
  isAdmin: boolean
  onCreateSpecialPeriod?: (input: { label: string; startDate: string; endDate: string; color: string }) => Promise<void> | void
  onDeleteSpecialPeriod?: (id: number) => Promise<void> | void
}) {
  const todayStr = new Date().toISOString().slice(0, 10)
  const activePeriod = specialPeriods.find((p) => todayStr >= p.startDate && todayStr <= p.endDate)
  const upcomingPeriods = specialPeriods.filter((p) => todayStr < p.startDate).sort((a, b) => a.startDate.localeCompare(b.startDate))
  const pastPeriods = specialPeriods.filter((p) => todayStr > p.endDate).sort((a, b) => b.startDate.localeCompare(a.startDate))

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [newStartDate, setNewStartDate] = useState(todayStr)
  const [newDurationDays, setNewDurationDays] = useState(7)
  const [submitting, setSubmitting] = useState(false)

  const calculateEndDate = (start: string, days: number): string => {
    if (!start) return ''
    const d = new Date(start)
    d.setDate(d.getDate() + days - 1)
    return d.toISOString().slice(0, 10)
  }

  const newEndDate = calculateEndDate(newStartDate, newDurationDays)
  const dDay = (() => {
    if (!activePeriod) return null
    const end = new Date(activePeriod.endDate)
    const today = new Date(todayStr)
    return Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  })()

  const handleCreate = async () => {
    if (!newLabel.trim() || !newStartDate || !newEndDate || !onCreateSpecialPeriod) return
    const overlaps = specialPeriods.find((p) => !(newEndDate < p.startDate || newStartDate > p.endDate))
    if (overlaps) {
      alert(`기존 시즌 "${overlaps.label}" (${overlaps.startDate} ~ ${overlaps.endDate})와 겹칩니다.`)
      return
    }
    setSubmitting(true)
    await Promise.resolve(onCreateSpecialPeriod({
      label: newLabel.trim(),
      startDate: newStartDate,
      endDate: newEndDate,
      color: '#f59e0b',
    }))
    setShowCreateModal(false)
    setNewLabel('')
    setNewStartDate(todayStr)
    setNewDurationDays(7)
    setSubmitting(false)
  }

  return (
    <div className="special-period-settings">
      {activePeriod && (
        <div className="detail-card sps-active-card" style={{ marginBottom: '16px', borderLeft: '4px solid #f59e0b', background: '#fffbeb' }}>
          <div className="sps-active-head">
            <div className="sps-active-main">
              <div className="sps-active-title">
                <span aria-hidden="true" />
                <h2 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: '#92400e' }}>특별봉사 진행 중</h2>
              </div>
              <p style={{ fontSize: '14px', fontWeight: 700, margin: '4px 0', color: '#1e293b' }}>{activePeriod.label}</p>
              <p className="sps-period-dates" style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>
                {activePeriod.startDate} ~ {activePeriod.endDate}
                {dDay !== null && (
                  <span className="sps-dday" style={{ marginLeft: '8px', padding: '2px 8px', borderRadius: '10px', background: '#f59e0b', color: '#fff', fontWeight: 700 }}>
                    {dDay > 0 ? `D-${dDay}` : dDay === 0 ? '오늘 마지막 날' : `D+${Math.abs(dDay)}`}
                  </span>
                )}
              </p>
            </div>
            {isAdmin && (
              <button
                onClick={() => {
                  if (window.confirm(`"${activePeriod.label}" 시즌을 즉시 종료할까요?\n이미 기록된 방문은 보존됩니다.`)) {
                    void onDeleteSpecialPeriod?.(activePeriod.id)
                  }
                }}
                type="button"
                style={{ padding: '6px 12px', border: '1px solid #fecaca', borderRadius: '7px', background: '#fff', color: '#dc2626', fontSize: '12px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}
              >
                종료/삭제
              </button>
            )}
          </div>
          <p className="sps-active-note" style={{ fontSize: '12px', color: '#78716c', margin: '12px 0 0', lineHeight: 1.5 }}>
            기간 동안의 모든 방문 기록은 자동으로 이 시즌에 태깅됩니다. 방문 모달에 "초대장 남김" 체크박스가 표시됩니다.
          </p>
        </div>
      )}

      {isAdmin && (
        <div className="detail-card" style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <h2 style={{ fontSize: '15px', fontWeight: 700, margin: 0 }}>특별봉사 시즌 관리</h2>
            <button
              onClick={() => setShowCreateModal(true)}
              type="button"
              style={{ padding: '6px 14px', border: 0, borderRadius: '7px', background: '#f59e0b', color: '#fff', fontSize: '13px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}
            >
              + 새 시즌
            </button>
          </div>

          {upcomingPeriods.length > 0 && (
            <div style={{ marginBottom: '14px' }}>
              <p style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', margin: '0 0 6px', letterSpacing: '0.05em' }}>예정</p>
              {upcomingPeriods.map((period) => (
                <div key={period.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', padding: '8px 12px', borderRadius: '8px', background: '#f8fafc', marginBottom: '6px' }}>
                  <div>
                    <strong style={{ fontSize: '13px' }}>{period.label}</strong>
                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>{period.startDate} ~ {period.endDate}</div>
                  </div>
                  <button
                    onClick={() => {
                      if (window.confirm(`"${period.label}" 예정 시즌을 삭제할까요?`)) void onDeleteSpecialPeriod?.(period.id)
                    }}
                    type="button"
                    style={{ padding: '4px 10px', border: '1px solid #fecaca', borderRadius: '6px', background: '#fff', color: '#dc2626', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                  >
                    삭제
                  </button>
                </div>
              ))}
            </div>
          )}

          {pastPeriods.length > 0 && (
            <div>
              <p style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', margin: '0 0 6px', letterSpacing: '0.05em' }}>지난 시즌</p>
              {pastPeriods.slice(0, 5).map((period) => (
                <div key={period.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', padding: '8px 12px', borderRadius: '8px', background: '#fff', marginBottom: '4px', border: '1px solid #f1f5f9' }}>
                  <div>
                    <strong style={{ fontSize: '13px', color: '#475569' }}>{period.label}</strong>
                    <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>{period.startDate} ~ {period.endDate}</div>
                  </div>
                  <button
                    onClick={() => {
                      if (window.confirm(`"${period.label}" 시즌을 삭제할까요? 방문 기록은 보존됩니다.`)) void onDeleteSpecialPeriod?.(period.id)
                    }}
                    type="button"
                    style={{ padding: '4px 10px', border: '1px solid #e2e8f0', borderRadius: '6px', background: '#fff', color: '#94a3b8', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                  >
                    삭제
                  </button>
                </div>
              ))}
              {pastPeriods.length > 5 && (
                <p style={{ fontSize: '11px', color: '#94a3b8', margin: '6px 0 0', textAlign: 'center' }}>외 {pastPeriods.length - 5}건</p>
              )}
            </div>
          )}

          {specialPeriods.length === 0 && (
            <p style={{ fontSize: '13px', color: '#94a3b8', margin: 0, textAlign: 'center', padding: '16px 0' }}>등록된 시즌이 없습니다.</p>
          )}
        </div>
      )}

      {showCreateModal && (
        <div className="cal-modal-backdrop" onClick={() => setShowCreateModal(false)}>
          <div className="cal-modal" style={{ maxWidth: '460px', width: '100%' }} onClick={(event) => event.stopPropagation()}>
            <div className="cal-modal-head">
              <div className="cal-modal-title"><h2>새 특별봉사 시즌</h2></div>
            </div>
            <div style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#374151' }}>라벨 <em style={{ color: '#ef4444', fontStyle: 'normal' }}>*</em></span>
                <input
                  placeholder="예) 봄 특별봉사 2026"
                  value={newLabel}
                  onChange={(event) => setNewLabel(event.target.value)}
                  style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '13px', fontFamily: 'inherit' }}
                />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#374151' }}>시작일</span>
                <input
                  type="date"
                  value={newStartDate}
                  onChange={(event) => setNewStartDate(event.target.value)}
                  style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '13px', fontFamily: 'inherit' }}
                />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#374151' }}>기간 (일)</span>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <input
                    type="number"
                    min={1}
                    value={newDurationDays}
                    onChange={(event) => setNewDurationDays(Math.max(1, Number(event.target.value)))}
                    style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '13px', width: '80px', fontFamily: 'inherit' }}
                  />
                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                    {[3, 5, 7, 10, 14].map((days) => (
                      <button
                        key={days}
                        type="button"
                        onClick={() => setNewDurationDays(days)}
                        style={{ padding: '4px 10px', border: newDurationDays === days ? '1px solid #f59e0b' : '1px solid #e2e8f0', borderRadius: '6px', background: newDurationDays === days ? '#fef3c7' : '#fff', color: newDurationDays === days ? '#92400e' : '#64748b', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
                      >
                        {days}일
                      </button>
                    ))}
                  </div>
                </div>
              </label>
              <div style={{ padding: '10px 12px', background: '#fffbeb', borderRadius: '8px', fontSize: '12px', color: '#92400e' }}>
                <strong>종료일:</strong> {newEndDate || '-'}
                {newStartDate && newStartDate <= todayStr && newEndDate >= todayStr && (
                  <span style={{ marginLeft: '8px', padding: '2px 8px', borderRadius: '4px', background: '#f59e0b', color: '#fff', fontSize: '11px' }}>오늘부터 활성화됨</span>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', padding: '12px 24px 20px', borderTop: '1px solid #f1f5f9' }}>
              <button
                onClick={() => setShowCreateModal(false)}
                type="button"
                style={{ padding: '8px 16px', border: '1px solid #e2e8f0', borderRadius: '7px', background: '#fff', color: '#64748b', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
              >
                취소
              </button>
              <button
                onClick={() => void handleCreate()}
                type="button"
                disabled={!newLabel.trim() || submitting}
                style={{ padding: '8px 18px', border: 0, borderRadius: '7px', background: !newLabel.trim() || submitting ? '#cbd5e1' : '#f59e0b', color: '#fff', fontSize: '13px', fontWeight: 700, cursor: !newLabel.trim() || submitting ? 'not-allowed' : 'pointer' }}
              >
                {submitting ? '생성 중...' : '시즌 생성'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
