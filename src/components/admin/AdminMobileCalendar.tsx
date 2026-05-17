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

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']
const WEEKDAY_LABELS = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일']

type EventInput = {
  time: string
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
  role: Role
  events: CalendarEvent[]
  leaderNames?: string[]
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
  leaderNames = [],
  onCreateEvent,
}: Props) {
  const today = useMemo(() => new Date(), [])
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1)
  const [selectedDay, setSelectedDay] = useState(today.getDate())
  const [addOpen, setAddOpen] = useState(false)

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
              <DayEventCard key={event.id} event={event} />
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
              <UpcomingEventCard key={event.id} event={event} />
            ))}
          </div>
        </section>
      )}

      {/* ── 일정 추가 시트 ─────────────── */}
      {addOpen && onCreateEvent && (
        <EventAddSheet
          defaultDate={selectedDateStr}
          leaderNames={leaderNames}
          onClose={() => setAddOpen(false)}
          onSubmit={(input) => {
            onCreateEvent(input)
            setAddOpen(false)
          }}
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
function DayEventCard({ event }: { event: CalendarEvent }) {
  const meta: string[] = []
  if (event.place) meta.push(event.place)
  if (event.leader) meta.push(event.leader)
  if (event.applicants && event.applicants.length > 0) {
    meta.push(`신청 ${event.applicants.length}명`)
  }
  return (
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
  )
}

// ── 다가오는 일정 카드 ─────────────────
function UpcomingEventCard({ event }: { event: CalendarEvent }) {
  const d = new Date(event.date)
  const dStr = `${d.getMonth() + 1}/${d.getDate()}`
  const dow = WEEKDAYS[d.getDay()]
  const meta: string[] = []
  if (event.time) meta.push(event.time)
  if (event.place) meta.push(event.place)
  return (
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
  )
}

// ── 일정 추가 바텀 시트 ────────────────
function EventAddSheet({
  defaultDate,
  leaderNames,
  onClose,
  onSubmit,
}: {
  defaultDate: string
  leaderNames: string[]
  onClose: () => void
  onSubmit: (input: EventInput & { date: string }) => void
}) {
  const [date, setDate] = useState(defaultDate)
  const [time, setTime] = useState('')
  const [title, setTitle] = useState('')
  const [memo, setMemo] = useState('')
  const [place, setPlace] = useState('')
  const [mapLink, setMapLink] = useState('')
  const [leader, setLeader] = useState('')
  const [hasMeeting, setHasMeeting] = useState(false)
  const [allowApplications, setAllowApplications] = useState(true)
  const canSubmit = title.trim().length > 0

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
            <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink)' }}>새 일정 추가</span>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>{date.replace(/-/g, '.')}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              width: 36,
              height: 36,
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

          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1 }}>
              <Field label="날짜">
                <TextInput type="date" value={date} onChange={setDate} />
              </Field>
            </div>
            <div style={{ flex: 1 }}>
              <Field label="시간">
                <TextInput type="time" value={time} onChange={setTime} />
              </Field>
            </div>
          </div>

          <Field label="모임 장소">
            <TextInput value={place} onChange={setPlace} placeholder="장소 입력" />
            <TextInput value={mapLink} onChange={setMapLink} placeholder="네이버 지도 링크 (선택)" />
          </Field>

          <Field label="인도자">
            <Select value={leader} onChange={setLeader} options={['', ...leaderNames]} placeholder="선택 안함" />
          </Field>

          <Field label="">
            <CheckRow checked={hasMeeting} onChange={setHasMeeting} label="봉사 모임 있음" />
            <CheckRow checked={allowApplications} onChange={setAllowApplications} label="이 일정에 봉사 신청을 받습니다" />
          </Field>
        </div>

        {/* 저장 */}
        <button
          type="button"
          disabled={!canSubmit}
          onClick={() => onSubmit({ date, time, title: title.trim(), memo: memo.trim(), place: place.trim(), mapLink: mapLink.trim() || undefined, leader, hasMeeting, allowApplications })}
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
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
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
      }}
    />
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

function CheckRow({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        fontSize: 14,
        color: 'var(--text)',
        padding: '8px 0',
        cursor: 'pointer',
      }}
    >
      <button
        type="button"
        onClick={() => onChange(!checked)}
        style={{
          width: 18,
          height: 18,
          borderRadius: 5,
          background: checked ? 'var(--ink)' : 'var(--surface)',
          border: checked ? 'none' : '1px solid var(--line-2)',
          display: 'grid',
          placeItems: 'center',
          color: '#fff',
          padding: 0,
          flexShrink: 0,
          cursor: 'pointer',
        }}
      >
        {checked && (
          <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
            <polyline points="5 13 10 18 19 8" />
          </svg>
        )}
      </button>
      {label}
    </label>
  )
}
