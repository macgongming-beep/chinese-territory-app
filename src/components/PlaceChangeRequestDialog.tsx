import { useState } from 'react'
import type { Building, PlaceIssueType, Unit } from '../types'
import { submitPlaceChangeRequest } from '../hooks/storeMutations/placeChangeRequests'

const commonIssues: { value: PlaceIssueType; label: string }[] = [
  { value: 'details_wrong', label: '주소·이름·호수가 다릅니다' },
  { value: 'duplicate_place', label: '같은 장소가 두 번 보입니다' },
  { value: 'remove_place', label: '이 장소를 삭제해야 합니다' },
  { value: 'other', label: '기타' },
]

export function PlaceChangeRequestDialog({ building, unit, onClose }: {
  building: Building
  unit?: Unit | null
  onClose: () => void
}) {
  const [requestType, setRequestType] = useState<PlaceIssueType>(unit ? 'unit_missing' : 'building_missing')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const issues: { value: PlaceIssueType; label: string }[] = [
    { value: unit ? 'unit_missing' : 'building_missing', label: unit ? '이 세대가 없어졌습니다' : '건물이 없어졌습니다' },
    ...commonIssues,
  ]

  return (
    <div className="rv-end-backdrop" onClick={onClose}>
      <section className="rv-end-sheet" role="dialog" aria-modal="true" aria-labelledby="place-request-title" onClick={(event) => event.stopPropagation()}>
        <header>
          <div>
            <h2 id="place-request-title">자료 수정 요청</h2>
            <p>{building.name || building.address}{unit ? ` ${unit.number}` : ''}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="닫기">×</button>
        </header>
        <div className="rv-end-section">
          <label className="rv-end-label" htmlFor="place-request-type">어떤 문제가 있나요?</label>
          <select id="place-request-type" value={requestType} onChange={(event) => setRequestType(event.target.value as PlaceIssueType)}>
            {issues.map((issue) => <option key={issue.value} value={issue.value}>{issue.label}</option>)}
          </select>
          <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="관리자가 확인할 내용을 적어 주세요." rows={3} />
        </div>
        <p className="rv-end-preserve">요청만 보내며 건물·세대와 방문 기록은 지금 삭제되지 않습니다.</p>
        <div className="rv-end-actions">
          <button type="button" onClick={onClose}>취소</button>
          <button
            type="button"
            className="primary"
            disabled={saving}
            onClick={async () => {
              setSaving(true)
              try {
                const ok = await submitPlaceChangeRequest({
                  requestType,
                  buildingId: building.id,
                  unitId: unit?.id ?? null,
                  note,
                })
                if (ok) onClose()
              } finally {
                setSaving(false)
              }
            }}
          >{saving ? '보내는 중…' : '요청 보내기'}</button>
        </div>
      </section>
    </div>
  )
}
