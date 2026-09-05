import { useState } from 'react'
import type { EndReturnVisitInput, PlaceIssueType, ReturnVisit, ReturnVisitEndReason } from '../types'

const reasons: { value: ReturnVisitEndReason; label: string }[] = [
  { value: 'no_longer_assigned', label: '더 이상 제가 담당하지 않습니다' },
  { value: 'needs_reassignment', label: '다른 사람이 이어서 방문해야 합니다' },
  { value: 'no_longer_target', label: '더 이상 정기방문 대상이 아닙니다' },
]

const issues: { value: PlaceIssueType; label: string }[] = [
  { value: 'building_missing', label: '건물이 없어졌습니다' },
  { value: 'unit_missing', label: '이 세대가 없어졌습니다' },
  { value: 'details_wrong', label: '주소·이름·호수가 다릅니다' },
  { value: 'duplicate_place', label: '같은 장소가 두 번 보여요' },
  { value: 'other', label: '기타' },
]

export function EndReturnVisitDialog({
  visit,
  onClose,
  onSubmit,
}: {
  visit: ReturnVisit
  onClose: () => void
  onSubmit: (input: EndReturnVisitInput) => Promise<boolean>
}) {
  const [reason, setReason] = useState<ReturnVisitEndReason>('no_longer_assigned')
  const [issueType, setIssueType] = useState<PlaceIssueType | ''>('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  return (
    <div className="rv-end-backdrop" onClick={onClose}>
      <section className="rv-end-sheet" role="dialog" aria-modal="true" aria-labelledby="rv-end-title" onClick={(event) => event.stopPropagation()}>
        <header>
          <div>
            <h2 id="rv-end-title">정기방문 종료</h2>
            <p>{visit.nickname || visit.displayName}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="닫기">×</button>
        </header>

        <div className="rv-end-section">
          <strong>왜 종료하나요?</strong>
          <div className="rv-end-options">
            {reasons.map((item) => (
              <label key={item.value}>
                <input type="radio" name="end-reason" checked={reason === item.value} onChange={() => setReason(item.value)} />
                <span>{item.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="rv-end-section">
          <label className="rv-end-label" htmlFor="rv-place-issue">장소 정보에도 문제가 있나요? <small>선택</small></label>
          <select id="rv-place-issue" value={issueType} onChange={(event) => setIssueType(event.target.value as PlaceIssueType | '')}>
            <option value="">문제 없음</option>
            {issues.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
          {issueType && (
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder={issueType === 'details_wrong' ? '올바른 주소·이름·호수를 적어 주세요.' : '관리자가 확인할 내용을 적어 주세요.'}
              rows={3}
            />
          )}
        </div>

        <p className="rv-end-preserve">건물·세대와 기존 방문기록은 그대로 남습니다.</p>
        <div className="rv-end-actions">
          <button type="button" onClick={onClose}>취소</button>
          <button
            type="button"
            className="primary"
            disabled={saving}
            onClick={async () => {
              setSaving(true)
              try {
                if (await onSubmit({ reason, issueType: issueType || null, issueNote: note })) onClose()
              } finally {
                setSaving(false)
              }
            }}
          >{saving ? '처리 중…' : issueType ? '종료하고 요청 보내기' : '정기방문 종료'}</button>
        </div>
      </section>
    </div>
  )
}
