import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { CalendarEvent, SpecialPeriod, TerritoryCard } from '../types'
import { PERIOD_COLORS } from '../types'
import { ChatRoom } from './ChatRoom'
import { CommentSection, type MentionUser } from './CommentSection'

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


function eventTimeClass(time: string) {
  const h = parseInt(time.split(':')[0], 10)
  if (h < 12) return 'event-pill--am'
  if (h < 17) return 'event-pill--pm'
  return 'event-pill--eve'
}

type CalendarIconName = 'clock' | 'pin' | 'user'

function CalendarIcon({ name }: { name: CalendarIconName }) {
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

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <circle cx="12" cy="8" r="3.2" />
      <path d="M5.8 19c.8-3.4 3-5.2 6.2-5.2s5.4 1.8 6.2 5.2" />
    </svg>
  )
}


type EventInput = { time: string; title: string; place: string; mapLink?: string; leader: string; memo: string; hasMeeting: boolean; allowApplications: boolean }
type EditDraft = EventInput

type ScopeModal =
  | { kind: 'edit'; id: number; date: string; seriesId: string; draft: EditDraft }
  | { kind: 'delete'; id: number; date: string; seriesId: string; title: string }

export function DesktopCalendar({
  currentVisitor,
  currentUserId,
  leaderNames = [],
  cards: _cards,
  events,
  role = 'user',
  allUserNames = [],
  mentionUsers = [],
  onApplyToEvent,
  onAssignToEvent: _onAssignToEvent,
  onAssignCardToEventParticipant: _onAssignCardToEventParticipant,
  onAddParticipant,
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
  currentUserId?: number | null
  leaderNames?: string[]
  cards: TerritoryCard[]
  events: CalendarEvent[]
  role?: import('../types').Role
  allUserNames?: string[]
  mentionUsers?: MentionUser[]
  onApplyToEvent: (eventId: number) => void
  onAssignToEvent: (eventId: number, userName: string) => void
  onAssignCardToEventParticipant: (eventId: number, userName: string, cardId: number | null) => void
  onAddParticipant?: (eventId: number, userName: string) => void
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
  const [searchParams, setSearchParams] = useSearchParams()
  const [chatEvent, setChatEvent] = useState<CalendarEvent | null>(null)

  // openChat=<eventId> 쿼리 처리: 해당 일정 날짜로 이동 + 채팅방 열기
  useEffect(() => {
    const openChatId = searchParams.get('openChat')
    if (!openChatId) return
    const targetEvent = events.find((ev: CalendarEvent) => ev.id === Number(openChatId))
    if (!targetEvent) return

    const d = new Date(targetEvent.date)
    setYear(d.getFullYear())
    setMonth(d.getMonth() + 1)
    setSelectedDay(d.getDate())
    setChatEvent(targetEvent)

    // 다음 tick에 스크롤
    setTimeout(() => {
      const el = document.getElementById(`event-card-${openChatId}`)
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 200)

    // 쿼리 제거
    const next = new URLSearchParams(searchParams)
    next.delete('openChat')
    setSearchParams(next, { replace: true })
  }, [events, searchParams, setSearchParams])
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newDate, setNewDate] = useState(() => toDateStr(today.getFullYear(), today.getMonth() + 1, today.getDate()))
  const [newTitle, setNewTitle] = useState('오전 방문')
  const [newTime, setNewTime] = useState('10:00')
  const [newPlace, setNewPlace] = useState('')
  const [newMapLink, setNewMapLink] = useState('')
  const [newLeader, setNewLeader] = useState('')
  const [newMemo, setNewMemo] = useState('')
  const [newHasMeeting, setNewHasMeeting] = useState(false)
  const [newAllowApplications, setNewAllowApplications] = useState(true)
  const [isRepeat, setIsRepeat] = useState(false)
  const [repeatEnd, setRepeatEnd] = useState('')
  const [editingEventId, setEditingEventId] = useState<number | null>(null)
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null)
  const [scopeModal, setScopeModal] = useState<ScopeModal | null>(null)
  const [deleteConfirmEvent, setDeleteConfirmEvent] = useState<CalendarEvent | null>(null)
  const [showPeriodForm, setShowPeriodForm] = useState(false)
  const [periodLabel, setPeriodLabel] = useState('')
  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd] = useState('')
  const [periodColor, setPeriodColor] = useState(PERIOD_COLORS[0].value)
  const [addParticipantEventId, setAddParticipantEventId] = useState<number | null>(null)
  const [addParticipantQuery, setAddParticipantQuery] = useState('')
  const addParticipantRef = useRef<HTMLDivElement>(null)

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
    setNewMapLink(''); setNewLeader(''); setNewMemo(''); setNewHasMeeting(false); setNewAllowApplications(true)
    setIsRepeat(false); setRepeatEnd('')
  }

  const handleCreate = () => {
    if (!newTitle.trim()) return
    const input: EventInput = { time: newTime, title: newTitle, place: newPlace, mapLink: newMapLink || undefined, leader: newLeader, memo: newMemo, hasMeeting: newHasMeeting, allowApplications: newAllowApplications }
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
      {/* ── 단일 일정 삭제 확인 모달 ───────────────────── */}
      {deleteConfirmEvent && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(0,0,0,0.4)', display: 'grid', placeItems: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 'var(--r-lg)', padding: '24px 28px', width: '400px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h2 style={{ fontSize: '17px', fontWeight: 700, margin: 0 }}>일정 삭제</h2>
            <div>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#1e293b' }}>"{deleteConfirmEvent.title}"</p>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--ink-500)' }}>{deleteConfirmEvent.date} {deleteConfirmEvent.time}</p>
            </div>
            <div style={{ padding: '12px 14px', background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 10 }}>
              <p style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 700, color: '#92400e' }}>⚠️ 함께 삭제됩니다</p>
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', fontSize: 12, color: '#78350f', lineHeight: 1.8 }}>
                <li>· 채팅방 (메시지 전체)</li>
                <li>· 신청자 {deleteConfirmEvent.applicants.length}명</li>
                <li>· 봉사자 카드 배정 {deleteConfirmEvent.cardAssignments.length}건</li>
                <li>· 일정에 달린 댓글</li>
              </ul>
            </div>
            <p style={{ margin: 0, fontSize: 12, color: '#dc2626', fontWeight: 600 }}>이 작업은 되돌릴 수 없습니다.</p>
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <button onClick={() => setDeleteConfirmEvent(null)} style={{ flex: 1, padding: '10px', borderRadius: 'var(--r-md)', border: '1px solid #d1d5db', background: '#f9fafb', fontSize: 14, fontWeight: 600, cursor: 'pointer' }} type="button">취소</button>
              <button onClick={() => { onDeleteEvent(deleteConfirmEvent.id); clearEdit(); setDeleteConfirmEvent(null) }} style={{ flex: 1, padding: '10px', borderRadius: 'var(--r-md)', border: 'none', background: '#dc2626', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }} type="button">삭제</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Scope modal (edit or delete series) ───────────────────── */}
      {scopeModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(0,0,0,0.4)', display: 'grid', placeItems: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 'var(--r-lg)', padding: '28px 32px', width: '360px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {scopeModal.kind === 'edit' && (
              <>
                <h2 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>수정 범위 선택</h2>
                <p style={{ fontSize: '13px', color: 'var(--ink-500)', margin: 0 }}>반복 시리즈 일정입니다. 어떤 범위로 수정할까요?</p>
                <button onClick={() => { onUpdateEvent(scopeModal.id, scopeModal.draft); clearEdit(); setScopeModal(null) }} style={{ padding: '12px', borderRadius: 'var(--r-md)', border: '1px solid #d1d5db', background: '#f9fafb', fontSize: '14px', fontWeight: 600, cursor: 'pointer', textAlign: 'left' }} type="button">
                  <strong style={{ display: 'block' }}>이 일정만 수정 ({scopeModal.date})</strong>
                  <span style={{ fontSize: '12px', color: 'var(--ink-500)', fontWeight: 400 }}>나머지 반복 일정은 그대로</span>
                </button>
                <button onClick={() => { onUpdateEventSeries(scopeModal.seriesId, scopeModal.date, scopeModal.draft); clearEdit(); setScopeModal(null) }} style={{ padding: '12px', borderRadius: 'var(--r-md)', border: '1px solid var(--brand-700)', background: 'var(--brand-50)', fontSize: '14px', fontWeight: 600, cursor: 'pointer', textAlign: 'left' }} type="button">
                  <strong style={{ display: 'block', color: 'var(--brand-700)' }}>이 날 포함 이후 모두 수정</strong>
                  <span style={{ fontSize: '12px', color: 'var(--ink-500)', fontWeight: 400 }}>{scopeModal.date} 부터 이후 일정만 변경 (지난 일정은 그대로)</span>
                </button>
              </>
            )}
            {scopeModal.kind === 'delete' && (
              <>
                <h2 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>삭제 범위 선택</h2>
                <p style={{ fontSize: '13px', color: 'var(--ink-500)', margin: 0 }}>반복 시리즈 일정입니다. 어떤 범위로 삭제할까요?</p>
                <button onClick={() => { onDeleteEvent(scopeModal.id); clearEdit(); setScopeModal(null) }} style={{ padding: '12px', borderRadius: 'var(--r-md)', border: '1px solid #d1d5db', background: '#f9fafb', fontSize: '14px', fontWeight: 600, cursor: 'pointer', textAlign: 'left' }} type="button">
                  <strong style={{ display: 'block' }}>이 일정만 삭제 ({scopeModal.date})</strong>
                  <span style={{ fontSize: '12px', color: 'var(--ink-500)', fontWeight: 400 }}>나머지 반복 일정은 그대로</span>
                </button>
                <button onClick={() => { onDeleteEventSeries(scopeModal.seriesId, scopeModal.date); clearEdit(); setScopeModal(null) }} style={{ padding: '12px', borderRadius: 'var(--r-md)', border: '1px solid var(--danger-600)', background: '#fef2f2', fontSize: '14px', fontWeight: 600, cursor: 'pointer', textAlign: 'left' }} type="button">
                  <strong style={{ display: 'block', color: 'var(--danger-600)' }}>이 날 포함 이후 모두 삭제</strong>
                  <span style={{ fontSize: '12px', color: 'var(--ink-500)', fontWeight: 400 }}>{scopeModal.date} 부터 이후 일정 모두 (지난 일정은 그대로)</span>
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
                <h2>새 일정 추가</h2>
              </div>
              <button className="cal-modal-close" onClick={closeCreate} type="button">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className="cal-modal-body">
              {/* 제목 */}
              <div className="cal-field">
                <label>제목 *</label>
                <input className="cal-input" placeholder="오전 방문" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
              </div>

              {/* 날짜 + 매주 반복 토글 */}
              <div className="cal-field">
                <label>날짜와 시간</label>
                <div className="cal-box-section">
                  <input className="cal-input" type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} style={{ marginBottom: 10 }} />
                  <label className="cal-toggle-row">
                    <div>
                      <span className="cal-toggle-label">매주 반복</span>
                      <span className="cal-toggle-desc">같은 요일로 반복 일정을 생성합니다.</span>
                    </div>
                    <button
                      type="button"
                      className={`cal-toggle-switch${isRepeat ? ' on' : ''}`}
                      onClick={() => setIsRepeat(v => !v)}
                      aria-pressed={isRepeat}
                    />
                  </label>
                  {isRepeat && (
                    <div style={{ marginTop: 10 }}>
                      <div className="cal-field">
                        <label>반복 종료일</label>
                        <input className="cal-input" type="date" value={repeatEnd} min={newDate} onChange={(e) => setRepeatEnd(e.target.value)} />
                      </div>
                      {repeatEnd && <p className="cal-repeat-hint" style={{ marginTop: 6 }}>{repeatCount}개 일정 생성 예정</p>}
                    </div>
                  )}
                  {/* 시간 프리셋 */}
                  <div style={{ marginTop: 12 }}>
                    <div className="cal-preset-label">자주 쓰는 시간</div>
                    <div className="cal-time-presets">
                      {([
                        { label: '오전', time: '10:00' },
                        { label: '오후', time: '13:00' },
                        { label: '늦은 오후', time: '15:00' },
                        { label: '저녁', time: '19:00' },
                      ] as const).map((p) => (
                        <button
                          key={p.label}
                          type="button"
                          className={`cal-time-preset-btn${newTime === p.time ? ' active' : ''}`}
                          onClick={() => setNewTime(p.time)}
                        >
                          <span className="cal-preset-name">{p.label}</span>
                          <span className="cal-preset-time">{p.time}</span>
                        </button>
                      ))}
                    </div>
                    <div style={{ marginTop: 8 }}>
                      <input className="cal-input" type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)} />
                    </div>
                  </div>
                </div>
              </div>

              {/* 장소 + 지도 링크 */}
              <div className="cal-field">
                <label>모임 장소</label>
                <input className="cal-input" placeholder="장소 입력" value={newPlace} onChange={(e) => setNewPlace(e.target.value)} style={{ marginBottom: 8 }} />
                <input className="cal-input" inputMode="url" placeholder="네이버 지도 링크 (선택)" value={newMapLink} onChange={(e) => setNewMapLink(e.target.value)} />
              </div>

              {/* 인도자 */}
              <div className="cal-field">
                <label>인도자</label>
                <select className="cal-input" value={newLeader} onChange={(e) => setNewLeader(e.target.value)}>
                  <option value="">선택 안함</option>
                  {leaderNames.map((name) => <option key={name} value={name}>{name}</option>)}
                </select>
              </div>

              {/* 상세설명 */}
              <div className="cal-field">
                <label>상세설명 <span style={{ fontWeight: 400, color: 'var(--gray-400)' }}>(선택)</span></label>
                <textarea className="cal-textarea" placeholder="봉사 전에 알아야 할 내용, 주의사항 등" value={newMemo} onChange={(e) => setNewMemo(e.target.value)} />
              </div>

              {/* 설정 토글 */}
              <div className="cal-field">
                <label>설정</label>
                <div className="cal-box-section">
                  <label className="cal-toggle-row">
                    <div>
                      <span className="cal-toggle-label">봉사모임</span>
                      <span className="cal-toggle-desc">모임 일정이면 카드에 표시됩니다.</span>
                    </div>
                    <button
                      type="button"
                      className={`cal-toggle-switch${newHasMeeting ? ' on' : ''}`}
                      onClick={() => setNewHasMeeting(v => !v)}
                      aria-pressed={newHasMeeting}
                    />
                  </label>
                  <div className="cal-toggle-divider" />
                  <label className="cal-toggle-row">
                    <div>
                      <span className="cal-toggle-label">봉사 신청 받기</span>
                      <span className="cal-toggle-desc">봉사자들이 이 일정에 신청할 수 있습니다.</span>
                    </div>
                    <button
                      type="button"
                      className={`cal-toggle-switch${newAllowApplications ? ' on' : ''}`}
                      onClick={() => setNewAllowApplications(v => !v)}
                      aria-pressed={newAllowApplications}
                    />
                  </label>
                </div>
              </div>
            </div>

            <div className="cal-modal-foot">
              <button className="cal-cancel-btn" onClick={closeCreate} type="button">취소</button>
              <button className="cal-save-btn" disabled={!newTitle.trim()} onClick={handleCreate} type="button">
                {isRepeat && repeatEnd ? `${repeatCount}개 일정 저장` : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}

      <section className="desktop-content calendar-layout">
        <div className="calendar-pane">
          <header className="page-header">
            <div className="page-header-text">
              <h1 className="page-header-title">{year}년 {month}월</h1>
            </div>
            <div className="page-header-actions">
              <button className="cal-today-btn" type="button">신청내역</button>
              <button className="cal-today-btn" type="button">일괄 업로드</button>
              <button className="cal-nav-btn" onClick={prevMonth} type="button">‹</button>
              <button className="cal-today-btn" onClick={goToday} type="button">오늘</button>
              <button className="cal-nav-btn" onClick={nextMonth} type="button">›</button>
              {(role === 'admin' || role === 'leader') && (
                <button className="cal-add-event-btn" onClick={openCreate} type="button">+ 일정 추가</button>
              )}
            </div>
          </header>

          {/* ── Special period management ── */}
          <div style={{ padding: '2px 16px', borderBottom: '1px solid var(--border-default)', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', minHeight: '22px' }}>
            {specialPeriods.map((p) => (
              <span key={p.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '1px 8px 1px 6px', borderRadius: 'var(--radius-sm)', background: p.color + '18', border: `1px solid ${p.color}50`, borderLeft: `3px solid ${p.color}`, fontSize: '11px', fontWeight: 600, color: p.color, flexShrink: 0, whiteSpace: 'nowrap' }}>
                <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: p.color, flexShrink: 0 }} />
                {p.label} · {p.startDate.slice(5)} ~ {p.endDate.slice(5)}
                <button onClick={() => onDeleteSpecialPeriod(p.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: p.color, fontWeight: 700, fontSize: '13px', lineHeight: 1, padding: '0 1px', opacity: 0.6 }} type="button">×</button>
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
                    <button key={c.value} onClick={() => setPeriodColor(c.value)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }} type="button" title={c.label}>
                      <span style={{ display: 'block', width: '18px', height: '18px', borderRadius: 'var(--radius-sm)', background: c.value, opacity: periodColor === c.value ? 1 : 0.35, transition: 'opacity 0.15s', outline: periodColor === c.value ? `2px solid ${c.value}` : 'none', outlineOffset: '2px' }} />
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
              const isPeriodEnd = activePeriod && dayStr === activePeriod.endDate
              return (
                <button
                  className={['day-cell', day === selectedDay ? 'selected' : '', !day ? 'muted' : '', activePeriod ? 'in-period' : ''].join(' ')}
                  disabled={!day}
                  key={`${day ?? 'blank'}-${index}`}
                  onClick={() => { if (day) { setSelectedDay(day); setShowCreateForm(false) } }}
                  style={activePeriod && day !== selectedDay ? { background: activePeriod.color + '14' } : undefined}
                  type="button"
                >
                  <div className="day-head">
                    <span className="day-number">{day ?? ''}</span>
                    {isPeriodStart && <small className="period-start-label" style={{ background: activePeriod.color + '22', color: activePeriod.color }}>{activePeriod.label}</small>}
                  </div>
                  {activePeriod && (
                    <div
                      className="period-full-bar"
                      style={{
                        background: activePeriod.color,
                        borderRadius: `${isPeriodStart ? '2px' : '0'} ${isPeriodEnd ? '2px' : '0'} ${isPeriodEnd ? '2px' : '0'} ${isPeriodStart ? '2px' : '0'}`,
                      }}
                    />
                  )}
                  <div className="day-events">
                    {dayEvents.slice(0, 3).map((event) => (
                      <small className={`event-pill ${eventTimeClass(event.time)}${event.hasMeeting ? ' has-meeting' : ''}`} key={event.id}>
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
                <div className="cal-empty-icon">
                  <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                </div>
                <h3>{month}월 {selectedDay}일 일정이 없습니다</h3>
                <p>새로운 일정을 추가해보세요</p>
                {(role === 'admin' || role === 'leader') && (
                  <button className="cal-empty-add-btn" onClick={openCreate} type="button">+ 일정 추가</button>
                )}
              </div>
            )}

            <div className="detail-stack">
              {selectedEvents.map((event) => {
                const isApplied = event.applicants.includes(currentVisitor)
                const canAccessChat =
                  role === 'admin' ||
                  role === 'developer' ||
                  role === 'leader' ||
                  event.applicants.includes(currentVisitor) ||
                  event.assigned.includes(currentVisitor) ||
                  event.leader === currentVisitor
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
                        } else {
                          setDeleteConfirmEvent(event)
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

                const canEdit = role === 'admin' || role === 'developer' || role === 'leader'
                const canManage = role === 'admin' || role === 'developer'

                return (
                  <article className="detail-card" key={event.id} id={`event-card-${event.id}`}>
                    {/* 헤더: 제목 + 배지 + (편집버튼) */}
                    <div className="detail-title-row">
                      <div className="detail-title-main">
                        <h2>{event.title}</h2>
                        {event.card && <span className="event-card-badge">{event.card}</span>}
                        {event.hasMeeting && <span className="event-meeting-tag">봉사모임</span>}
                        {!event.allowApplications && <span className="event-closed-tag">신청 마감</span>}
                      </div>
                      {canEdit && (
                        <button
                          className="edit-btn"
                          onClick={() => {
                            setEditingEventId(event.id)
                            setEditDraft({ time: event.time, title: event.title, place: event.place, mapLink: event.mapLink ?? '', leader: event.leader, memo: event.memo, hasMeeting: event.hasMeeting, allowApplications: event.allowApplications })
                          }}
                          type="button"
                        >
                          편집
                        </button>
                      )}
                    </div>

                    {/* 메타: 시간 / 장소 / 인도자 */}
                    <div className="event-meta-row">
                      <span><CalendarIcon name="clock" /> {event.time || '시간 미정'}</span>
                      {event.place && (
                        <span>
                          <CalendarIcon name="pin" />
                          {event.mapLink
                            ? <a href={event.mapLink} rel="noreferrer" target="_blank" style={{ color: 'inherit', textDecoration: 'underline' }}>{event.place}</a>
                            : event.place}
                        </span>
                      )}
                      {event.leader && <span><CalendarIcon name="user" /> {event.leader}</span>}
                    </div>

                    {/* 상세설명 */}
                    {event.memo && <p className="event-memo">{event.memo}</p>}

                    {/* 신청 섹션 */}
                    {event.allowApplications && (
                      <div className="assignment-box">
                        {/* 신청하기 버튼 — 봉사자에게 크게 표시 */}
                        <button
                          className={`cal-apply-big-btn${isApplied ? ' applied' : ''}`}
                          onClick={() => onApplyToEvent(event.id)}
                          type="button"
                        >
                          {isApplied ? '신청 취소' : '신청하기'}
                        </button>

                        {/* 신청자 목록 */}
                        {(event.applicants.length > 0 || canManage) && (
                          <div style={{ marginTop: 12 }}>
                            <div className="box-heading">
                              <strong>신청자 {event.applicants.length > 0 && <em>{event.applicants.length}명</em>}</strong>
                              {(role === 'leader' || role === 'admin' || role === 'developer') && onAddParticipant && (
                                <div className="cal-add-participant-wrap" ref={addParticipantEventId === event.id ? addParticipantRef : undefined}>
                                  <button
                                    className="cal-add-participant-chip-btn"
                                    onClick={() => {
                                      setAddParticipantEventId(addParticipantEventId === event.id ? null : event.id)
                                      setAddParticipantQuery('')
                                    }}
                                    type="button"
                                  >
                                    + 추가
                                  </button>
                                  {addParticipantEventId === event.id && (
                                    <div className="cal-add-participant-dropdown">
                                      <input
                                        autoFocus
                                        className="cal-add-participant-input"
                                        onBlur={() => window.setTimeout(() => setAddParticipantEventId(null), 150)}
                                        onChange={(e) => setAddParticipantQuery(e.target.value)}
                                        placeholder="이름 검색..."
                                        type="text"
                                        value={addParticipantQuery}
                                      />
                                      <div className="cal-add-participant-list">
                                        {allUserNames
                                          .filter((n) => !event.applicants.includes(n) && n.includes(addParticipantQuery))
                                          .map((name) => (
                                            <button
                                              className="cal-add-participant-item"
                                              key={name}
                                              onMouseDown={() => {
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
                                          <span className="cal-add-participant-empty">추가할 회원이 없습니다</span>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                            <div className="person-chips">
                              {event.applicants.map((person) => (
                                <span className={event.assigned.includes(person) ? 'assigned event-person-chip' : 'event-person-chip'} key={person}>
                                  <strong className="event-person-name">{person}</strong>
                                  {canManage && <button className="chip-remove" onClick={() => onRemoveParticipant(event.id, person)} type="button">×</button>}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="event-collab-grid">
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
                          <div>
                            <strong>채팅</strong>
                            <span>{event.title}</span>
                          </div>
                        </div>
                        <button
                          className="chat-open-btn"
                          disabled={!canAccessChat}
                          onClick={() => setChatEvent(event)}
                          type="button"
                        >
                          채팅방 열기
                        </button>
                        {!canAccessChat && <p className="chat-summary-muted">참여한 봉사 채팅방만 볼 수 있습니다.</p>}
                      </section>
                    </div>
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
      {chatEvent && (
        <div className="chat-room-modal-backdrop" onClick={() => setChatEvent(null)}>
          <div className="chat-room-modal" onClick={(event) => event.stopPropagation()}>
            <div className="chat-room-modal__head">
              <div>
                <strong>{chatEvent.title}</strong>
                <span>{chatEvent.date} · {chatEvent.time || '시간 미정'}</span>
              </div>
              <button onClick={() => setChatEvent(null)} type="button">닫기</button>
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
    </>
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

      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div className="cal-field">
          <label>제목</label>
          <input className="cal-input" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
        </div>
        {/* 시간 — 프리셋 */}
        <div className="cal-field">
          <label>시간</label>
          <div className="cal-time-presets" style={{ marginBottom: 8 }}>
            {([
              { label: '오전', time: '10:00' },
              { label: '오후', time: '13:00' },
              { label: '늦은 오후', time: '15:00' },
              { label: '저녁', time: '19:00' },
            ] as const).map((p) => (
              <button
                key={p.label}
                type="button"
                className={`cal-time-preset-btn${draft.time === p.time ? ' active' : ''}`}
                onClick={() => setDraft({ ...draft, time: p.time })}
              >
                <span className="cal-preset-name">{p.label}</span>
                <span className="cal-preset-time">{p.time}</span>
              </button>
            ))}
          </div>
          <input className="cal-input" type="time" value={draft.time} onChange={(e) => setDraft({ ...draft, time: e.target.value })} />
        </div>
        {/* 장소 + 지도 링크 */}
        <div className="cal-field">
          <label>모임 장소</label>
          <input className="cal-input" placeholder="장소 입력" value={draft.place} onChange={(e) => setDraft({ ...draft, place: e.target.value })} style={{ marginBottom: 8 }} />
          <input className="cal-input" inputMode="url" placeholder="네이버 지도 링크 (선택)" value={draft.mapLink ?? ''} onChange={(e) => setDraft({ ...draft, mapLink: e.target.value })} />
        </div>
        {/* 인도자 */}
        <div className="cal-field">
          <label>인도자</label>
          <select className="cal-input" value={draft.leader} onChange={(e) => setDraft({ ...draft, leader: e.target.value })}>
            <option value="">선택 안함</option>
            {leaderNames.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </div>
        {/* 상세설명 */}
        <div className="cal-field">
          <label>상세설명 <span style={{ fontWeight: 400, color: 'var(--gray-400)' }}>(선택)</span></label>
          <textarea className="cal-textarea" placeholder="봉사 전에 알아야 할 내용, 주의사항 등" value={draft.memo} onChange={(e) => setDraft({ ...draft, memo: e.target.value })} />
        </div>
        {/* 설정 토글 */}
        <div className="cal-field">
          <label>설정</label>
          <div className="cal-box-section">
            <label className="cal-toggle-row">
              <div>
                <span className="cal-toggle-label">봉사모임</span>
                <span className="cal-toggle-desc">모임 일정이면 카드에 표시됩니다.</span>
              </div>
              <button
                type="button"
                className={`cal-toggle-switch${draft.hasMeeting ? ' on' : ''}`}
                onClick={() => setDraft({ ...draft, hasMeeting: !draft.hasMeeting })}
                aria-pressed={draft.hasMeeting}
              />
            </label>
            <div className="cal-toggle-divider" />
            <label className="cal-toggle-row">
              <div>
                <span className="cal-toggle-label">봉사 신청 받기</span>
                <span className="cal-toggle-desc">봉사자들이 이 일정에 신청할 수 있습니다.</span>
              </div>
              <button
                type="button"
                className={`cal-toggle-switch${draft.allowApplications ? ' on' : ''}`}
                onClick={() => setDraft({ ...draft, allowApplications: !draft.allowApplications })}
                aria-pressed={draft.allowApplications}
              />
            </label>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginTop: '18px' }}>
        <button className="cal-save-btn" onClick={() => onSave(event.id, draft)} type="button">저장</button>
        <button className="danger-action" onClick={() => onDelete(event.id)} style={{ borderRadius: '999px', minHeight: '48px', padding: '0 20px' }} type="button">삭제</button>
      </div>
    </article>
  )
}
