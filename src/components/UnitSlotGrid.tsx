import { useState } from 'react'
import type { TimeSlot, UnitStatus, VisitHistory } from '../types'
import type { SlotCell, SlotMatrix } from '../utils/visitStrategy'
import { getSlotMatrix, isAllSlotsAbsent } from '../utils/visitStrategy'

const DAY_LABELS = ['평일', '주말'] as const
const SLOT_LABELS: TimeSlot[] = ['오전', '오후', '저녁']

// ── 셀 색상 계산 ──────────────────────────────────────────────
function cellStyle(cell: SlotCell): { bg: string; color: string; border: string } {
  if (cell.total === 0) {
    return { bg: '#f8fafc', color: '#cbd5e1', border: '1px solid #e2e8f0' }
  }
  if (cell.meetings > 0) {
    return { bg: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0' }
  }
  // 부재만 있음 — 횟수에 따라 색 진해짐
  if (cell.absences === 1) {
    return { bg: '#fff7ed', color: '#ea580c', border: '1px solid #fed7aa' }
  }
  return { bg: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }
}

function cellLabel(cell: SlotCell): string {
  if (cell.total === 0) return '─'
  if (cell.meetings > 0) return '✓'
  return String(cell.absences)
}

// ── 팝오버 ───────────────────────────────────────────────────
function SlotPopover({
  cell,
  histories,
  canRecord,
  onRecord,
  onClose,
}: {
  cell: SlotCell
  histories: VisitHistory[]
  canRecord: boolean
  onRecord: (result: UnitStatus) => Promise<void>
  onClose: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [justSaved, setJustSaved] = useState<UnitStatus | null>(null)

  const relevantHistories = histories.filter((h) => {
    if (!h.timeSlot || h.timeSlot !== cell.slot) return false
    const dow = new Date(h.visitedAt).getDay()
    const isWe = dow === 0 || dow === 6
    return cell.dayType === '주말' ? isWe : !isWe
  }).slice(0, 5)

  const handleRecord = async (result: UnitStatus) => {
    if (!canRecord || saving) return
    setSaving(true)
    await onRecord(result)
    setSaving(false)
    setJustSaved(result)
    setTimeout(onClose, 800)
  }

  const RESULTS: { result: UnitStatus; label: string; color: string; bg: string }[] = [
    { result: '부재', label: '부재', color: '#dc2626', bg: '#fef2f2' },
    { result: '만남', label: '만남', color: '#16a34a', bg: '#f0fdf4' },
    { result: '대상외', label: '대상외', color: '#6366f1', bg: '#f5f3ff' },
  ]

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        background: 'rgba(0,0,0,0.25)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%', maxWidth: 420,
          background: '#fff', borderRadius: '16px 16px 0 0',
          padding: '20px 20px 32px',
          boxShadow: '0 -4px 24px rgba(0,0,0,0.12)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <span style={{ fontSize: 16, fontWeight: 700, color: '#1e293b' }}>
              {cell.dayType} {cell.slot}
            </span>
            {cell.total > 0 && (
              <span style={{ fontSize: 12, color: '#94a3b8', marginLeft: 8 }}>
                총 {cell.total}회 방문
              </span>
            )}
          </div>
          <button
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 18, padding: 4 }}
            onClick={onClose}
            type="button"
          >✕</button>
        </div>

        {/* 이력 */}
        {relevantHistories.length > 0 && (
          <div style={{ marginBottom: 16, padding: '10px 12px', background: '#f8fafc', borderRadius: 10 }}>
            {relevantHistories.map((h) => (
              <div key={h.id} style={{ display: 'flex', gap: 8, fontSize: 12, color: '#64748b', padding: '3px 0' }}>
                <span style={{ minWidth: 50, color: '#94a3b8' }}>{h.visitedAt.slice(5).replace('-', '/')}</span>
                <span style={{
                  fontWeight: 700,
                  color: h.result === '만남' ? '#16a34a' : h.result === '부재' ? '#dc2626' : '#6366f1',
                }}>{h.result}</span>
                {h.visitor && <span style={{ color: '#94a3b8' }}>· {h.visitor}</span>}
              </div>
            ))}
          </div>
        )}

        {/* 기록 버튼 */}
        {canRecord && (
          <>
            <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600, marginBottom: 10 }}>
              지금 방문 기록 추가
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {RESULTS.map(({ result, label, color, bg }) => (
                <button
                  key={result}
                  disabled={saving}
                  onClick={() => handleRecord(result)}
                  style={{
                    flex: 1, padding: '11px 0', borderRadius: 10, border: 'none',
                    background: justSaved === result ? color : bg,
                    color: justSaved === result ? '#fff' : color,
                    fontWeight: 700, fontSize: 14, cursor: 'pointer',
                    transition: 'all .15s',
                  }}
                  type="button"
                >
                  {justSaved === result ? '✓' : label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── 메인 그리드 컴포넌트 ─────────────────────────────────────
export function UnitSlotGrid({
  histories,
  canRecord,
  onRecordVisit,
}: {
  histories: VisitHistory[]
  canRecord: boolean
  /** (result, timeSlot, isWeekend) → 방문 기록 */
  onRecordVisit: (result: UnitStatus, timeSlot: TimeSlot, isWeekend: boolean) => Promise<void>
}) {
  const matrix: SlotMatrix = getSlotMatrix(histories)
  const allAbsent = isAllSlotsAbsent(matrix)
  const [activeCell, setActiveCell] = useState<{ row: number; col: number } | null>(null)

  const activeCellData = activeCell !== null ? matrix[activeCell.row][activeCell.col] : null

  return (
    <>
      <div style={{
        marginBottom: 12,
        border: allAbsent ? '1.5px solid #fca5a5' : '1.5px solid #f1f5f9',
        borderRadius: 10,
        overflow: 'hidden',
        background: '#fff',
      }}>
        {/* 헤더 행 */}
        <div style={{ display: 'grid', gridTemplateColumns: '36px 1fr 1fr 1fr', background: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
          <div />
          {SLOT_LABELS.map((s) => (
            <div key={s} style={{ padding: '3px 0', textAlign: 'center', fontSize: 10, fontWeight: 700, color: '#94a3b8' }}>{s}</div>
          ))}
        </div>

        {/* 데이터 행 */}
        {matrix.map((row, rowIdx) => (
          <div
            key={DAY_LABELS[rowIdx]}
            style={{
              display: 'grid', gridTemplateColumns: '36px 1fr 1fr 1fr',
              borderBottom: rowIdx < matrix.length - 1 ? '1px solid #f1f5f9' : 'none',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#64748b', background: '#f8fafc', borderRight: '1px solid #f1f5f9' }}>
              {DAY_LABELS[rowIdx]}
            </div>
            {row.map((cell, colIdx) => {
              const s = cellStyle(cell)
              return (
                <button
                  key={cell.slot}
                  onClick={() => setActiveCell({ row: rowIdx, col: colIdx })}
                  style={{
                    border: 'none', borderRight: colIdx < row.length - 1 ? '1px solid #f1f5f9' : 'none',
                    background: s.bg, color: s.color,
                    padding: '5px 4px', cursor: 'pointer',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1,
                    transition: 'background .15s',
                  }}
                  type="button"
                >
                  <span style={{ fontSize: 12, fontWeight: 800 }}>{cellLabel(cell)}</span>
                  {cell.total > 0 && cell.meetings === 0 && (
                    <span style={{ fontSize: 9, color: '#cbd5e1' }}>{cell.total}회</span>
                  )}
                </button>
              )
            })}
          </div>
        ))}
      </div>

      {allAbsent && (
        <div style={{ fontSize: 11, color: '#dc2626', fontWeight: 600, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#dc2626', display: 'inline-block', flexShrink: 0 }} />
          3슬롯 이상 부재 — 다른 접근 방법 검토
        </div>
      )}

      {/* 팝오버 */}
      {activeCell !== null && activeCellData && (
        <SlotPopover
          cell={activeCellData}
          histories={histories}
          canRecord={canRecord}
          onRecord={async (result) => {
            const weekend = DAY_LABELS[activeCell.row] === '주말'
            await onRecordVisit(result, activeCellData.slot, weekend)
          }}
          onClose={() => setActiveCell(null)}
        />
      )}
    </>
  )
}
