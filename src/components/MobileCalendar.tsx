import { useState } from 'react'
import type { CalendarEvent, Role } from '../types'

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']
const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']

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

type EventInput = { time: string; title: string; place: string; leader: string; memo: string; hasMeeting: boolean; allowApplications: boolean }

export function MobileCalendar({
  currentVisitor,
  leaderNames = [],
  events,
  role = 'user',
  onApplyToEvent,
  onCreateEvent,
  onDeleteEvent,
  onUpdateEvent,
}: {
  currentVisitor: string
  leaderNames?: string[]
  events: CalendarEvent[]
  role?: Role
  onApplyToEvent: (eventId: number) => void
  onCreateEvent?: (input: EventInput & { date: string }) => void
  onDeleteEvent?: (id: number) => void
  onUpdateEvent?: (id: number, input: EventInput) => void
}) {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1)
  const [selectedDay, setSelectedDay] = useState(today.getDate())

  // create form
  const [showCreate, setShowCreate] = useState(false)
  const [newDate, setNewDate] = useState(() => toDateStr(today.getFullYear(), today.getMonth() + 1, today.getDate()))
  const [newTime, setNewTime] = useState('10:00')
  const [newTitle, setNewTitle] = useState('')
  const [newPlace, setNewPlace] = useState('')
  const [newLeader, setNewLeader] = useState('')
  const [newMemo, setNewMemo] = useState('')
  const [newHasMeeting, setNewHasMeeting] = useState(false)
  const [newAllowApplications, setNewAllowApplications] = useState(true)

  // edit form
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editDraft, setEditDraft] = useState<EventInput | null>(null)

  const isAdmin = role === 'admin'

  const calendarDays = getCalendarDays(year, month)
  const selectedDateStr = toDateStr(year, month, selectedDay)
  const selectedEvents = events
    .filter((e) => e.date === selectedDateStr)
    .sort((a, b) => a.time.localeCompare(b.time))

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
    setNewTime('10:00')
    setNewPlace('')
    setNewLeader('')
    setNewMemo('')
    setNewHasMeeting(false)
    setNewAllowApplications(true)
    setShowCreate(true)
  }

  const handleCreate = () => {
    if (!newTitle.trim() || !onCreateEvent) return
    onCreateEvent({ date: newDate, time: newTime, title: newTitle, place: newPlace, leader: newLeader, memo: newMemo, hasMeeting: newHasMeeting, allowApplications: newAllowApplications })
    setShowCreate(false)
  }

  const startEdit = (event: CalendarEvent) => {
    setEditingId(event.id)
    setEditDraft({ time: event.time, title: event.title, place: event.place, leader: event.leader, memo: event.memo, hasMeeting: event.hasMeeting, allowApplications: event.allowApplications })
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
              <h2>새 일정 추가</h2>
              <button className="mobile-sheet-close" onClick={() => setShowCreate(false)} type="button">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className="mobile-form-row">
              <div className="mobile-form-field">
                <label>날짜 *</label>
                <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
              </div>
              <div className="mobile-form-field">
                <label>시간 *</label>
                <input type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)} />
              </div>
            </div>
            <div className="mobile-form-field">
              <label>제목 *</label>
              <input placeholder="오전 방문" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
            </div>
            <div className="mobile-form-field">
              <label>장소</label>
              <input placeholder="모임 장소" value={newPlace} onChange={(e) => setNewPlace(e.target.value)} />
            </div>
            <div className="mobile-form-field">
              <label>인도자</label>
              <input placeholder="이름" list="mob-cal-leader-list" value={newLeader} onChange={(e) => setNewLeader(e.target.value)} />
              {leaderNames.length > 0 && (
                <datalist id="mob-cal-leader-list">
                  {leaderNames.map((name) => <option key={name} value={name} />)}
                </datalist>
              )}
            </div>
            <div className="mobile-form-field">
              <label>상세설명 (선택사항)</label>
              <textarea placeholder="봉사 전에 알아야 할 내용을 적어주세요" value={newMemo} onChange={(e) => setNewMemo(e.target.value)} />
            </div>
            <label className="mobile-form-check">
              <input type="checkbox" checked={newHasMeeting} onChange={(e) => setNewHasMeeting(e.target.checked)} />
              봉사 모임 있음
            </label>
            <label className="mobile-form-check">
              <input type="checkbox" checked={newAllowApplications} onChange={(e) => setNewAllowApplications(e.target.checked)} />
              이 일정에 봉사 신청을 받습니다
            </label>
            <button className="mobile-form-save" disabled={!newTitle.trim()} onClick={handleCreate} type="button">저장</button>
            <button className="mobile-form-cancel" onClick={() => setShowCreate(false)} type="button">취소</button>
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
              <h2>일정 편집</h2>
              <button className="mobile-sheet-close" onClick={() => setEditingId(null)} type="button">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className="mobile-form-row">
              <div className="mobile-form-field">
                <label>시간</label>
                <input type="time" value={editDraft.time} onChange={(e) => setEditDraft({ ...editDraft, time: e.target.value })} />
              </div>
              <div className="mobile-form-field">
                <label>장소</label>
                <input value={editDraft.place} onChange={(e) => setEditDraft({ ...editDraft, place: e.target.value })} />
              </div>
            </div>
            <div className="mobile-form-field">
              <label>제목</label>
              <input value={editDraft.title} onChange={(e) => setEditDraft({ ...editDraft, title: e.target.value })} />
            </div>
            <div className="mobile-form-field">
              <label>인도자</label>
              <input list="mob-cal-leader-list-edit" value={editDraft.leader} onChange={(e) => setEditDraft({ ...editDraft, leader: e.target.value })} />
              {leaderNames.length > 0 && (
                <datalist id="mob-cal-leader-list-edit">
                  {leaderNames.map((name) => <option key={name} value={name} />)}
                </datalist>
              )}
            </div>
            <div className="mobile-form-field">
              <label>상세설명 (선택사항)</label>
              <textarea value={editDraft.memo} onChange={(e) => setEditDraft({ ...editDraft, memo: e.target.value })} />
            </div>
            <label className="mobile-form-check">
              <input type="checkbox" checked={editDraft.hasMeeting} onChange={(e) => setEditDraft({ ...editDraft, hasMeeting: e.target.checked })} />
              봉사 모임 있음
            </label>
            <label className="mobile-form-check">
              <input type="checkbox" checked={editDraft.allowApplications} onChange={(e) => setEditDraft({ ...editDraft, allowApplications: e.target.checked })} />
              이 일정에 봉사 신청을 받습니다
            </label>
            <button className="mobile-form-save" onClick={handleUpdate} type="button">저장</button>
            <button className="mobile-form-cancel" onClick={() => setEditingId(null)} type="button">취소</button>
          </div>
        </>
      )}

      {/* 월 헤더 */}
      <div className="mobile-cal-header">
        <button onClick={prevMonth} type="button">‹</button>
        <h1>{year}년 {month}월</h1>
        <button onClick={() => { setYear(today.getFullYear()); setMonth(today.getMonth() + 1); setSelectedDay(today.getDate()) }} type="button">오늘</button>
        <button onClick={nextMonth} type="button">›</button>
        {isAdmin && (
          <button className="mobile-cal-add-btn" onClick={openCreate} type="button">+ 추가</button>
        )}
      </div>

      {/* 요일 헤더 + 날짜 그리드 */}
      <div className="mobile-cal-grid">
        {WEEKDAYS.map((w) => (
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
        <p className="mobile-cal-detail-title">
          {month}월 {selectedDay}일 ({WEEKDAY_LABELS[new Date(selectedDateStr).getDay()]}요일)
          {selectedEvents.length > 0 && <span>{selectedEvents.length}개</span>}
        </p>

        {selectedEvents.length === 0 && (
          <div className="mobile-cal-empty">
            {isAdmin ? (
              <button onClick={openCreate} style={{ color: 'var(--brand-700)', background: 'none', fontWeight: 700, fontSize: '14px', minHeight: 'auto', padding: 0 }} type="button">
                + 일정 추가하기
              </button>
            ) : '등록된 일정이 없습니다'}
          </div>
        )}

        {selectedEvents.map((event) => {
          const isApplied = event.applicants.includes(currentVisitor)
          const isEditing = editingId === event.id
          return (
            <div className="mobile-cal-event-card" key={event.id}>
              <div className="mobile-cal-event-time">{event.time}</div>
              <div className="mobile-cal-event-body">
                <div className="mobile-cal-event-top">
                  <strong>{event.title}</strong>
                  {event.hasMeeting && <span className="mobile-cal-badge">봉사모임</span>}
                  {!event.allowApplications && <span className="mobile-cal-badge muted">신청 받지 않음</span>}
                  {event.card && <span className="mobile-cal-badge">{event.card}</span>}
                </div>
                {(event.place || event.leader) && (
                  <p className="mobile-cal-event-meta">
                    {event.place && <>📍 {event.place}</>}
                    {event.place && event.leader && '  '}
                    {event.leader && <>👤 {event.leader}</>}
                  </p>
                )}
                {event.memo && <p className="mobile-cal-event-memo">{event.memo}</p>}
                {event.allowApplications && (
                  <div className="mobile-cal-event-footer">
                    <span>👥 {event.applicants.length}명 신청</span>
                    <button
                      className={`mobile-cal-apply-btn${isApplied ? ' applied' : ''}`}
                      onClick={() => onApplyToEvent(event.id)}
                      type="button"
                    >
                      {isApplied ? '신청취소' : '신청'}
                    </button>
                  </div>
                )}
                {isAdmin && !isEditing && (
                  <div className="mobile-cal-event-admin-actions">
                    <button className="mobile-cal-edit-btn" onClick={() => startEdit(event)} type="button">편집</button>
                    <button
                      className="mobile-cal-delete-btn"
                      onClick={() => {
                        if (confirm(`"${event.title}" 일정을 삭제할까요?`)) onDeleteEvent?.(event.id)
                      }}
                      type="button"
                    >
                      삭제
                    </button>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
