/**
 * RestaurantServiceSheet — 식당봉사 바텀시트
 *
 * 봉사자 흐름:
 *  1. 식당 검색 (이름/주소) → 지역별 그룹 목록 + 내가 신청한 대기 항목
 *  2. 선택 → 이전 기록 + 메모 입력 → 저장
 *  3. 없으면 → 추가 신청 (이름+주소만, 메모 없음)
 *  4. 대기 항목 선택 → 메모 추가/수정
 */
import { useMemo, useState } from 'react'
import type { Building, RestaurantRequest, VisitHistory } from '../types'
import { normalizeCardSearch } from '../utils/cardSearch'

// ── 아이콘 ────────────────────────────────────────────────────
function ForkIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 2v7c0 1.66 1.34 3 3 3h0c1.66 0 3-1.34 3-3V2" />
      <line x1="6" y1="12" x2="6" y2="22" />
      <path d="M15 22V12c0-3 2-7 4-7v17" />
    </svg>
  )
}
function SearchIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  )
}
function ChevronRight() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="9 18 15 12 9 6" />
    </svg>
  )
}
function ChevronDown({ open }: { open: boolean }) {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}
function BackIcon() {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="15 18 9 12 15 6" />
    </svg>
  )
}
function ClockIcon() {
  return (
    <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  )
}

// ── 유틸 ─────────────────────────────────────────────────────

const KNOWN_DISTRICTS = ['처인구', '기흥구', '수지구', '영통구', '화성시']

function extractDistrict(address: string): string {
  // 알려진 구/시 이름 우선 매칭
  for (const d of KNOWN_DISTRICTS) {
    if (address.includes(d)) return d
  }
  // 그 외 주소에서 첫 번째 구/시/군 추출
  const match = address.match(/[가-힣]+[구시군]/)
  return match ? match[0] : '기타'
}

function fmtVisitDate(iso: string): string {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const diff = Math.round((today.getTime() - new Date(iso.slice(0, 10)).getTime()) / 86400000)
  if (diff === 0) return '오늘'
  if (diff === 1) return '어제'
  if (diff < 30) return `${diff}일 전`
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

// ── Props ─────────────────────────────────────────────────────
type Props = {
  buildings: Building[]
  visitHistories: VisitHistory[]
  currentVisitor: string
  restaurantRequests?: RestaurantRequest[]
  onAddVisit: (unitId: number, memo: string) => Promise<void>
  onSubmitRequest: (name: string, address: string, memo: string) => Promise<void>
  onUpdateRequestMemo?: (requestId: number, memo: string) => Promise<void>
  onClose: () => void
}

type View = 'search' | 'record' | 'record-pending' | 'add-request'

export function RestaurantServiceSheet({
  buildings,
  visitHistories,
  currentVisitor,
  restaurantRequests = [],
  onAddVisit,
  onSubmitRequest,
  onUpdateRequestMemo,
  onClose,
}: Props) {
  const [view, setView] = useState<View>('search')
  const [search, setSearch] = useState('')
  const [selectedBuilding, setSelectedBuilding] = useState<Building | null>(null)
  const [selectedRequest, setSelectedRequest] = useState<RestaurantRequest | null>(null)
  const [memo, setMemo] = useState('')
  const [saving, setSaving] = useState(false)

  // 추가 신청 폼
  const [reqName, setReqName] = useState('')
  const [reqAddress, setReqAddress] = useState('')

  // 지역별 collapse 상태 (기본: 모두 접힘)
  const [openDistricts, setOpenDistricts] = useState<Set<string>>(new Set())
  const toggleDistrict = (d: string) =>
    setOpenDistricts((prev) => {
      const next = new Set(prev)
      if (next.has(d)) next.delete(d)
      else next.add(d)
      return next
    })

  // 식당 목록 (is_restaurant = true)
  const restaurants = useMemo(
    () => buildings.filter((b) => b.isRestaurant),
    [buildings],
  )

  // 내가 신청한 대기 중 항목
  const myPendingRequests = useMemo(
    () => restaurantRequests.filter((r) => r.status === 'pending' && r.requestedBy === currentVisitor),
    [restaurantRequests, currentVisitor],
  )

  // 검색 필터
  const filtered = useMemo(() => {
    if (!search.trim()) return restaurants
    const q = normalizeCardSearch(search)
    return restaurants.filter(
      (b) => normalizeCardSearch(b.name).includes(q) || normalizeCardSearch(b.address).includes(q),
    )
  }, [restaurants, search])

  // 지역별 그룹
  const grouped = useMemo(() => {
    const map = new Map<string, Building[]>()
    for (const b of filtered) {
      const d = extractDistrict(b.address)
      if (!map.has(d)) map.set(d, [])
      map.get(d)!.push(b)
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b, 'ko'))
  }, [filtered])

  // 선택된 식당의 방문이력
  const buildingHistories = useMemo(() => {
    if (!selectedBuilding) return []
    const unitIds = new Set(selectedBuilding.units.map((u) => u.id))
    return visitHistories
      .filter((h) => unitIds.has(h.unitId))
      .sort((a, b) => b.visitedAt.localeCompare(a.visitedAt))
      .slice(0, 10)
  }, [selectedBuilding, visitHistories])

  // ── 핸들러 ────────────────────────────────────────────────
  const handleSelectBuilding = (b: Building) => {
    setSelectedBuilding(b)
    setMemo('')
    setView('record')
  }

  const handleSelectPendingRequest = (req: RestaurantRequest) => {
    setSelectedRequest(req)
    setMemo(req.memo ?? '')
    setView('record-pending')
  }

  const handleSaveVisit = async () => {
    if (!selectedBuilding) return
    const unit = selectedBuilding.units[0]
    if (!unit) return
    setSaving(true)
    await onAddVisit(unit.id, memo)
    setSaving(false)
    setView('search')
    setSelectedBuilding(null)
    setMemo('')
  }

  const handleSavePendingMemo = async () => {
    if (!selectedRequest || !onUpdateRequestMemo) return
    setSaving(true)
    await onUpdateRequestMemo(selectedRequest.id, memo)
    setSaving(false)
    setView('search')
    setSelectedRequest(null)
    setMemo('')
  }

  const handleSubmitRequest = async () => {
    if (!reqName.trim() || !reqAddress.trim()) return
    setSaving(true)
    await onSubmitRequest(reqName, reqAddress, '')
    setSaving(false)
    setReqName(''); setReqAddress('')
    setView('search')
  }

  const handleOpenAddRequest = () => {
    setReqName(search.trim())
    setReqAddress('')
    setView('add-request')
  }

  const handleBack = () => {
    setView('search')
    setSelectedBuilding(null)
    setSelectedRequest(null)
    setMemo('')
  }

  // ── 렌더: 검색 ───────────────────────────────────────────
  if (view === 'search') {
    return (
      <div className="mobile-sheet-backdrop" onClick={onClose}>
        <section className="mobile-sheet restaurant-service-sheet" onClick={(e) => e.stopPropagation()}>
          {/* 헤더 */}
          <div className="mobile-sheet-handle" />
          <div className="restaurant-sheet-head">
            <span className="restaurant-sheet-icon"><ForkIcon /></span>
            <h2>식당봉사</h2>
            <button className="restaurant-sheet-close" type="button" aria-label="닫기" onClick={onClose}>×</button>
          </div>

          {/* 검색 */}
          <div className="restaurant-search-wrap">
            <SearchIcon />
            <input
              className="restaurant-search-input"
              placeholder="식당 이름 또는 주소 검색"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
            {search && (
              <button type="button" className="restaurant-search-clear" onClick={() => setSearch('')}>×</button>
            )}
          </div>

          {/* 결과 목록 */}
          <div className="restaurant-list-body">
            {/* 내가 신청 대기 중인 항목 (검색 없을 때만 표시) */}
            {!search.trim() && myPendingRequests.length > 0 && (
              <div className="restaurant-pending-section">
                <p className="restaurant-pending-label">
                  <ClockIcon /> 승인 대기 중
                </p>
                {myPendingRequests.map((req) => (
                  <button
                    key={req.id}
                    type="button"
                    className="restaurant-item restaurant-item--pending"
                    onClick={() => handleSelectPendingRequest(req)}
                  >
                    <div className="restaurant-item-info">
                      <strong className="restaurant-item-name">{req.name}</strong>
                      <span className="restaurant-item-address">{req.address}</span>
                      {req.memo && (
                        <span className="restaurant-item-last">메모: {req.memo}</span>
                      )}
                    </div>
                    <span className="restaurant-item-pending-badge">대기중</span>
                    <ChevronRight />
                  </button>
                ))}
              </div>
            )}

            {grouped.length === 0 ? (
              <div className="restaurant-empty">
                {search.trim() ? (
                  <>
                    <p>"{search}" 검색 결과가 없습니다</p>
                    <button type="button" className="restaurant-add-request-btn" onClick={handleOpenAddRequest}>
                      + 이 식당 추가 신청
                    </button>
                  </>
                ) : myPendingRequests.length === 0 ? (
                  <p>등록된 식당이 없습니다</p>
                ) : null}
              </div>
            ) : (
              <>
                {grouped.map(([district, items]) => (
                  <div key={district} className="restaurant-group">
                    <button
                      type="button"
                      className="restaurant-group-head"
                      onClick={() => toggleDistrict(district)}
                    >
                      <span className="restaurant-group-label">{district}</span>
                      <span className="restaurant-group-count">{items.length}</span>
                      <ChevronDown open={openDistricts.has(district)} />
                    </button>
                    {openDistricts.has(district) && (
                      <ul className="restaurant-group-list">
                        {items.map((b) => {
                          const unitIds = new Set(b.units.map((u) => u.id))
                          const lastHistory = visitHistories
                            .filter((h) => unitIds.has(h.unitId))
                            .sort((a, c) => c.visitedAt.localeCompare(a.visitedAt))[0]
                          return (
                            <li key={b.id}>
                              <button
                                type="button"
                                className="restaurant-item"
                                onClick={() => handleSelectBuilding(b)}
                              >
                                <div className="restaurant-item-info">
                                  <strong className="restaurant-item-name">{b.name}</strong>
                                  <span className="restaurant-item-address">{b.address}</span>
                                  {lastHistory && (
                                    <span className="restaurant-item-last">
                                      마지막: {fmtVisitDate(lastHistory.visitedAt)}
                                      {lastHistory.visitor ? ` · ${lastHistory.visitor}` : ''}
                                    </span>
                                  )}
                                </div>
                                <ChevronRight />
                              </button>
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </div>
                ))}
                {search.trim() && (
                  <div className="restaurant-add-row">
                    <button type="button" className="restaurant-add-request-btn" onClick={handleOpenAddRequest}>
                      + "{search}" 식당 추가 신청
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </section>
      </div>
    )
  }

  // ── 렌더: 기록 모드 (승인된 식당) ─────────────────────────
  if (view === 'record' && selectedBuilding) {
    return (
      <div className="mobile-sheet-backdrop" onClick={handleBack}>
        <section className="mobile-sheet restaurant-service-sheet" onClick={(e) => e.stopPropagation()}>
          <div className="mobile-sheet-handle" />
          <div className="restaurant-sheet-head">
            <button type="button" className="restaurant-back-btn" onClick={handleBack} aria-label="뒤로">
              <BackIcon />
            </button>
            <h2>{selectedBuilding.name}</h2>
            <button className="restaurant-sheet-close" type="button" aria-label="닫기" onClick={onClose}>×</button>
          </div>

          <div className="restaurant-record-body">
            {/* 식당 정보 */}
            <div className="restaurant-record-info">
              <span className="restaurant-record-address">{selectedBuilding.address}</span>
            </div>

            {/* 이전 기록 */}
            {buildingHistories.length > 0 && (
              <div className="restaurant-history-section">
                <p className="restaurant-history-label">이전 기록</p>
                <ul className="restaurant-history-list">
                  {buildingHistories.map((h) => (
                    <li key={h.id} className="restaurant-history-item">
                      <span className="restaurant-history-date">{fmtVisitDate(h.visitedAt)}</span>
                      {h.visitor && <span className="restaurant-history-visitor">{h.visitor}</span>}
                      {h.visitType === 'restaurant' && (
                        <span className="restaurant-history-badge">식당봉사</span>
                      )}
                      {h.memo && <span className="restaurant-history-memo">"{h.memo}"</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* 메모 입력 */}
            <div className="restaurant-memo-section">
              <label className="restaurant-memo-label">메모</label>
              <textarea
                className="restaurant-memo-input"
                placeholder={`${currentVisitor}님의 식당봉사 메모를 남겨주세요`}
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                rows={3}
              />
            </div>

            <button
              type="button"
              className="restaurant-save-btn"
              onClick={handleSaveVisit}
              disabled={saving}
            >
              {saving ? '저장 중...' : '기록 남기기'}
            </button>
          </div>
        </section>
      </div>
    )
  }

  // ── 렌더: 대기 중 신청 메모 ───────────────────────────────
  if (view === 'record-pending' && selectedRequest) {
    return (
      <div className="mobile-sheet-backdrop" onClick={handleBack}>
        <section className="mobile-sheet restaurant-service-sheet" onClick={(e) => e.stopPropagation()}>
          <div className="mobile-sheet-handle" />
          <div className="restaurant-sheet-head">
            <button type="button" className="restaurant-back-btn" onClick={handleBack} aria-label="뒤로">
              <BackIcon />
            </button>
            <h2>{selectedRequest.name}</h2>
            <button className="restaurant-sheet-close" type="button" aria-label="닫기" onClick={onClose}>×</button>
          </div>

          <div className="restaurant-record-body">
            <div className="restaurant-record-info">
              <span className="restaurant-record-address">{selectedRequest.address}</span>
              <span className="restaurant-pending-status-badge">
                <ClockIcon /> 승인 대기 중
              </span>
            </div>

            {/* 메모 입력 */}
            <div className="restaurant-memo-section">
              <label className="restaurant-memo-label">메모</label>
              <textarea
                className="restaurant-memo-input"
                placeholder="방문 내용을 간단히 남겨주세요"
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                rows={3}
              />
            </div>

            <button
              type="button"
              className="restaurant-save-btn"
              onClick={handleSavePendingMemo}
              disabled={saving || !onUpdateRequestMemo}
            >
              {saving ? '저장 중...' : '메모 저장'}
            </button>
          </div>
        </section>
      </div>
    )
  }

  // ── 렌더: 추가 신청 ────────────────────────────────────────
  return (
    <div className="mobile-sheet-backdrop" onClick={handleBack}>
      <section className="mobile-sheet restaurant-service-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="mobile-sheet-handle" />
        <div className="restaurant-sheet-head">
          <button type="button" className="restaurant-back-btn" onClick={handleBack} aria-label="뒤로">
            <BackIcon />
          </button>
          <h2>식당 추가 신청</h2>
          <button className="restaurant-sheet-close" type="button" aria-label="닫기" onClick={onClose}>×</button>
        </div>

        <div className="restaurant-record-body">
          <p className="restaurant-request-desc">
            관리자 승인 후 목록에 추가됩니다.
          </p>

          <div className="mobile-form-field">
            <label>식당 이름 <span aria-hidden>*</span></label>
            <input
              type="text"
              placeholder="예: 명장인력직업식당"
              value={reqName}
              onChange={(e) => setReqName(e.target.value)}
            />
          </div>
          <div className="mobile-form-field">
            <label>주소 <span aria-hidden>*</span></label>
            <input
              type="text"
              placeholder="예: 청명남로 16"
              value={reqAddress}
              onChange={(e) => setReqAddress(e.target.value)}
            />
          </div>

          <button
            type="button"
            className="restaurant-save-btn"
            onClick={handleSubmitRequest}
            disabled={saving || !reqName.trim() || !reqAddress.trim()}
          >
            {saving ? '신청 중...' : '추가 신청'}
          </button>
        </div>
      </section>
    </div>
  )
}
