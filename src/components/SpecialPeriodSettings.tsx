import { useState } from 'react'
import type { SpecialPeriod } from '../types'
import { confirmDialog } from '../lib/confirm'
import { findActivePeriod } from '../utils/specialPeriod'
import { getLocalDateString } from '../utils/dateUtils'
import { PERIOD_COLORS } from '../types'

type PeriodInput = { label: string; startDate: string; endDate: string; color: string; hasInvitation: boolean }

function ColorPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
      {PERIOD_COLORS.map((c) => (
        <button
          key={c.value}
          type="button"
          title={c.label}
          onClick={() => onChange(c.value)}
          style={{
            flexShrink: 0,
            flexGrow: 0,
            width: 24, height: 24,
            minWidth: 24, minHeight: 24,
            borderRadius: '50%',
            background: c.value,
            border: value === c.value ? `2.5px solid ${c.value}` : '2.5px solid transparent',
            outline: value === c.value ? `2px solid ${c.value}66` : 'none',
            outlineOffset: '2px',
            cursor: 'pointer',
            padding: 0,
            opacity: value === c.value ? 1 : 0.45,
            transition: 'opacity 0.15s, outline 0.15s',
            display: 'block',
          }}
        />
      ))}
    </div>
  )
}

function PeriodForm({
  title,
  initial,
  todayStr,
  onSubmit,
  onCancel,
  submitLabel,
  submitting,
}: {
  title: string
  initial: { label: string; startDate: string; durationDays: number; color: string; hasInvitation: boolean }
  todayStr: string
  onSubmit: (input: PeriodInput) => void
  onCancel: () => void
  submitLabel: string
  submitting: boolean
}) {
  const [label, setLabel] = useState(initial.label)
  const [startDate, setStartDate] = useState(initial.startDate)
  const [durationDays, setDurationDays] = useState(initial.durationDays)
  const [color, setColor] = useState(initial.color)
  const [hasInvitation, setHasInvitation] = useState(initial.hasInvitation)

  const calcEnd = (start: string, days: number) => {
    if (!start) return ''
    const d = new Date(start)
    d.setDate(d.getDate() + days - 1)
    return d.toISOString().slice(0, 10)
  }
  const endDate = calcEnd(startDate, durationDays)
  const canSubmit = label.trim() && startDate && endDate && !submitting

  const fieldStyle = { padding: '8px 12px', border: '1px solid var(--line)', borderRadius: '8px', fontSize: '13px', fontFamily: 'inherit', background: 'var(--bg)', color: 'var(--ink)' }
  const labelStyle = { fontSize: '12px', fontWeight: 600 as const, color: 'var(--muted)' }

  return (
    <div className="cal-modal-backdrop" onClick={onCancel}>
      <div className="cal-modal" style={{ maxWidth: '420px', width: '100%' }} onClick={(e) => e.stopPropagation()}>
        <div className="cal-modal-head">
          <div className="cal-modal-title"><h2>{title}</h2></div>
        </div>
        <div style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: '13px' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <span style={labelStyle}>라벨 <em style={{ color: 'var(--status-danger)', fontStyle: 'normal' }}>*</em></span>
            <input placeholder="예) 봄 특별봉사 2026" value={label} onChange={(e) => setLabel(e.target.value)} style={fieldStyle} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <span style={labelStyle}>시작일</span>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={fieldStyle} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <span style={labelStyle}>기간 (일)</span>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <input type="number" min={1} value={durationDays} onChange={(e) => setDurationDays(Math.max(1, Number(e.target.value)))} style={{ ...fieldStyle, width: '80px' }} />
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                {[3, 5, 7, 10, 14].map((days) => (
                  <button key={days} type="button" onClick={() => setDurationDays(days)}
                    style={{ padding: '4px 10px', border: `1px solid ${durationDays === days ? color : 'var(--line)'}`, borderRadius: '6px', background: durationDays === days ? color + '18' : 'var(--surface)', color: durationDays === days ? color : 'var(--muted)', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>
                    {days}일
                  </button>
                ))}
              </div>
            </div>
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={labelStyle}>색상</span>
            <ColorPicker value={color} onChange={setColor} />
          </div>
          {/* 초대장 봉사 여부 */}
          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', padding: '10px 12px', background: hasInvitation ? 'rgba(245,158,11,0.08)' : 'var(--surface)', border: `1px solid ${hasInvitation ? '#f59e0b' : 'var(--line)'}`, borderRadius: '8px' }}>
            <input
              type="checkbox"
              checked={hasInvitation}
              onChange={(e) => setHasInvitation(e.target.checked)}
              style={{ width: 16, height: 16, accentColor: '#f59e0b', flexShrink: 0 }}
            />
            <div>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: hasInvitation ? '#b45309' : 'var(--ink)' }}>초대장 봉사</p>
              <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--muted)' }}>
                체크 시 봉사 중 세대별 초대장 버튼이 표시됩니다
              </p>
            </div>
          </label>
          <div style={{ padding: '9px 12px', background: 'var(--surface)', border: `1px solid var(--line)`, borderLeft: `3px solid ${color}`, borderRadius: '8px', fontSize: '12px', color: 'var(--ink)' }}>
            <strong>종료일:</strong> {endDate || '-'}
            {startDate && startDate <= todayStr && endDate >= todayStr && (
              <span style={{ marginLeft: '8px', padding: '2px 7px', borderRadius: '4px', background: color, color: '#fff', fontSize: '11px' }}>오늘부터 활성화됨</span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', padding: '12px 24px 20px', borderTop: '1px solid var(--line)' }}>
          <button onClick={onCancel} type="button" style={{ padding: '8px 16px', border: '1px solid var(--line)', borderRadius: '7px', background: 'var(--surface)', color: 'var(--muted)', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>취소</button>
          <button onClick={() => canSubmit && onSubmit({ label: label.trim(), startDate, endDate, color, hasInvitation })} type="button" disabled={!canSubmit}
            style={{ padding: '8px 18px', border: 0, borderRadius: '7px', background: canSubmit ? 'var(--ink)' : 'var(--line)', color: '#fff', fontSize: '13px', fontWeight: 700, cursor: canSubmit ? 'pointer' : 'not-allowed' }}>
            {submitting ? '저장 중...' : submitLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

export function SpecialPeriodSettings({
  specialPeriods = [],
  isAdmin,
  onCreateSpecialPeriod,
  onUpdateSpecialPeriod,
  onDeleteSpecialPeriod,
}: {
  specialPeriods?: SpecialPeriod[]
  isAdmin: boolean
  onCreateSpecialPeriod?: (input: PeriodInput) => Promise<void> | void
  onUpdateSpecialPeriod?: (id: number, input: PeriodInput) => Promise<void> | void
  onDeleteSpecialPeriod?: (id: number) => Promise<void> | void
}) {
  const todayStr = getLocalDateString()
  const activePeriod = findActivePeriod(specialPeriods, todayStr)
  const upcomingPeriods = specialPeriods.filter((p) => todayStr < p.startDate).sort((a, b) => a.startDate.localeCompare(b.startDate))
  const pastPeriods = specialPeriods.filter((p) => todayStr > p.endDate).sort((a, b) => b.startDate.localeCompare(a.startDate))

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingPeriod, setEditingPeriod] = useState<SpecialPeriod | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const dDay = (() => {
    if (!activePeriod) return null
    const end = new Date(activePeriod.endDate)
    const today = new Date(todayStr)
    return Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  })()

  const calcDuration = (start: string, end: string) => {
    if (!start || !end) return 7
    const s = new Date(start), e = new Date(end)
    return Math.max(1, Math.round((e.getTime() - s.getTime()) / 86400000) + 1)
  }

  const handleCreate = async (input: PeriodInput) => {
    if (!onCreateSpecialPeriod) return
    setSubmitting(true)
    await Promise.resolve(onCreateSpecialPeriod(input))
    setShowCreateModal(false)
    setSubmitting(false)
  }

  const handleUpdate = async (input: PeriodInput) => {
    if (!editingPeriod || !onUpdateSpecialPeriod) return
    setSubmitting(true)
    await Promise.resolve(onUpdateSpecialPeriod(editingPeriod.id, input))
    setEditingPeriod(null)
    setSubmitting(false)
  }

  const rowStyle = { display: 'flex', alignItems: 'center', justifyContent: 'space-between' as const, gap: '10px', padding: '8px 12px', borderRadius: '8px', background: 'var(--surface)', marginBottom: '6px', border: '1px solid var(--line)' }
  const actionBtnStyle = (danger?: boolean) => ({ padding: '3px 10px', border: `1px solid var(--line)`, borderRadius: '6px', background: 'var(--bg)', color: danger ? 'var(--status-danger)' : 'var(--muted)', fontSize: '12px', fontWeight: 600 as const, cursor: 'pointer' })

  return (
    <div className="special-period-settings">
      {activePeriod && (
        <div style={{ marginBottom: 16, padding: 16, background: 'var(--surface)', border: `1px solid var(--line)`, borderLeft: `4px solid ${activePeriod.color || 'var(--ink)'}`, borderRadius: 12 }}>
          {/* 헤더 행: 상태 라벨 + D-day + 액션 버튼 */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
              <span style={{ width: 6, height: 6, borderRadius: 99, background: activePeriod.color || 'var(--ink)', flexShrink: 0 }} />
              <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--muted)', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>특별봉사 진행 중</span>
              {dDay !== null && (
                <span style={{ flexShrink: 0, padding: '1px 7px', borderRadius: 999, background: activePeriod.color || 'var(--ink)', color: '#fff', fontWeight: 700, fontSize: 11 }}>
                  {dDay > 0 ? `D-${dDay}` : dDay === 0 ? '오늘 마지막' : `D+${Math.abs(dDay)}`}
                </span>
              )}
            </div>
            {isAdmin && (
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <button onClick={() => setEditingPeriod(activePeriod)} type="button" style={actionBtnStyle()}>수정</button>
                <button onClick={async () => { if (await confirmDialog({ message: `"${activePeriod.label}" 시즌을 즉시 종료할까요?\n이미 기록된 방문은 보존됩니다.`, danger: true, confirmLabel: '종료' })) void onDeleteSpecialPeriod?.(activePeriod.id) }} type="button" style={actionBtnStyle(true)}>종료</button>
              </div>
            )}
          </div>
          {/* 시즌 이름 */}
          <p style={{ fontSize: 15, fontWeight: 700, margin: '0 0 4px', color: 'var(--ink)' }}>{activePeriod.label}</p>
          {/* 날짜: 한 줄 고정 */}
          <p style={{ fontSize: 12.5, color: 'var(--muted)', margin: '0 0 10px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontVariantNumeric: 'tabular-nums' }}>
            {activePeriod.startDate} ~ {activePeriod.endDate}
          </p>
          <p style={{ fontSize: 12, color: 'var(--muted)', margin: 0, lineHeight: 1.5 }}>
            기간 동안의 모든 방문 기록은 자동으로 이 시즌에 태깅됩니다.
          </p>
        </div>
      )}

      {isAdmin && (
        <div className="detail-card" style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <h2 style={{ fontSize: '15px', fontWeight: 700, margin: 0 }}>특별봉사 시즌 관리</h2>
            <button onClick={() => setShowCreateModal(true)} type="button"
              style={{ padding: '6px 14px', border: 0, borderRadius: '7px', background: 'var(--ink)', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              + 새 시즌
            </button>
          </div>

          {upcomingPeriods.length > 0 && (
            <div style={{ marginBottom: '14px' }}>
              <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', margin: '0 0 6px', letterSpacing: '0.05em' }}>예정</p>
              {upcomingPeriods.map((period) => (
                <div key={period.id} style={rowStyle}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: period.color, flexShrink: 0 }} />
                    <div style={{ minWidth: 0 }}>
                      <strong style={{ fontSize: '13px', display: 'block' }}>{period.label}</strong>
                      <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>{period.startDate} ~ {period.endDate}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button onClick={() => setEditingPeriod(period)} type="button" style={actionBtnStyle()}>수정</button>
                    <button onClick={async () => { if (await confirmDialog({ message: `"${period.label}" 예정 시즌을 삭제할까요?`, danger: true, confirmLabel: '삭제' })) void onDeleteSpecialPeriod?.(period.id) }} type="button" style={actionBtnStyle(true)}>삭제</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {pastPeriods.length > 0 && (
            <div>
              <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', margin: '0 0 6px', letterSpacing: '0.05em' }}>지난 시즌</p>
              {pastPeriods.slice(0, 5).map((period) => (
                <div key={period.id} style={{ ...rowStyle, opacity: 0.7 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: period.color, flexShrink: 0 }} />
                    <div style={{ minWidth: 0 }}>
                      <strong style={{ fontSize: '13px', color: 'var(--ink)', display: 'block' }}>{period.label}</strong>
                      <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>{period.startDate} ~ {period.endDate}</div>
                    </div>
                  </div>
                  <button onClick={async () => { if (await confirmDialog({ message: `"${period.label}" 시즌을 삭제할까요? 방문 기록은 보존됩니다.`, danger: true, confirmLabel: '삭제' })) void onDeleteSpecialPeriod?.(period.id) }} type="button" style={actionBtnStyle(true)}>삭제</button>
                </div>
              ))}
              {pastPeriods.length > 5 && (
                <p style={{ fontSize: '11px', color: 'var(--muted)', margin: '6px 0 0', textAlign: 'center' }}>외 {pastPeriods.length - 5}건</p>
              )}
            </div>
          )}

          {specialPeriods.length === 0 && (
            <p style={{ fontSize: '13px', color: 'var(--muted)', margin: 0, textAlign: 'center', padding: '16px 0' }}>등록된 시즌이 없습니다.</p>
          )}
        </div>
      )}

      {showCreateModal && (
        <PeriodForm
          title="새 특별봉사 시즌"
          initial={{ label: '', startDate: todayStr, durationDays: 7, color: PERIOD_COLORS[0].value, hasInvitation: false }}
          todayStr={todayStr}
          onSubmit={(input) => void handleCreate(input)}
          onCancel={() => setShowCreateModal(false)}
          submitLabel="시즌 생성"
          submitting={submitting}
        />
      )}

      {editingPeriod && (
        <PeriodForm
          title="시즌 수정"
          initial={{ label: editingPeriod.label, startDate: editingPeriod.startDate, durationDays: calcDuration(editingPeriod.startDate, editingPeriod.endDate), color: editingPeriod.color || PERIOD_COLORS[0].value, hasInvitation: editingPeriod.hasInvitation ?? false }}
          todayStr={todayStr}
          onSubmit={(input) => void handleUpdate(input)}
          onCancel={() => setEditingPeriod(null)}
          submitLabel="저장"
          submitting={submitting}
        />
      )}
    </div>
  )
}
