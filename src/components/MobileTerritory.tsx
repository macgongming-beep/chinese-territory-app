import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Building, CalendarEvent, ReturnVisit, ReturnVisitLog, Role, ServiceSession, TerritoryCard, TimeSlot, Unit } from '../types'
import { normalizeCardSearch, sortTerritoryCards } from '../utils/cardSearch'

function assignmentCardIds(assignment?: CalendarEvent['cardAssignments'][number]) {
  if (!assignment) return []
  return assignment.assignedCardIds && assignment.assignedCardIds.length > 0
    ? assignment.assignedCardIds
    : [assignment.assignedCardId]
}

function getTimeSlotFromTime(time: string): TimeSlot {
  const [hourText, minuteText] = time.split(':')
  const hour = Number(hourText)
  const minute = Number(minuteText || '0')
  const value = hour + minute / 60
  if (value < 12) return '오전'
  if (value < 16.5) return '오후'
  return '저녁'
}

function getCurrentTimeSlot(): TimeSlot {
  const hour = new Date().getHours()
  if (hour < 12) return '오전'
  if (hour < 17) return '오후'
  return '저녁'
}

function fmtDate(dateStr: string): string {
  const today = new Date(); today.setHours(0,0,0,0)
  const d = new Date(dateStr.slice(0, 10)); d.setHours(0,0,0,0)
  const diff = Math.round((today.getTime() - d.getTime()) / 86400000)
  if (diff === 0) return '오늘'
  if (diff === 1) return '어제'
  if (diff < 30) return `${diff}일 전`
  return `${d.getMonth()+1}/${d.getDate()}`
}

export function MobileTerritory({
  buildings,
  cards,
  calendarEvents = [],
  currentVisitor,
  role,
  serviceSessions,
  returnVisits = [],
  returnVisitLogs = [],
  onOpenMap,
  onStartServiceSession,
  onEndServiceSession,
  onCreateManualReturnVisit,
  onAddReturnVisitLog,
  onUpdateReturnVisitLog,
  onDeleteReturnVisitLog,
  onDeleteReturnVisit,
  onUpdateReturnVisitNickname,
  onUpdateReturnVisitAddress,
}: {
  buildings: Building[]
  cards: TerritoryCard[]
  calendarEvents?: CalendarEvent[]
  currentVisitor: string
  role: Role
  serviceSessions: ServiceSession[]
  returnVisits?: ReturnVisit[]
  returnVisitLogs?: ReturnVisitLog[]
  onOpenMap: (cardId: number) => void
  onStartServiceSession: (input: {
    role: Role
    timeSlot: TimeSlot
    primaryCardId?: number | null
    calendarEventId?: number | null
    assignedCardId?: number | null
    assignmentId?: number | null
    source?: ServiceSession['source']
    memo?: string
  }) => Promise<number | null>
  onEndServiceSession: (sessionId: number) => void
  onCreateManualReturnVisit?: (input: { displayName: string; address: string; memo: string; unitId?: number | null; buildingId?: number | null }) => Promise<void>
  onAddReturnVisitLog?: (returnVisitId: number, result: '만남' | '부재' | null, memo: string) => Promise<void>
  onUpdateReturnVisitLog?: (id: number, result: '만남' | '부재' | null, memo: string) => Promise<void>
  onDeleteReturnVisitLog?: (id: number) => Promise<void>
  onDeleteReturnVisit?: (id: number) => Promise<void>
  onUpdateReturnVisitNickname?: (id: number, nickname: string) => Promise<void>
  onUpdateReturnVisitAddress?: (id: number, address: string) => Promise<void>
}) {
  const navigate = useNavigate()
  const [filter, setFilter] = useState<'전체' | '미배정' | '내 카드'>('전체')
  const [showRegularDetail, setShowRegularDetail] = useState(false)
  const [showNewService, setShowNewService] = useState(false)
  // 정기방문 카드 메뉴 & 기록 시트
  const [menuOpenId, setMenuOpenId] = useState<number | null>(null)
  const [nicknameEditId, setNicknameEditId] = useState<number | null>(null)
  const [nicknameEditValue, setNicknameEditValue] = useState('')
  const [nicknameSaving, setNicknameSaving] = useState(false)
  const [addressEditId, setAddressEditId] = useState<number | null>(null)
  const [addressEditValue, setAddressEditValue] = useState('')
  const [addressSaving, setAddressSaving] = useState(false)
  const [logTarget, setLogTarget] = useState<ReturnVisit | null>(null)
  const [logResult, setLogResult] = useState<'만남' | '부재' | null>(null)
  const [logMemo, setLogMemo] = useState('')
  const [logSaving, setLogSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  // 꾹 누르기 → 기록 액션 팝업
  // 수동 추가 시트
  const [showAddSheet, setShowAddSheet] = useState(false)
  const [addNickname, setAddNickname] = useState('')
  const [addAddress, setAddAddress] = useState('')
  const [addMemo, setAddMemo] = useState('')
  const [addSaving, setAddSaving] = useState(false)
  const [addLinked, setAddLinked] = useState<{ building: Building; unit: Unit } | null>(null)
  const [addUnitPickBuilding, setAddUnitPickBuilding] = useState<Building | null>(null)
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const geocodeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [confirmDialog, setConfirmDialog] = useState<{ message: string; onConfirm: () => void } | null>(null)
  const [addAddressGeocoding, setAddAddressGeocoding] = useState(false)
  const [addrEditGeocoding, setAddrEditGeocoding] = useState(false)
  const [logActionId, setLogActionId] = useState<number | null>(null) // 팝업 대상 로그 id
  const [logEditMode, setLogEditMode] = useState(false)               // 팝업이 수정 모드인지
  const [logEditResult, setLogEditResult] = useState<'만남' | '부재' | null>(null)
  const [logEditMemo, setLogEditMemo] = useState('')
  const [logEditSaving, setLogEditSaving] = useState(false)
  const [newServiceCardId, setNewServiceCardId] = useState<number | ''>('')
  const [newServiceSearch, setNewServiceSearch] = useState('')
  const [newServiceSlot, setNewServiceSlot] = useState<TimeSlot>(getCurrentTimeSlot)

  const today = useMemo(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }, [])

  // 오늘 배정 공유된 내 카드 (event_card_assignments)
  const myTodayAssignments = useMemo(() => {
    const todayEvents = calendarEvents.filter((e) => e.date === today)
    const result: Array<{ event: CalendarEvent; cards: TerritoryCard[]; teammates: string[] }> = []
    for (const event of todayEvents) {
      const assignment = event.cardAssignments.find((a) => a.userName === currentVisitor)
      const isParticipant =
        !!assignment ||
        event.applicants.includes(currentVisitor) ||
        event.assigned.includes(currentVisitor) ||
        event.leader === currentVisitor
      if (!isParticipant) continue
      const cardIds = assignmentCardIds(assignment)
      const assignedCards = cardIds
        .map((id) => cards.find((c) => c.id === id))
        .filter(Boolean) as TerritoryCard[]
      const cardIdSet = new Set(assignedCards.map((card) => card.id))
      const teammates = event.cardAssignments
        .filter((item) =>
          item.userName !== currentVisitor &&
          (cardIdSet.size === 0 || assignmentCardIds(item).some((id) => cardIdSet.has(id)))
        )
        .map((item) => item.userName)
      result.push({ event, cards: assignedCards, teammates })
    }
    return result
  }, [calendarEvents, today, currentVisitor, cards])

  const [expandedEventIds, setExpandedEventIds] = useState<Set<number>>(() => {
    const currentSlot = getCurrentTimeSlot()
    const currentEvent = myTodayAssignments.find(({ event }) => getTimeSlotFromTime(event.time) === currentSlot)
    return currentEvent ? new Set([currentEvent.event.id]) : new Set()
  })

  const myTodaySessions = useMemo(
    () =>
      serviceSessions
        .filter((s) => s.userName === currentVisitor && s.serviceDate === today)
        .sort((a, b) => b.startedAt.localeCompare(a.startedAt)),
    [serviceSessions, currentVisitor, today]
  )

  const activeSession = myTodaySessions.find((s) => s.status === 'active' && !s.endedAt)

  const activeSessionCardIds = useMemo(
    () =>
      new Set(
        myTodaySessions
          .filter((s) => s.status === 'active' && !s.endedAt && s.primaryCardId)
          .map((s) => s.primaryCardId as number)
      ),
    [myTodaySessions]
  )

  const myCards = useMemo(() => {
    const assigned = (() => {
      if (role === 'user') return cards.filter((c) => c.assignedUsers.includes(currentVisitor))
      if (role === 'leader') return cards.filter((c) => c.assignedLeader === currentVisitor)
      return cards.filter((c) => c.assignedLeader === currentVisitor || c.assignedUsers.includes(currentVisitor))
    })()
    const assignedIds = new Set(assigned.map((c) => c.id))
    const fromSession = cards.filter((c) => activeSessionCardIds.has(c.id) && !assignedIds.has(c.id))
    return [...assigned, ...fromSession]
  }, [cards, role, currentVisitor, activeSessionCardIds])

  const visibleCards = useMemo(() => {
    if (role === 'admin') {
      if (filter === '미배정') return cards.filter((c) => !c.assignedLeader)
      if (filter === '내 카드') return myCards
      return cards
    }
    return myCards
  }, [cards, role, filter, myCards])

  const myRegularVisits = useMemo(
    () =>
      buildings.flatMap((building) => {
        const card = cards.find((item) => item.id === building.cardId)
        return building.units
          .filter((unit) => unit.isRegularVisit && unit.regularVisitor === currentVisitor)
          .map((unit) => ({ building, card, unit }))
      }),
    [buildings, cards, currentVisitor]
  )

  // return_visits 기반 정기방문 목록 (내가 담당 or 내가 생성)
  const myReturnVisits = useMemo(() =>
    returnVisits.filter(
      (rv) => rv.assignedUserName === currentVisitor || rv.createdBy === currentVisitor
    ),
    [returnVisits, currentVisitor]
  )

  // 네이버 지도 Geocoding으로 짧은 주소 → 전체 주소 자동완성
  const geocodeAndFill = (query: string, setter: (v: string) => void, setLoading: (v: boolean) => void) => {
    const naver = (window as any).naver
    if (!naver?.maps?.Service) return // 지도 SDK 미로드 시 skip
    setLoading(true)
    naver.maps.Service.geocode({ query }, (status: any, response: any) => {
      setLoading(false)
      if (status === naver.maps.Service.Status.ERROR) return
      const item = response?.v2?.addresses?.[0]
      if (!item) return
      const full = item.roadAddress || item.jibunAddress
      if (full) setter(full)
    })
  }

  // 주소 입력 시 구역 카드 건물 매칭
  const addressMatches = useMemo(() => {
    if (addAddress.length < 2 || addLinked) return []
    const q = addAddress.toLowerCase()
    return buildings
      .filter((b) => b.address.toLowerCase().includes(q) || b.name.toLowerCase().includes(q))
      .slice(0, 3)
  }, [addAddress, buildings, addLinked])

  const activeCard = cards.find((card) => card.id === activeSession?.primaryCardId)
  const fallbackCard = myCards[0]
  const _quickMapCardId = activeCard?.id ?? fallbackCard?.id
  void _quickMapCardId
  const newServiceCard = newServiceCardId ? cards.find((card) => card.id === newServiceCardId) : undefined
  const newServiceOptions = useMemo(() => {
    const query = normalizeCardSearch(newServiceSearch)
    if (!query) return []
    return sortTerritoryCards(cards.filter((card) =>
      normalizeCardSearch(`${card.name}${card.region}${card.area}`).includes(query)
    ))
  }, [cards, newServiceSearch])

  const toggleTodayEvent = (eventId: number) => {
    setExpandedEventIds((prev) => {
      const next = new Set(prev)
      if (next.has(eventId)) next.delete(eventId)
      else next.add(eventId)
      return next
    })
  }

  const startNewService = async () => {
    if (!newServiceCardId) return
    const id = await onStartServiceSession({
      role,
      timeSlot: newServiceSlot,
      primaryCardId: newServiceCardId,
      calendarEventId: null,
      assignedCardId: null,
      assignmentId: null,
      source: 'manual',
    })
    if (id) {
      setShowNewService(false)
      onOpenMap(newServiceCardId)
    }
  }

  if (showRegularDetail) {
    return (
      <div className="mobile-territory-page">
        <div className="mobile-territory-head compact">
          <button className="mobile-territory-back" onClick={() => setShowRegularDetail(false)} type="button">‹</button>
          <div>
            <p>나의 봉사</p>
            <h2>정기 방문 관리</h2>
          </div>
        </div>
        <section className="mobile-regular-section detail" aria-label="정기 방문 상세 관리">
          <div className="mobile-section-title">
            <h2>정기 방문 ({myRegularVisits.length}건)</h2>
          </div>
          {myRegularVisits.length === 0 ? (
            <div className="mobile-territory-empty">등록된 정기 방문이 없습니다.</div>
          ) : (
            <div className="mobile-regular-list">
              {myRegularVisits.map(({ building, card, unit }) => (
                <button
                  className="mobile-regular-row"
                  key={`${building.id}-${unit.id}`}
                  onClick={() => onOpenMap(building.cardId)}
                  type="button"
                >
                  <div>
                    <strong>{building.name} {unit.number}</strong>
                    <span>{card?.name ?? '카드 미지정'} · {building.type}</span>
                    {unit.memo && <small>{unit.memo}</small>}
                  </div>
                  <b>열기</b>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
    )
  }

  return (
    <div className="mobile-territory-page">
      <div className="mobile-territory-head">
        <div>
          <h2>{role === 'admin' ? '구역 관리' : '나의 봉사'}</h2>
        </div>
      </div>

      {role !== 'admin' && (
        <>
          <section className="mobile-territory-section mobile-today-service-section">
            <div className="mobile-section-title mobile-territory-list-title mobile-execution-title">
              <h2>오늘의 봉사</h2>
            </div>
            {myTodayAssignments.length === 0 ? (
              <div className="mobile-territory-empty">오늘 참여하는 봉사 일정이 없습니다.</div>
            ) : (
              <div className="mobile-today-service-list">
                {myTodayAssignments.map(({ event, cards: assignedCards, teammates }) => {
                  const isOpen = expandedEventIds.has(event.id)
                  return (
                    <article className={`mobile-today-service-card${isOpen ? ' open' : ''}`} key={event.id}>
                      <button className="mobile-today-service-toggle" onClick={() => toggleTodayEvent(event.id)} type="button">
                        <span aria-hidden="true">{isOpen ? '⌄' : '›'}</span>
                        <strong>{event.time} {event.title}</strong>
                        <b>{assignedCards.length}개</b>
                      </button>
                      {isOpen && (
                        <div className="mobile-today-service-body">
                          <p>
                            {event.leader ? `인도자 ${event.leader}` : '인도자 미정'}
                            {teammates.length > 0 ? ` · 팀원 ${teammates.join(', ')}` : ''}
                          </p>
                          {assignedCards.length === 0 ? (
                            <div className="mobile-territory-empty compact">배정된 카드가 없습니다.</div>
                          ) : assignedCards.map((card) => (
                            <div className="mobile-today-card-row" key={card.id}>
                              <span>📍</span>
                              <strong>{card.name}</strong>
                              <em>{card.progress}%</em>
                              <button onClick={() => onOpenMap(card.id)} type="button">지도</button>
                            </div>
                          ))}
                        </div>
                      )}
                    </article>
                  )
                })}
              </div>
            )}
          </section>

          <section className="mobile-territory-section">
            <button className="mobile-new-service-card" onClick={() => setShowNewService((open) => !open)} type="button">
              <span aria-hidden="true">+</span>
              <div>
                <strong>새 봉사</strong>
                <small>배정 외 카드로 봉사 시작</small>
              </div>
              <b aria-hidden="true">›</b>
            </button>
            {showNewService && (
              <div className="mobile-service-launcher compact">
                <div className="mobile-card-search">
                  <input
                    placeholder="카드 검색: 고림동, 고림동 1"
                    value={newServiceSearch}
                    onChange={(event) => {
                      setNewServiceSearch(event.target.value)
                      setNewServiceCardId('')
                    }}
                  />
                  {newServiceCard && <span>{newServiceCard.name}</span>}
                  {newServiceSearch && !newServiceCard && (
                    <div className="mobile-card-search-results">
                      {newServiceOptions.length === 0 && <span>검색 결과 없음</span>}
                      {newServiceOptions.map((card) => (
                        <button
                          key={card.id}
                          onClick={() => {
                            setNewServiceCardId(card.id)
                            setNewServiceSearch(card.name)
                          }}
                          type="button"
                        >
                          {card.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="mobile-session-slot" role="group" aria-label="봉사 시간대">
                  {(['오전', '오후', '저녁'] as TimeSlot[]).map((slot) => (
                    <button className={newServiceSlot === slot ? 'active' : ''} key={slot} onClick={() => setNewServiceSlot(slot)} type="button">
                      {slot}
                    </button>
                  ))}
                </div>
                <div className="mobile-service-actions">
                  {activeSession && <button onClick={() => onEndServiceSession(activeSession.id)} type="button">현재 종료</button>}
                  <button disabled={!newServiceCardId} onClick={startNewService} type="button">시작</button>
                </div>
              </div>
            )}
          </section>

          <section className="mobile-territory-section mobile-regular-section" aria-label="정기 방문">
            <div className="mobile-section-title">
              <h2>정기 방문 <span className="rv-count">{myReturnVisits.length}건</span></h2>
              <button className="rv-add-btn" onClick={() => { setShowAddSheet(true); setAddNickname(''); setAddAddress(''); setAddMemo(''); setAddLinked(null); setAddUnitPickBuilding(null) }} type="button">+ 추가</button>
            </div>

            {myReturnVisits.length === 0 ? (
              <div className="mobile-regular-empty-card">
                <strong>등록된 정기 방문이 없습니다.</strong>
                <span>지도에서 세대 정기방문을 체크하면 여기에 나타납니다.</span>
              </div>
            ) : (
              <div className="rv-list">
                {myReturnVisits.map((rv) => {
                  const building = buildings.find((b) => b.id === rv.buildingId)
                  const label = rv.nickname || rv.displayName
                  const isMenuOpen = menuOpenId === rv.id
                  const isNicknameEdit = nicknameEditId === rv.id
                  const isAddressEdit = addressEditId === rv.id
                  return (
                    <div key={rv.id} className="rv-card" onClick={() => { if (isMenuOpen) setMenuOpenId(null) }}>
                      {/* 상단: 이름 · 상태 · ⋮ */}
                      <div className="rv-card-header">
                        <div className="rv-card-title">
                          <strong className="rv-name">{label}</strong>
                          {rv.lastResult && (
                            <span className={`rv-status-dot rv-status-${rv.lastResult}`} />
                          )}
                          {rv.lastVisitedAt && (
                            <span className="rv-last-visit">{fmtDate(rv.lastVisitedAt)}</span>
                          )}
                        </div>
                        <div className="rv-menu-wrap">
                          <button
                            className="rv-menu-btn"
                            onClick={(e) => { e.stopPropagation(); setMenuOpenId(isMenuOpen ? null : rv.id) }}
                            type="button"
                            aria-label="더보기"
                          >⋮</button>
                          {isMenuOpen && (
                            <div className="rv-menu-dropdown" onClick={(e) => e.stopPropagation()}>
                              <button
                                className="rv-menu-item"
                                onClick={() => {
                                  setNicknameEditId(rv.id)
                                  setNicknameEditValue(rv.nickname || rv.displayName)
                                  setMenuOpenId(null)
                                }}
                                type="button"
                              >별칭 수정</button>
                              <button
                                className="rv-menu-item"
                                onClick={() => {
                                  setAddressEditId(rv.id)
                                  setAddressEditValue(rv.address)
                                  setMenuOpenId(null)
                                }}
                                type="button"
                              >주소 수정</button>
                              <button
                                className="rv-menu-item rv-menu-danger"
                                disabled={deletingId === rv.id}
                                onClick={() => {
                                  if (!onDeleteReturnVisit) return
                                  setMenuOpenId(null)
                                  setConfirmDialog({
                                    message: '정기방문을 삭제할까요?',
                                    onConfirm: async () => {
                                      setDeletingId(rv.id)
                                      await onDeleteReturnVisit(rv.id)
                                      setDeletingId(null)
                                    },
                                  })
                                }}
                                type="button"
                              >삭제</button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* 주소 */}
                      <span className="rv-address">{rv.address}</span>

                      {/* 별칭 인라인 편집 */}
                      {isNicknameEdit && (
                        <div className="rv-nickname-edit-row" onClick={(e) => e.stopPropagation()}>
                          <input
                            className="rv-nickname-input"
                            value={nicknameEditValue}
                            onChange={(e) => setNicknameEditValue(e.target.value)}
                            placeholder={rv.displayName}
                            autoFocus
                          />
                          <button
                            className="rv-nickname-save-btn"
                            disabled={nicknameSaving}
                            onClick={async () => {
                              if (!onUpdateReturnVisitNickname) return
                              setNicknameSaving(true)
                              await onUpdateReturnVisitNickname(rv.id, nicknameEditValue)
                              setNicknameSaving(false)
                              setNicknameEditId(null)
                            }}
                            type="button"
                          >{nicknameSaving ? '…' : '저장'}</button>
                          <button
                            className="rv-nickname-cancel-btn"
                            onClick={() => setNicknameEditId(null)}
                            type="button"
                          >취소</button>
                        </div>
                      )}

                      {/* 주소 인라인 편집 */}
                      {isAddressEdit && (
                        <div className="rv-nickname-edit-row" onClick={(e) => e.stopPropagation()}>
                          <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
                            <input
                              className="rv-nickname-input"
                              value={addressEditValue}
                              onChange={(e) => {
                                const val = e.target.value
                                setAddressEditValue(val)
                                if (geocodeTimerRef.current) clearTimeout(geocodeTimerRef.current)
                                if (val.trim().length >= 4) {
                                  geocodeTimerRef.current = setTimeout(() => {
                                    geocodeAndFill(val.trim(), setAddressEditValue, setAddrEditGeocoding)
                                  }, 800)
                                }
                              }}
                              placeholder="예: 언동로 213"
                              style={{ paddingRight: addrEditGeocoding ? 28 : undefined, width: '100%', boxSizing: 'border-box' }}
                              autoFocus
                            />
                            {addrEditGeocoding && (
                              <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: '#94a3b8' }}>검색 중…</span>
                            )}
                          </div>
                          <button
                            className="rv-nickname-save-btn"
                            disabled={addressSaving}
                            onClick={async () => {
                              if (!onUpdateReturnVisitAddress) return
                              setAddressSaving(true)
                              await onUpdateReturnVisitAddress(rv.id, addressEditValue)
                              setAddressSaving(false)
                              setAddressEditId(null)
                            }}
                            type="button"
                          >{addressSaving ? '…' : '저장'}</button>
                          <button
                            className="rv-nickname-cancel-btn"
                            onClick={() => setAddressEditId(null)}
                            type="button"
                          >취소</button>
                        </div>
                      )}

                      {/* 구분선 */}
                      <div className="rv-divider" />

                      {/* 하단 액션 버튼 */}
                      <div className="rv-card-actions">
                        <button
                          className="rv-btn rv-btn-log"
                          onClick={() => { setLogTarget(rv); setLogResult(null); setLogMemo('') }}
                          type="button"
                        >기록</button>
                        {building ? (
                          <button
                            className="rv-btn rv-btn-map"
                            onClick={() => onOpenMap(building.cardId)}
                            type="button"
                          >지도</button>
                        ) : rv.address ? (
                          <button
                            className="rv-btn rv-btn-map"
                            onClick={() => navigate(`/map?addr=${encodeURIComponent(rv.address)}&pinLabel=${encodeURIComponent(rv.nickname || rv.displayName)}`)}
                            type="button"
                          >지도</button>
                        ) : null}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>

        {/* ── 수동 추가 시트 ── */}
        {showAddSheet && (
          <div className="rv-log-backdrop" onClick={() => setShowAddSheet(false)}>
            <div className="rv-log-sheet" onClick={(e) => e.stopPropagation()}>
              <div className="rv-log-header">
                <strong>정기 방문 추가</strong>
              </div>

              {/* 별칭 */}
              <div className="rv-add-field">
                <label className="rv-add-label">별칭 <span className="rv-add-required">필수</span></label>
                <input
                  className="rv-add-input"
                  placeholder="예: 고림동 할머니"
                  value={addNickname}
                  onChange={(e) => setAddNickname(e.target.value)}
                  autoFocus
                />
              </div>

              {/* 주소 */}
              <div className="rv-add-field">
                <label className="rv-add-label">주소 <span className="rv-add-optional">선택</span></label>
                {addLinked ? (
                  <div className="rv-add-linked">
                    <span className="rv-add-linked-text">
                      <b>{addLinked.building.name} {addLinked.unit.number}호</b>
                      <em>{addLinked.building.address}</em>
                    </span>
                    <button className="rv-add-unlink" type="button" onClick={() => { setAddLinked(null); setAddAddress('') }}>해제</button>
                  </div>
                ) : (
                  <>
                    <div style={{ position: 'relative' }}>
                      <input
                        className="rv-add-input"
                        placeholder="예: 언동로 213"
                        value={addAddress}
                        onChange={(e) => {
                          const val = e.target.value
                          setAddAddress(val)
                          setAddUnitPickBuilding(null)
                          // debounce geocoding (4자 이상)
                          if (geocodeTimerRef.current) clearTimeout(geocodeTimerRef.current)
                          if (val.trim().length >= 4) {
                            geocodeTimerRef.current = setTimeout(() => {
                              geocodeAndFill(val.trim(), setAddAddress, setAddAddressGeocoding)
                            }, 800)
                          }
                        }}
                        style={{ paddingRight: addAddressGeocoding ? 28 : undefined }}
                      />
                      {addAddressGeocoding && (
                        <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: '#94a3b8' }}>검색 중…</span>
                      )}
                    </div>
                    {/* 주소 매칭 결과 */}
                    {addressMatches.length > 0 && (
                      <div className="rv-add-matches">
                        <p className="rv-add-matches-title">구역 카드에서 일치하는 건물</p>
                        {addressMatches.map((b) => (
                          <div key={b.id} className="rv-add-match-item">
                            <div className="rv-add-match-info">
                              <strong>{b.name}</strong>
                              <span>{b.address}</span>
                            </div>
                            <button
                              className="rv-add-connect-btn"
                              type="button"
                              onClick={() => {
                                if (b.units.length === 1) {
                                  setAddLinked({ building: b, unit: b.units[0] })
                                  setAddUnitPickBuilding(null)
                                } else {
                                  setAddUnitPickBuilding(addUnitPickBuilding?.id === b.id ? null : b)
                                }
                              }}
                            >연결</button>
                          </div>
                        ))}
                        {/* 세대 선택 */}
                        {addUnitPickBuilding && (
                          <div className="rv-add-unit-picker">
                            <p className="rv-add-matches-title">세대 선택</p>
                            {addUnitPickBuilding.units.map((u) => (
                              <button
                                key={u.id}
                                className="rv-add-unit-btn"
                                type="button"
                                onClick={() => { setAddLinked({ building: addUnitPickBuilding, unit: u }); setAddUnitPickBuilding(null) }}
                              >{u.number}호</button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* 메모 */}
              <div className="rv-add-field">
                <label className="rv-add-label">메모 <span className="rv-add-optional">선택</span></label>
                <input
                  className="rv-add-input"
                  placeholder="예: 매주 화요일 방문"
                  value={addMemo}
                  onChange={(e) => setAddMemo(e.target.value)}
                />
              </div>

              <div className="rv-log-actions">
                <button className="rv-log-cancel" type="button" onClick={() => setShowAddSheet(false)}>취소</button>
                <button
                  className="rv-log-save"
                  disabled={!addNickname.trim() || addSaving}
                  type="button"
                  onClick={async () => {
                    if (!addNickname.trim() || !onCreateManualReturnVisit) return
                    setAddSaving(true)
                    await onCreateManualReturnVisit({
                      displayName: addNickname.trim(),
                      address: addLinked ? addLinked.building.address : addAddress,
                      memo: addMemo,
                      unitId: addLinked?.unit.id ?? null,
                      buildingId: addLinked?.building.id ?? null,
                    })
                    setAddSaving(false)
                    setShowAddSheet(false)
                  }}
                >{addSaving ? '저장 중…' : '저장'}</button>
              </div>
            </div>
          </div>
        )}

        {/* ── 기록 시트 ── */}
        {logTarget && (() => {
          const logs = returnVisitLogs
            .filter((l) => l.returnVisitId === logTarget.id)
            .slice(0, 12)
          const todayLabel = new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })
          return (
            <div className="rv-log-backdrop" onClick={() => setLogTarget(null)}>
              <div className="rv-log-sheet" onClick={(e) => e.stopPropagation()}>
                {/* 헤더 */}
                <div className="rv-log-header">
                  <strong>{logTarget.nickname || logTarget.displayName}</strong>
                  <span className="rv-log-target-addr">{logTarget.address}</span>
                </div>

                {/* 방문 기록 목록 */}
                {logs.length > 0 && (
                  <div className="rv-log-history">
                    {logs.map((l) => {
                      const d = new Date(l.visitedAt)
                      const h = d.getHours()
                      const slot = h < 12 ? '오전' : h < 17 ? '오후' : '저녁'
                      const dateStr = `${d.getMonth() + 1}. ${d.getDate()}.`
                      return (
                        <div
                          key={l.id}
                          className="rv-log-history-item"
                          onTouchStart={() => {
                            longPressTimer.current = setTimeout(() => setLogActionId(l.id), 500)
                          }}
                          onTouchEnd={() => { if (longPressTimer.current) clearTimeout(longPressTimer.current) }}
                          onTouchMove={() => { if (longPressTimer.current) clearTimeout(longPressTimer.current) }}
                          onContextMenu={(e) => { e.preventDefault(); setLogActionId(l.id) }}
                        >
                          <span className="rv-h-date">{dateStr} {slot}</span>
                          {l.result && <b className={l.result === '만남' ? 'rv-h-meet' : 'rv-h-absent'}> · {l.result}</b>}
                          {l.memo && <em className="rv-h-memo"> {l.memo}</em>}
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* 꾹 누르기 액션 팝업 */}
                {logActionId !== null && (() => {
                  const targetLog = returnVisitLogs.find((l) => l.id === logActionId)
                  if (!targetLog) return null
                  return (
                    <div className="rv-action-backdrop" onClick={() => { setLogActionId(null); setLogEditMode(false) }}>
                      <div className="rv-action-sheet" onClick={(e) => e.stopPropagation()}>
                        {!logEditMode ? (
                          <>
                            <p className="rv-action-title">기록 관리</p>
                            <button
                              className="rv-action-btn"
                              type="button"
                              onClick={() => {
                                setLogEditResult(targetLog.result)
                                setLogEditMemo(targetLog.memo)
                                setLogEditMode(true)
                              }}
                            >내용 수정</button>
                            <button
                              className="rv-action-btn rv-action-danger"
                              type="button"
                              onClick={() => {
                                if (!onDeleteReturnVisitLog) return
                                setConfirmDialog({
                                  message: '이 기록을 삭제할까요?',
                                  onConfirm: async () => {
                                    await onDeleteReturnVisitLog(logActionId)
                                    setLogActionId(null)
                                  },
                                })
                              }}
                            >삭제</button>
                            <button
                              className="rv-action-cancel"
                              type="button"
                              onClick={() => setLogActionId(null)}
                            >취소</button>
                          </>
                        ) : (
                          <>
                            <p className="rv-action-title">기록 수정</p>
                            <div className="rv-log-result-chips" style={{ marginBottom: 8 }}>
                              <button
                                className={`rv-chip${logEditResult === '만남' ? ' rv-chip-meet' : ''}`}
                                onClick={() => setLogEditResult(logEditResult === '만남' ? null : '만남')}
                                type="button"
                              >만남</button>
                              <button
                                className={`rv-chip${logEditResult === '부재' ? ' rv-chip-absent' : ''}`}
                                onClick={() => setLogEditResult(logEditResult === '부재' ? null : '부재')}
                                type="button"
                              >부재</button>
                            </div>
                            <textarea
                              className="rv-log-memo"
                              rows={2}
                              value={logEditMemo}
                              onChange={(e) => setLogEditMemo(e.target.value)}
                              placeholder="메모 (선택)"
                            />
                            <div className="rv-log-actions">
                              <button
                                className="rv-log-cancel"
                                type="button"
                                onClick={() => setLogEditMode(false)}
                              >취소</button>
                              <button
                                className="rv-log-save"
                                disabled={logEditSaving || (!logEditResult && !logEditMemo.trim())}
                                type="button"
                                onClick={async () => {
                                  if (!onUpdateReturnVisitLog) return
                                  setLogEditSaving(true)
                                  await onUpdateReturnVisitLog(logActionId, logEditResult, logEditMemo)
                                  setLogEditSaving(false)
                                  setLogActionId(null)
                                  setLogEditMode(false)
                                }}
                              >{logEditSaving ? '저장 중…' : '저장'}</button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  )
                })()}

                {/* 날짜 + 만남/부재 칩 한 줄 */}
                <div className="rv-log-date-row">
                  <span className="rv-log-date">{todayLabel}</span>
                  <div className="rv-log-result-chips">
                    <button
                      className={`rv-chip${logResult === '만남' ? ' rv-chip-meet' : ''}`}
                      onClick={() => setLogResult(logResult === '만남' ? null : '만남')}
                      type="button"
                    >만남</button>
                    <button
                      className={`rv-chip${logResult === '부재' ? ' rv-chip-absent' : ''}`}
                      onClick={() => setLogResult(logResult === '부재' ? null : '부재')}
                      type="button"
                    >부재</button>
                  </div>
                </div>

                {/* 메모 */}
                <textarea
                  className="rv-log-memo"
                  placeholder="메모 (선택)"
                  value={logMemo}
                  onChange={(e) => setLogMemo(e.target.value)}
                  rows={2}
                />

                {/* 액션 */}
                <div className="rv-log-actions">
                  <button
                    className="rv-log-cancel"
                    onClick={() => setLogTarget(null)}
                    type="button"
                  >취소</button>
                  <button
                    className="rv-log-save"
                    disabled={(!logResult && !logMemo.trim()) || logSaving}
                    onClick={async () => {
                      if ((!logResult && !logMemo.trim()) || !onAddReturnVisitLog) return
                      setLogSaving(true)
                      await onAddReturnVisitLog(logTarget.id, logResult, logMemo)
                      setLogSaving(false)
                      setLogResult(null)
                      setLogMemo('')
                    }}
                    type="button"
                  >{logSaving ? '저장 중…' : '저장'}</button>
                </div>
              </div>
            </div>
          )
        })()}
        {/* ── 커스텀 확인 다이얼로그 ── */}
        {confirmDialog && (
          <div
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onClick={() => setConfirmDialog(null)}
          >
            <div
              style={{ background: '#fff', borderRadius: 16, padding: '24px 20px 20px', width: 280, maxWidth: '88vw', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <p style={{ margin: '0 0 20px', fontSize: 15, color: '#1e293b', lineHeight: 1.5, textAlign: 'center' }}>{confirmDialog.message}</p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => setConfirmDialog(null)}
                  style={{ flex: 1, padding: '11px', borderRadius: 10, border: '1px solid #e2e8f0', background: '#f8fafc', fontWeight: 600, fontSize: 14, cursor: 'pointer', color: '#475569' }}
                  type="button"
                >취소</button>
                <button
                  onClick={() => { const fn = confirmDialog.onConfirm; setConfirmDialog(null); fn() }}
                  style={{ flex: 1, padding: '11px', borderRadius: 10, border: 'none', background: '#ef4444', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
                  type="button"
                >삭제</button>
              </div>
            </div>
          </div>
        )}
        </>
      )}

      {role === 'admin' && (
        <>
          <div className="mobile-territory-filter" aria-label="카드 필터">
            {(['전체', '미배정', '내 카드'] as const).map((f) => (
              <button
                className={filter === f ? 'active' : ''}
                key={f}
                onClick={() => setFilter(f)}
                type="button"
              >
                {f}
              </button>
            ))}
          </div>

          {visibleCards.length > 0 && (
            <div className="mobile-section-title mobile-territory-list-title">
              <h2>{filter === '전체' ? '전체 카드 목록' : '내 카드'}</h2>
            </div>
          )}

          {visibleCards.length === 0 && (
            <div className="mobile-territory-empty" style={{ margin: '0 20px' }}>
              카드가 없습니다.
            </div>
          )}

          {visibleCards.map((card) => {
            const isActiveSession = activeSessionCardIds.has(card.id)
            const statusLabel = isActiveSession ? '봉사 중' : card.status
            const statusClass = isActiveSession ? '진행중' : card.status
            return (
              <div className="mobile-territory-card" key={card.id}>
                <div className="mobile-territory-info">
                  <h3 className="mobile-territory-name">{card.name}</h3>
                  <p className="mobile-territory-sub">
                    {card.area} · 세대 {card.units} · 사용자 {card.assignedUsers.length}명
                  </p>
                  <div className="mobile-territory-progress">
                    <div className="mobile-territory-bar">
                      <b style={{ width: `${card.progress}%` }} />
                    </div>
                    <span className="mobile-territory-pct">{card.progress}%</span>
                  </div>
                </div>
                <div className="mobile-territory-side">
                  <span className={`mobile-territory-status status-${statusClass}`}>
                    {statusLabel}
                  </span>
                  <button
                    className="mobile-territory-open-btn"
                    onClick={() => onOpenMap(card.id)}
                    type="button"
                  >
                    열기
                  </button>
                </div>
              </div>
            )
          })}
        </>
      )}

    </div>
  )
}
