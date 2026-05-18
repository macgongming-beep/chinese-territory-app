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

import { useMemo, useState } from 'react'
import type { CalendarEvent, Role } from '../../types'
import type { AppLanguage } from '../../i18n'
import { Card } from '../ui'
import { AdminEventDetailSheet } from './AdminEventDetailSheet'
import type { MentionUser } from '../CommentSection'

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']
const WEEKDAY_LABELS = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일']
const TIME_PRESETS = [
  { label: '오전', time: '10:00', title: '오전 방문' },
  { label: '오후', time: '13:00', title: '오후 방문' },
  { label: '저녁', time: '19:00', title: '저녁 방문' },
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

type Props = {
  language: AppLanguage
  currentVisitor: string
  currentUserId?: number | null
  role: Role
  events: CalendarEvent[]
  leaderNames?: string[]
  mentionUsers?: MentionUser[]
  onCreateEvent?: (input: EventInput & { date: string }) => void
  onDeleteEvent?: (id: number) => void
  onUpdateEvent?: (id: number, input: EventInput) => void
}

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

function toDateStr(year: number, month: number, day: number) {
  return `${year}-${pad2(month)}-${pad2(day)}`
}

// 시간 범위 포맷: "13:00 — 15:00" 또는 "13:00"
function formatTimeRange(start?: string, end?: string): string {
  if (!start) return ''
  return end ? `${start} — ${end}` : start
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
  onDeleteEvent,
  onUpdateEvent,
}: Props) {
  const today = useMemo(() => new Date(), [])
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1)
  const [selectedDay, setSelectedDay] = useState(today.getDate())
  const [addOpen, setAddOpen] = useState(false)
  const [editingEventId, setEditingEventId] = useState<number | null>(null)
  const [detailEventId, setDetailEventId] = useState<number | null>(null)
  const detailEvent = detailEventId !== null ? events.find((e) => e.id === detailEventId) ?? null : null
  const editingEvent = editingEventId !== null ? events.find((e) => e.id === editingEventId) ?? null : null

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
              const { date: _date, ...editInput } = input
              void _date
              onUpdateEvent(editingEvent.id, editInput)
            } else if (onCreateEvent) {
              onCreateEvent(input)
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
                  if (window.confirm(`"${detailEvent.title}" 일정을 삭제할까요?`)) {
                    onDeleteEvent(detailEvent.id)
                    setDetailEventId(null)
                  }
                }
              : undefined
          }
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
  onSubmit: (input: EventInput & { date: string }) => void
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
  const canSubmit = title.trim().length > 0
  const isEditing = !!editingEvent
  const selectedPreset = TIME_PRESETS.find((preset) => preset.time === time)?.label ?? ''

  const applyTimePreset = (preset: (typeof TIME_PRESETS)[number]) => {
    setTime(preset.time)
    if (!title.trim() || TIME_PRESETS.some((item) => item.title === title)) {
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
          padding: '8px 16px max(18px, env(safe-area-inset-bottom))',
          boxShadow: '0 -12px 40px rgba(0,0,0,0.18)',
          maxHeight: '88vh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* 핸들 */}
        <div style={{ width: 32, height: 4, borderRadius: 99, background: 'var(--line-2)', margin: '4px auto 14px' }} />

        {/* 제목 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto', flex: 1, paddingRight: 2, marginRight: -2 }}>
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
                gap: 10,
                padding: 12,
                border: '1px solid var(--line)',
                borderRadius: 14,
                background: 'var(--surface)',
              }}
            >
              <TextInput type="date" value={date} onChange={setDate} subtle />

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                {TIME_PRESETS.map((preset) => {
                  const active = selectedPreset === preset.label
                  return (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => applyTimePreset(preset)}
                      style={{
                        height: 36,
                        minHeight: 36,
                        border: active ? '1px solid var(--ink)' : '1px solid var(--line)',
                        borderRadius: 10,
                        background: active ? 'var(--ink)' : 'var(--bg)',
                        color: active ? '#fff' : 'var(--text)',
                        fontSize: 13,
                        fontWeight: 650,
                        cursor: 'pointer',
                        padding: 0,
                      }}
                    >
                      {preset.label} {preset.time}
                    </button>
                  )
                })}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 8, alignItems: 'center' }}>
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
          onClick={() => onSubmit({ date, time, endTime: endTime || undefined, title: title.trim(), memo: memo.trim(), place: place.trim(), mapLink: mapLink.trim() || undefined, leader, hasMeeting, allowApplications })}
          style={{
            marginTop: 14,
            height: 48,
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {label && (
        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{label}</label>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{children}</div>
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
        background: subtle ? 'var(--bg)' : 'var(--surface)',
        border: subtle ? '1px solid transparent' : '1px solid var(--line)',
        borderRadius: 10,
        padding: '12px 14px',
        fontSize: 14,
        color: 'var(--text)',
        font: 'inherit',
        outline: 'none',
        width: '100%',
        accentColor: 'var(--ink)',
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
        padding: '9px 10px',
        border: '1px solid var(--line)',
        borderRadius: 10,
        background: 'var(--bg)',
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
  description,
  label,
  onChange,
}: {
  checked: boolean
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
        minHeight: 58,
        padding: '11px 12px',
        border: '1px solid var(--line)',
        borderRadius: 12,
        background: 'var(--surface)',
        color: 'var(--text)',
        textAlign: 'left',
        cursor: 'pointer',
      }}
    >
      <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
        <strong style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{label}</strong>
        <small style={{ fontSize: 12, fontWeight: 500, color: 'var(--muted)', lineHeight: 1.25 }}>{description}</small>
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
