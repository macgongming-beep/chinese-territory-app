import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchPlaceChangeRequests, reviewPlaceChangeRequest } from '../hooks/storeMutations/placeChangeRequests'
import type { PlaceChangeRequest, PlaceIssueType } from '../types'

const issueLabels: Record<PlaceIssueType, string> = {
  building_missing: '건물이 없어졌습니다',
  unit_missing: '이 세대가 없어졌습니다',
  details_wrong: '주소·이름·호수가 다릅니다',
  duplicate_place: '같은 장소가 두 번 보여요',
  other: '기타',
}

export function PlaceChangeRequests() {
  const navigate = useNavigate()
  const [requests, setRequests] = useState<PlaceChangeRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [showClosed, setShowClosed] = useState(false)
  const [savingId, setSavingId] = useState<number | null>(null)

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
          {requests.map((request) => (
            <article className="place-request-card" key={request.id}>
              <div className="place-request-title">
                <strong>{issueLabels[request.requestType]}</strong>
                <span className={`place-request-status ${request.status}`}>{request.status === 'pending' ? '대기' : request.status === 'completed' ? '완료' : '반려'}</span>
              </div>
              <h3>{request.buildingName || request.address || '장소 정보 없음'}{request.unitNumber ? ` ${request.unitNumber}호` : ''}</h3>
              {request.address && <p>{request.address}</p>}
              {request.note && <blockquote>{request.note}</blockquote>}
              <small>{request.requestedByName} · {new Date(request.createdAt).toLocaleString('ko-KR')}</small>
              {request.status === 'pending' && (
                <div className="place-request-actions">
                  {request.buildingId && <button type="button" onClick={() => navigate(`/map?buildingId=${request.buildingId}`)}>장소 열기</button>}
                  <button type="button" disabled={savingId === request.id} onClick={() => review(request.id, 'rejected')}>반려</button>
                  <button className="primary" type="button" disabled={savingId === request.id} onClick={() => review(request.id, 'completed')}>처리 완료</button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
