// 관리자 모바일 캘린더 — design_handoff 02 / 02b / 03 화면
//
// 구조:
//   - 월 카드 (헤더 + nav + grid)
//   - 그 날 일정 섹션 (헤더 + "+ 일정 추가" ghost)
//   - 다가오는 일정 섹션 (3개)
//   - 일정 카드 탭 → 상세 시트
//   - "+ 일정 추가" → 바텀 시트
//
// 헤더는 상위 MobileHome.tsx 의 AppHeader 가 그림.

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { CalendarEvent, Role } from '../../types'
import type { AppLanguage } from '../../i18n'
import { Card } from '../ui'
import { AdminEventDetailSheet } from './AdminEventDetailSheet'
import type { MentionUser } from '../CommentSection'

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']
const WEEKDAY_LABELS = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일']
const TIME_PRESET_STORAGE_KEY = 'chs-admin-calendar-time-presets-v1'
const TIME_PRESETS_MAX = 5
type TimePreset = {
  label: string
  time: string
  durationMinutes: number
  title: string
}
const DEFAULT_TIME_PRESETS: TimePreset[] = [
  { label: '오전', time: '10:00', durationMinutes: 120, title: '오전 방문' },
  { label: '오후', time: '13:00', durationMinutes: 120, title: '오후 방문' },
  { label: '늦은 오후', time: '15:00', durationMinutes: 120, title: '오후 방문' },
  { label: '저녁', time: '19:00', durationMinutes: 120, title: '저녁 방문' },
]

type EventInput = {
  time: string
  endTime?: string
  title: string
  place: string
  leader: string
  memo: string
  hasMeeting: boolean
  allowApplications: boolean
  mapLink?: string
}

type EventSheetInput = EventInput & {
  date: string
  repeat?: boolean
  repeatEnd?: string
}

type Props = {
  language: AppLanguage
  currentVisitor: string
  currentUserId?: number | null
  role: Role
  events: CalendarEvent[]
  leaderNames?: string[]
  mentionUsers?: MentionUser[]
  onCreateEvent?: (input: EventInput & { date: string }) => void
  onCreateRepeatEvents?: (dates: string[], input: EventInput) => void
  onDeleteEvent?: (id: number) => void
  onDeleteEventSeries?: (seriesId: string, fromDate: string) => void
  onUpdateEvent?: (id: number, input: EventInput) => void
  onUpdateEventSeries?: (seriesId: string, fromDate: string, input: EventInput) => void
}

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

function toDateStr(year: number, month: number, day: number) {
  return `${year}-${pad2(month)}-${pad2(day)}`
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

// 시간 범위 포맷: "13:00 — 15:00" 또는 "13:00"
function formatTimeRange(start?: string, end?: string): string {
  if (!start) return ''
  return end ? `${start} — ${end}` : start
}

function addMinutesToTime(time: string, minutes: number) {
  const match = time.match(/^(\d{2}):(\d{2})$/)
  if (!match) return ''
  const hour = Number(match[1])
  const minute = Number(match[2])
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return ''
  const total = (hour * 60 + minute + minutes) % (24 * 60)
  return `${pad2(Math.floor(total / 60))}:${pad2(total % 60)}`
}

function normalizeTimePresets(input: unknown): TimePreset[] {
  if (!Array.isArray(input)) return DEFAULT_TIME_PRESETS
  const normalized = input
    .slice(0, TIME_PRESETS_MAX)
    .map((item) => {
      const row = item as Partial<TimePreset>
      const time = typeof row.time === 'string' && /^\d{2}:\d{2}$/.test(row.time) ? row.time : ''
      if (!time) return null
      const duration = Number(row.durationMinutes)
      return {
        label: typeof row.label === 'string' && row.label.trim() ? row.label.trim().slice(0, 8) : '봉사',
        time,
        durationMinutes: Number.isFinite(duration) && duration > 0 ? Math.min(480, Math.max(15, Math.round(duration))) : 120,
        title: typeof row.title === 'string' && row.title.trim() ? row.title.trim().slice(0, 20) : '방문',
      }
    })
    .filter((item): item is TimePreset => Boolean(item))
  return normalized.length > 0 ? normalized : DEFAULT_TIME_PRESETS
}

function loadTimePresets(): TimePreset[] {
  if (typeof window === 'undefined') return DEFAULT_TIME_PRESETS
  try {
    return normalizeTimePresets(JSON.parse(window.localStorage.getItem(TIME_PRESET_STORAGE_KEY) ?? 'null'))
  } catch {
    return DEFAULT_TIME_PRESETS
  }
}

function saveTimePresets(presets: TimePreset[]) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(TIME_PRESET_STORAGE_KEY, JSON.stringify(normalizeTimePresets(presets)))
}

function buildCalendarDays(year: number, month: number): (number | null)[] {
  const firstDow = new Date(year, month - 1, 1).getDay()
  const total = new Date(year, month, 0).getDate()
  const cells: (number | null)[] = []
  for (let i = 0; i < firstDow; i++) cells.push(null)
  for (let d = 1; d <= total; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

function formatMonthHeader(year: number, month: number) {
  return `${year}년 ${month}월`
}

// ── 아이콘 ─────────────────────────────
function ChevR({ size = 14, color = 'var(--muted-2)' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="9 6 15 12 9 18" />
    </svg>
  )
}
function ChevL({ size = 14, color = 'var(--text)' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="15 6 9 12 15 18" />
    </svg>
  )
}
function PlusIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" aria-hidden>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}

export function AdminMobileCalendar({
  events,
  role,
  currentVisitor,
  currentUserId,
  leaderNames = [],
  mentionUsers = [],
  onCreateEvent,
  onCreateRepeatEvents,
  onDeleteEvent,
  onDeleteEventSeries,
  onUpdateEvent,
  onUpdateEventSeries,
}: Props) {
  const today = useMemo(() => new Date(), [])
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1)
  const [selectedDay, setSelectedDay] = useState(today.getDate())
  const [addOpen, setAddOpen] = useState(false)
  const [editingEventId, setEditingEventId] = useState<number | null>(null)
  const [scopeAction, setScopeAction] = useState<
    | { kind: 'edit'; event: CalendarEvent; input: EventInput }
    | { kind: 'delete'; event: CalendarEvent }
    | null
  >(null)
  const [detailEventId, setDetailEventId] = useState<number | null>(null)
  const detailEvent = detailEventId !== null ? events.find((e) => e.id === detailEventId) ?? null : null
  const editingEvent = editingEventId !== null ? events.find((e) => e.id === editingEventId) ?? null : null

  const [searchParams, setSearchParams] = useSearchParams()
  // 알림/딥링크 진입: ?openChat=X → 그 일정 채팅 열기,
  //                  ?openEvent=X → 그 일정 상세 시트 열기
  useEffect(() => {
    const openChatId = searchParams.get('openChat')
    const openEventId = searchParams.get('openEvent')
    if (!openChatId && !openEventId) return

    const targetIdRaw = openChatId ?? openEventId
    const targetId = Number(targetIdRaw)
    if (!Number.isFinite(targetId)) return
    const targetEvent = events.find((e) => e.id === targetId)
    if (!targetEvent) return

    // 해당 일정 날짜로 이동
    const d = new Date(targetEvent.date)
    setYear(d.getFullYear())
    setMonth(d.getMonth() + 1)
    setSelectedDay(d.getDate())

    if (openChatId) {
      window.dispatchEvent(new CustomEvent('app:open-event-chat', {
        detail: {
          eventId: targetEvent.id,
          eventTitle: targetEvent.title,
          eventDate: targetEvent.date,
          eventTime: targetEvent.time,
        },
      }))
    } else if (openEventId) {
      setDetailEventId(targetEvent.id)
    }

    const next = new URLSearchParams(searchParams)
    next.delete('openChat')
    next.delete('openEvent')
    setSearchParams(next, { replace: true })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, events])

  const cells = useMemo(() => buildCalendarDays(year, month), [year, month])
  const selectedDateStr = toDateStr(year, month, selectedDay)
  const monthEvents = useMemo(
    () => events.filter((e) => e.date.startsWith(`${year}-${pad2(month)}`)),
    [events, year, month],
  )
  const selectedEvents = useMemo(
    () =>
      events
        .filter((e) => e.date === selectedDateStr)
        .sort((a, b) => a.time.localeCompare(b.time)),
    [events, selectedDateStr],
  )
  const upcomingEvents = useMemo(() => {
    const todayStr = toDateStr(today.getFullYear(), today.getMonth() + 1, today.getDate())
    return events
      .filter((e) => e.date > todayStr)
      .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
      .slice(0, 3)
  }, [events, today])

  const prevMonth = () => {
    if (month === 1) {
      setYear(year - 1)
      setMonth(12)
    } else setMonth(month - 1)
    setSelectedDay(1)
  }
  const nextMonth = () => {
    if (month === 12) {
      setYear(year + 1)
      setMonth(1)
    } else setMonth(month + 1)
    setSelectedDay(1)
  }
  const goToday = () => {
    setYear(today.getFullYear())
    setMonth(today.getMonth() + 1)
    setSelectedDay(today.getDate())
  }

  const selectedDow = new Date(selectedDateStr).getDay()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, padding: '20px 16px 24px' }}>
      {/* ── 월 카드 ───────────────────── */}
      <Card padding="14px 14px 8px">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingBottom: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <NavButton onClick={prevMonth}>
              <ChevL />
            </NavButton>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>
              {formatMonthHeader(year, month)}
            </h3>
            <NavButton onClick={nextMonth}>
              <ChevR size={14} color="var(--text)" />
            </NavButton>
          </div>
          <button
            type="button"
            onClick={goToday}
            style={{
              border: 'none',
              background: 'transparent',
              font: 'inherit',
              fontSize: 13,
              fontWeight: 500,
              color: 'var(--muted)',
              padding: '0 10px',
              height: 32,
              minHeight: 32,
              cursor: 'pointer',
            }}
          >
            오늘
          </button>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            textAlign: 'center',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {WEEKDAYS.map((d, i) => (
            <div
              key={d}
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: i === 0 ? 'var(--status-danger)' : 'var(--muted)',
                paddingBottom: 8,
              }}
            >
              {d}
            </div>
          ))}
          {cells.map((day, idx) => {
            if (day === null) {
              return <div key={`empty-${idx}`} style={{ height: 40 }} />
            }
            const dayStr = toDateStr(year, month, day)
            const isToday = day === today.getDate() && month === today.getMonth() + 1 && year === today.getFullYear()
            const isSelected = day === selectedDay
            const isSun = idx % 7 === 0
            const hasEvent = monthEvents.some((e) => e.date === dayStr)
            return (
              <button
                key={`d-${day}-${idx}`}
                type="button"
                onClick={() => setSelectedDay(day)}
                style={{
                  height: 40,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 3,
                  background: 'transparent',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  fontSize: 14,
                  color: isSun ? 'var(--status-danger)' : 'var(--text)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                <span
                  style={{
                    width: 28,
                    height: 28,
                    display: 'grid',
                    placeItems: 'center',
                    borderRadius: '50%',
                    background: isToday ? 'var(--ink)' : isSelected ? 'var(--tint)' : 'transparent',
                    color: isToday ? '#fff' : isSun ? 'var(--status-danger)' : 'var(--text)',
                    fontWeight: isToday || isSelected ? 600 : 500,
                  }}
                >
                  {day}
                </span>
                {hasEvent && (
                  <span
                    style={{
                      width: 4,
                      height: 4,
                      borderRadius: 99,
                      background: isToday ? 'var(--ink)' : 'var(--muted)',
                    }}
                  />
                )}
              </button>
            )
          })}
        </div>
      </Card>

      {/* ── 그 날 일정 ─────────────────── */}
      <section>
        <SectionHead
          title={
            <>
              {month}월 {selectedDay}일 ({WEEKDAY_LABELS[selectedDow]})
              {selectedEvents.length > 0 && (
                <span style={{ fontWeight: 500, color: 'var(--muted)', fontSize: 13, marginLeft: 6 }}>
                  {selectedEvents.length}
                </span>
              )}
            </>
          }
          right={
            onCreateEvent ? (
              <button
                type="button"
                onClick={() => setAddOpen(true)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  height: 30,
                  minHeight: 30,
                  padding: '0 10px',
                  border: '1px solid var(--line-2)',
                  background: 'var(--surface)',
                  borderRadius: 8,
                  font: 'inherit',
                  fontSize: 12,
                  fontWeight: 600,
                  color: 'var(--text)',
                  cursor: 'pointer',
                }}
              >
                <PlusIcon /> 일정 추가
              </button>
            ) : null
          }
        />
        {selectedEvents.length === 0 ? (
          <Card padding={18} style={{ marginTop: 10, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
            등록된 일정이 없습니다
          </Card>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
            {selectedEvents.map((event) => (
              <DayEventCard key={event.id} event={event} onClick={() => setDetailEventId(event.id)} />
            ))}
          </div>
        )}
      </section>

      {/* ── 다가오는 일정 ──────────────── */}
      {upcomingEvents.length > 0 && (
        <section>
          <SectionHead
            title={
              <>
                다가오는 일정
                <span style={{ fontWeight: 500, color: 'var(--muted)', fontSize: 13, marginLeft: 6 }}>
                  {upcomingEvents.length}
                </span>
              </>
            }
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
            {upcomingEvents.map((event) => (
              <UpcomingEventCard key={event.id} event={event} onClick={() => setDetailEventId(event.id)} />
            ))}
          </div>
        </section>
      )}

      {/* ── 일정 추가/편집 시트 ─────────── */}
      {(addOpen || editingEvent) && (
        <EventAddSheet
          defaultDate={selectedDateStr}
          editingEvent={editingEvent}
          leaderNames={leaderNames}
          onClose={() => {
            setAddOpen(false)
            setEditingEventId(null)
          }}
          onSubmit={(input) => {
            if (editingEvent && onUpdateEvent) {
              const { date: _date, repeat: _repeat, repeatEnd: _repeatEnd, ...editInput } = input
              void _date
              void _repeat
              void _repeatEnd
              if (editingEvent.seriesId && onUpdateEventSeries) {
                setScopeAction({ kind: 'edit', event: editingEvent, input: editInput })
              } else {
                onUpdateEvent(editingEvent.id, editInput)
              }
            } else if (onCreateEvent) {
              const { date: eventDate, repeat, repeatEnd, ...eventInput } = input
              if (repeat && repeatEnd && onCreateRepeatEvents) {
                onCreateRepeatEvents(getWeeklyDates(eventDate, repeatEnd), eventInput)
              } else {
                onCreateEvent(input)
              }
            }
            setAddOpen(false)
            setEditingEventId(null)
          }}
        />
      )}

      {/* ── 일정 상세 시트 ─────────────── */}
      {detailEvent && (
        <AdminEventDetailSheet
          event={detailEvent}
          role={role}
          currentVisitor={currentVisitor}
          currentUserId={currentUserId}
          mentionUsers={mentionUsers}
          onClose={() => setDetailEventId(null)}
          onEdit={
            onUpdateEvent
              ? () => {
                  setEditingEventId(detailEvent.id)
                  setDetailEventId(null)
                }
              : undefined
          }
          onDelete={
            onDeleteEvent
              ? () => {
                  if (detailEvent.seriesId && onDeleteEventSeries) {
                    setScopeAction({ kind: 'delete', event: detailEvent })
                    setDetailEventId(null)
                  } else if (window.confirm(`"${detailEvent.title}" 일정을 삭제할까요?`)) {
                    onDeleteEvent(detailEvent.id)
                    setDetailEventId(null)
                  }
                }
              : undefined
          }
        />
      )}

      {scopeAction && (
        <SeriesScopeSheet
          action={scopeAction}
          onClose={() => setScopeAction(null)}
          onDeleteEvent={onDeleteEvent}
          onDeleteEventSeries={onDeleteEventSeries}
          onUpdateEvent={onUpdateEvent}
          onUpdateEventSeries={onUpdateEventSeries}
        />
      )}
    </div>
  )
}

// ── 섹션 헤더 ──────────────────────────
function SectionHead({ title, right }: { title: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        padding: '0 4px',
      }}
    >
      <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.01em' }}>
        {title}
      </h2>
      {right}
    </div>
  )
}

function SeriesScopeSheet({
  action,
  onClose,
  onDeleteEvent,
  onDeleteEventSeries,
  onUpdateEvent,
  onUpdateEventSeries,
}: {
  action: { kind: 'edit'; event: CalendarEvent; input: EventInput } | { kind: 'delete'; event: CalendarEvent }
  onClose: () => void
  onDeleteEvent?: (id: number) => void
  onDeleteEventSeries?: (seriesId: string, fromDate: string) => void
  onUpdateEvent?: (id: number, input: EventInput) => void
  onUpdateEventSeries?: (seriesId: string, fromDate: string, input: EventInput) => void
}) {
  const isEdit = action.kind === 'edit'
  const seriesId = action.event.seriesId
  const handleOnly = () => {
    if (isEdit) onUpdateEvent?.(action.event.id, action.input)
    else onDeleteEvent?.(action.event.id)
    onClose()
  }
  const handleSeries = () => {
    if (!seriesId) return
    if (isEdit) onUpdateEventSeries?.(seriesId, action.event.date, action.input)
    else onDeleteEventSeries?.(seriesId, action.event.date)
    onClose()
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 260,
        display: 'grid',
        placeItems: 'center',
        padding: 20,
        background: 'rgba(26,26,24,0.34)',
      }}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 360,
          padding: 18,
          borderRadius: 18,
          background: 'var(--bg)',
          border: '1px solid var(--line)',
          boxShadow: '0 20px 50px rgba(0,0,0,0.18)',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 4 }}>
          <strong style={{ color: 'var(--ink)', fontSize: 17, fontWeight: 750 }}>
            {isEdit ? '반복 일정 수정' : '반복 일정 삭제'}
          </strong>
          <span style={{ color: 'var(--muted)', fontSize: 12.5, lineHeight: 1.35 }}>
            이 일정은 반복 일정입니다. 적용 범위를 선택해 주세요.
          </span>
        </div>

        <ScopeButton
          description={`${action.event.date} 일정만 적용`}
          label={`이 일정만 ${isEdit ? '수정' : '삭제'}`}
          onClick={handleOnly}
        />
        <ScopeButton
          danger={!isEdit}
          description={`${action.event.date}부터 적용`}
          label={`이후 반복 일정 모두 ${isEdit ? '수정' : '삭제'}`}
          onClick={handleSeries}
          primary={isEdit}
        />

        <button
          type="button"
          onClick={onClose}
          style={{
            height: 40,
            minHeight: 40,
            border: 'none',
            borderRadius: 10,
            background: 'transparent',
            color: 'var(--muted)',
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          취소
        </button>
      </div>
    </div>
  )
}

function ScopeButton({
  danger = false,
  description,
  label,
  onClick,
  primary = false,
}: {
  danger?: boolean
  description: string
  label: string
  onClick: () => void
  primary?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        minHeight: 58,
        padding: '12px 14px',
        border: primary ? '1px solid var(--ink)' : danger ? '1px solid var(--status-danger)' : '1px solid var(--line)',
        borderRadius: 12,
        background: primary ? 'var(--ink)' : danger ? 'rgba(220,38,38,0.08)' : 'var(--surface)',
        color: primary ? '#fff' : danger ? 'var(--status-danger)' : 'var(--text)',
        textAlign: 'left',
        cursor: 'pointer',
      }}
    >
      <strong style={{ display: 'block', color: primary ? '#fff' : danger ? 'var(--status-danger)' : 'var(--ink)', fontSize: 14 }}>
        {label}
      </strong>
      <span style={{ display: 'block', marginTop: 3, opacity: 0.72, fontSize: 12 }}>{description}</span>
    </button>
  )
}

function NavButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: 32,
        height: 32,
        minHeight: 32,
        display: 'grid',
        placeItems: 'center',
        background: 'transparent',
        border: 'none',
        color: 'var(--text)',
        borderRadius: 8,
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  )
}

// ── 그 날 일정 카드 ────────────────────
function DayEventCard({ event, onClick }: { event: CalendarEvent; onClick?: () => void }) {
  const meta: string[] = []
  if (event.place) meta.push(event.place)
  if (event.leader) meta.push(event.leader)
  if (event.applicants && event.applicants.length > 0) {
    meta.push(`신청 ${event.applicants.length}명`)
  }
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'block',
        width: '100%',
        padding: 0,
        border: 'none',
        background: 'transparent',
        cursor: 'pointer',
        textAlign: 'left',
        minHeight: 0,
      }}
    >
    <Card padding={14}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            minWidth: 48,
            flexShrink: 0,
            gap: 2,
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>
            {event.time || '시간 미정'}
          </span>
          {event.endTime && (
            <span style={{ fontSize: 12, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>
              {event.endTime}
            </span>
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>{event.title}</span>
            {event.hasMeeting && (
              <span
                style={{
                  fontSize: 10.5,
                  padding: '2px 7px',
                  borderRadius: 999,
                  background: 'var(--tint)',
                  color: 'var(--text)',
                  fontWeight: 500,
                }}
              >
                봉사모임
              </span>
            )}
          </div>
          {meta.length > 0 && (
            <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 500 }}>
              {meta.join(' · ')}
            </span>
          )}
        </div>
        <ChevR />
      </div>
    </Card>
    </button>
  )
}

// ── 다가오는 일정 카드 ─────────────────
function UpcomingEventCard({ event, onClick }: { event: CalendarEvent; onClick?: () => void }) {
  const d = new Date(event.date)
  const dStr = `${d.getMonth() + 1}/${d.getDate()}`
  const dow = WEEKDAYS[d.getDay()]
  const meta: string[] = []
  if (event.time) meta.push(formatTimeRange(event.time, event.endTime))
  if (event.place) meta.push(event.place)
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'block',
        width: '100%',
        padding: 0,
        border: 'none',
        background: 'transparent',
        cursor: 'pointer',
        textAlign: 'left',
        minHeight: 0,
      }}
    >
    <Card padding="12px 14px">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 42, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>
            {dStr}
          </span>
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>{dow}</span>
        </div>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{event.title}</span>
          {meta.length > 0 && (
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>{meta.join(' · ')}</span>
          )}
        </div>
        <ChevR />
      </div>
    </Card>
    </button>
  )
}

// ── 일정 추가/편집 바텀 시트 ────────────────
function EventAddSheet({
  defaultDate,
  editingEvent,
  leaderNames,
  onClose,
  onSubmit,
}: {
  defaultDate: string
  editingEvent?: CalendarEvent | null
  leaderNames: string[]
  onClose: () => void
  onSubmit: (input: EventSheetInput) => void
}) {
  const [date, setDate] = useState(editingEvent?.date ?? defaultDate)
  const [time, setTime] = useState(editingEvent?.time ?? '')
  const [endTime, setEndTime] = useState(editingEvent?.endTime ?? '')
  const [title, setTitle] = useState(editingEvent?.title ?? '')
  const [memo, setMemo] = useState(editingEvent?.memo ?? '')
  const [place, setPlace] = useState(editingEvent?.place ?? '')
  const [mapLink, setMapLink] = useState(editingEvent?.mapLink ?? '')
  const [leader, setLeader] = useState(editingEvent?.leader ?? '')
  const [hasMeeting, setHasMeeting] = useState(editingEvent?.hasMeeting ?? false)
  const [allowApplications, setAllowApplications] = useState(editingEvent?.allowApplications ?? true)
  const [repeat, setRepeat] = useState(false)
  const [repeatEnd, setRepeatEnd] = useState('')
  const [timePresets, setTimePresets] = useState<TimePreset[]>(loadTimePresets)
  const [timeSettingsOpen, setTimeSettingsOpen] = useState(false)
  const canSubmit = title.trim().length > 0
  const isEditing = !!editingEvent
  const repeatCount = repeat && repeatEnd ? getWeeklyDates(date, repeatEnd).length : 0
  const selectedPreset = timePresets.find((preset) => preset.time === time)?.label ?? ''

  const updateTimePresets = (next: TimePreset[]) => {
    const normalized = normalizeTimePresets(next)
    setTimePresets(normalized)
    saveTimePresets(normalized)
  }

  const applyTimePreset = (preset: TimePreset) => {
    setTime(preset.time)
    setEndTime(addMinutesToTime(preset.time, preset.durationMinutes))
    if (!title.trim() || timePresets.some((item) => item.title === title)) {
      setTitle(preset.title)
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        background: 'rgba(26,26,24,0.34)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg)',
          borderTopLeftRadius: 18,
          borderTopRightRadius: 18,
          width: '100%',
          maxWidth: '100vw',
          boxSizing: 'border-box',
          padding: '8px 12px max(14px, env(safe-area-inset-bottom))',
          boxShadow: '0 -12px 40px rgba(0,0,0,0.18)',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflowX: 'hidden',
        }}
      >
        {/* 핸들 */}
        <div style={{ width: 30, height: 4, borderRadius: 99, background: 'var(--line-2)', margin: '4px auto 12px' }} />

        {/* 제목 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink)' }}>{isEditing ? '일정 편집' : '새 일정 추가'}</span>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>{date.replace(/-/g, '.')}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              width: 36,
              height: 36,
              minHeight: 36,
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              color: 'var(--text)',
              fontSize: 20,
            }}
          >
            ✕
          </button>
        </div>

        {/* 폼 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto', overflowX: 'hidden', flex: 1, minWidth: 0 }}>
          <Field
            label={
              <>
                일정 제목 <span style={{ color: 'var(--status-danger)' }}>*</span>
              </>
            }
          >
            <TextInput value={title} onChange={setTitle} placeholder="일정 제목" />
          </Field>

          <Field
            label={
              <>
                상세 설명 <span style={{ color: 'var(--muted)', fontWeight: 500 }}>(선택)</span>
              </>
            }
          >
            <TextArea value={memo} onChange={setMemo} placeholder="추가 설명" />
          </Field>

          <Field label="날짜와 시간">
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                padding: 10,
                border: '1px solid var(--line)',
                borderRadius: 12,
                background: 'var(--surface)',
                boxSizing: 'border-box',
                minWidth: 0,
              }}
            >
              <TextInput type="date" value={date} onChange={setDate} subtle />
              {!isEditing && (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    padding: '9px 10px',
                    border: '1px solid var(--line)',
                    borderRadius: 10,
                    background: 'var(--bg)',
                    minWidth: 0,
                    boxSizing: 'border-box',
                  }}
                >
                  <SettingToggle
                    checked={repeat}
                    compact
                    description="같은 요일로 반복 일정을 생성합니다."
                    label="매주 반복"
                    onChange={setRepeat}
                  />
                  {repeat && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr)', gap: 8, alignItems: 'center', minWidth: 0 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', whiteSpace: 'nowrap' }}>종료일</span>
                      <TextInput type="date" value={repeatEnd} onChange={setRepeatEnd} subtle />
                      {repeatEnd && (
                        <span style={{ gridColumn: '1 / -1', color: 'var(--muted)', fontSize: 11.5, fontWeight: 600 }}>
                          {repeatCount}개 일정 생성 예정
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>자주 쓰는 시간</span>
                <button
                  type="button"
                  onClick={() => setTimeSettingsOpen((value) => !value)}
                  style={{
                    minHeight: 0,
                    border: 'none',
                    background: 'transparent',
                    color: 'var(--text)',
                    fontSize: 12,
                    fontWeight: 700,
                    padding: '4px 2px',
                    cursor: 'pointer',
                  }}
                >
                  {timeSettingsOpen ? '설정 닫기' : '시간 설정'}
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 6, minWidth: 0 }}>
                {timePresets.map((preset) => {
                  const active = selectedPreset === preset.label
                  return (
                    <button
                      key={`${preset.label}-${preset.time}`}
                      type="button"
                      onClick={() => applyTimePreset(preset)}
                      style={{
                        minHeight: 42,
                        border: active ? '1px solid var(--ink)' : '1px solid var(--line)',
                        borderRadius: 10,
                        background: active ? 'var(--ink)' : 'var(--bg)',
                        color: active ? '#fff' : 'var(--text)',
                        cursor: 'pointer',
                        padding: '6px 8px',
                        textAlign: 'left',
                        minWidth: 0,
                        overflow: 'hidden',
                      }}
                    >
                      <span style={{ display: 'block', fontSize: 12.5, fontWeight: 750, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{preset.label}</span>
                      <span style={{ display: 'block', marginTop: 2, fontSize: 11, fontWeight: 650, opacity: active ? 0.85 : 0.68, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {preset.time} - {addMinutesToTime(preset.time, preset.durationMinutes)}
                      </span>
                    </button>
                  )
                })}
              </div>

              {timeSettingsOpen && (
                <TimePresetEditor presets={timePresets} onChange={updateTimePresets} />
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto minmax(0, 1fr)', gap: 6, alignItems: 'center', minWidth: 0 }}>
                <TimeBox label="시작" value={time} onChange={setTime} />
                <span style={{ color: 'var(--muted-2)', fontSize: 13, fontWeight: 700 }}>—</span>
                <TimeBox label="종료" value={endTime} onChange={setEndTime} placeholder="선택" />
              </div>
            </div>
          </Field>

          <Field label="모임 장소">
            <TextInput value={place} onChange={setPlace} placeholder="장소 입력" />
            <TextInput value={mapLink} onChange={setMapLink} placeholder="네이버 지도 링크 (선택)" />
          </Field>

          <Field label="인도자">
            <Select value={leader} onChange={setLeader} options={['', ...leaderNames]} placeholder="선택 안함" />
          </Field>

          <Field label="설정">
            <SettingToggle
              checked={hasMeeting}
              description="모임 일정이면 카드에 표시됩니다."
              label="봉사모임"
              onChange={setHasMeeting}
            />
            <SettingToggle
              checked={allowApplications}
              description="봉사자들이 이 일정에 신청할 수 있습니다."
              label="봉사 신청 받기"
              onChange={setAllowApplications}
            />
          </Field>
        </div>

        {/* 저장 */}
        <button
          type="button"
          disabled={!canSubmit}
          onClick={() => onSubmit({ date, time, endTime: endTime || undefined, title: title.trim(), memo: memo.trim(), place: place.trim(), mapLink: mapLink.trim() || undefined, leader, hasMeeting, allowApplications, repeat: !isEditing && repeat, repeatEnd })}
          style={{
            marginTop: 14,
            height: 46,
            width: '100%',
            background: canSubmit ? 'var(--ink)' : 'var(--tint)',
            color: canSubmit ? '#fff' : 'var(--muted-2)',
            border: 'none',
            borderRadius: 8,
            fontSize: 15,
            fontWeight: 600,
            cursor: canSubmit ? 'pointer' : 'not-allowed',
            letterSpacing: '-0.005em',
          }}
        >
          저장
        </button>
      </div>
    </div>
  )
}

// ── 폼 헬퍼 ─────────────────────────────
function Field({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0 }}>
      {label && (
        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{label}</label>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7, minWidth: 0 }}>{children}</div>
    </div>
  )
}

function TextInput({
  value,
  onChange,
  placeholder,
  type = 'text',
  subtle = false,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
  subtle?: boolean
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        display: 'block',
        background: subtle ? 'var(--bg)' : 'var(--surface)',
        border: subtle ? '1px solid transparent' : '1px solid var(--line)',
        borderRadius: 10,
        padding: '10px 12px',
        fontSize: 14,
        color: 'var(--text)',
        font: 'inherit',
        outline: 'none',
        width: '100%',
        maxWidth: '100%',
        minWidth: 0,
        minHeight: 42,
        boxSizing: 'border-box',
        accentColor: 'var(--ink)',
        // iOS Safari: date/time 인풋이 콘텐츠 폭에 맞춰지지 않는 문제 방지
        WebkitAppearance: type === 'date' || type === 'time' ? 'none' : undefined,
        appearance: type === 'date' || type === 'time' ? 'none' : undefined,
        textAlign: type === 'date' || type === 'time' ? 'left' : undefined,
      }}
    />
  )
}

function TimeBox({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <label
      style={{
        display: 'grid',
        gridTemplateColumns: 'auto 1fr',
        alignItems: 'center',
        gap: 8,
        minWidth: 0,
        padding: '8px 9px',
        border: '1px solid var(--line)',
        borderRadius: 10,
        background: 'var(--bg)',
        boxSizing: 'border-box',
        minHeight: 40,
      }}
    >
      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{label}</span>
      <input
        type="time"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          minWidth: 0,
          width: '100%',
          border: 'none',
          background: 'transparent',
          color: value ? 'var(--ink)' : 'var(--muted-2)',
          font: 'inherit',
          fontSize: 14,
          fontWeight: 700,
          outline: 'none',
          padding: 0,
          accentColor: 'var(--ink)',
        }}
      />
    </label>
  )
}

function TimePresetEditor({
  presets,
  onChange,
}: {
  presets: TimePreset[]
  onChange: (presets: TimePreset[]) => void
}) {
  const updatePreset = (index: number, patch: Partial<TimePreset>) => {
    onChange(presets.map((preset, i) => i === index ? { ...preset, ...patch } : preset))
  }

  const addPreset = () => {
    if (presets.length >= TIME_PRESETS_MAX) return
    const baseHour = 10 + presets.length * 2
    const time = `${pad2(Math.min(baseHour, 21))}:00`
    onChange([
      ...presets,
      {
        label: `시간 ${presets.length + 1}`,
        time,
        durationMinutes: 120,
        title: '방문',
      },
    ])
  }

  const removePreset = (index: number) => {
    if (presets.length <= 1) return
    onChange(presets.filter((_, i) => i !== index))
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        padding: 8,
        border: '1px solid var(--line)',
        borderRadius: 12,
        background: 'var(--bg)',
        minWidth: 0,
        boxSizing: 'border-box',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 750, color: 'var(--ink)' }}>빠른 시간 편집</span>
        <button
          type="button"
          disabled={presets.length >= TIME_PRESETS_MAX}
          onClick={addPreset}
          style={{
            minHeight: 0,
            border: '1px solid var(--line)',
            borderRadius: 8,
            background: presets.length >= TIME_PRESETS_MAX ? 'var(--surface)' : '#fff',
            color: presets.length >= TIME_PRESETS_MAX ? 'var(--muted-2)' : 'var(--text)',
            cursor: presets.length >= TIME_PRESETS_MAX ? 'not-allowed' : 'pointer',
            fontSize: 12,
            fontWeight: 750,
            padding: '6px 9px',
          }}
        >
          + 추가
        </button>
      </div>

      {presets.map((preset, index) => (
        <div
          key={`${index}-${preset.time}`}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 5,
            minWidth: 0,
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1.1fr) minmax(0, 1fr) minmax(0, 0.7fr) 24px',
              gap: 5,
              alignItems: 'center',
              minWidth: 0,
            }}
          >
            <MiniInput
              ariaLabel="시간 라벨"
              value={preset.label}
              onChange={(value) => updatePreset(index, { label: value })}
              placeholder="라벨"
            />
            <MiniInput
              ariaLabel="시작 시간"
              type="time"
              value={preset.time}
              onChange={(value) => updatePreset(index, { time: value })}
            />
            <MiniInput
              ariaLabel="소요 시간"
              type="number"
              value={String(preset.durationMinutes)}
              onChange={(value) => updatePreset(index, { durationMinutes: Number(value) || 120 })}
              suffix="분"
            />
            <button
              type="button"
              disabled={presets.length <= 1}
              onClick={() => removePreset(index)}
              style={{
                width: 24,
                height: 24,
                minHeight: 24,
                border: 'none',
                borderRadius: 6,
                background: 'transparent',
                color: presets.length <= 1 ? 'var(--muted-2)' : 'var(--status-danger)',
                cursor: presets.length <= 1 ? 'not-allowed' : 'pointer',
                fontSize: 16,
                lineHeight: 1,
                padding: 0,
                display: 'grid',
                placeItems: 'center',
              }}
              aria-label="빠른 시간 삭제"
            >
              ×
            </button>
          </div>
          <MiniInput
            ariaLabel="기본 제목"
            value={preset.title}
            onChange={(value) => updatePreset(index, { title: value })}
            placeholder="기본 제목"
          />
        </div>
      ))}

      <p style={{ margin: 0, color: 'var(--muted)', fontSize: 11.5, lineHeight: 1.35 }}>
        시간을 누르면 종료시간은 소요시간만큼 자동 입력됩니다. 기본 소요시간은 120분입니다.
      </p>
    </div>
  )
}

function MiniInput({
  ariaLabel,
  onChange,
  placeholder,
  suffix,
  type = 'text',
  value,
}: {
  ariaLabel: string
  onChange: (value: string) => void
  placeholder?: string
  suffix?: string
  type?: string
  value: string
}) {
  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'center',
        minWidth: 0,
        height: 32,
        border: '1px solid var(--line)',
        borderRadius: 8,
        background: '#fff',
        padding: '0 7px',
        boxSizing: 'border-box',
      }}
    >
      <input
        aria-label={ariaLabel}
        type={type}
        min={type === 'number' ? 15 : undefined}
        max={type === 'number' ? 480 : undefined}
        step={type === 'number' ? 15 : undefined}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        style={{
          display: 'block',
          minWidth: 0,
          width: '100%',
          maxWidth: '100%',
          border: 'none',
          background: 'transparent',
          color: 'var(--ink)',
          font: 'inherit',
          fontSize: 11.5,
          fontWeight: 650,
          outline: 'none',
          padding: 0,
          boxSizing: 'border-box',
          accentColor: 'var(--ink)',
          WebkitAppearance: type === 'time' ? 'none' : undefined,
          appearance: type === 'time' ? 'none' : undefined,
        }}
      />
      {suffix && <span style={{ flex: '0 0 auto', color: 'var(--muted)', fontSize: 11, fontWeight: 700 }}>{suffix}</span>}
    </label>
  )
}

function TextArea({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={3}
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--line)',
        borderRadius: 10,
        padding: '12px 14px',
        fontSize: 14,
        color: 'var(--text)',
        font: 'inherit',
        outline: 'none',
        width: '100%',
        resize: 'vertical',
        minHeight: 64,
      }}
    />
  )
}

function Select({ value, onChange, options, placeholder }: { value: string; onChange: (v: string) => void; options: string[]; placeholder?: string }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--line)',
        borderRadius: 10,
        padding: '12px 14px',
        fontSize: 14,
        color: value ? 'var(--text)' : 'var(--muted-2)',
        font: 'inherit',
        outline: 'none',
        width: '100%',
        appearance: 'none',
      }}
    >
      {options.map((opt) => (
        <option key={opt} value={opt}>
          {opt || placeholder || '선택 안함'}
        </option>
      ))}
    </select>
  )
}

function SettingToggle({
  checked,
  compact = false,
  description,
  label,
  onChange,
}: {
  checked: boolean
  compact?: boolean
  description: string
  label: string
  onChange: (v: boolean) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        width: '100%',
        minHeight: compact ? 0 : 58,
        padding: compact ? '2px 0' : '11px 12px',
        border: compact ? 'none' : '1px solid var(--line)',
        borderRadius: compact ? 0 : 12,
        background: compact ? 'transparent' : 'var(--surface)',
        color: 'var(--text)',
        textAlign: 'left',
        cursor: 'pointer',
      }}
    >
      <span style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
        <strong style={{ fontSize: compact ? 13 : 14, fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.005em' }}>{label}</strong>
        <small style={{ fontSize: compact ? 11.5 : 12, fontWeight: 500, color: 'var(--muted)', lineHeight: 1.3 }}>{description}</small>
      </span>
      <span
        aria-hidden
        style={{
          position: 'relative',
          flex: '0 0 auto',
          width: 42,
          height: 24,
          borderRadius: 999,
          background: checked ? 'var(--ink)' : 'var(--line-2)',
          transition: 'background 0.15s ease',
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: 3,
            left: checked ? 21 : 3,
            width: 18,
            height: 18,
            borderRadius: '50%',
            background: '#fff',
            boxShadow: '0 1px 3px rgba(0,0,0,0.14)',
            transition: 'left 0.15s ease',
          }}
        />
      </span>
    </button>
  )
}
