import { useEffect, useMemo, useRef, useState } from 'react'
import type { CalendarEvent, Notice, ReviewTask, Role, ServiceSession, TerritoryCard, TimeSlot } from '../types'
import { normalizeCardSearch, sortTerritoryCards } from '../utils/cardSearch'

const WEEKDAY_KO = ['일', '월', '화', '수', '목', '금', '토']

const PRIORITY_COLOR: Record<Notice['priority'], { bg: string; color: string }> = {
  긴급: { bg: 'var(--danger-100)', color: '#b91c1c' },
  일반: { bg: '#eff6ff', color: 'var(--brand-700)' },
  정보: { bg: 'var(--accent-100)', color: 'var(--accent-700)' },
}

type ServiceStartInput = {
  timeSlot: TimeSlot
  primaryCardId?: number | null
  calendarEventId?: number | null
  assignedCardId?: number | null
  assignmentId?: number | null
  source?: ServiceSession['source']
  memo?: string
}

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatHeader() {
  const d = new Date()
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 ${WEEKDAY_KO[d.getDay()]}요일`
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

function assignmentCardIds(assignment?: CalendarEvent['cardAssignments'][number]) {
  if (!assignment) return []
  return assignment.assignedCardIds && assignment.assignedCardIds.length > 0
    ? assignment.assignedCardIds
    : [assignment.assignedCardId]
}

export function DesktopHome({
  calendarEvents,
  cards,
  currentVisitor,
  notices,
  role,
  serviceSessions,
  onApplyToEvent,
  onStartServiceSession,
  onEndServiceSession,
  onOpenCalendar,
  onOpenNotices,
  onOpenTerritory,
  reviewTasks,
  onCreateReviewTask,
  onCompleteReviewTask,
  onUncompleteReviewTask,
  onUpdateReviewTask,
  onDeleteReviewTask,
}: {
  calendarEvents: CalendarEvent[]
  cards: TerritoryCard[]
  currentVisitor: string
  notices: Notice[]
  role: Role
  serviceSessions: ServiceSession[]
  onApplyToEvent: (eventId: number) => void
  onStartServiceSession: (input: {
    timeSlot: TimeSlot
    primaryCardId?: number | null
    calendarEventId?: number | null
    assignedCardId?: number | null
    assignmentId?: number | null
    source?: ServiceSession['source']
    memo?: string
  }) => Promise<number | null>
  onEndServiceSession: (sessionId: number) => void
  onOpenCalendar: () => void
  onOpenNotices: () => void
  onOpenTerritory: () => void
  reviewTasks: ReviewTask[]
  onCreateReviewTask: (title: string, content: string) => Promise<void>
  onCompleteReviewTask: (id: number) => Promise<void>
  onUncompleteReviewTask: (id: number) => Promise<void>
  onUpdateReviewTask: (id: number, title: string, content: string) => Promise<void>
  onDeleteReviewTask: (id: number) => Promise<void>
}) {
  const today = todayStr()

  // ── 검토 항목 상태 ────────────────────────────────────────────
  const [reviewModal, setReviewModal] = useState<{ mode: 'add' } | { mode: 'edit'; task: ReviewTask } | null>(null)
  const [reviewTitle, setReviewTitle] = useState('')
  const [reviewContent, setReviewContent] = useState('')
  const [reviewSubmitting, setReviewSubmitting] = useState(false)
  const [reviewMenuId, setReviewMenuId] = useState<number | null>(null)
  const [showDoneHistory, setShowDoneHistory] = useState(false)
  const [sectionMenuOpen, setSectionMenuOpen] = useState(false)
  const sectionMenuRef = useRef<HTMLDivElement>(null)
  const reviewMenuRef = useRef<HTMLDivElement>(null)

  // 완료 후 7일 이내 항목만 표시
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const pendingTasks = reviewTasks.filter((t) => t.status === 'pending')
  const doneTasks = reviewTasks.filter(
    (t) => t.status === 'done' && (!t.completedAt || t.completedAt >= sevenDaysAgo)
  )
  const allDoneTasks = reviewTasks.filter((t) => t.status === 'done')
  const visibleTasks = [...pendingTasks, ...doneTasks].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (sectionMenuRef.current && !sectionMenuRef.current.contains(e.target as Node)) {
        setSectionMenuOpen(false)
      }
      if (reviewMenuRef.current && !reviewMenuRef.current.contains(e.target as Node)) {
        setReviewMenuId(null)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const openAddModal = () => {
    setReviewTitle('')
    setReviewContent('')
    setReviewModal({ mode: 'add' })
  }

  const openEditModal = (task: ReviewTask) => {
    setReviewTitle(task.title)
    setReviewContent(task.content)
    setReviewModal({ mode: 'edit', task })
    setReviewMenuId(null)
  }

  const closeReviewModal = () => {
    setReviewModal(null)
    setReviewTitle('')
    setReviewContent('')
  }

  const handleReviewSubmit = async () => {
    if (!reviewTitle.trim()) return
    setReviewSubmitting(true)
    if (reviewModal?.mode === 'edit') {
      await onUpdateReviewTask(reviewModal.task.id, reviewTitle.trim(), reviewContent.trim())
    } else {
      await onCreateReviewTask(reviewTitle.trim(), reviewContent.trim())
    }
    setReviewSubmitting(false)
    closeReviewModal()
  }

  const [showServiceStart, setShowServiceStart] = useState(false)
  const [serviceCardId, setServiceCardId] = useState<number | ''>('')
  const [serviceEventId, setServiceEventId] = useState<number | ''>('')
  const [cardSearch, setCardSearch] = useState('')
  const [serviceSlot, setServiceSlot] = useState<TimeSlot>('오전')
  const [pendingStartInput, setPendingStartInput] = useState<ServiceStartInput | null>(null)
  const todayEvents = calendarEvents
    .filter((e) => e.date === today)
    .sort((a, b) => a.time.localeCompare(b.time))

  const myCards = cards.filter((c) => c.assignedUsers.includes(currentVisitor))
  const leaderCards = cards.filter((c) => c.assignedLeader === currentVisitor)
  const myLeadingEvents = calendarEvents.filter(
    (e) => e.date === today && e.leader === currentVisitor,
  )
  const assignedCards = cards.filter((card) => card.assignedLeader)
  const pendingCards = cards.filter((card) => card.status === '미배정')
  const inProgressCards = cards.filter((card) => card.status === '진행중')
  const completedCards = cards.filter((card) => card.progress >= 100)
  const totalUnits = cards.reduce((sum, card) => sum + card.units, 0)
  const completedUnits = cards.reduce((sum, card) => sum + card.completed, 0)
  const todaySessions = useMemo(() =>
    serviceSessions.filter((session) => session.serviceDate === today),
    [serviceSessions, today])
  const myTodaySessions = todaySessions.filter((session) => session.userName === currentVisitor)
  const activeMySession = myTodaySessions.find((session) => session.status === 'active' && !session.endedAt)
  const myStartEvents = todayEvents.filter((event) =>
    event.applicants.includes(currentVisitor) ||
    event.assigned.includes(currentVisitor) ||
    event.leader === currentVisitor
  )
  const selectedStartEvent = serviceEventId ? todayEvents.find((event) => event.id === serviceEventId) : undefined
  const selectedAssignment = selectedStartEvent?.cardAssignments.find((assignment) => assignment.userName === currentVisitor)
  const selectedCard = serviceCardId ? cards.find((card) => card.id === serviceCardId) : undefined
  const filteredCardOptions = cards
    .filter((card) => {
      const query = normalizeCardSearch(cardSearch)
      if (!query) return false
      const haystack = normalizeCardSearch(`${card.name}${card.region}${card.area}`)
      return haystack.includes(query)
    })
  const sortedCardOptions = sortTerritoryCards(filteredCardOptions)

  const selectStartEvent = (event: CalendarEvent) => {
    const assignment = event.cardAssignments.find((item) => item.userName === currentVisitor)
    setServiceEventId(event.id)
    setServiceSlot(getTimeSlotFromTime(event.time))
    if (assignment) {
      const firstCardId = assignmentCardIds(assignment)[0]
      const card = cards.find((item) => item.id === firstCardId)
      setServiceCardId(firstCardId ?? '')
      setCardSearch(card?.name ?? '')
    }
  }

  const startSession = async (input: ServiceStartInput) => {
    const id = await onStartServiceSession(input)
    if (id) {
      setShowServiceStart(false)
      setPendingStartInput(null)
    }
  }

  const requestStartSession = async () => {
    if (!serviceCardId) return
    const source: ServiceSession['source'] = selectedAssignment
      ? selectedAssignment.assignedCardId === serviceCardId ? 'assigned' : 'manual_override'
      : 'manual'
    const input: ServiceStartInput = {
      calendarEventId: serviceEventId || null,
      primaryCardId: serviceCardId,
      assignedCardId: selectedAssignment?.assignedCardId ?? null,
      assignmentId: selectedAssignment?.id ?? null,
      source,
      timeSlot: serviceSlot,
    }

    const shouldConfirmSwitch = !!activeMySession &&
      (activeMySession.primaryCardId !== input.primaryCardId || activeMySession.timeSlot !== input.timeSlot)

    if (shouldConfirmSwitch) {
      setPendingStartInput(input)
      return
    }

    await startSession(input)
  }

  const userCards = myCards.length > 0 ? myCards : cards.slice(0, 3)
  const visibleLeaderCards = leaderCards.length > 0 ? leaderCards : cards.filter((card) => card.assignedLeader).slice(0, 4)

  const modeCopy: Record<Role, { label: string; title: string; description: string }> = {
    user: {
      label: '봉사자 홈',
      title: `${currentVisitor}님, 오늘 봉사를 시작할 준비가 됐습니다`,
      description: '신청한 일정과 오늘 방문할 카드를 빠르게 확인합니다.',
    },
    leader: {
      label: '인도자 홈',
      title: '오늘 봉사 운영과 카드 진행을 확인합니다',
      description: '참여자, 담당 카드, 검토가 필요한 현장 기록을 한곳에서 봅니다.',
    },
    admin: {
      label: '관리자 홈',
      title: '전체 구역 운영 현황을 관리합니다',
      description: '봉사 세션, 카드 진행, 검토 필요 항목과 통계를 확인합니다.',
    },
  }

  const quickStats = role === 'admin'
    ? [
        { label: '전체 카드', value: cards.length },
        { label: '인도자 배정', value: assignedCards.length },
        { label: '진행중 카드', value: inProgressCards.length },
        { label: '완료 카드', value: completedCards.length },
      ]
    : role === 'leader'
      ? [
          { label: '담당 카드', value: visibleLeaderCards.length },
          { label: '오늘 일정', value: todayEvents.length },
          { label: '신청자', value: todayEvents.reduce((sum, event) => sum + event.applicants.length, 0) },
          { label: '검토 필요', value: 0 },
        ]
      : [
          { label: '오늘 일정', value: todayEvents.length },
          { label: '내 카드', value: myCards.length },
          { label: '신청 완료', value: calendarEvents.filter((event) => event.applicants.includes(currentVisitor)).length },
          { label: '정기방문', value: cards.reduce((sum, card) => sum + card.regularVisits, 0) },
        ]

  if (role === 'leader') {
    const usedCardCount = new Set(
      myTodaySessions
        .filter((session) => session.primaryCardId)
        .map((session) => session.primaryCardId as number),
    ).size
    const visibleCards = leaderCards.length > 0 ? leaderCards : []

    return (
      <div className="home-layout leader-home-layout">
        <div className="home-date-header leader-date-header">
          <span>{formatHeader()}</span>
        </div>

        <div className="leader-home-grid">
          <HomeTodayEvents
            currentVisitor={currentVisitor}
            events={todayEvents}
            onApplyToEvent={onApplyToEvent}
            onOpenCalendar={onOpenCalendar}
          />

          <section className="home-section">
            <div className="home-section-title">
              <span className="home-section-icon">●</span>
              <h2>담당카드</h2>
              <button className="home-more-btn" onClick={onOpenTerritory} type="button">
                전체보기 →
              </button>
            </div>
            <div className="leader-card-summary">
              <div>
                <strong>{leaderCards.length}</strong>
                <span>배정받은 카드</span>
              </div>
              <div>
                <strong>{usedCardCount}</strong>
                <span>오늘 사용한 카드</span>
              </div>
            </div>
            <div className="home-my-list">
              {visibleCards.length === 0 && (
                <div className="home-empty-state">
                  <p>담당 카드가 없습니다</p>
                </div>
              )}
              {visibleCards.slice(0, 6).map((card) => (
                <div className="home-my-card" key={card.id}>
                  <div className="home-my-card-info">
                    <strong>{card.name}</strong>
                    <span>사용자 {card.assignedUsers.length}명 · 건물 {card.buildings} · 세대 {card.units}</span>
                  </div>
                  <div className="home-my-card-progress">
                    <div className="home-progress-bar">
                      <span style={{ width: `${card.progress}%` }} />
                    </div>
                    <small>{card.progress}%</small>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="home-section leader-participants-section">
            <div className="home-section-title">
              <span className="home-section-icon">●</span>
              <h2>오늘 참여자</h2>
              <button className="home-more-btn" onClick={onOpenCalendar} type="button">
                신청자 상세 →
              </button>
            </div>
            <div className="leader-participant-list">
              {todayEvents.length === 0 && (
                <div className="home-empty-state"><p>오늘 신청자가 없습니다</p></div>
              )}
              {todayEvents.map((event) => (
                <article className="leader-participant-card" key={event.id}>
                  <div className="leader-participant-head">
                    <strong>{event.time} {event.title}</strong>
                    <span>신청 {event.applicants.length}명 · 배정 {event.assigned.length}명</span>
                  </div>
                  <div className="leader-applicant-chips">
                    {event.applicants.length === 0 && <span className="empty">신청자 없음</span>}
                    {event.applicants.map((name) => (
                      <span className={event.assigned.includes(name) ? 'assigned' : ''} key={name}>
                        {name}{event.assigned.includes(name) ? ' · 배정' : ''}
                      </span>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>
      </div>
    )
  }

  return (
    <div className="home-layout">
      {pendingStartInput && (
        <SessionSwitchModal
          currentCardName={cards.find((card) => card.id === activeMySession?.primaryCardId)?.name ?? '현재 카드'}
          currentSlot={activeMySession?.timeSlot ?? serviceSlot}
          nextCardName={cards.find((card) => card.id === pendingStartInput.primaryCardId)?.name ?? '새 카드'}
          nextSlot={pendingStartInput.timeSlot}
          onCancel={() => setPendingStartInput(null)}
          onConfirm={() => startSession(pendingStartInput)}
        />
      )}

      <section className={`home-role-hero home-role-hero-${role}`}>
        <div>
          <span>{modeCopy[role].label}</span>
          <h1>{modeCopy[role].title}</h1>
          <p>{modeCopy[role].description}</p>
        </div>
        <button
          className="home-primary-action"
          onClick={role === 'admin' ? onOpenTerritory : () => setShowServiceStart((open) => !open)}
          type="button"
        >
          {role === 'admin' ? '운영 현황 보기' : activeMySession ? `${activeMySession.timeSlot} 봉사 중` : '봉사 시작'}
        </button>
      </section>

      {role !== 'admin' && showServiceStart && (
        <section className="home-service-launcher">
          <div>
            <strong>봉사 시작</strong>
            <span>오늘 일정이 있으면 먼저 고르고, 실제 방문할 카드를 검색합니다.</span>
          </div>
          <div className="home-start-events">
            {myStartEvents.length === 0 ? (
              <span>오늘 신청/배정된 일정 없음</span>
            ) : myStartEvents.slice(0, 3).map((event) => {
              const assignment = event.cardAssignments.find((item) => item.userName === currentVisitor)
              const assignedIds = assignmentCardIds(assignment)
              const assignedCard = assignedIds[0] ? cards.find((card) => card.id === assignedIds[0]) : undefined
              return (
                <button
                  className={serviceEventId === event.id ? 'active' : ''}
                  key={event.id}
                  onClick={() => selectStartEvent(event)}
                  type="button"
                >
                  <strong>{event.time} {event.title}</strong>
                  <span>
                    {assignedIds.length > 1
                      ? `배정 카드 ${assignedIds.length}개`
                      : assignedCard
                        ? `배정 ${assignedCard.name}`
                        : '카드 직접 선택'}
                  </span>
                </button>
              )
            })}
          </div>
          <div className="home-card-search">
            <input
              placeholder="카드 검색: 고림동, 고림동 1"
              value={cardSearch}
              onChange={(event) => {
                setCardSearch(event.target.value)
                setServiceCardId('')
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && sortedCardOptions[0]) {
                  event.preventDefault()
                  setServiceCardId(sortedCardOptions[0].id)
                  setCardSearch(sortedCardOptions[0].name)
                }
              }}
            />
            {selectedCard && <span className="home-selected-card">{selectedCard.name}</span>}
            {cardSearch && !selectedCard && (
              <div className="home-card-search-results">
                {sortedCardOptions.length === 0 && <span>검색 결과 없음</span>}
                {sortedCardOptions.length > 0 && <span>검색 결과 {sortedCardOptions.length}개</span>}
                {sortedCardOptions.map((card) => (
                  <button
                    key={card.id}
                    onClick={() => {
                      setServiceCardId(card.id)
                      setCardSearch(card.name)
                    }}
                    type="button"
                  >
                    {card.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="home-session-slot" role="group" aria-label="봉사 시간대">
            {(['오전', '오후', '저녁'] as TimeSlot[]).map((slot) => (
              <button
                className={serviceSlot === slot ? 'active' : ''}
                key={slot}
                onClick={() => setServiceSlot(slot)}
                type="button"
              >
                {slot}
              </button>
            ))}
          </div>
          <button
            className="home-session-start-btn"
            disabled={!serviceCardId}
            onClick={requestStartSession}
            type="button"
          >
            시작
          </button>
        </section>
      )}

      {role !== 'admin' && myTodaySessions.length > 0 && (
        <section className="home-today-sessions">
          <div className="home-section-title">
            <span className="home-section-icon">●</span>
            <h2>오늘 내가 봉사한 카드</h2>
          </div>
          <div className="home-session-list">
            {myTodaySessions.map((session) => {
              const card = cards.find((item) => item.id === session.primaryCardId)
              const isActive = session.status === 'active' && !session.endedAt
              return (
                <div className="home-session-card" key={session.id}>
                  <div>
                    <strong>{card?.name ?? '카드 미지정'}</strong>
                    <span>{session.timeSlot} · {isActive ? '진행 중' : '종료됨'}</span>
                  </div>
                  {isActive && (
                    <button onClick={() => onEndServiceSession(session.id)} type="button">
                      종료
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      )}

      <div className="home-stat-grid" aria-label={`${modeCopy[role].label} 요약`}>
        {quickStats.map((stat) => (
          <div className="home-stat-card" key={stat.label}>
            <strong>{stat.value}</strong>
            <span>{stat.label}</span>
          </div>
        ))}
      </div>

      <div className="home-date-header">
        <span>{formatHeader()}</span>
      </div>

      {role === 'admin' && (
        <div className="home-grid">
          <section className="home-section">
            <div className="home-section-title">
              <span className="home-section-icon">●</span>
              <h2>오늘 운영 요약</h2>
              <button className="home-more-btn" onClick={onOpenTerritory} type="button">
                구역 보기 →
              </button>
            </div>
              <div className="home-ops-grid">
                <div><strong>{todayEvents.length}</strong><span>오늘 일정</span></div>
                <div><strong>{todaySessions.length}</strong><span>봉사 세션</span></div>
                <div><strong>{completedUnits}/{totalUnits}</strong><span>완료 세대</span></div>
                <div><strong>{pendingCards.length}</strong><span>미배정 카드</span></div>
              </div>
          </section>

          <section className="home-section">
            <div className="home-section-title">
              <span className="home-section-icon">●</span>
              <h2>검토 필요</h2>
              <div className="review-section-actions">
                <button className="review-action-btn" onClick={openAddModal} title="항목 추가" type="button">＋</button>
                <div className="review-section-menu-wrap" ref={sectionMenuRef}>
                  <button className="review-action-btn" onClick={() => setSectionMenuOpen((o) => !o)} title="더보기" type="button">⋯</button>
                  {sectionMenuOpen && (
                    <div className="review-dropdown-menu">
                      <button type="button" onClick={() => { setShowDoneHistory(true); setSectionMenuOpen(false) }}>완료 내역 보기</button>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="home-review-list">
              {visibleTasks.length === 0 && (
                <p className="review-empty">검토 항목이 없습니다</p>
              )}
              {visibleTasks.map((task) => (
                <div className={`home-review-row ${task.status === 'done' ? 'done' : ''}`} key={task.id}>
                  <div className="review-row-main">
                    <strong>{task.title}</strong>
                    {task.content && <span>{task.content}</span>}
                    {task.status === 'done' && task.completedAt && (
                      <em className="review-done-date">완료일: {task.completedAt.slice(0, 10)}</em>
                    )}
                  </div>
                  <div className="review-row-actions">
                    {task.status === 'pending' ? (
                      <button
                        className="review-check-btn"
                        onClick={() => onCompleteReviewTask(task.id)}
                        title="완료 처리"
                        type="button"
                      >✓</button>
                    ) : (
                      <button
                        className="review-done-badge-btn"
                        onClick={() => onUncompleteReviewTask(task.id)}
                        title="완료 취소"
                        type="button"
                      >완료됨</button>
                    )}
                    <div className="review-item-menu-wrap" ref={reviewMenuId === task.id ? reviewMenuRef : undefined}>
                      <button
                        className="review-action-btn sm"
                        onClick={() => setReviewMenuId((id) => id === task.id ? null : task.id)}
                        type="button"
                      >⋯</button>
                      {reviewMenuId === task.id && (
                        <div className="review-dropdown-menu">
                          <button type="button" onClick={() => openEditModal(task)}>수정</button>
                          <button type="button" className="danger" onClick={() => { onDeleteReviewTask(task.id); setReviewMenuId(null) }}>삭제</button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 완료 내역 모달 */}
          {showDoneHistory && (
            <div className="cal-modal-backdrop" onClick={() => setShowDoneHistory(false)}>
              <div className="cal-modal" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
                <div className="cal-modal-head">
                  <div className="cal-modal-title">
                    <h2>완료 내역</h2>
                  </div>
                  <button className="cal-modal-close" type="button" onClick={() => setShowDoneHistory(false)}>✕</button>
                </div>
                <div className="cal-modal-body" style={{ maxHeight: 400, overflowY: 'auto' }}>
                  {allDoneTasks.length === 0 && (
                    <p style={{ color: 'var(--ink-400)', textAlign: 'center', padding: '24px 0', fontSize: 14 }}>완료된 항목이 없습니다</p>
                  )}
                  {[...allDoneTasks].sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? '')).map((task) => (
                    <div key={task.id} style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '12px 0', borderBottom: '1px solid var(--surface-200)' }}>
                      <strong style={{ fontSize: 14, color: 'var(--ink-900)' }}>{task.title}</strong>
                      {task.content && <p style={{ fontSize: 13, color: 'var(--ink-500)', margin: 0 }}>{task.content}</p>}
                      {task.completedAt && <em style={{ fontSize: 12, color: 'var(--ink-400)', fontStyle: 'normal' }}>완료일: {task.completedAt.slice(0, 10)}</em>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 항목 추가/수정 모달 */}
          {reviewModal && (
            <div className="cal-modal-backdrop" onClick={closeReviewModal}>
              <div className="cal-modal" style={{ maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
                <div className="cal-modal-head">
                  <div className="cal-modal-title">
                    <h2>{reviewModal.mode === 'add' ? '검토 항목 추가' : '항목 수정'}</h2>
                  </div>
                  <button className="cal-modal-close" type="button" onClick={closeReviewModal}>✕</button>
                </div>
                <div className="cal-modal-body">
                  <div className="cal-field">
                    <label>제목 <span style={{ color: 'var(--danger-500)' }}>*</span></label>
                    <input
                      autoFocus
                      className="cal-input"
                      placeholder="검토할 항목을 입력하세요"
                      value={reviewTitle}
                      onChange={(e) => setReviewTitle(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) handleReviewSubmit() }}
                    />
                  </div>
                  <div className="cal-field">
                    <label>내용 <span style={{ color: 'var(--ink-400)', fontWeight: 400 }}>(선택)</span></label>
                    <textarea
                      className="cal-input"
                      placeholder="추가 설명을 입력하세요"
                      rows={3}
                      style={{ resize: 'vertical', minHeight: 72 }}
                      value={reviewContent}
                      onChange={(e) => setReviewContent(e.target.value)}
                    />
                  </div>
                </div>
                <div className="cal-modal-foot">
                  <button className="cal-cancel-btn" type="button" onClick={closeReviewModal}>취소</button>
                  <button
                    className="cal-save-btn"
                    disabled={!reviewTitle.trim() || reviewSubmitting}
                    type="button"
                    onClick={handleReviewSubmit}
                  >
                    {reviewSubmitting ? '처리 중...' : reviewModal.mode === 'add' ? '추가' : '저장'}
                  </button>
                </div>
              </div>
            </div>
          )}

          <section className="home-section">
            <div className="home-section-title">
              <span className="home-section-icon">●</span>
              <h2>카드 진행</h2>
              <button className="home-more-btn" onClick={onOpenTerritory} type="button">
                전체보기 →
              </button>
            </div>
            <div className="home-my-list">
              {cards.slice(0, 4).map((card) => (
                <div className="home-my-card" key={card.id}>
                  <div className="home-my-card-info">
                    <strong>{card.name}</strong>
                    <span>{card.assignedLeader ?? '인도자 미배정'} · 건물 {card.buildings} · 세대 {card.units}</span>
                  </div>
                  <div className="home-my-card-progress">
                    <div className="home-progress-bar">
                      <span style={{ width: `${card.progress}%` }} />
                    </div>
                    <small>{card.progress}%</small>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <HomeNoticeSection notices={notices} onOpenNotices={onOpenNotices} />
        </div>
      )}

      {role === 'user' && (
        <div className="home-grid">
        {/* 공지 */}
        <HomeNoticeSection notices={notices} onOpenNotices={onOpenNotices} />

        {/* 오늘의 봉사 */}
        <HomeTodayEvents
          currentVisitor={currentVisitor}
          events={todayEvents}
          onApplyToEvent={onApplyToEvent}
          onOpenCalendar={onOpenCalendar}
        />

        {/* 나의 구역 */}
        <section className="home-section">
          <div className="home-section-title">
            <span className="home-section-icon">📍</span>
            <h2>나의 구역</h2>
            <button className="home-more-btn" onClick={onOpenTerritory} type="button">
              전체보기 →
            </button>
          </div>
          <div className="home-my-list">
            {myCards.length === 0 && (
              <div className="home-empty-state">
                <p>배정된 구역이 없습니다</p>
              </div>
            )}
            {userCards.slice(0, 3).map((card) => (
              <div className="home-my-card" key={card.id}>
                <div className="home-my-card-info">
                  <strong>{card.name}</strong>
                  <span>{card.area}</span>
                </div>
                <div className="home-my-card-progress">
                  <div className="home-progress-bar">
                    <span style={{ width: `${card.progress}%` }} />
                  </div>
                  <small>{card.progress}%</small>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 나의 인도 */}
        <section className="home-section">
          <div className="home-section-title">
            <span className="home-section-icon">🔄</span>
            <h2>나의 인도</h2>
          </div>
          <div className="home-my-list">
            {myLeadingEvents.length === 0 && (
              <div className="home-empty-state">
                <p>인도 일정이 없습니다</p>
              </div>
            )}
            {myLeadingEvents.map((event) => (
              <div className="home-my-card" key={event.id}>
                <div className="home-my-card-info">
                  <strong>{event.title}</strong>
                  <span>⏰ {event.time} {event.place && `· ${event.place}`}</span>
                </div>
                <span className="home-lead-badge">인도자</span>
              </div>
            ))}
          </div>
        </section>
        </div>
      )}
    </div>
  )
}

function SessionSwitchModal({
  currentCardName,
  currentSlot,
  nextCardName,
  nextSlot,
  onCancel,
  onConfirm,
}: {
  currentCardName: string
  currentSlot: TimeSlot
  nextCardName: string
  nextSlot: TimeSlot
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <div className="session-switch-backdrop" role="presentation">
      <div className="session-switch-modal" role="dialog" aria-modal="true" aria-label="봉사 카드 전환 확인">
        <strong>봉사 카드를 전환할까요?</strong>
        <p>전환하면 현재 진행 중인 봉사는 지금 시간으로 종료되고, 새 카드 봉사가 시작됩니다.</p>
        <div className="session-switch-flow">
          <span>{currentCardName} · {currentSlot} 종료</span>
          <span>{nextCardName} · {nextSlot} 시작</span>
        </div>
        <div className="session-switch-actions">
          <button onClick={onCancel} type="button">취소</button>
          <button onClick={onConfirm} type="button">전환</button>
        </div>
      </div>
    </div>
  )
}

function HomeNoticeSection({ notices, onOpenNotices }: { notices: Notice[]; onOpenNotices: () => void }) {
  return (
    <section className="home-section">
      <div className="home-section-title">
        <span className="home-section-icon">●</span>
        <h2>공지</h2>
        <button className="home-more-btn" onClick={onOpenNotices} type="button">
          전체보기 →
        </button>
      </div>
      <div className="home-notice-list">
        {notices.length === 0 && (
          <div className="home-empty-state"><p>등록된 공지가 없습니다</p></div>
        )}
        {notices.slice(0, 3).map((n) => {
          const pc = PRIORITY_COLOR[n.priority]
          return (
            <div className="home-notice-item" key={n.id}>
              <span style={{ padding: '2px 7px', borderRadius: '999px', fontSize: '11px', fontWeight: 700, background: pc.bg, color: pc.color, flexShrink: 0 }}>
                {n.priority}
              </span>
              <p>{n.title}</p>
              <span className="notice-date">{n.createdAt.slice(5, 10).replace('-', '월 ')}일</span>
              <span className="notice-arrow">›</span>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function HomeTodayEvents({
  currentVisitor,
  events,
  onApplyToEvent,
  onOpenCalendar,
}: {
  currentVisitor: string
  events: CalendarEvent[]
  onApplyToEvent: (eventId: number) => void
  onOpenCalendar: () => void
}) {
  return (
    <section className="home-section">
      <div className="home-section-title">
        <span className="home-section-icon">●</span>
        <h2>오늘의 봉사</h2>
        <button className="home-more-btn" onClick={onOpenCalendar} type="button">
          전체보기 →
        </button>
      </div>
      <div className="home-event-list">
        {events.length === 0 && (
          <div className="home-empty-state">
            <p>오늘 예정된 봉사가 없습니다</p>
          </div>
        )}
        {events.map((event) => {
          const isApplied = event.applicants.includes(currentVisitor)
          const count = event.applicants.length
          return (
            <div className={`home-event-card ${isApplied ? 'applied' : ''}`} key={event.id}>
              <div className="home-time-chip">{event.time}</div>
              <div className="home-event-body">
                <div className="home-event-title-row">
                  <strong>{event.title}</strong>
                  {event.allowApplications && (
                    <span className="home-event-badge">
                      {isApplied ? '신청완료' : '신청 가능'}
                    </span>
                  )}
                  {!event.allowApplications && <span className="home-event-badge muted">신청 받지 않음</span>}
                </div>
                <div className="home-event-meta">
                  {event.place && <span>장소 {event.place}</span>}
                  {event.leader && <span>인도자 {event.leader}</span>}
                </div>
                {event.memo && <p className="home-event-memo">{event.memo}</p>}
                <div className="home-event-footer">
                  <span className="home-participant-count">신청 {count}명</span>
                  {event.allowApplications && (
                    <button
                      className={`home-join-btn ${isApplied ? 'applied' : ''}`}
                      onClick={() => onApplyToEvent(event.id)}
                      type="button"
                    >
                      {isApplied ? '신청취소' : '참여'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
