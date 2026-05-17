import { useEffect, useMemo, useRef, useState } from 'react'
import type { CalendarEvent, Notice, ReviewTask, Role, ServiceSession, SpecialPeriod, TerritoryCard, TimeSlot } from '../types'
import { normalizeCardSearch, sortTerritoryCards } from '../utils/cardSearch'
import { SpecialPeriodBanner } from './SpecialPeriodBanner'

const WEEKDAY_KO = ['일', '월', '화', '수', '목', '금', '토']

const PRIORITY_COLOR: Record<Notice['priority'], { bg: string; color: string }> = {
  긴급: { bg: 'var(--danger-100)', color: '#b91c1c' },
  일반: { bg: '#eff6ff', color: 'var(--brand-700)' },
  정보: { bg: 'var(--accent-100)', color: 'var(--accent-700)' },
}

type InlineIconName = 'clock' | 'pin' | 'user' | 'map' | 'repeat'

function InlineIcon({ name }: { name: InlineIconName }) {
  if (name === 'clock') {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="8" />
        <path d="M12 8v4l3 2" />
      </svg>
    )
  }

  if (name === 'pin') {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="M12 21s6-5.2 6-11a6 6 0 0 0-12 0c0 5.8 6 11 6 11Z" />
        <circle cx="12" cy="10" r="2" />
      </svg>
    )
  }

  if (name === 'user') {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <circle cx="12" cy="8" r="3.2" />
        <path d="M5.8 19c.8-3.4 3-5.2 6.2-5.2s5.4 1.8 6.2 5.2" />
      </svg>
    )
  }

  if (name === 'map') {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="m4 6 5-2 6 2 5-2v14l-5 2-6-2-5 2V6Z" />
        <path d="M9 4v14M15 6v14" />
      </svg>
    )
  }

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M17 3v5h-5" />
      <path d="M7 21v-5h5" />
      <path d="M18.5 9A7 7 0 0 0 6.9 5.2L5 7" />
      <path d="M5.5 15A7 7 0 0 0 17.1 18.8L19 17" />
    </svg>
  )
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
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일(${WEEKDAY_KO[d.getDay()]})`
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
  onEndServiceSession: _onEndServiceSession,
  onOpenCalendar,
  onOpenNotices,
  onOpenTerritory,
  reviewTasks,
  onCreateReviewTask,
  onCompleteReviewTask,
  onUncompleteReviewTask,
  onUpdateReviewTask,
  onDeleteReviewTask,
  specialPeriods,
  onOpenSettings,
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
  specialPeriods?: SpecialPeriod[]
  onOpenSettings?: () => void
}) {
  const today = todayStr()

  // ── 검토 항목 상태 ────────────────────────────────────────────
  const [reviewModal, setReviewModal] = useState<{ mode: 'add' } | { mode: 'edit'; task: ReviewTask } | null>(null)
  const [reviewTitle, setReviewTitle] = useState('')
  const [reviewContent, setReviewContent] = useState('')
  const [reviewSubmitting, setReviewSubmitting] = useState(false)
  const [reviewMenuId, setReviewMenuId] = useState<number | null>(null)
  const [showDoneHistory, setShowDoneHistory] = useState(false)
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
  const pendingCards = cards.filter((card) => card.status === '미배정')
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

  if (role === 'leader') {
    const usedCardCount = new Set(
      myTodaySessions
        .filter((session) => session.primaryCardId)
        .map((session) => session.primaryCardId as number),
    ).size
    const visibleCards = leaderCards.length > 0 ? leaderCards : []

    return (
      <div className="home-layout leader-home-layout">
        <header className="page-header">
          <div className="page-header-text">
            <h1 className="page-header-title">{formatHeader()}</h1>
          </div>
          {specialPeriods && specialPeriods.length > 0 && (
            <div className="page-header-actions">
              <SpecialPeriodBanner specialPeriods={specialPeriods} variant="inline" onClick={onOpenSettings} />
            </div>
          )}
        </header>

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
    <div className={`home-layout${role === 'user' ? ' service-home-layout' : ''}`}>
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

      {role === 'user' && (
        <header className="page-header">
          <div className="page-header-text">
            <h1 className="page-header-title">{formatHeader()}</h1>
          </div>
          {specialPeriods && specialPeriods.length > 0 && (
            <div className="page-header-actions">
              <SpecialPeriodBanner specialPeriods={specialPeriods} variant="inline" onClick={onOpenSettings} />
            </div>
          )}
        </header>
      )}

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

      {role === 'admin' && (
        <>
          {/* ── Page Head ── */}
          <header className="page-header">
            <div className="page-header-text">
              <h1 className="page-header-title">{formatHeader()}</h1>
            </div>
            {specialPeriods && specialPeriods.length > 0 && (
              <div className="page-header-actions">
                <SpecialPeriodBanner specialPeriods={specialPeriods} variant="inline" onClick={onOpenSettings} />
              </div>
            )}
          </header>

          {/* ── Content Grid 1행 ── */}
          <div className="desk-grid-12">
            {/* 오늘 운영 요약 */}
            <div className="desk-card" style={{ gridColumn: 'span 6' }}>
              <div className="desk-card__head">
                <h2 className="desk-card__title">
                  <span className="desk-card__title-dot" />
                  오늘 운영 요약
                </h2>
                <button className="desk-card__link-btn" onClick={onOpenTerritory} type="button">구역 보기 ›</button>
              </div>
              <div className="home-ops-grid">
                <div className="home-ops-stat">
                  <strong className="tnum">{todayEvents.length}</strong>
                  <span>오늘 일정</span>
                </div>
                <div className="home-ops-stat">
                  <strong className="tnum">{todaySessions.length}</strong>
                  <span>봉사 세션</span>
                </div>
                <div className="home-ops-stat">
                  <strong className="tnum">{completedUnits}<small>/{totalUnits}</small></strong>
                  <span>완료 세대</span>
                </div>
                <div className="home-ops-stat">
                  <strong className="tnum">{pendingCards.length}</strong>
                  <span>미배정 카드</span>
                </div>
              </div>
            </div>

            {/* 검토 필요 */}
            <div className="desk-card" style={{ gridColumn: 'span 6' }}>
              <div className="desk-card__head">
                <h2 className="desk-card__title">
                  <span className="desk-card__title-dot" style={{ background: 'var(--warning-500)' }} />
                  검토 필요
                  {visibleTasks.filter(t => t.status === 'pending').length > 0 && (
                    <span style={{ marginLeft: 6, padding: '1px 7px', borderRadius: 'var(--radius-full)', background: 'var(--warning-100)', color: 'var(--warning-700)', fontSize: 11, fontWeight: 700 }}>
                      {visibleTasks.filter(t => t.status === 'pending').length}
                    </span>
                  )}
                </h2>
                <button className="desk-card__link-btn" onClick={openAddModal} type="button">+ 추가</button>
              </div>
              <div className="home-review-list">
                {visibleTasks.length === 0 && <p className="review-empty">검토 항목이 없습니다</p>}
                {visibleTasks.map((task) => (
                  <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    {/* 카드 박스 */}
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', background: task.status === 'done' ? 'var(--gray-50)' : 'var(--bg-card)' }}>
                      <span style={{ padding: '2px 7px', borderRadius: 'var(--radius-sm)', background: task.status === 'done' ? 'var(--gray-100)' : 'var(--warning-100)', color: task.status === 'done' ? 'var(--gray-500)' : 'var(--warning-700)', fontSize: 11, fontWeight: 600, flexShrink: 0, whiteSpace: 'nowrap' }}>
                        {task.status === 'done' ? '완료' : '검토'}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <strong style={{ display: 'block', fontSize: 13, fontWeight: 600, color: task.status === 'done' ? 'var(--gray-400)' : 'var(--gray-900)', textDecoration: task.status === 'done' ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.title}</strong>
                        {task.content && <span style={{ fontSize: 12, color: 'var(--gray-500)' }}>{task.content}</span>}
                      </div>
                      {task.status === 'pending' ? (
                        <button onClick={() => onCompleteReviewTask(task.id)} style={{ padding: '3px 10px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--primary-50)', color: 'var(--primary-700)', fontSize: 12, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }} type="button">처리</button>
                      ) : (
                        <button onClick={() => onUncompleteReviewTask(task.id)} style={{ padding: '3px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)', background: 'none', color: 'var(--gray-500)', fontSize: 12, cursor: 'pointer', flexShrink: 0 }} type="button">취소</button>
                      )}
                    </div>
                    {/* 카드 밖 ⋯ 메뉴 */}
                    <div className="review-item-menu-wrap" ref={reviewMenuId === task.id ? reviewMenuRef : undefined}>
                      <button className="review-action-btn sm" onClick={() => setReviewMenuId((id) => id === task.id ? null : task.id)} type="button">⋯</button>
                      {reviewMenuId === task.id && (
                        <div className="review-dropdown-menu">
                          <button type="button" onClick={() => openEditModal(task)}>수정</button>
                          <button type="button" className="danger" onClick={() => { onDeleteReviewTask(task.id); setReviewMenuId(null) }}>삭제</button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Content Grid 2행 ── */}
          <div className="desk-grid-12">
            {/* 카드 진행 */}
            <div className="desk-card" style={{ gridColumn: 'span 7' }}>
              <div className="desk-card__head">
                <h2 className="desk-card__title">
                  <span className="desk-card__title-dot" />
                  카드 진행
                </h2>
                <button className="desk-card__link-btn" onClick={onOpenTerritory} type="button">전체보기 ›</button>
              </div>
              <div className="home-progress-list">
                {cards.slice(0, 5).map((card) => {
                  const pct = card.progress
                  const barColor = pct >= 100 ? 'var(--success-500)' : pct > 0 ? 'var(--warning-500)' : 'var(--gray-300)'
                  return (
                    <div className="home-progress-row" key={card.id}>
                      <div className="home-progress-row__info">
                        <strong>{card.name}</strong>
                        <span>{card.assignedLeader ?? '인도자 미배정'} · 세대 {card.units}</span>
                      </div>
                      <div style={{ height: 6, background: 'var(--gray-100)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: barColor, borderRadius: 'var(--radius-full)', transition: 'width 0.3s' }} />
                      </div>
                      <span className="home-progress-row__pct tnum">{pct}%</span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* 공지 */}
            <div className="desk-card" style={{ gridColumn: 'span 5' }}>
              <div className="desk-card__head">
                <h2 className="desk-card__title">
                  <span className="desk-card__title-dot" />
                  공지
                </h2>
                <button className="desk-card__link-btn" onClick={onOpenNotices} type="button">더보기 ›</button>
              </div>
              <div className="home-notice-list">
                {notices.length === 0 && <p style={{ fontSize: 13, color: 'var(--gray-400)', padding: '12px 0' }}>등록된 공지가 없습니다</p>}
                {notices.slice(0, 4).map((notice, i) => {
                  const badge =
                    notice.priority === '긴급'
                      ? { label: '긴급', bg: 'var(--danger-100)', color: 'var(--danger-700)' }
                      : notice.priority === '정보'
                        ? { label: '공지', bg: 'var(--primary-100)', color: 'var(--primary-700)' }
                        : { label: '일반', bg: 'var(--gray-100)', color: 'var(--gray-600)' }
                  return (
                    <div key={notice.id} className={`home-notice-row${i === 0 ? ' is-selected' : ''}`} onClick={onOpenNotices} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onOpenNotices()}>
                      <span style={{ padding: '2px 7px', borderRadius: 'var(--radius-sm)', background: badge.bg, color: badge.color, fontSize: 11, fontWeight: 600, flexShrink: 0, whiteSpace: 'nowrap' }}>
                        {badge.label}
                      </span>
                      <div className="home-notice-row__body">
                        <strong className="home-notice-row__title">{notice.title}</strong>
                        <span className="home-notice-row__meta">{notice.author} · {notice.createdAt.slice(0, 10)}</span>
                      </div>
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, color: 'var(--gray-400)' }}>
                        <path d="M6 3L11 8L6 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* ── 모달들 ── */}
          {showDoneHistory && (
            <div className="cal-modal-backdrop" onClick={() => setShowDoneHistory(false)}>
              <div className="cal-modal" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
                <div className="cal-modal-head">
                  <div className="cal-modal-title"><h2>완료 내역</h2></div>
                  <button className="cal-modal-close" type="button" onClick={() => setShowDoneHistory(false)}>✕</button>
                </div>
                <div className="cal-modal-body" style={{ maxHeight: 400, overflowY: 'auto' }}>
                  {allDoneTasks.length === 0 && <p style={{ color: 'var(--gray-400)', textAlign: 'center', padding: '24px 0', fontSize: 14 }}>완료된 항목이 없습니다</p>}
                  {[...allDoneTasks].sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? '')).map((task) => (
                    <div key={task.id} style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '12px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                      <strong style={{ fontSize: 14, color: 'var(--gray-900)' }}>{task.title}</strong>
                      {task.content && <p style={{ fontSize: 13, color: 'var(--gray-500)', margin: 0 }}>{task.content}</p>}
                      {task.completedAt && <em style={{ fontSize: 12, color: 'var(--gray-400)', fontStyle: 'normal' }}>완료일: {task.completedAt.slice(0, 10)}</em>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          {reviewModal && (
            <div className="cal-modal-backdrop" onClick={closeReviewModal}>
              <div className="cal-modal" style={{ maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
                <div className="cal-modal-head">
                  <div className="cal-modal-title"><h2>{reviewModal.mode === 'add' ? '검토 항목 추가' : '항목 수정'}</h2></div>
                  <button className="cal-modal-close" type="button" onClick={closeReviewModal}>✕</button>
                </div>
                <div className="cal-modal-body">
                  <div className="cal-field">
                    <label>제목 <span style={{ color: 'var(--danger-500)' }}>*</span></label>
                    <input autoFocus className="cal-input" placeholder="검토할 항목을 입력하세요" value={reviewTitle} onChange={(e) => setReviewTitle(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) handleReviewSubmit() }} />
                  </div>
                  <div className="cal-field">
                    <label>내용 <span style={{ color: 'var(--gray-400)', fontWeight: 400 }}>(선택)</span></label>
                    <textarea className="cal-input" placeholder="추가 설명을 입력하세요" rows={3} style={{ resize: 'vertical', minHeight: 72 }} value={reviewContent} onChange={(e) => setReviewContent(e.target.value)} />
                  </div>
                </div>
                <div className="cal-modal-foot">
                  <button className="cal-cancel-btn" type="button" onClick={closeReviewModal}>취소</button>
                  <button className="cal-save-btn" disabled={!reviewTitle.trim() || reviewSubmitting} type="button" onClick={handleReviewSubmit}>
                    {reviewSubmitting ? '처리 중...' : reviewModal.mode === 'add' ? '추가' : '저장'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
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
            <span className="home-section-icon home-section-icon--soft"><InlineIcon name="map" /></span>
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
            <span className="home-section-icon home-section-icon--soft"><InlineIcon name="repeat" /></span>
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
                  <span className="home-compact-meta">
                    <span><InlineIcon name="clock" /> {event.time}</span>
                    {event.place && <span><InlineIcon name="pin" /> {event.place}</span>}
                  </span>
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
                  <span><InlineIcon name="clock" /> {event.time}</span>
                  {event.place && <span><InlineIcon name="pin" /> {event.place}</span>}
                  {event.leader && <span><InlineIcon name="user" /> {event.leader}</span>}
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
