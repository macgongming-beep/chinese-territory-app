// 관리자 모바일 홈 — design_handoff_admin_redesign 01 화면
// 구조: 공지 → 오늘의 봉사 → 운영 현황
//
// 헤더는 상위(MobileHome.tsx)의 AppHeader 가 그림.

import type { CalendarEvent, Notice, TerritoryCard } from '../../types'
import type { AppLanguage } from '../../i18n'
import { t, formatLeaderOf, formatJoined, formatPeriod, weekdayShortLabels } from '../../i18n'

type WeekDay = { date: Date; iso: string; hasEvent: boolean }

type ChevRIconProps = { size?: number; color?: string }
function ChevR({ size = 14, color = 'var(--muted-2)' }: ChevRIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="9 6 15 12 9 18" />
    </svg>
  )
}

function PinIcon() {
  return (
    <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 21s6-5.2 6-11a6 6 0 0 0-12 0c0 5.8 6 11 6 11Z" />
      <circle cx="12" cy="10" r="2" />
    </svg>
  )
}

function UserIcon() {
  return (
    <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="8" r="3.2" />
      <path d="M5.8 19c.8-3.4 3-5.2 6.2-5.2s5.4 1.8 6.2 5.2" />
    </svg>
  )
}

type Props = {
  language: AppLanguage
  notices: Notice[]
  todayEvents: CalendarEvent[]
  cards: TerritoryCard[]
  totalUnits: number
  completedUnits: number
  inProgressCount: number
  unassignedCount: number
  noticeReadCount?: { read: number; total: number } | null
  onOpenNotices: () => void
  onOpenCalendar: () => void
  onOpenZone: () => void
  // A안
  weekDays: WeekDay[]
  today: string
  selectedWeekDate: string | null
  selectedDateEvents: CalendarEvent[]
  onSelectWeekDate: (date: string) => void
  onOpenEventDetail: (eventId: number) => void
}

function timeBlock(time: string, lang: AppLanguage) {
  const [hh] = time.split(':')
  const hour = Number(hh)
  if (!Number.isFinite(hour)) return { display: time, period: '' }
  return { display: String(hour), period: formatPeriod(lang, hour) }
}

export function AdminMobileHome({
  language,
  notices,
  todayEvents,
  cards,
  totalUnits,
  completedUnits,
  inProgressCount,
  unassignedCount,
  onOpenNotices,
  onOpenCalendar,
  onOpenZone,
  weekDays,
  today,
  selectedWeekDate,
  selectedDateEvents,
  onSelectWeekDate,
  onOpenEventDetail,
}: Props) {
  const latestNotice = notices.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null
  const completedPct = totalUnits > 0 ? (completedUnits / totalUnits) * 100 : 0
  const completedPctText = completedPct >= 10 ? completedPct.toFixed(1) : completedPct.toFixed(2)

  return (
    <div className="mh-page">
      {/* ── 공지 ────────────────────────── */}
      <section className="mobile-home-section">
        <div className="mh-sec-head">
          <h2>{t(language, 'home.notice')}</h2>
          <button type="button" onClick={onOpenNotices} className="mh-all">
            {t(language, 'home.viewAllBtn')} <ChevR size={14} color="currentColor" />
          </button>
        </div>
        {latestNotice ? (
          <div className="mh-notice-list">
            <button
              type="button"
              className="mh-notice-row"
              onClick={onOpenNotices}
            >
              <span className="mh-notice-pill">{t(language, 'home.noticePill')}</span>
              <span className="mh-notice-title">{latestNotice.title}</span>
              <span className="mh-notice-date">{latestNotice.createdAt.slice(5, 10).replace('-', '/')}</span>
            </button>
          </div>
        ) : (
          <div className="mh-empty-line">
            <span>{t(language, 'home.noNoticesShort')}</span>
          </div>
        )}
      </section>

      {/* ── 오늘의 봉사 ──────────────────── */}
      <section className="mobile-home-section">
        <div className="mh-sec-head">
          <h2>
            {t(language, 'home.todayServiceShort')}
            <span className="mh-cnt">{todayEvents.length}</span>
          </h2>
          <button type="button" onClick={onOpenCalendar} className="mh-all">
            {t(language, 'home.viewAllBtn')} <ChevR size={14} color="currentColor" />
          </button>
        </div>
        {todayEvents.length === 0 ? (
          <div className="mh-empty-line">
            <span>{t(language, 'home.noTodayServiceShort')}</span>
          </div>
        ) : (
          <div className="mh-today-list">
            {todayEvents.map((event) => {
              const tb = timeBlock(event.time || '', language)
              return (
                <button
                  key={event.id}
                  type="button"
                  className="mh-today-serving"
                  onClick={() => onOpenEventDetail(event.id)}
                >
                  <span className="mh-today-time">
                    <span className="mh-today-time-hour">{tb.display}</span>
                    <span className="mh-today-time-period">{tb.period}</span>
                  </span>
                  <span className="mh-today-body">
                    <span className="mh-today-title-row">
                      <span className="mh-today-title">{event.title}</span>
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 2 }}>
                      {event.place && (
                        <span className="mh-today-where" style={{ margin: 0 }}>
                          <PinIcon />
                          {event.place}
                        </span>
                      )}
                      {event.place && event.leader && <span style={{ color: 'var(--muted-3)', fontSize: 12 }}>·</span>}
                      {event.leader && (
                        <span className="mh-today-sub" style={{ margin: 0, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <UserIcon />
                          {event.leader}
                        </span>
                      )}
                    </span>
                  </span>
                  <ChevR size={14} color="currentColor" />
                </button>
              )
            })}
          </div>
        )}
      </section>

      {/* ── 이번 주 일정 (A안) ────────────── */}
      {(() => {
        const activeDate = selectedWeekDate ?? today
        const wdShort = weekdayShortLabels[language]
        return (
          <section className="mobile-home-section">
            <div className="mh-sec-head">
              <h2>{t(language, 'home.weekSchedule')}</h2>
              <button type="button" onClick={onOpenCalendar} className="mh-all">
                {t(language, 'home.viewAllBtn')} <ChevR size={14} color="currentColor" />
              </button>
            </div>
            <div className="mh-week-dots">
              {weekDays.map((d, i) => {
                const isToday = i === 0
                const isSelected = d.iso === activeDate
                return (
                  <button
                    key={d.iso}
                    type="button"
                    onClick={() => onSelectWeekDate(d.iso)}
                    className={`mh-week-dot-cell${isToday ? ' is-today' : ''}${isSelected ? ' is-selected' : ''}`}
                  >
                    <span className="mh-week-dot-wd">{wdShort[d.date.getDay()]}</span>
                    <span className="mh-week-dot-day">{d.date.getDate()}</span>
                    <span className={`mh-week-dot${d.hasEvent ? ' filled' : ''}`} />
                  </button>
                )
              })}
            </div>
            {selectedDateEvents.length === 0 ? (
              <div className="mh-empty-line" style={{ marginTop: 10 }}>
                <span>{activeDate === today ? t(language, 'home.noEventsToday') : t(language, 'home.noEventsThisDay')}</span>
              </div>
            ) : (
              selectedDateEvents.map((event) => {
                const date = new Date(event.date + 'T00:00:00')
                const todayDate = new Date(today + 'T00:00:00')
                const diff = Math.round((date.getTime() - todayDate.getTime()) / 86400000)
                const dateLabel = diff === 0 ? t(language, 'home.dateToday') : diff === 1 ? t(language, 'home.dateTomorrow') : diff === 2 ? t(language, 'home.dateDayAfter') : `${date.getMonth() + 1}/${date.getDate()}(${wdShort[date.getDay()]})`
                const participantCount = new Set([...(event.assigned ?? []), ...(event.applicants ?? [])]).size
                return (
                  <button key={event.id} type="button" onClick={() => onOpenEventDetail(event.id)} className="mh-upcoming-row mh-upcoming-row--featured">
                    <span className="mh-upcoming-date">{dateLabel} {event.time}</span>
                    <span className="mh-upcoming-title">{event.title}</span>
                    <span className="mh-upcoming-meta">
                      {event.leader ? formatLeaderOf(language, event.leader) : ''}
                      {participantCount > 0 ? ` · ${formatJoined(language, participantCount)}` : ''}
                    </span>
                  </button>
                )
              })
            )}
          </section>
        )
      })()}

      {/* ── 운영 현황 ────────────────────── */}
      <section className="mobile-home-section">
        <div className="mh-sec-head">
          <h2>{t(language, 'home.operationStatus')}</h2>
          <button type="button" onClick={onOpenZone} className="mh-all">
            {t(language, 'home.viewAllBtn')} <ChevR size={14} color="currentColor" />
          </button>
        </div>
        <div className="mh-card-grid" style={{ marginTop: 0 }}>
          <StatTile num={cards.length} sub={t(language, 'home.totalCards')} />
          <StatTile num={inProgressCount} sub={t(language, 'home.inProgress')} />
          <StatTile num={unassignedCount} sub={t(language, 'zone.unassigned')} danger />
          <StatTile num={completedPctText} unit="%" sub={`${t(language, 'home.completedUnits')} ${completedUnits} / ${totalUnits}`} />
        </div>
      </section>
    </div>
  )
}

function StatTile({ num, unit, sub, danger }: { num: number | string; unit?: string; sub: string; danger?: boolean }) {
  return (
    <div className="mh-card-tile" style={{ padding: '16px 14px', alignItems: 'center', textAlign: 'center', background: 'var(--surface)' }}>
      <div
        style={{
          fontSize: 26,
          fontWeight: 700,
          color: danger ? 'var(--status-danger)' : 'var(--ink)',
          letterSpacing: '-0.02em',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {num}
        {unit && <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--muted)' }}>{unit}</span>}
      </div>
      <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 500, marginTop: 4 }}>{sub}</div>
    </div>
  )
}
