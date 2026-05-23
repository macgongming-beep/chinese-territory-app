import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { CalendarEvent, Role } from '../types'
import type { AppLanguage } from '../i18n'
import { t } from '../i18n'
import { ChatRoom } from './ChatRoom'
import { CommentSection, type MentionUser } from './CommentSection'

const WEEKDAYS: Record<AppLanguage, string[]> = {
  ko: ['일', '월', '화', '수', '목', '금', '토'],
  zh: ['日', '一', '二', '三', '四', '五', '六'],
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
}

const WEEKDAY_LABELS: Record<AppLanguage, string[]> = {
  ko: ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'],
  zh: ['周日', '周一', '周二', '周三', '周四', '周五', '周六'],
  en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
}

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

function formatMonthTitle(language: AppLanguage, year: number, month: number) {
  if (language === 'en') {
    return new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' }).format(new Date(year, month - 1, 1))
  }
  return language === 'zh' ? `${year}年 ${month}月` : `${year}년 ${month}월`
}

function formatSelectedDate(language: AppLanguage, year: number, month: number, day: number, weekday: string) {
  if (language === 'en') return `${new Intl.DateTimeFormat('en', { month: 'long' }).format(new Date(year, month - 1, day))} ${day} (${weekday})`
  return language === 'zh' ? `${month}月 ${day}日（${weekday}）` : `${month}월 ${day}일 (${weekday})`
}

type EventInput = { time: string; title: string; place: string; mapLink?: string; leader: string; memo: string; hasMeeting: boolean; allowApplications: boolean }

function CalMiniIcon({ name }: { name: 'place' | 'leader' | 'users' }) {
  if (name === 'place') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 21s6-5.4 6-11a6 6 0 0 0-12 0c0 5.6 6 11 6 11Z" />
        <circle cx="12" cy="10" r="2.2" />
      </svg>
    )
  }
  if (name === 'leader') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="8" r="4" />
        <path d="M4.5 21a7.5 7.5 0 0 1 15 0" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="9" cy="8" r="3.3" />
      <path d="M3.5 20a5.5 5.5 0 0 1 11 0" />
      <path d="M15.5 11.2a3 3 0 1 0-1.2-5.8" />
      <path d="M17 20a5 5 0 0 0-3-4.6" />
    </svg>
  )
}

export function MobileCalendar({
  language,
  currentVisitor,
  currentUserId,
  leaderNames = [],
  leaderPhones = {},
  events,
  role = 'user',
  allUserNames = [],
  mentionUsers = [],
  onApplyToEvent,
  onAddParticipant,
  onCreateEvent,
  onDeleteEvent,
  onUpdateEvent,
}: {
  language: AppLanguage
  currentVisitor: string
  currentUserId?: number | null
  leaderNames?: string[]
  leaderPhones?: Record<string, string | null | undefined>
  events: CalendarEvent[]
  role?: Role
  allUserNames?: string[]
  mentionUsers?: MentionUser[]
  onApplyToEvent: (eventId: number) => void
  onAddParticipant?: (eventId: number, userName: string) => void
  onCreateEvent?: (input: EventInput & { date: string }) => void
  onDeleteEvent?: (id: number) => void
  onUpdateEvent?: (id: number, input: EventInput) => void
}) {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1)
  const [selectedDay, setSelectedDay] = useState(today.getDate())
  const [searchParams, setSearchParams] = useSearchParams()
  const [chatEvent, setChatEvent] = useState<CalendarEvent | null>(null)
  const [deleteConfirmEvent, setDeleteConfirmEvent] = useState<CalendarEvent | null>(null)

  // openChat=<eventId> 쿼리 처리: 해당 일정 날짜로 이동 + 채팅방 열기
  useEffect(() => {
    const openChatId = searchParams.get('openChat')
    if (!openChatId) return
    const targetEvent = events.find((ev) => ev.id === Number(openChatId))
    if (!targetEvent) return

    const d = new Date(targetEvent.date)
    setYear(d.getFullYear())
    setMonth(d.getMonth() + 1)
    setSelectedDay(d.getDate())
    setChatEvent(targetEvent)

    setTimeout(() => {
      const el = document.getElementById(`mobile-event-card-${openChatId}`)
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 200)

    const next = new URLSearchParams(searchParams)
    next.delete('openChat')
    setSearchParams(next, { replace: true })
  }, [events, searchParams, setSearchParams])

  // create form
  const [showCreate, setShowCreate] = useState(false)
  const [newDate, setNewDate] = useState(() => toDateStr(today.getFullYear(), today.getMonth() + 1, today.getDate()))
  const [newTime, setNewTime] = useState('')
  const [newTitle, setNewTitle] = useState('')
  const [newPlace, setNewPlace] = useState('')
  const [newMapLink, setNewMapLink] = useState('')
  const [newLeader, setNewLeader] = useState('')
  const [newMemo, setNewMemo] = useState('')
  const [newHasMeeting, setNewHasMeeting] = useState(false)
  const [newAllowApplications, setNewAllowApplications] = useState(true)

  // edit form
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editDraft, setEditDraft] = useState<EventInput | null>(null)

  // 수동 참가자 추가
  const [addParticipantEventId, setAddParticipantEventId] = useState<number | null>(null)
  const [addParticipantQuery, setAddParticipantQuery] = useState('')

  const isAdmin = role === 'admin'
  const canManageParticipants = role === 'admin' || role === 'leader'

  const calendarDays = getCalendarDays(year, month)
  const selectedDateStr = toDateStr(year, month, selectedDay)
  const weekdays = WEEKDAYS[language]
  const weekdayLabels = WEEKDAY_LABELS[language]
  const selectedEvents = events
    .filter((e) => e.date === selectedDateStr)
    .sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'))

  const prevMonth = () => {
    if (month === 1) { setYear(y => y - 1); setMonth(12) } else setMonth(m => m - 1)
    setSelectedDay(1)
  }
  const nextMonth = () => {
    if (month === 12) { setYear(y => y + 1); setMonth(1) } else setMonth(m => m + 1)
    setSelectedDay(1)
  }

  const openCreate = () => {
    setNewDate(selectedDateStr)
    setNewTitle('')
    setNewTime('')
    setNewPlace('')
    setNewMapLink('')
    setNewLeader('')
    setNewMemo('')
    setNewHasMeeting(false)
    setNewAllowApplications(true)
    setShowCreate(true)
  }

  const handleCreate = () => {
    if (!newTitle.trim() || !onCreateEvent) return
    onCreateEvent({ date: newDate, time: newTime, title: newTitle, place: newPlace, mapLink: newMapLink, leader: newLeader, memo: newMemo, hasMeeting: newHasMeeting, allowApplications: newAllowApplications })
    setShowCreate(false)
  }

  const startEdit = (event: CalendarEvent) => {
    setEditingId(event.id)
    setEditDraft({ time: event.time, title: event.title, place: event.place, mapLink: event.mapLink ?? '', leader: event.leader, memo: event.memo, hasMeeting: event.hasMeeting, allowApplications: event.allowApplications })
  }

  const handleUpdate = () => {
    if (!editDraft || !editingId || !onUpdateEvent) return
    onUpdateEvent(editingId, editDraft)
    setEditingId(null)
    setEditDraft(null)
  }

  return (
    <div className="mobile-calendar-shell">
      {/* ── Create sheet ── */}
      {showCreate && (
        <>
          <div className="mobile-sheet-backdrop" onClick={() => setShowCreate(false)} />
          <div className="mobile-sheet">
            <div className="mobile-sheet-handle" />
            <div className="mobile-sheet-title">
              <h2>{t(language, 'calendar.newEvent')}</h2>
              <button className="mobile-sheet-close" onClick={() => setShowCreate(false)} type="button">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className="mobile-form-field">
              <label>{t(language, 'calendar.eventTitleRequired')}</label>
              <input placeholder={t(language, 'calendar.eventTitlePlaceholder')} value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
            </div>
            <div className="mobile-form-field">
              <label>{t(language, 'calendar.description')}</label>
              <textarea placeholder={t(language, 'calendar.descriptionPlaceholder')} value={newMemo} onChange={(e) => setNewMemo(e.target.value)} />
            </div>
            <div className="mobile-form-row">
              <div className="mobile-form-field">
                <label>{t(language, 'calendar.dateRequired')}</label>
                <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
              </div>
              <div className="mobile-form-field">
                <label>{t(language, 'calendar.time')}</label>
                <input type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)} />
              </div>
            </div>
            <div className="mobile-form-row">
              <div className="mobile-form-field">
                <label>{t(language, 'calendar.place')}</label>
                <input placeholder={t(language, 'calendar.placePlaceholder')} value={newPlace} onChange={(e) => setNewPlace(e.target.value)} />
              </div>
              <div className="mobile-form-field">
                <label>{t(language, 'calendar.mapLink')}</label>
                <input inputMode="url" placeholder={t(language, 'calendar.mapLinkPlaceholder')} value={newMapLink} onChange={(e) => setNewMapLink(e.target.value)} />
              </div>
            </div>
            <div className="mobile-form-field">
              <label>{t(language, 'calendar.leader')}</label>
              <select value={newLeader} onChange={(e) => setNewLeader(e.target.value)}>
                <option value="">{t(language, 'common.none')}</option>
                {leaderNames.map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
            </div>
            <label className="mobile-form-check">
              <input type="checkbox" checked={newHasMeeting} onChange={(e) => setNewHasMeeting(e.target.checked)} />
              {t(language, 'calendar.hasMeeting')}
            </label>
            <label className="mobile-form-check">
              <input type="checkbox" checked={newAllowApplications} onChange={(e) => setNewAllowApplications(e.target.checked)} />
              {t(language, 'calendar.allowApplications')}
            </label>
            <button className="mobile-form-save" disabled={!newTitle.trim()} onClick={handleCreate} type="button">{t(language, 'common.save')}</button>
            <button className="mobile-form-cancel" onClick={() => setShowCreate(false)} type="button">{t(language, 'common.cancel')}</button>
          </div>
        </>
      )}

      {/* ── Edit sheet ── */}
      {editingId && editDraft && (
        <>
          <div className="mobile-sheet-backdrop" onClick={() => setEditingId(null)} />
          <div className="mobile-sheet">
            <div className="mobile-sheet-handle" />
            <div className="mobile-sheet-title">
              <h2>{t(language, 'calendar.editEvent')}</h2>
              <button className="mobile-sheet-close" onClick={() => setEditingId(null)} type="button">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className="mobile-form-row">
              <div className="mobile-form-field">
                <label>{t(language, 'calendar.date')}</label>
                <input disabled type="date" value={events.find((event) => event.id === editingId)?.date ?? selectedDateStr} />
              </div>
              <div className="mobile-form-field">
                <label>{t(language, 'calendar.time')}</label>
                <input type="time" value={editDraft.time} onChange={(e) => setEditDraft({ ...editDraft, time: e.target.value })} />
              </div>
            </div>
            <div className="mobile-form-field">
              <label>{t(language, 'calendar.eventTitle')}</label>
              <input placeholder={t(language, 'calendar.eventTitlePlaceholder')} value={editDraft.title} onChange={(e) => setEditDraft({ ...editDraft, title: e.target.value })} />
            </div>
            <div className="mobile-form-field">
              <label>{t(language, 'calendar.description')}</label>
              <textarea placeholder={t(language, 'calendar.descriptionPlaceholder')} value={editDraft.memo} onChange={(e) => setEditDraft({ ...editDraft, memo: e.target.value })} />
            </div>
            <div className="mobile-form-row">
              <div className="mobile-form-field">
                <label>{t(language, 'calendar.place')}</label>
                <input placeholder={t(language, 'calendar.placePlaceholder')} value={editDraft.place} onChange={(e) => setEditDraft({ ...editDraft, place: e.target.value })} />
              </div>
              <div className="mobile-form-field">
                <label>{t(language, 'calendar.mapLink')}</label>
                <input inputMode="url" placeholder={t(language, 'calendar.mapLinkPlaceholder')} value={editDraft.mapLink ?? ''} onChange={(e) => setEditDraft({ ...editDraft, mapLink: e.target.value })} />
              </div>
            </div>
            <div className="mobile-form-field">
              <label>{t(language, 'calendar.leader')}</label>
              <select value={editDraft.leader} onChange={(e) => setEditDraft({ ...editDraft, leader: e.target.value })}>
                <option value="">{t(language, 'common.none')}</option>
                {leaderNames.map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
            </div>
            <label className="mobile-form-check">
              <input type="checkbox" checked={editDraft.hasMeeting} onChange={(e) => setEditDraft({ ...editDraft, hasMeeting: e.target.checked })} />
              {t(language, 'calendar.hasMeeting')}
            </label>
            <label className="mobile-form-check">
              <input type="checkbox" checked={editDraft.allowApplications} onChange={(e) => setEditDraft({ ...editDraft, allowApplications: e.target.checked })} />
              {t(language, 'calendar.allowApplications')}
            </label>
            <button className="mobile-form-save" onClick={handleUpdate} type="button">{t(language, 'common.save')}</button>
            <button className="mobile-form-cancel" onClick={() => setEditingId(null)} type="button">{t(language, 'common.cancel')}</button>
          </div>
        </>
      )}

      {/* 월 헤더 */}
      <div className="mobile-cal-header">
        <button onClick={prevMonth} type="button">‹</button>
        <h1>{formatMonthTitle(language, year, month)}</h1>
        <button onClick={() => { setYear(today.getFullYear()); setMonth(today.getMonth() + 1); setSelectedDay(today.getDate()) }} type="button">{t(language, 'calendar.today')}</button>
        <button onClick={nextMonth} type="button">›</button>
      </div>

      {/* 요일 헤더 + 날짜 그리드 */}
      <div className="mobile-cal-grid">
        {weekdays.map((w) => (
          <div className="mobile-cal-weekday" key={w}>{w}</div>
        ))}
        {calendarDays.map((day, idx) => {
          const dayStr = day ? toDateStr(year, month, day) : null
          const dayEvents = dayStr ? events.filter(e => e.date === dayStr) : []
          const isToday = day === today.getDate() && month === today.getMonth() + 1 && year === today.getFullYear()
          const isSelected = day === selectedDay
          const isSun = idx % 7 === 0
          const isSat = idx % 7 === 6
          return (
            <button
              className={['mobile-cal-day', !day ? 'empty' : '', isSelected ? 'selected' : ''].join(' ')}
              disabled={!day}
              key={`${day ?? 'x'}-${idx}`}
              onClick={() => { if (day) setSelectedDay(day) }}
              type="button"
            >
              {day && (
                <>
                  <span className={['mobile-cal-daynum', isToday ? 'today' : '', isSun ? 'sun' : isSat ? 'sat' : ''].join(' ')}>{day}</span>
                  {dayEvents.length > 0 && (
                    <div className="mobile-cal-dots">
                      {dayEvents.slice(0, 4).map((e) => (
                        <span className="mobile-cal-dot" key={e.id} style={{ background: e.hasMeeting ? 'var(--brand-700)' : '#9ca3af' }} />
                      ))}
                    </div>
                  )}
                </>
              )}
            </button>
          )
        })}
      </div>

      {/* 선택된 날짜 일정 */}
      <div className="mobile-cal-detail">
        <div className="mobile-cal-detail-head">
          <p className="mobile-cal-detail-title">
            {formatSelectedDate(language, year, month, selectedDay, weekdayLabels[new Date(selectedDateStr).getDay()])}
            {selectedEvents.length > 0 && <span>{selectedEvents.length}{t(language, 'calendar.countSuffix')}</span>}
          </p>
          {isAdmin && (
            <button className="mobile-cal-add-inline" onClick={openCreate} type="button">
              {t(language, 'calendar.addSchedule')}
            </button>
          )}
        </div>

        {selectedEvents.length === 0 && (
          <div className="mobile-cal-empty">
            {t(language, 'calendar.noEvents')}
          </div>
        )}

        {selectedEvents.map((event) => {
          const isApplied = event.applicants.includes(currentVisitor)
          const canAccessChat =
            role === 'admin' ||
            role === 'developer' ||
            role === 'leader' ||
            event.applicants.includes(currentVisitor) ||
            event.assigned.includes(currentVisitor) ||
            event.leader === currentVisitor
          const isEditing = editingId === event.id
          return (
            <div className="mobile-cal-event-card" key={event.id} id={`mobile-event-card-${event.id}`}>
              <div className="mobile-cal-event-body">
                <div className="mobile-cal-event-head">
                  <span className="mobile-cal-event-time">{event.time || t(language, 'calendar.timeTbd')}</span>
                  <div className="mobile-cal-event-badges">
                    {event.hasMeeting && <span className="mobile-cal-badge">{t(language, 'calendar.serviceMeeting')}</span>}
                    {!event.allowApplications && <span className="mobile-cal-badge muted">{t(language, 'calendar.notAccepting')}</span>}
                    {event.card && <span className="mobile-cal-badge">{event.card}</span>}
                  </div>
                </div>
                <strong className="mobile-cal-event-title">{event.title}</strong>
                {(event.place || event.leader) && (
                  <p className="mobile-cal-event-meta">
                    {event.place && (
                      <span>
                        <CalMiniIcon name="place" />
                        {event.mapLink ? (
                          <a href={event.mapLink} rel="noreferrer" target="_blank">{event.place}</a>
                        ) : event.place}
                      </span>
                    )}
                    {event.leader && (
                      <span>
                        <CalMiniIcon name="leader" />
                        {leaderPhones[event.leader] ? (
                          <a href={`tel:${leaderPhones[event.leader]}`}>{event.leader}</a>
                        ) : event.leader}
                      </span>
                    )}
                  </p>
                )}
                {event.memo && <p className="mobile-cal-event-memo">{event.memo}</p>}
                {event.allowApplications && (
                  <div className="mobile-cal-apply-section">
                    <div className="mobile-cal-event-footer">
                      <span>
                        <CalMiniIcon name="users" />
                        {t(language, 'calendar.applicants')} {event.applicants.length}{t(language, 'calendar.personCount')}
                      </span>
                      <div className="mobile-cal-event-actions">
                        {canManageParticipants && onAddParticipant && (
                          <button
                            className="mobile-cal-add-participant-btn"
                            onClick={() => {
                              setAddParticipantEventId(addParticipantEventId === event.id ? null : event.id)
                              setAddParticipantQuery('')
                            }}
                            type="button"
                          >
                            + {t(language, 'common.add')}
                          </button>
                        )}
                        <button
                          className={`mobile-cal-apply-btn${isApplied ? ' applied' : ''}`}
                          onClick={() => onApplyToEvent(event.id)}
                          type="button"
                        >
                          {isApplied ? t(language, 'calendar.cancelApply') : t(language, 'calendar.apply')}
                        </button>
                      </div>
                    </div>
                    {/* 신청자 칩 목록 */}
                    {event.applicants.length > 0 && (
                      <div className="mobile-cal-applicant-chips">
                        {event.applicants.map((person) => (
                          <span className="mobile-cal-applicant-chip" key={person}>{person}</span>
                        ))}
                      </div>
                    )}
                    {/* 수동 추가 드롭다운 (리더/관리자) */}
                    {addParticipantEventId === event.id && canManageParticipants && onAddParticipant && (
                      <div className="mobile-cal-add-participant-panel">
                        <input
                          autoFocus
                          className="mobile-cal-add-participant-input"
                          onChange={(e) => setAddParticipantQuery(e.target.value)}
                          placeholder={t(language, 'calendar.searchName')}
                          type="text"
                          value={addParticipantQuery}
                        />
                        <div className="mobile-cal-add-participant-list">
                          {allUserNames
                            .filter((n) => !event.applicants.includes(n) && n.includes(addParticipantQuery))
                            .map((name) => (
                              <button
                                className="mobile-cal-add-participant-item"
                                key={name}
                                onClick={() => {
                                  onAddParticipant(event.id, name)
                                  setAddParticipantEventId(null)
                                  setAddParticipantQuery('')
                                }}
                                type="button"
                              >
                                {name}
                              </button>
                            ))}
                          {allUserNames.filter((n) => !event.applicants.includes(n) && n.includes(addParticipantQuery)).length === 0 && (
                            <span className="mobile-cal-add-participant-empty">{t(language, 'calendar.noMembersToAdd')}</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {isAdmin && !isEditing && (
                  <div className="mobile-cal-event-admin-actions">
                    <button className="mobile-cal-edit-btn" onClick={() => startEdit(event)} type="button">{t(language, 'common.edit')}</button>
                    <button
                      className="mobile-cal-delete-btn"
                      onClick={() => setDeleteConfirmEvent(event)}
                      type="button"
                    >
                      {t(language, 'common.delete')}
                    </button>
                  </div>
                )}
                <CommentSection
                  compact
                  currentUserId={currentUserId}
                  currentVisitor={currentVisitor}
                  role={role}
                  targetId={event.id}
                  targetType="calendar_event"
                  users={mentionUsers}
                />
                <section className="chat-room chat-room--compact chat-room-summary">
                  <div className="chat-room__head">
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                      <strong>{t(language, 'header.chats')}</strong>
                      <span>{event.title}</span>
                    </div>
                  </div>
                  <button
                    className="chat-open-btn"
                    disabled={!canAccessChat}
                    onClick={() => setChatEvent(event)}
                    type="button"
                  >
                    {t(language, 'calendar.openChat')}
                  </button>
                  {!canAccessChat && <p className="chat-summary-muted">{t(language, 'calendar.chatOnlyJoined')}</p>}
                </section>
              </div>
            </div>
          )
        })}
      </div>
      {deleteConfirmEvent && (
        <div className="cal-modal-backdrop" onClick={() => setDeleteConfirmEvent(null)}>
          <div className="cal-modal" style={{ maxWidth: 380 }} onClick={(e) => e.stopPropagation()}>
            <div className="cal-modal-head">
              <div className="cal-modal-title"><h2>{t(language, 'calendar.deleteEvent')}</h2></div>
              <button className="cal-modal-close" onClick={() => setDeleteConfirmEvent(null)} type="button">✕</button>
            </div>
            <div className="cal-modal-body" style={{ padding: '16px 20px' }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#1e293b' }}>
                "{deleteConfirmEvent.title}"
              </p>
              <p style={{ margin: '4px 0 14px', fontSize: 13, color: '#64748b' }}>
                {deleteConfirmEvent.date} {deleteConfirmEvent.time}
              </p>
              <div style={{ padding: '12px 14px', background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 10 }}>
                <p style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 700, color: '#92400e' }}>
                  {t(language, 'calendar.deleteWarning')}
                </p>
                <ul className="cal-delete-warning-list" style={{ margin: 0, padding: 0, listStyle: 'none', fontSize: 12, color: '#78350f', lineHeight: 1.8 }}>
                  <li>{t(language, 'calendar.deleteChat')}</li>
                  <li>{t(language, 'calendar.deleteApplicants').replace('{count}', String(deleteConfirmEvent.applicants.length))}</li>
                  <li>{t(language, 'calendar.deleteAssignments').replace('{count}', String(deleteConfirmEvent.cardAssignments.length))}</li>
                  <li>{t(language, 'calendar.deleteComments')}</li>
                </ul>
              </div>
              <p className="cal-delete-irreversible" style={{ margin: '12px 0 0', fontSize: 12, color: '#dc2626', fontWeight: 600 }}>
                {t(language, 'calendar.deleteIrreversible')}
              </p>
            </div>
            <div className="cal-modal-foot">
              <button className="cal-cancel-btn" onClick={() => setDeleteConfirmEvent(null)} type="button">{t(language, 'header.close')}</button>
              <button
                className="cal-save-btn"
                style={{ background: '#dc2626', borderColor: '#dc2626' }}
                onClick={() => {
                  onDeleteEvent?.(deleteConfirmEvent.id)
                  setDeleteConfirmEvent(null)
                }}
                type="button"
              >
                {t(language, 'calendar.delete')}
              </button>
            </div>
          </div>
        </div>
      )}

      {chatEvent && (
        <div className="chat-room-modal-backdrop" onClick={() => setChatEvent(null)}>
          <div className="chat-room-modal chat-room-modal--mobile" onClick={(event) => event.stopPropagation()}>
            <div className="chat-room-modal__head">
              <div>
                <strong>{chatEvent.title}</strong>
                <span>{chatEvent.date} · {chatEvent.time || '시간 미정'}</span>
              </div>
              <button onClick={() => setChatEvent(null)} type="button">{t(language, 'header.close')}</button>
            </div>
            <ChatRoom
              canAccess
              compact
              currentUserId={currentUserId}
              currentVisitor={currentVisitor}
              eventId={chatEvent.id}
              eventTitle={chatEvent.title}
              role={role}
              users={mentionUsers}
            />
          </div>
        </div>
      )}
    </div>
  )
}
