import { useEffect, useMemo, useState } from 'react'
import type { CalendarEvent, SpecialPeriod, TerritoryCard } from '../types'
import { PERIOD_COLORS } from '../types'
import { normalizeCardSearch, sortTerritoryCards } from '../utils/cardSearch'

function getCalendarDays(year: number, month: number): (number | null)[] {
  const firstDay = new Date(year, month - 1, 1).getDay()
  const daysInMonth = new Date(year, month, 0).getDate()
  const total = Math.ceil((firstDay + daysInMonth) / 7) * 7
  return Array.from({ length: total }, (_, i) => {
    const day = i - firstDay + 1
    return day >= 1 && day <= daysInMonth ? day : null
  })
}

function toDateStr(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function getWeeklyDates(startDate: string, endDate: string): string[] {
  const dates: string[] = []
  const current = new Date(startDate)
  const end = new Date(endDate)
  while (current <= end) {
    dates.push(current.toISOString().slice(0, 10))
    current.setDate(current.getDate() + 7)
  }
  return dates
}

const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']

type EventInput = { time: string; title: string; place: string; leader: string; memo: string; hasMeeting: boolean; allowApplications: boolean }
type EditDraft = EventInput

type ScopeModal =
  | { kind: 'edit'; id: number; date: string; seriesId: string; draft: EditDraft }
  | { kind: 'delete'; id: number; date: string; seriesId: string; title: string }

export function DesktopCalendar({
  currentVisitor,
  leaderNames = [],
  cards,
  events,
  onApplyToEvent,
  onAssignToEvent,
  onAssignCardToEventParticipant,
  onCreateEvent,
  onCreateRepeatEvents,
  onDeleteEvent,
  onDeleteEventSeries,
  onLinkEventsToSeries,
  onRemoveParticipant,
  onUpdateEvent,
  onUpdateEventSeries,
  onCreateSpecialPeriod,
  onDeleteSpecialPeriod,
  specialPeriods,
}: {
  currentVisitor: string
  leaderNames?: string[]
  cards: TerritoryCard[]
  events: CalendarEvent[]
  onApplyToEvent: (eventId: number) => void
  onAssignToEvent: (eventId: number, userName: string) => void
  onAssignCardToEventParticipant: (eventId: number, userName: string, cardId: number | null) => void
  onCreateEvent: (input: EventInput & { date: string }) => void
  onCreateRepeatEvents: (dates: string[], input: EventInput) => void
  onDeleteEvent: (eventId: number) => void
  onDeleteEventSeries: (seriesId: string, fromDate: string) => void
  onLinkEventsToSeries: (eventIds: number[]) => void
  onRemoveParticipant: (eventId: number, userName: string) => void
  onUpdateEvent: (eventId: number, input: EditDraft) => void
  onUpdateEventSeries: (seriesId: string, fromDate: string, input: EditDraft) => void
  onCreateSpecialPeriod: (input: { label: string; startDate: string; endDate: string; color: string }) => void
  onDeleteSpecialPeriod: (id: number) => void
  specialPeriods: SpecialPeriod[]
}) {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1)
  const [selectedDay, setSelectedDay] = useState(today.getDate())
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newDate, setNewDate] = useState(() => toDateStr(today.getFullYear(), today.getMonth() + 1, today.getDate()))
  const [newTitle, setNewTitle] = useState('오전 방문')
  const [newTime, setNewTime] = useState('10:00')
  const [newPlace, setNewPlace] = useState('')
  const [newLeader, setNewLeader] = useState('')
  const [newMemo, setNewMemo] = useState('')
  const [newHasMeeting, setNewHasMeeting] = useState(false)
  const [newAllowApplications, setNewAllowApplications] = useState(true)
  const [isRepeat, setIsRepeat] = useState(false)
  const [repeatEnd, setRepeatEnd] = useState('')
  const [editingEventId, setEditingEventId] = useState<number | null>(null)
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null)
  const [scopeModal, setScopeModal] = useState<ScopeModal | null>(null)
  const [showPeriodForm, setShowPeriodForm] = useState(false)
  const [periodLabel, setPeriodLabel] = useState('')
  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd] = useState('')
  const [periodColor, setPeriodColor] = useState(PERIOD_COLORS[0].value)

  const calendarDays = getCalendarDays(year, month)
  const selectedDateStr = toDateStr(year, month, selectedDay)
  const selectedEvents = events.filter((e) => e.date === selectedDateStr)
  const applicationEvents = selectedEvents.filter((event) => event.allowApplications)
  const allApplicants = applicationEvents.reduce((t, e) => t + e.applicants.length, 0)
  const allAssigned = applicationEvents.reduce((t, e) => t + e.assigned.length, 0)

  const prevMonth = () => {
    if (month === 1) { setYear((y) => y - 1); setMonth(12) } else setMonth((m) => m - 1)
    setSelectedDay(1); setShowCreateForm(false)
  }
  const nextMonth = () => {
    if (month === 12) { setYear((y) => y + 1); setMonth(1) } else setMonth((m) => m + 1)
    setSelectedDay(1); setShowCreateForm(false)
  }
  const goToday = () => {
    setYear(today.getFullYear()); setMonth(today.getMonth() + 1); setSelectedDay(today.getDate())
    setShowCreateForm(false)
  }

  const resetCreateForm = () => {
    setNewDate(selectedDateStr); setNewTitle('오전 방문'); setNewTime('10:00'); setNewPlace('')
    setNewLeader(''); setNewMemo(''); setNewHasMeeting(false); setNewAllowApplications(true)
    setIsRepeat(false); setRepeatEnd('')
  }

  const handleCreate = () => {
    if (!newTitle.trim()) return
    const input: EventInput = { time: newTime, title: newTitle, place: newPlace, leader: newLeader, memo: newMemo, hasMeeting: newHasMeeting, allowApplications: newAllowApplications }
    if (isRepeat && repeatEnd) {
      onCreateRepeatEvents(getWeeklyDates(newDate, repeatEnd), input)
    } else {
      onCreateEvent({ date: newDate, ...input })
    }
    setShowCreateForm(false)
    resetCreateForm()
  }

  const clearEdit = () => { setEditingEventId(null); setEditDraft(null) }
  const closeCreate = () => { setShowCreateForm(false); resetCreateForm() }
  const openCreate = () => { setNewDate(selectedDateStr); setShowCreateForm(true) }

  const repeatCount = isRepeat && repeatEnd ? getWeeklyDates(newDate, repeatEnd).length : 0

  return (
    <>
      {/* ── Scope modal (edit or delete series) ───────────────────── */}
      {scopeModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(0,0,0,0.4)', display: 'grid', placeItems: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 'var(--r-lg)', padding: '28px 32px', width: '360px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {scopeModal.kind === 'edit' && (
              <>
                <h2 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>수정 범위 선택</h2>
                <p style={{ fontSize: '13px', color: 'var(--ink-500)', margin: 0 }}>반복 시리즈 일정입니다. 어떤 범위로 수정할까요?</p>
                <button onClick={() => { onUpdateEvent(scopeModal.id, scopeModal.draft); clearEdit(); setScopeModal(null) }} style={{ padding: '12px', borderRadius: 'var(--r-md)', border: '1px solid #d1d5db', background: '#f9fafb', fontSize: '14px', fontWeight: 600, cursor: 'pointer', textAlign: 'left' }} type="button">
                  <strong style={{ display: 'block' }}>이 일정만 수정</strong>
                  <span style={{ fontSize: '12px', color: 'var(--ink-500)', fontWeight: 400 }}>{scopeModal.date} 일정만 변경됩니다</span>
                </button>
                <button onClick={() => { onUpdateEventSeries(scopeModal.seriesId, scopeModal.date, scopeModal.draft); clearEdit(); setScopeModal(null) }} style={{ padding: '12px', borderRadius: 'var(--r-md)', border: '1px solid var(--brand-700)', background: 'var(--brand-50)', fontSize: '14px', fontWeight: 600, cursor: 'pointer', textAlign: 'left' }} type="button">
                  <strong style={{ display: 'block', color: 'var(--brand-700)' }}>이후 모든 일정 수정</strong>
                  <span style={{ fontSize: '12px', color: 'var(--ink-500)', fontWeight: 400 }}>{scopeModal.date} 이후 시리즈 전체가 변경됩니다</span>
                </button>
              </>
            )}
            {scopeModal.kind === 'delete' && (
              <>
                <h2 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>삭제 범위 선택</h2>
                <p style={{ fontSize: '13px', color: 'var(--ink-500)', margin: 0 }}>반복 시리즈 일정입니다. 어떤 범위로 삭제할까요?</p>
                <button onClick={() => { onDeleteEvent(scopeModal.id); clearEdit(); setScopeModal(null) }} style={{ padding: '12px', borderRadius: 'var(--r-md)', border: '1px solid #d1d5db', background: '#f9fafb', fontSize: '14px', fontWeight: 600, cursor: 'pointer', textAlign: 'left' }} type="button">
                  <strong style={{ display: 'block' }}>이 일정만 삭제</strong>
                  <span style={{ fontSize: '12px', color: 'var(--ink-500)', fontWeight: 400 }}>{scopeModal.date} 한 건만 삭제됩니다</span>
                </button>
                <button onClick={() => { onDeleteEventSeries(scopeModal.seriesId, scopeModal.date); clearEdit(); setScopeModal(null) }} style={{ padding: '12px', borderRadius: 'var(--r-md)', border: '1px solid var(--danger-600)', background: '#fef2f2', fontSize: '14px', fontWeight: 600, cursor: 'pointer', textAlign: 'left' }} type="button">
                  <strong style={{ display: 'block', color: 'var(--danger-600)' }}>이후 반복 일정 모두 삭제</strong>
                  <span style={{ fontSize: '12px', color: 'var(--ink-500)', fontWeight: 400 }}>{scopeModal.date} 이후 같은 시리즈 전체가 삭제됩니다</span>
                </button>
              </>
            )}
            <button onClick={() => setScopeModal(null)} style={{ padding: '8px', borderRadius: 'var(--r-md)', border: 'none', background: 'none', color: 'var(--ink-500)', fontSize: '13px', cursor: 'pointer' }} type="button">취소</button>
          </div>
        </div>
      )}

      {/* ── Create event modal ───────────────────── */}
      {showCreateForm && (
        <div className="cal-modal-backdrop" onClick={closeCreate}>
          <div className="cal-modal" onClick={(e) => e.stopPropagation()}>
            <div className="cal-modal-head">
              <div className="cal-modal-title">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                <h2>새 일정 추가</h2>
              </div>
              <button className="cal-modal-close" onClick={closeCreate} type="button">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className="cal-modal-body">
              <div className="cal-field-row">
                <div className="cal-field">
                  <label>날짜 *</label>
                  <input className="cal-input" type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
                </div>
                <div className="cal-field">
                  <label>시간 *</label>
                  <input className="cal-input" type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)} />
                </div>
              </div>
              <div className="cal-field">
                <label>제목 *</label>
                <input className="cal-input" placeholder="오전 방문" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
              </div>
              <div className="cal-field">
                <label>장소</label>
                <input className="cal-input" placeholder="모임 장소를 입력하세요" value={newPlace} onChange={(e) => setNewPlace(e.target.value)} />
              </div>
              <div className="cal-field">
                <label>인도자</label>
                <input className="cal-input" placeholder="이름" list="cal-leader-list" value={newLeader} onChange={(e) => setNewLeader(e.target.value)} />
                {leaderNames.length > 0 && (
                  <datalist id="cal-leader-list">
                    {leaderNames.map((name) => <option key={name} value={name} />)}
                  </datalist>
                )}
              </div>
              <div className="cal-field">
                <label>상세설명 (선택사항)</label>
                <textarea className="cal-textarea" placeholder="봉사 전에 알아야 할 내용, 지도 링크, 주의사항 등을 적어주세요" value={newMemo} onChange={(e) => setNewMemo(e.target.value)} />
              </div>
              <label className="cal-check-label">
                <input type="checkbox" checked={newHasMeeting} onChange={(e) => setNewHasMeeting(e.target.checked)} />
                봉사 모임 있음
              </label>
              <label className="cal-check-label">
                <input type="checkbox" checked={newAllowApplications} onChange={(e) => setNewAllowApplications(e.target.checked)} />
                이 일정에 봉사 신청을 받습니다
              </label>
              <label className="cal-check-label">
                <input type="checkbox" checked={isRepeat} onChange={(e) => setIsRepeat(e.target.checked)} />
                매주 반복 ({WEEKDAY_LABELS[new Date(newDate).getDay()]}요일)
              </label>
              {isRepeat && (
                <div className="cal-repeat-range">
                  <div className="cal-field">
                    <label>반복 종료일</label>
                    <input className="cal-input" type="date" value={repeatEnd} min={newDate} onChange={(e) => setRepeatEnd(e.target.value)} />
                  </div>
                  {repeatEnd && <small className="cal-repeat-hint">{repeatCount}개 일정 생성 예정</small>}
                </div>
              )}
            </div>

            <div className="cal-modal-foot">
              <button className="cal-cancel-btn" onClick={closeCreate} type="button">취소</button>
              <button className="cal-save-btn" onClick={handleCreate} type="button">
                {isRepeat && repeatEnd ? `${repeatCount}개 일정 저장` : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}

      <section className="desktop-content calendar-layout">
        <div className="calendar-pane">
          <div className="calendar-toolbar">
            <div>
              <p>운영 캘린더</p>
              <h1>{year}년 {month}월</h1>
            </div>
            <div className="toolbar-actions">
              <button type="button">신청내역</button>
              <button type="button">일괄 업로드</button>
              <button onClick={prevMonth} type="button">←</button>
              <button onClick={goToday} type="button">오늘</button>
              <button onClick={nextMonth} type="button">→</button>
            </div>
          </div>

          {/* ── Special period management ── */}
          <div style={{ padding: '6px 16px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', minHeight: '40px' }}>
            {specialPeriods.map((p) => (
              <span key={p.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px 2px 4px', borderRadius: '999px', background: p.color + '20', border: `1px solid ${p.color}60`, fontSize: '12px', fontWeight: 600, color: p.color }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '999px', background: p.color, flexShrink: 0 }} />
                {p.label} · {p.startDate.slice(5)} ~ {p.endDate.slice(5)}
                <button onClick={() => onDeleteSpecialPeriod(p.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: p.color, fontWeight: 700, fontSize: '13px', lineHeight: 1, padding: '0 1px' }} type="button">×</button>
              </span>
            ))}
            {!showPeriodForm && (
              <button onClick={() => setShowPeriodForm(true)} style={{ padding: '2px', border: 'none', background: 'none', color: '#9ca3af', cursor: 'pointer', display: 'grid', placeItems: 'center' }} title="특별기간 추가" type="button">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"><path d="M12.127 22H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v5.125"/><path d="M14.62 18.8A2.25 2.25 0 1 1 18 15.836a2.25 2.25 0 1 1 3.38 2.966l-2.626 2.856a.998.998 0 0 1-1.507 0zM16 2v4M3 10h18M8 2v4"/></g></svg>
              </button>
            )}
            {showPeriodForm && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <input placeholder="기간 이름" value={periodLabel} onChange={(e) => setPeriodLabel(e.target.value)} style={{ padding: '3px 8px', borderRadius: 'var(--r-sm)', border: '1px solid #d1d5db', fontSize: '12px', width: '100px' }} />
                <input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} style={{ padding: '3px 6px', borderRadius: 'var(--r-sm)', border: '1px solid #d1d5db', fontSize: '12px' }} />
                <span style={{ fontSize: '12px', color: '#9ca3af' }}>~</span>
                <input type="date" value={periodEnd} min={periodStart} onChange={(e) => setPeriodEnd(e.target.value)} style={{ padding: '3px 6px', borderRadius: 'var(--r-sm)', border: '1px solid #d1d5db', fontSize: '12px' }} />
                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                  {PERIOD_COLORS.map((c) => (
                    <button key={c.value} onClick={() => setPeriodColor(c.value)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'grid', placeItems: 'center', opacity: periodColor === c.value ? 1 : 0.45, transition: 'opacity 0.15s' }} type="button" title={c.label}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill={c.value}>
                        <path d="M4 12a8 8 0 1 1 16 0a8 8 0 0 1-16 0" />
                      </svg>
                    </button>
                  ))}
                </div>
                <button disabled={!periodLabel.trim() || !periodStart || !periodEnd} onClick={() => { onCreateSpecialPeriod({ label: periodLabel.trim(), startDate: periodStart, endDate: periodEnd, color: periodColor }); setPeriodLabel(''); setPeriodStart(''); setPeriodEnd(''); setShowPeriodForm(false) }} style={{ padding: '3px 10px', borderRadius: 'var(--r-sm)', border: 'none', background: 'var(--ink-900)', color: '#fff', fontSize: '12px', cursor: 'pointer' }} type="button">저장</button>
                <button onClick={() => setShowPeriodForm(false)} style={{ padding: '3px 8px', borderRadius: 'var(--r-sm)', border: '1px solid #e5e7eb', background: 'none', fontSize: '12px', cursor: 'pointer' }} type="button">취소</button>
              </div>
            )}
          </div>

          <div className="calendar-grid" aria-label={`${year}년 ${month}월 일정`}>
            {['일', '월', '화', '수', '목', '금', '토'].map((weekDay) => (
              <div className="weekday-cell" key={weekDay}>{weekDay}</div>
            ))}
            {calendarDays.map((day, index) => {
              const dayStr = day ? toDateStr(year, month, day) : null
              const dayEvents = dayStr ? events.filter((e) => e.date === dayStr) : []
              const activePeriod = dayStr ? specialPeriods.find((p) => dayStr >= p.startDate && dayStr <= p.endDate) : null
              const isPeriodStart = activePeriod && dayStr === activePeriod.startDate
              return (
                <button
                  className={['day-cell', day === selectedDay ? 'selected' : '', !day ? 'muted' : ''].join(' ')}
                  disabled={!day}
                  key={`${day ?? 'blank'}-${index}`}
                  onClick={() => { if (day) { setSelectedDay(day); setShowCreateForm(false) } }}
                  type="button"
                >
                  {activePeriod && <span className="period-band" style={{ background: activePeriod.color }} />}
                  <div className="day-head">
                    <span className="day-number">
                      {day ?? ''}
                    </span>
                    {isPeriodStart && <small className="period-start-label" style={{ background: activePeriod.color }}>{activePeriod.label}</small>}
                  </div>
                  <div className="day-events">
                    {dayEvents.slice(0, 3).map((event) => (
                      <small className={`event-pill${event.hasMeeting ? ' has-meeting' : ''}`} key={event.id}>
                        {event.time} {event.title}
                      </small>
                    ))}
                    {dayEvents.length > 3 && <em>+{dayEvents.length - 3}개 더</em>}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        <aside className="detail-pane" aria-label={`${selectedDay}일 일정 상세`}>
          <div className="detail-header">
            <p>{month}월 {selectedDay}일 일정</p>
            {applicationEvents.length > 0 && <strong>신청 {allApplicants}명 · 배정 {allAssigned}명</strong>}
          </div>

          <div className="detail-body">
            {selectedEvents.length === 0 && (
              <div className="cal-empty-state">
                <svg xmlns="http://www.w3.org/2000/svg" width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                <h3>{month}월 {selectedDay}일 일정이 없습니다</h3>
                <p>새로운 일정을 추가해보세요</p>
              </div>
            )}

            <div className="detail-stack">
              {selectedEvents.map((event) => {
                const isApplied = event.applicants.includes(currentVisitor)
                const isAssigned = event.assigned.includes(currentVisitor)
                const isEditing = editingEventId === event.id

                if (isEditing && editDraft) {
                  return (
                    <EditCard
                      key={event.id}
                      draft={editDraft}
                      event={event}
                      events={events}
                      leaderNames={leaderNames}
                      onClearEdit={clearEdit}
                      onDelete={(id) => {
                        if (event.seriesId) {
                          setScopeModal({ kind: 'delete', id, date: event.date, seriesId: event.seriesId, title: event.title })
                        } else if (confirm(`"${event.title}" 일정을 삭제할까요?`)) {
                          onDeleteEvent(id); clearEdit()
                        }
                      }}
                      onLinkEventsToSeries={onLinkEventsToSeries}
                      onSave={(id, draft) => {
                        if (!draft.title.trim()) return
                        if (event.seriesId) {
                          setScopeModal({ kind: 'edit', id, date: event.date, seriesId: event.seriesId, draft })
                        } else {
                          onUpdateEvent(id, draft); clearEdit()
                        }
                      }}
                      setDraft={setEditDraft}
                    />
                  )
                }

                return (
                  <article className="detail-card" key={event.id}>
                    <div className="detail-title-row">
                      <div className="detail-title-main">
                        <h2>{event.title}</h2>
                        {event.card && <span className="event-card-badge">{event.card}</span>}
                        {event.hasMeeting && <span className="event-meeting-tag">봉사모임</span>}
                        {!event.allowApplications && <span className="event-closed-tag">신청 받지 않음</span>}
                      </div>
                      <button
                        className="edit-btn"
                        onClick={() => {
                          setEditingEventId(event.id)
                          setEditDraft({ time: event.time, title: event.title, place: event.place, leader: event.leader, memo: event.memo, hasMeeting: event.hasMeeting, allowApplications: event.allowApplications })
                        }}
                        type="button"
                      >
                        편집
                      </button>
                    </div>

                    <div className="event-meta-row">
                      <span>⏰ {event.time}</span>
                      {event.place && <span>📍 {event.place}</span>}
                      {event.leader && <span>👤 {event.leader}</span>}
                    </div>

                    {event.allowApplications && (
                      <div className="assignment-box">
                        <div className="box-heading">
                          <strong>신청자 {event.applicants.length > 0 && <em>{event.applicants.length}명</em>}</strong>
                          <div>
                            <button className={`apply-btn${isApplied ? ' applied' : ''}`} onClick={() => onApplyToEvent(event.id)} type="button">
                              {isApplied ? '신청취소' : '신청'}
                            </button>
                            <button className={`assign-btn${isAssigned ? ' assigned' : ''}`} onClick={() => onAssignToEvent(event.id, currentVisitor)} type="button">
                              임명
                            </button>
                          </div>
                        </div>
                        <div className="person-chips">
                          {event.applicants.map((person) => {
                            const cardAssignment = event.cardAssignments.find((assignment) => assignment.userName === person)
                            return (
                              <span className={event.assigned.includes(person) ? 'assigned event-person-chip' : 'event-person-chip'} key={person}>
                                <strong className="event-person-name">{person}</strong>
                                <EventCardAssignSearch
                                  assignedCardId={cardAssignment?.assignedCardId ?? null}
                                  cards={cards}
                                  eventId={event.id}
                                  onAssign={onAssignCardToEventParticipant}
                                  person={person}
                                />
                                <button className="chip-remove" onClick={() => onRemoveParticipant(event.id, person)} type="button">×</button>
                              </span>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {event.memo && <p className="event-memo">{event.memo}</p>}
                  </article>
                )
              })}
            </div>
          </div>

          <div className="cal-pane-footer">
            <button className="cal-add-btn" onClick={openCreate} type="button">
              + 일정 추가
            </button>
          </div>
        </aside>
      </section>
    </>
  )
}

function EventCardAssignSearch({
  assignedCardId,
  cards,
  eventId,
  onAssign,
  person,
}: {
  assignedCardId: number | null
  cards: TerritoryCard[]
  eventId: number
  onAssign: (eventId: number, userName: string, cardId: number | null) => void
  person: string
}) {
  const assignedCard = assignedCardId ? cards.find((card) => card.id === assignedCardId) : undefined
  const [query, setQuery] = useState(assignedCard?.name ?? '')
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    setQuery(assignedCard?.name ?? '')
  }, [assignedCard?.name])

  const filteredCards = useMemo(() => {
    const normalizedQuery = normalizeCardSearch(query)
    if (!normalizedQuery) return []
    return sortTerritoryCards(cards
      .filter((card) => {
        const haystack = normalizeCardSearch(`${card.name}${card.region}${card.area}`)
        return haystack.includes(normalizedQuery)
      }))
  }, [cards, query])

  const selectCard = (card: TerritoryCard) => {
    onAssign(eventId, person, card.id)
    setQuery(card.name)
    setIsOpen(false)
  }

  return (
    <div className="event-card-assign-search">
      <div className="event-card-assign-input-row">
        <input
          aria-label={`${person} 배정 카드 검색`}
          onBlur={() => window.setTimeout(() => setIsOpen(false), 120)}
          onChange={(event) => {
            setQuery(event.target.value)
            setIsOpen(true)
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && filteredCards[0]) {
              event.preventDefault()
              selectCard(filteredCards[0])
            }
            if (event.key === 'Escape') setIsOpen(false)
          }}
          placeholder="카드 검색"
          value={query}
        />
        {assignedCard && (
          <button
            aria-label={`${person} 카드 배정 해제`}
            className="event-card-clear-btn"
            onClick={() => {
              onAssign(eventId, person, null)
              setQuery('')
              setIsOpen(false)
            }}
            type="button"
          >
            해제
          </button>
        )}
      </div>
      {isOpen && query && !assignedCardId && (
        <div className="event-card-assign-results">
          {filteredCards.length === 0 && <div className="event-card-empty-result">검색 결과 없음</div>}
          {filteredCards.length > 0 && <div className="event-card-empty-result">검색 결과 {filteredCards.length}개</div>}
          {filteredCards.map((card) => (
            <button key={card.id} onMouseDown={() => selectCard(card)} type="button">
              <strong>{card.name}</strong>
              <small>{card.region} · {card.area}</small>
            </button>
          ))}
        </div>
      )}
      {isOpen && query && assignedCardId && query !== assignedCard?.name && (
        <div className="event-card-assign-results">
          {filteredCards.length === 0 && <div className="event-card-empty-result">검색 결과 없음</div>}
          {filteredCards.length > 0 && <div className="event-card-empty-result">검색 결과 {filteredCards.length}개</div>}
          {filteredCards.map((card) => (
            <button key={card.id} onMouseDown={() => selectCard(card)} type="button">
              <strong>{card.name}</strong>
              <small>{card.region} · {card.area}</small>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function EditCard({
  draft,
  event,
  events,
  leaderNames = [],
  onClearEdit,
  onDelete,
  onLinkEventsToSeries,
  onSave,
  setDraft,
}: {
  draft: EditDraft
  event: CalendarEvent
  events: CalendarEvent[]
  leaderNames?: string[]
  onClearEdit: () => void
  onDelete: (id: number) => void
  onLinkEventsToSeries: (ids: number[]) => void
  onSave: (id: number, draft: EditDraft) => void
  setDraft: (d: EditDraft) => void
}) {
  const eventWeekday = new Date(event.date).getDay()

  const linkableIds = useMemo(() => {
    if (event.seriesId) return []
    return events
      .filter((e) => e.title === event.title && new Date(e.date).getDay() === eventWeekday && !e.seriesId)
      .map((e) => e.id)
  }, [event, events, eventWeekday])

  return (
    <article className="detail-card">
      <div className="detail-title-row">
        <div>
          <h2>일정 편집</h2>
          <span style={{ fontSize: '13px', color: 'var(--ink-500)' }}>{event.date}</span>
        </div>
        <button className="edit-btn" onClick={onClearEdit} type="button">취소</button>
      </div>

      {event.seriesId && (
        <div style={{ marginBottom: '12px', padding: '6px 10px', background: 'var(--brand-50)', borderRadius: 'var(--r-md)', fontSize: '12px', color: 'var(--brand-700)' }}>
          반복 시리즈 일정 — 저장 또는 삭제 시 범위를 선택할 수 있습니다
        </div>
      )}

      {!event.seriesId && linkableIds.length > 1 && (
        <div style={{ marginBottom: '12px', padding: '8px 10px', background: 'var(--accent-100)', borderRadius: 'var(--r-md)', fontSize: '12px', color: 'var(--accent-700)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>같은 제목의 일정 {linkableIds.length}개 발견</span>
          <button onClick={() => onLinkEventsToSeries(linkableIds)} style={{ fontSize: '12px', padding: '3px 10px', borderRadius: 'var(--r-sm)', border: '1px solid var(--accent-700)', background: '#fff', color: 'var(--accent-700)', cursor: 'pointer' }} type="button">
            시리즈로 묶기
          </button>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div className="cal-field">
          <label>제목</label>
          <input className="cal-input" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
        </div>
        <div className="cal-field-row">
          <div className="cal-field">
            <label>시간</label>
            <input className="cal-input" type="time" value={draft.time} onChange={(e) => setDraft({ ...draft, time: e.target.value })} />
          </div>
          <div className="cal-field">
            <label>장소</label>
            <input className="cal-input" value={draft.place} onChange={(e) => setDraft({ ...draft, place: e.target.value })} />
          </div>
        </div>
        <div className="cal-field">
          <label>인도자</label>
          <input className="cal-input" list="cal-leader-list-edit" value={draft.leader} onChange={(e) => setDraft({ ...draft, leader: e.target.value })} />
          {leaderNames.length > 0 && (
            <datalist id="cal-leader-list-edit">
              {leaderNames.map((name) => <option key={name} value={name} />)}
            </datalist>
          )}
        </div>
        <div className="cal-field">
          <label>상세설명 (선택사항)</label>
          <textarea className="cal-textarea" placeholder="봉사 전에 알아야 할 내용, 지도 링크, 주의사항 등을 적어주세요" value={draft.memo} onChange={(e) => setDraft({ ...draft, memo: e.target.value })} />
        </div>
        <label className="cal-check-label">
          <input type="checkbox" checked={draft.hasMeeting} onChange={(e) => setDraft({ ...draft, hasMeeting: e.target.checked })} />
          봉사 모임 있음
        </label>
        <label className="cal-check-label">
          <input type="checkbox" checked={draft.allowApplications} onChange={(e) => setDraft({ ...draft, allowApplications: e.target.checked })} />
          이 일정에 봉사 신청을 받습니다
        </label>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
        <button className="cal-save-btn" onClick={() => onSave(event.id, draft)} type="button">저장</button>
        <button className="danger-action" onClick={() => onDelete(event.id)} style={{ borderRadius: '999px', minHeight: '48px', padding: '0 20px' }} type="button">삭제</button>
      </div>
    </article>
  )
}
