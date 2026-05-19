import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import type { Building, CalendarEvent, EventInformalAssignment, EventRestaurantAssignment, InformalAsset, ReturnVisit, ReturnVisitLog, Role, ServiceSession, TerritoryCard, TimeSlot, Unit } from '../types'
import type { AppLanguage } from '../i18n'
import { t } from '../i18n'

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

function fmtDate(dateStr: string, language: AppLanguage): string {
  const today = new Date(); today.setHours(0,0,0,0)
  const d = new Date(dateStr.slice(0, 10)); d.setHours(0,0,0,0)
  const diff = Math.round((today.getTime() - d.getTime()) / 86400000)
  if (diff === 0) return t(language, 'territory.today')
  if (diff === 1) return t(language, 'territory.yesterday')
  if (diff < 30) return language === 'en' ? `${diff}d ago` : language === 'zh' ? `${diff}天前` : `${diff}일 전`
  return `${d.getMonth()+1}/${d.getDate()}`
}

export function MobileTerritory({
  language,
  buildings,
  cards,
  calendarEvents = [],
  currentVisitor,
  role,
  serviceSessions,
  returnVisits = [],
  returnVisitLogs = [],
  onOpenMap,
  onEndServiceSession,
  onCreateManualReturnVisit,
  onAddReturnVisitLog,
  onUpdateReturnVisitLog,
  onDeleteReturnVisitLog,
  onDeleteReturnVisit,
  onUpdateReturnVisitNickname,
  onUpdateReturnVisitAddress,
  // v2 신 배정 모델
  informalAssets = [],
  eventInformalAssignments = [],
  eventRestaurantAssignments = [],
}: {
  language: AppLanguage
  buildings: Building[]
  cards: TerritoryCard[]
  calendarEvents?: CalendarEvent[]
  currentVisitor: string
  role: Role
  serviceSessions: ServiceSession[]
  returnVisits?: ReturnVisit[]
  returnVisitLogs?: ReturnVisitLog[]
  informalAssets?: InformalAsset[]
  eventInformalAssignments?: EventInformalAssignment[]
  eventRestaurantAssignments?: EventRestaurantAssignment[]
  onOpenMap: (cardId: number) => void
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
  const [searchParams] = useSearchParams()
  const targetAssignmentEventId = Number(searchParams.get('assignmentEvent') ?? 0) || null
  const [filter, setFilter] = useState<'전체' | '미배정' | '내 카드'>('전체')
  const [showRegularDetail, setShowRegularDetail] = useState(false)
  const [rvCollapsed, setRvCollapsed] = useState(false)
  const [colorPickId, setColorPickId] = useState<number | null>(null)
  const [rvColors, setRvColors] = useState<Record<number, string>>(() => {
    try { return JSON.parse(localStorage.getItem('rvColors') ?? '{}') } catch { return {} }
  })
  const setRvColor = (id: number, color: string | null) => {
    setRvColors((prev) => {
      const next = { ...prev }
      if (color) next[id] = color
      else delete next[id]
      localStorage.setItem('rvColors', JSON.stringify(next))
      return next
    })
  }
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
  const timeSlotLabel = (slot: TimeSlot) => {
    if (slot === '오전') return t(language, 'map.morning')
    if (slot === '오후') return t(language, 'map.afternoon')
    return t(language, 'map.evening')
  }
  const resultLabel = (result: '만남' | '부재' | null) => {
    if (result === '만남') return t(language, 'map.met')
    if (result === '부재') return t(language, 'map.absent')
    return ''
  }
  const cardStatusLabel = (status: string) => {
    if (status === '방문필요') return t(language, 'zone.summaryNeed')
    if (status === '진행중') return t(language, 'zone.summaryProgress')
    if (status === '완료') return t(language, 'zone.summaryDone')
    return status
  }

  const cardBuildingTypeCounts = useMemo(() => {
    const map = new Map<number, { total: number; house: number; shop: number }>()
    cards.forEach((card) => map.set(card.id, { total: 0, house: 0, shop: 0 }))
    buildings.forEach((building) => {
      const current = map.get(building.cardId) ?? { total: 0, house: 0, shop: 0 }
      current.total += 1
      if (building.type === '주택') current.house += 1
      if (building.type === '상가') current.shop += 1
      map.set(building.cardId, current)
    })
    return map
  }, [buildings, cards])

  const today = useMemo(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }, [])

  // 오늘 봉사 + 미래 배정 + (지난 배정은 펼치기 토글)
  const [showPastAssignments, setShowPastAssignments] = useState(false)
  // 지난 봉사 — 전체 기간 (월별 타임라인으로 렌더)
  const pastCutoff = useMemo(() => '0001-01-01', [])
  const myAssignmentsSplit = useMemo(() => {
    const todayEvents = calendarEvents.filter((e) => e.date === today)
    // 미래(오늘 제외) 일정 중 내 배정
    const futureAssigned = calendarEvents.filter((event) =>
      event.date > today &&
      event.cardAssignments.some((assignment) => assignment.userName === currentVisitor)
    )
    // 과거 일정 중 내 배정 (오늘 제외, 30일 이내)
    const pastAssigned = calendarEvents.filter((event) =>
      event.date < today &&
      event.date >= pastCutoff &&
      event.cardAssignments.some((assignment) => assignment.userName === currentVisitor)
    )
    const targetEvent = targetAssignmentEventId
      ? calendarEvents.find((event) => event.id === targetAssignmentEventId)
      : null
    // 활성 영역: 오늘 + 미래 + (targetEvent 강제 주입)
    const activeEvents = [
      ...(targetEvent ? [targetEvent] : []),
      ...todayEvents,
      ...futureAssigned,
    ].filter((event, index, list) => list.findIndex((item) => item.id === event.id) === index)
      .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`))
    // 과거 영역: targetEvent 가 과거면 활성에 이미 들어갔으므로 제외
    const pastEvents = pastAssigned
      .filter((event) => !activeEvents.some((e) => e.id === event.id))
      .sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`))
    return { activeEvents, pastEvents }
  }, [calendarEvents, today, pastCutoff, targetAssignmentEventId, currentVisitor])

  const buildAssignment = (event: CalendarEvent) => {
    const assignment = event.cardAssignments.find((a) => a.userName === currentVisitor)
    const isParticipant =
      !!assignment ||
      event.applicants.includes(currentVisitor) ||
      event.assigned.includes(currentVisitor) ||
      event.leader === currentVisitor
    if (!isParticipant) return null
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
    return { event, cards: assignedCards, teammates }
  }

  const myTodayAssignments = useMemo(() => {
    return myAssignmentsSplit.activeEvents
      .map(buildAssignment)
      .filter(Boolean) as Array<{ event: CalendarEvent; cards: TerritoryCard[]; teammates: string[] }>
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myAssignmentsSplit, cards, currentVisitor])

  const myPastAssignments = useMemo(() => {
    return myAssignmentsSplit.pastEvents
      .map(buildAssignment)
      .filter(Boolean) as Array<{ event: CalendarEvent; cards: TerritoryCard[]; teammates: string[] }>
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myAssignmentsSplit, cards, currentVisitor])

  // 월별 그루핑 — { yearMonth: 'YYYY-MM', label: '2026년 5월', count: N, items: [...] }
  const myPastAssignmentsByMonth = useMemo(() => {
    const groups = new Map<string, { yearMonth: string; label: string; items: typeof myPastAssignments }>()
    for (const item of myPastAssignments) {
      const ym = item.event.date.slice(0, 7) // YYYY-MM
      if (!groups.has(ym)) {
        const [year, month] = ym.split('-')
        const label = language === 'zh' ? `${year}年${Number(month)}月`
          : language === 'en' ? `${new Date(`${ym}-01`).toLocaleString('en-US', { month: 'long' })} ${year}`
          : `${year}년 ${Number(month)}월`
        groups.set(ym, { yearMonth: ym, label, items: [] })
      }
      groups.get(ym)!.items.push(item)
    }
    return [...groups.values()].sort((a, b) => b.yearMonth.localeCompare(a.yearMonth))
  }, [myPastAssignments, language])


  const [expandedEventIds, setExpandedEventIds] = useState<Set<number>>(() => {
    if (targetAssignmentEventId) return new Set([targetAssignmentEventId])
    const currentSlot = getCurrentTimeSlot()
    const currentEvent = myTodayAssignments.find(({ event }) => getTimeSlotFromTime(event.time) === currentSlot)
    return currentEvent ? new Set([currentEvent.event.id]) : new Set()
  })

  useEffect(() => {
    if (!targetAssignmentEventId) return
    setExpandedEventIds((prev) => new Set(prev).add(targetAssignmentEventId))
  }, [targetAssignmentEventId])

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
  const toggleTodayEvent = (eventId: number) => {
    setExpandedEventIds((prev) => {
      const next = new Set(prev)
      if (next.has(eventId)) next.delete(eventId)
      else next.add(eventId)
      return next
    })
  }

  if (showRegularDetail) {
    return (
      <div className="mobile-territory-page">
        <div className="mobile-territory-head compact">
          <button className="mobile-territory-back" onClick={() => setShowRegularDetail(false)} type="button">‹</button>
          <div>
            <p>{t(language, 'territory.title')}</p>
            <h2>{t(language, 'territory.regularVisitManage')}</h2>
          </div>
        </div>
        <section className="mobile-regular-section detail" aria-label={t(language, 'territory.regularVisitManage')}>
          <div className="mobile-section-title">
            <h2>{t(language, 'territory.regularVisit')} ({myRegularVisits.length}{t(language, 'calendar.countSuffix')})</h2>
          </div>
          {myRegularVisits.length === 0 ? (
            <div className="mobile-territory-empty">{t(language, 'territory.noRegularVisits')}</div>
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
                    <span>{card?.name ?? t(language, 'territory.noCard')} · {building.type}</span>
                    {unit.memo && <small>{unit.memo}</small>}
                  </div>
                  <b>{t(language, 'territory.open')}</b>
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
      {role !== 'admin' && (
        <>
          <section className="mobile-territory-section mobile-today-service-section">
            <div className="mobile-section-title mobile-territory-list-title mobile-execution-title">
              <h2>{t(language, 'territory.assignedService')}</h2>
            </div>
            {myTodayAssignments.length === 0 ? (
              <div className="mobile-territory-empty">{t(language, 'territory.noTodayService')}</div>
            ) : (
              <div className="mobile-today-service-list">
                {myTodayAssignments.map(({ event, cards: assignedCards, teammates }) => {
                  const isOpen = expandedEventIds.has(event.id)
                  // v2: 본인의 비공식/식당 배정
                  const myInformal = eventInformalAssignments.filter(
                    (a) => a.eventId === event.id && a.userName === currentVisitor,
                  )
                  const myRestaurants = eventRestaurantAssignments.filter(
                    (a) => a.eventId === event.id && a.userName === currentVisitor,
                  )
                  const totalCount = assignedCards.length + myInformal.length + myRestaurants.length
                  return (
                    <article className={`mobile-today-service-card${isOpen ? ' open' : ''}`} key={event.id}>
                      <button className="mobile-today-service-toggle" onClick={() => toggleTodayEvent(event.id)} type="button">
                        <span aria-hidden="true">{isOpen ? '⌄' : '›'}</span>
                        <strong>{event.date === today ? '' : `${fmtDate(event.date, language)} · `}{event.time} {event.title}</strong>
                        <b>{totalCount}{t(language, 'calendar.countSuffix')}</b>
                      </button>
                      {isOpen && (
                        <div className="mobile-today-service-body">
                          <p>
                            {event.leader ? `${t(language, 'territory.leader')} ${event.leader}` : t(language, 'territory.leaderTbd')}
                            {teammates.length > 0 ? ` · ${t(language, 'territory.members')} ${teammates.join(', ')}` : ''}
                          </p>
                          {totalCount === 0 ? (
                            <div className="mobile-territory-empty compact">{t(language, 'territory.noAssignedCards')}</div>
                          ) : (
                            <>
                              {assignedCards.map((card) => (
                                <div className="mobile-today-card-row" key={`card-${card.id}`}>
                                  <span className="mobile-today-card-dot" aria-hidden="true" style={{ background: '#2563eb' }} />
                                  <strong>{card.name}</strong>
                                  <em>{card.progress}%</em>
                                  <button onClick={() => onOpenMap(card.id)} type="button">{t(language, 'zone.map')}</button>
                                </div>
                              ))}
                              {myInformal.map((asn) => {
                                const asset = informalAssets.find((x) => x.id === asn.assetId)
                                return (
                                  <div className="mobile-today-card-row" key={`inf-${asn.id}`}>
                                    <span className="mobile-today-card-dot" aria-hidden="true" style={{ background: '#a855f7' }} />
                                    <strong>{asset?.name ?? '비공식 자료'}</strong>
                                    <em style={{ color: '#a855f7' }}>비공식</em>
                                    {asset?.imageUrl && (
                                      <a href={asset.imageUrl} target="_blank" rel="noreferrer" style={{ display: 'inline-block' }}>
                                        <img
                                          src={asset.imageUrl}
                                          alt={asset.name}
                                          style={{ width: 32, height: 32, borderRadius: 6, objectFit: 'cover', border: '1px solid #e2e8f0' }}
                                        />
                                      </a>
                                    )}
                                  </div>
                                )
                              })}
                              {myRestaurants.map((asn) => {
                                const b = buildings.find((x) => x.id === asn.buildingId)
                                if (!b) return null
                                return (
                                  <div className="mobile-today-card-row" key={`rest-${asn.id}`}>
                                    <span className="mobile-today-card-dot" aria-hidden="true" style={{ background: '#ea580c' }} />
                                    <strong>{b.name || b.address}</strong>
                                    <em style={{ color: '#ea580c' }}>식당</em>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (b.lat && b.lng) {
                                          const dname = encodeURIComponent(b.name || b.address)
                                          window.open(`https://map.naver.com/p/search/${dname}`, '_blank', 'noopener,noreferrer')
                                        } else {
                                          onOpenMap(b.cardId)
                                        }
                                      }}
                                    >길찾기</button>
                                  </div>
                                )
                              })}
                            </>
                          )}
                        </div>
                      )}
                    </article>
                  )
                })}
              </div>
            )}
          </section>

          {activeSession && (
            <section className="mobile-territory-section">
              <div className="mobile-active-session-card">
                <span className="mas-dot" />
                <div className="mas-body">
                  <strong>{activeCard?.name ?? t(language, 'territory.noCard')}</strong>
                  <span>{timeSlotLabel(activeSession.timeSlot)} · {t(language, 'map.servicing')}</span>
                </div>
                <div className="mas-actions">
                  {activeCard && (
                    <button className="mas-map-btn" onClick={() => onOpenMap(activeCard.id)} type="button">{t(language, 'zone.map')}</button>
                  )}
                  <button className="mas-end-btn" onClick={() => onEndServiceSession(activeSession.id)} type="button">{t(language, 'territory.end')}</button>
                </div>
              </div>
            </section>
          )}

          <section className="mobile-territory-section mobile-regular-section" aria-label={t(language, 'territory.regularVisit')}>
            <div className="mobile-section-title">
              <h2>
                <button className="rv-collapse-btn" onClick={() => setRvCollapsed((v) => !v)} type="button">
                  <span className="rv-collapse-chevron">{rvCollapsed ? '›' : '⌄'}</span>
                  {t(language, 'territory.regularVisit')} <span className="rv-count">{myReturnVisits.length}{t(language, 'calendar.countSuffix')}</span>
                </button>
              </h2>
              <button className="rv-add-btn" onClick={() => { setShowAddSheet(true); setAddNickname(''); setAddAddress(''); setAddMemo(''); setAddLinked(null); setAddUnitPickBuilding(null) }} type="button">+ {t(language, 'common.add')}</button>
            </div>

            {!rvCollapsed && (myReturnVisits.length === 0 ? (
              <div className="mobile-regular-empty-card">
                <strong>{t(language, 'territory.noRegularVisits')}</strong>
                <span>{t(language, 'territory.regularEmptyDesc')}</span>
              </div>
            ) : (
              <div className="rv-list">
                {myReturnVisits.map((rv) => {
                  const building = buildings.find((b) => b.id === rv.buildingId)
                  const label = rv.nickname || rv.displayName
                  const isMenuOpen = menuOpenId === rv.id
                  const isNicknameEdit = nicknameEditId === rv.id
                  const isAddressEdit = addressEditId === rv.id
                  const isColorPick = colorPickId === rv.id
                  const cardColor = rvColors[rv.id]
                  const colorStyle: React.CSSProperties = cardColor
                    ? { borderLeft: `3px solid ${cardColor}`, background: `${cardColor}14` }
                    : {}

                  return (
                    <div
                      key={rv.id}
                      className="rv-card"
                      style={colorStyle}
                      onClick={() => { if (isMenuOpen) setMenuOpenId(null); if (isColorPick) setColorPickId(null) }}
                    >
                      {/* 메인 행: 정보 + 버튼 */}
                      <div className="rv-card-main">
                        <button
                          type="button"
                          className="rv-card-info rv-card-info-btn"
                          onClick={(e) => {
                            e.stopPropagation()
                            if (isMenuOpen) { setMenuOpenId(null); return }
                            if (isColorPick) { setColorPickId(null); return }
                            navigate(`/territory/regular/${rv.id}`)
                          }}
                          aria-label={`${label} 상세`}
                        >
                          <div className="rv-card-title">
                            <strong className="rv-name">{label}</strong>
                            {rv.lastResult && (
                              <span className={`rv-status-dot rv-status-${rv.lastResult}`} />
                            )}
                          </div>
                          {rv.address && <span className="rv-address">{rv.address}</span>}
                          <span className="rv-meta-row">
                            {rv.lastVisitedAt
                              ? `${t(language, 'home.lastVisit')} · ${fmtDate(rv.lastVisitedAt, language)}`
                              : t(language, 'home.noVisitYet')}
                          </span>
                        </button>

                        <div className="rv-row-actions">
                          <button
                            className="rv-btn rv-btn-log"
                            onClick={(e) => { e.stopPropagation(); setLogTarget(rv); setLogResult(null); setLogMemo('') }}
                            type="button"
                          >{t(language, 'territory.log')}</button>
                          {building ? (
                            <button
                              className="rv-btn rv-btn-map"
                              onClick={(e) => { e.stopPropagation(); onOpenMap(building.cardId) }}
                              type="button"
                            >{t(language, 'zone.map')}</button>
                          ) : rv.address ? (
                            <button
                              className="rv-btn rv-btn-map"
                              onClick={(e) => { e.stopPropagation(); navigate(`/map?addr=${encodeURIComponent(rv.address)}&pinLabel=${encodeURIComponent(rv.nickname || rv.displayName)}`) }}
                              type="button"
                            >{t(language, 'zone.map')}</button>
                          ) : null}
                          <div className="rv-menu-wrap">
                            <button
                              className="rv-menu-btn"
                              onClick={(e) => { e.stopPropagation(); setMenuOpenId(isMenuOpen ? null : rv.id); setColorPickId(null) }}
                              type="button"
                              aria-label={t(language, 'territory.more')}
                            >⋮</button>
                            {isMenuOpen && (
                              <div className="rv-menu-dropdown" onClick={(e) => e.stopPropagation()}>
                                <button
                                  className="rv-menu-item"
                                  onClick={() => { setColorPickId(rv.id); setMenuOpenId(null) }}
                                  type="button"
                                >{t(language, 'territory.color')}</button>
                                <button
                                  className="rv-menu-item"
                                  onClick={() => { setNicknameEditId(rv.id); setNicknameEditValue(rv.nickname || rv.displayName); setMenuOpenId(null) }}
                                  type="button"
                                >{t(language, 'territory.editNickname')}</button>
                                <button
                                  className="rv-menu-item"
                                  onClick={() => { setAddressEditId(rv.id); setAddressEditValue(rv.address); setMenuOpenId(null) }}
                                  type="button"
                                >{t(language, 'territory.editAddress')}</button>
                                <button
                                  className="rv-menu-item rv-menu-danger"
                                  disabled={deletingId === rv.id}
                                  onClick={() => {
                                    if (!onDeleteReturnVisit) return
                                    setMenuOpenId(null)
                                    setConfirmDialog({
                                      message: t(language, 'territory.deleteRegularConfirm'),
                                      onConfirm: async () => {
                                        setDeletingId(rv.id)
                                        await onDeleteReturnVisit(rv.id)
                                        setDeletingId(null)
                                      },
                                    })
                                  }}
                                  type="button"
                                >{t(language, 'common.delete')}</button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* 색상 피커 */}
                      {isColorPick && (
                        <div className="rv-color-picker" onClick={(e) => e.stopPropagation()}>
                          {['#ef4444','#f97316','#eab308','#22c55e','#3b82f6','#8b5cf6','#ec4899','#6b7280'].map((c) => (
                            <button
                              key={c}
                              className={`rv-color-dot${cardColor === c ? ' selected' : ''}`}
                              style={{ background: c }}
                              onClick={() => { setRvColor(rv.id, cardColor === c ? null : c); setColorPickId(null) }}
                              type="button"
                            />
                          ))}
                          {cardColor && (
                            <button className="rv-color-reset" onClick={() => { setRvColor(rv.id, null); setColorPickId(null) }} type="button">{t(language, 'territory.default')}</button>
                          )}
                        </div>
                      )}

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
                          >{nicknameSaving ? '…' : t(language, 'common.save')}</button>
                          <button className="rv-nickname-cancel-btn" onClick={() => setNicknameEditId(null)} type="button">{t(language, 'common.cancel')}</button>
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
                              placeholder={t(language, 'territory.addressPlaceholderShort')}
                              style={{ paddingRight: addrEditGeocoding ? 28 : undefined, width: '100%', boxSizing: 'border-box' }}
                              autoFocus
                            />
                            {addrEditGeocoding && (
                              <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: '#94a3b8' }}>{t(language, 'map.searchingAddress')}</span>
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
                          >{addressSaving ? '…' : t(language, 'common.save')}</button>
                          <button className="rv-nickname-cancel-btn" onClick={() => setAddressEditId(null)} type="button">{t(language, 'common.cancel')}</button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ))}
          </section>

          {/* 지난 봉사 — 월별 타임라인 (활동 탭 맨 아래) */}
          {myPastAssignments.length > 0 && (
            <section className="mobile-territory-section mobile-past-section">
              <div className="mobile-section-title">
                <h2>
                  <button
                    className="rv-collapse-btn"
                    onClick={() => setShowPastAssignments((v) => !v)}
                    type="button"
                  >
                    <span className="rv-collapse-chevron">{showPastAssignments ? '⌄' : '›'}</span>
                    지난 봉사 <span className="rv-count">{myPastAssignments.length}{t(language, 'calendar.countSuffix')}</span>
                  </button>
                </h2>
              </div>
              {showPastAssignments && (
                <div className="mobile-past-timeline">
                  {myPastAssignmentsByMonth.map((group) => (
                    <div key={group.yearMonth} className="mobile-past-month-group">
                      <header className="mobile-past-month-header">
                        <span>{group.label}</span>
                        <span className="rv-count">{group.items.length}{t(language, 'calendar.countSuffix')}</span>
                      </header>
                      <ul className="mobile-past-list">
                        {group.items.map(({ event, cards: assignedCards, teammates }) => {
                          const d = new Date(event.date)
                          const dow = ['일', '월', '화', '수', '목', '금', '토'][d.getDay()]
                          const slot = getTimeSlotFromTime(event.time)
                          const isOpen = expandedEventIds.has(event.id)
                          return (
                            <li key={event.id} className={`mobile-past-item${isOpen ? ' is-open' : ''}`}>
                              <button
                                type="button"
                                className="mobile-past-item-head"
                                onClick={() => toggleTodayEvent(event.id)}
                              >
                                <div className="mobile-past-item-date">
                                  <strong>{d.getMonth() + 1}/{d.getDate()}</strong>
                                  <span>({dow}) · {slot}</span>
                                </div>
                                <div className="mobile-past-item-summary">
                                  <p className="mobile-past-item-title">{event.title}</p>
                                  <p className="mobile-past-item-meta">
                                    {event.leader ? `${t(language, 'territory.leader')} ${event.leader}` : t(language, 'territory.leaderTbd')}
                                    {teammates.length > 0 && ` · ${t(language, 'territory.members')} ${teammates.length}${t(language, 'calendar.countSuffix')}`}
                                    {assignedCards.length > 0 && ` · 카드 ${assignedCards.length}${t(language, 'calendar.countSuffix')}`}
                                  </p>
                                </div>
                                <span className="mobile-past-item-chevron" aria-hidden>{isOpen ? '⌄' : '›'}</span>
                              </button>
                              {isOpen && (
                                <div className="mobile-past-item-body">
                                  {teammates.length > 0 && (
                                    <p className="mobile-past-teammates">
                                      <span>{t(language, 'territory.members')}</span> {teammates.join(', ')}
                                    </p>
                                  )}
                                  {assignedCards.length === 0 ? (
                                    <p className="mobile-past-empty">{t(language, 'territory.noAssignedCards')}</p>
                                  ) : (
                                    <ul className="mobile-past-cards">
                                      {assignedCards.map((card) => (
                                        <li key={card.id} className="mobile-past-card-row">
                                          <strong>{card.name}</strong>
                                          <em>{card.progress}%</em>
                                          <button onClick={() => onOpenMap(card.id)} type="button">{t(language, 'zone.map')}</button>
                                        </li>
                                      ))}
                                    </ul>
                                  )}
                                </div>
                              )}
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

        {/* ── 수동 추가 시트 ── */}
        {showAddSheet && (
          <div className="rv-log-backdrop" onClick={() => setShowAddSheet(false)}>
            <div className="rv-log-sheet" onClick={(e) => e.stopPropagation()}>
              <div className="rv-log-header">
                <strong>{t(language, 'territory.addRegularVisit')}</strong>
              </div>

              {/* 별칭 */}
              <div className="rv-add-field">
                <label className="rv-add-label">{t(language, 'territory.nickname')} <span className="rv-add-required">{t(language, 'territory.required')}</span></label>
                <input
                  className="rv-add-input"
                  placeholder={t(language, 'territory.nicknamePlaceholder')}
                  value={addNickname}
                  onChange={(e) => setAddNickname(e.target.value)}
                  autoFocus
                />
              </div>

              {/* 주소 */}
              <div className="rv-add-field">
                <label className="rv-add-label">{t(language, 'map.address')} <span className="rv-add-optional">{t(language, 'territory.optional')}</span></label>
                {addLinked ? (
                  <div className="rv-add-linked">
                    <span className="rv-add-linked-text">
                      <b>{addLinked.building.name} {addLinked.unit.number}호</b>
                      <em>{addLinked.building.address}</em>
                    </span>
                    <button className="rv-add-unlink" type="button" onClick={() => { setAddLinked(null); setAddAddress('') }}>{t(language, 'territory.unlink')}</button>
                  </div>
                ) : (
                  <>
                    <div style={{ position: 'relative' }}>
                      <input
                        className="rv-add-input"
                        placeholder={t(language, 'territory.addressPlaceholderShort')}
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
                        <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: '#94a3b8' }}>{t(language, 'map.searchingAddress')}</span>
                      )}
                    </div>
                    {/* 주소 매칭 결과 */}
                    {addressMatches.length > 0 && (
                      <div className="rv-add-matches">
                        <p className="rv-add-matches-title">{t(language, 'territory.matchingBuildings')}</p>
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
                            >{t(language, 'territory.connect')}</button>
                          </div>
                        ))}
                        {/* 세대 선택 */}
                        {addUnitPickBuilding && (
                          <div className="rv-add-unit-picker">
                            <p className="rv-add-matches-title">{t(language, 'territory.selectUnit')}</p>
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
                <label className="rv-add-label">{t(language, 'map.memo')} <span className="rv-add-optional">{t(language, 'territory.optional')}</span></label>
                <input
                  className="rv-add-input"
                  placeholder={t(language, 'territory.memoPlaceholder')}
                  value={addMemo}
                  onChange={(e) => setAddMemo(e.target.value)}
                />
              </div>

              <div className="rv-log-actions">
                <button className="rv-log-cancel" type="button" onClick={() => setShowAddSheet(false)}>{t(language, 'common.cancel')}</button>
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
                >{addSaving ? t(language, 'territory.saving') : t(language, 'common.save')}</button>
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
                          <span className="rv-h-date">{dateStr} {timeSlotLabel(slot as TimeSlot)}</span>
                          {l.result && <b className={l.result === '만남' ? 'rv-h-meet' : 'rv-h-absent'}> · {resultLabel(l.result)}</b>}
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
                            <p className="rv-action-title">{t(language, 'territory.manageRecord')}</p>
                            <button
                              className="rv-action-btn"
                              type="button"
                              onClick={() => {
                                setLogEditResult(targetLog.result)
                                setLogEditMemo(targetLog.memo)
                                setLogEditMode(true)
                              }}
                            >{t(language, 'territory.editContent')}</button>
                            <button
                              className="rv-action-btn rv-action-danger"
                              type="button"
                              onClick={() => {
                                if (!onDeleteReturnVisitLog) return
                                setConfirmDialog({
                                  message: t(language, 'territory.deleteRecordConfirm'),
                                  onConfirm: async () => {
                                    await onDeleteReturnVisitLog(logActionId)
                                    setLogActionId(null)
                                  },
                                })
                              }}
                            >{t(language, 'common.delete')}</button>
                            <button
                              className="rv-action-cancel"
                              type="button"
                              onClick={() => setLogActionId(null)}
                            >{t(language, 'common.cancel')}</button>
                          </>
                        ) : (
                          <>
                            <p className="rv-action-title">{t(language, 'territory.editRecord')}</p>
                            <div className="rv-log-result-chips" style={{ marginBottom: 8 }}>
                              <button
                                className={`rv-chip${logEditResult === '만남' ? ' rv-chip-meet' : ''}`}
                                onClick={() => setLogEditResult(logEditResult === '만남' ? null : '만남')}
                                type="button"
                              >{t(language, 'map.met')}</button>
                              <button
                                className={`rv-chip${logEditResult === '부재' ? ' rv-chip-absent' : ''}`}
                                onClick={() => setLogEditResult(logEditResult === '부재' ? null : '부재')}
                                type="button"
                              >{t(language, 'map.absent')}</button>
                            </div>
                            <textarea
                              className="rv-log-memo"
                              rows={2}
                              value={logEditMemo}
                              onChange={(e) => setLogEditMemo(e.target.value)}
                              placeholder={`${t(language, 'map.memo')} (${t(language, 'territory.optional')})`}
                            />
                            <div className="rv-log-actions">
                              <button
                                className="rv-log-cancel"
                                type="button"
                                onClick={() => setLogEditMode(false)}
                              >{t(language, 'common.cancel')}</button>
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
                              >{logEditSaving ? t(language, 'territory.saving') : t(language, 'common.save')}</button>
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
                    >{t(language, 'map.met')}</button>
                    <button
                      className={`rv-chip${logResult === '부재' ? ' rv-chip-absent' : ''}`}
                      onClick={() => setLogResult(logResult === '부재' ? null : '부재')}
                      type="button"
                    >{t(language, 'map.absent')}</button>
                  </div>
                </div>

                {/* 메모 */}
                <textarea
                  className="rv-log-memo"
                  placeholder={`${t(language, 'map.memo')} (${t(language, 'territory.optional')})`}
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
                  >{t(language, 'common.cancel')}</button>
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
                  >{logSaving ? t(language, 'territory.saving') : t(language, 'common.save')}</button>
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
                >{t(language, 'common.cancel')}</button>
                <button
                  onClick={() => { const fn = confirmDialog.onConfirm; setConfirmDialog(null); fn() }}
                  style={{ flex: 1, padding: '11px', borderRadius: 10, border: 'none', background: '#ef4444', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
                  type="button"
                >{t(language, 'common.delete')}</button>
              </div>
            </div>
          </div>
        )}
        </>
      )}

      {role === 'admin' && (
        <>
          <div className="mobile-territory-filter" aria-label={t(language, 'zone.cardCount')}>
            {(['전체', '미배정', '내 카드'] as const).map((f) => (
              <button
                className={filter === f ? 'active' : ''}
                key={f}
                onClick={() => setFilter(f)}
                type="button"
              >
                {f === '전체' ? t(language, 'map.all') : f === '미배정' ? t(language, 'zone.unassigned') : t(language, 'territory.myCards')}
              </button>
            ))}
          </div>

          {visibleCards.length > 0 && (
            <div className="mobile-section-title mobile-territory-list-title">
              <h2>{filter === '전체' ? t(language, 'territory.allCardsList') : t(language, 'territory.myCards')}</h2>
            </div>
          )}

          {visibleCards.length === 0 && (
            <div className="mobile-territory-empty" style={{ margin: '0 20px' }}>
              {t(language, 'zone.noCards')}
            </div>
          )}

          {visibleCards.map((card) => {
            const isActiveSession = activeSessionCardIds.has(card.id)
            const statusLabel = isActiveSession ? t(language, 'map.servicing') : cardStatusLabel(card.status)
            const statusClass = isActiveSession ? '진행중' : card.status
            const counts = cardBuildingTypeCounts.get(card.id) ?? { total: card.buildings, house: 0, shop: 0 }
            return (
              <div className="mobile-territory-card" key={card.id}>
                <div className="mobile-territory-info">
                  <h3 className="mobile-territory-name">{card.name}</h3>
                  <p className="mobile-territory-sub">
                    {card.area} · 전체 {counts.total} · 주택 {counts.house} · 상가 {counts.shop}
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
                    {t(language, 'territory.open')}
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
