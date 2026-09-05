import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { executePlaceDeletionRequest, fetchPlaceChangeRequests, reviewPlaceChangeRequest } from '../hooks/storeMutations/placeChangeRequests'
import { confirmDialog } from '../lib/confirm'
import type { PlaceChangeRequest, PlaceIssueType } from '../types'

const issueLabels: Record<PlaceIssueType, string> = {
  building_missing: '건물이 없어졌습니다',
  unit_missing: '이 세대가 없어졌습니다',
  details_wrong: '주소·이름·호수가 다릅니다',
  duplicate_place: '같은 장소가 두 번 보여요',
  remove_place: '장소 삭제 요청',
  other: '기타',
}

export function PlaceChangeRequests({ onDataChanged }: { onDataChanged?: () => Promise<void> }) {
  const navigate = useNavigate()
  const [requests, setRequests] = useState<PlaceChangeRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [showClosed, setShowClosed] = useState(false)
  const [savingId, setSavingId] = useState<number | null>(null)
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set())

  useEffect(() => {
    let active = true
    void fetchPlaceChangeRequests(showClosed).then((rows) => {
      if (!active) return
      if (rows) setRequests(rows)
      setLoading(false)
    })
    return () => { active = false }
  }, [showClosed])

  const review = async (id: number, status: 'completed' | 'rejected') => {
    setSavingId(id)
    const ok = await reviewPlaceChangeRequest(id, status)
    setSavingId(null)
    if (!ok) return
    const rows = await fetchPlaceChangeRequests(showClosed)
    if (rows) setRequests(rows)
  }

  const executeDeletion = async (request: PlaceChangeRequest) => {
    const impact = impactItems(request)
    const detail = impact.length > 0 ? `\n${impact.map((item) => `${item.label} ${item.count}건`).join(' · ')}` : ''
    const confirmed = await confirmDialog({
      message: `${request.buildingName || request.address || '이 장소'}를 영구 삭제할까요?${detail}\n\n삭제하면 자동으로 되돌릴 수 없습니다.`,
      danger: true,
      confirmLabel: '영구 삭제',
    })
    if (!confirmed) return
    setSavingId(request.id)
    const ok = await executePlaceDeletionRequest(request.id)
    setSavingId(null)
    if (!ok) return
    await onDataChanged?.()
    const rows = await fetchPlaceChangeRequests(showClosed)
    if (rows) setRequests(rows)
  }

  const toggleExpanded = (id: number) => {
    setExpandedIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <section className="place-requests-page">
      <header>
        <div>
          <h2>자료 수정 요청</h2>
          <p>장소를 확인하고 실제 수정·병합·삭제를 마친 뒤 처리 완료로 표시하세요.</p>
        </div>
        <label><input type="checkbox" checked={showClosed} onChange={(event) => setShowClosed(event.target.checked)} /> 처리한 요청 보기</label>
      </header>

      {loading ? (
        <p className="place-requests-empty">불러오는 중…</p>
      ) : requests.length === 0 ? (
        <p className="place-requests-empty">{showClosed ? '요청이 없습니다.' : '처리할 요청이 없습니다.'}</p>
      ) : (
        <div className="place-request-list">
          {requests.map((request) => {
            const expanded = expandedIds.has(request.id)
            const impact = impactItems(request)
            const placeName = `${request.buildingName || request.address || '장소 정보 없음'}${request.unitNumber ? ` ${request.unitNumber}` : ''}`
            return (
              <article className={`place-request-card${expanded ? ' expanded' : ''}`} key={request.id}>
                <button className="place-request-summary" type="button" onClick={() => toggleExpanded(request.id)} aria-expanded={expanded}>
                  <span className="place-request-chevron" aria-hidden="true">{expanded ? '⌄' : '›'}</span>
                  <span className="place-request-summary-copy">
                    <span className="place-request-title"><strong>{issueLabels[request.requestType]}</strong></span>
                    <span className="place-request-place">{placeName}</span>
                    <small>{request.requestedByName} · {new Date(request.createdAt).toLocaleDateString('ko-KR')}</small>
                  </span>
                  <span className={`place-request-status ${request.status}`}>{request.status === 'pending' ? '대기' : request.status === 'completed' ? '완료' : '반려'}</span>
                </button>
                {expanded && (
                  <div className="place-request-details">
                    {request.address && <p>{request.address}</p>}
                    {request.note && <blockquote>{request.note}</blockquote>}
                    {request.requestType === 'remove_place' && (
                      <div className="place-request-impact">
                        <strong>연결된 자료</strong>
                        {impact.length > 0
                          ? <ul>{impact.map((item) => <li key={item.label}><span>{item.label}</span><b>{item.count}</b></li>)}</ul>
                          : <p>연결 기록이 없습니다.</p>}
                      </div>
                    )}
                    {request.reviewedByName && <small>{request.reviewedByName} · {request.status === 'rejected' ? '반려' : '처리'}</small>}
                    {request.status === 'pending' && (
                      <div className="place-request-actions">
                        {request.buildingId && (
                          <button type="button" onClick={() => {
                            const params = new URLSearchParams({ buildingId: String(request.buildingId) })
                            if (request.unitId) params.set('unitId', String(request.unitId))
                            navigate(`/map?${params.toString()}`)
                          }}>장소 열기</button>
                        )}
                        <button type="button" disabled={savingId === request.id} onClick={() => review(request.id, 'rejected')}>반려</button>
                        {request.requestType === 'remove_place'
                          ? <button className="danger" type="button" disabled={savingId === request.id} onClick={() => executeDeletion(request)}>영구 삭제</button>
                          : <button className="primary" type="button" disabled={savingId === request.id} onClick={() => review(request.id, 'completed')}>처리 완료</button>}
                      </div>
                    )}
                  </div>
                )}
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}

function impactItems(request: PlaceChangeRequest) {
  return [
    { label: '세대', count: request.impact.unitCount },
    { label: '방문 기록', count: request.impact.visitHistoryCount },
    { label: '정기방문 담당', count: request.impact.regularVisitCount },
    { label: '정기방문 활동', count: request.impact.returnVisitCount },
    { label: '전화 조사', count: request.impact.phoneSurveyCount },
    { label: '식당 배정', count: request.impact.assignmentCount },
  ].filter((item) => item.count > 0)
}
