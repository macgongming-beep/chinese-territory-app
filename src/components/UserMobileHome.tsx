import { useNavigate } from 'react-router-dom'
import type { Notice, TerritoryCard, CalendarEvent, Role } from '../types'
import type { AppLanguage } from '../i18n'
import { t, formatPeriod, formatLeadSub, formatLeaderOf, formatApplied, formatJoined, weekdayShortLabels } from '../i18n'

export function UserMobileHome({
  language,
  notices,
  myTodayEvents,
  today,
  selectedWeekDate,
  weekDays,
  selectedDateEvents,
  leaderCards,
  role,
  onSelectWeekDate,
  onOpenNotices,
  onOpenCalendar,
  onOpenEventDetail,
  onOpenZone,
}: {
  language: AppLanguage
  notices: Notice[]
  myTodayEvents: Array<{ event: CalendarEvent; kind: 'lead' | 'join' | 'avail' }>
  today: string
  selectedWeekDate: string | null
  weekDays: Array<{ date: Date; iso: string; hasEvent: boolean }>
  selectedDateEvents: CalendarEvent[]
  leaderCards: TerritoryCard[]
  role: Role
  onSelectWeekDate: (iso: string) => void
  onOpenNotices: () => void
  onOpenCalendar: () => void
  onOpenEventDetail: (eventId: number) => void
  onOpenZone: () => void
}) {
  const navigate = useNavigate()
  const activeDate = selectedWeekDate ?? today
  const wdShort = weekdayShortLabels[language]

  return (
    <div className="mh-page">
      {/* ─── 공지 (최상단) ─── */}
      {notices.length > 0 && (
        <section className="mobile-home-section">
          <div className="mh-sec-head">
            <h2>
              {t(language, 'home.notice')}
              <span className="mh-cnt">{notices.length}</span>
            </h2>
            <button className="mh-all" onClick={onOpenNotices} type="button">
              {t(language, 'home.viewAllBtn')}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden><polyline points="9 6 15 12 9 18"/></svg>
            </button>
          </div>
          <div className="mh-notice-list">
            {notices.slice(0, 2).map((notice) => (
              <button
                key={notice.id}
                type="button"
                className="mh-notice-row"
                onClick={onOpenNotices}
              >
                <span className="mh-notice-pill">{t(language, 'home.noticePill')}</span>
                <span className="mh-notice-title">{notice.title}</span>
                <span className="mh-notice-date">{notice.createdAt.slice(5, 10).replace('-', '/')}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* ─── 오늘 봉사 — 디자인 24/25 ─── */}
      <section className="mobile-home-section">
        <div className="mh-sec-head">
          <h2>
            {t(language, 'home.todayServiceShort')}
            {myTodayEvents.length > 0 && <span className="mh-cnt">{myTodayEvents.length}</span>}
          </h2>
          <button className="mh-all" onClick={onOpenCalendar} type="button">
            {t(language, 'home.viewAllBtn')}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden><polyline points="9 6 15 12 9 18"/></svg>
          </button>
        </div>
        {myTodayEvents.length === 0 ? (
          <div className="mh-empty-line">
            <span>{t(language, 'home.noTodayServiceShort')}</span>
          </div>
        ) : (
          <div className="mh-today-list">
            {myTodayEvents.map(({ event, kind }) => {
              const hour = Number(event.time.split(':')[0] ?? 0)
              const period = formatPeriod(language, hour)
              const sub = kind === 'lead'
                ? formatLeadSub(language, event.applicants.length, event.cardAssignments.length)
                : kind === 'join'
                  ? (event.leader
                    ? `${formatLeaderOf(language, event.leader)}${event.applicants.length > 0 ? ` · ${formatApplied(language, event.applicants.length)}` : ''}`
                    : '')
                  : (event.leader
                    ? `${formatLeaderOf(language, event.leader)} · ${formatApplied(language, event.applicants.length)}${event.allowApplications ? ` · ${t(language, 'home.signupOpen')}` : ''}`
                    : `${formatApplied(language, event.applicants.length)}${event.allowApplications ? ` · ${t(language, 'home.signupOpen')}` : ''}`)
              return (
                <button
                  key={event.id}
                  type="button"
                  className={`mh-today-serving${kind === 'lead' ? ' is-lead' : ''}${kind === 'avail' ? ' is-avail' : ''}`}
                  onClick={() => onOpenEventDetail(event.id)}
                >
                  <span className="mh-today-time">
                    <span className="mh-today-time-hour">{event.time.split(':')[0]}</span>
                    <span className="mh-today-time-period">{period}</span>
                  </span>
                  <span className="mh-today-body">
                    <span className="mh-today-title-row">
                      <span className="mh-today-title">{event.title}</span>
                      {kind === 'lead' && <span className="mh-today-pill-lead">{t(language, 'home.leadPill')}</span>}
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 2 }}>
                      {event.place && (
                        <span className="mh-today-where" style={{ margin: 0 }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 21s6-5.2 6-11a6 6 0 0 0-12 0c0 5.8 6 11 6 11Z"/><circle cx="12" cy="10" r="2"/></svg>
                          {event.place}
                        </span>
                      )}
                      {event.place && sub && <span style={{ color: 'var(--muted-3)', fontSize: 12 }}>·</span>}
                      {sub && (
                        <span className="mh-today-sub" style={{ margin: 0, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          {kind !== 'lead' && event.leader && (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                          )}
                          {sub}
                        </span>
                      )}
                    </span>
                  </span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><polyline points="9 6 15 12 9 18"/></svg>
                </button>
              )
            })}
          </div>
        )}
      </section>

      {/* ─── 이번 주 일정 (A안) ─── */}
      <section className="mobile-home-section">
        <div className="mh-sec-head">
          <h2>{t(language, 'home.weekSchedule')}</h2>
          <button className="mh-all" onClick={onOpenCalendar} type="button">
            {t(language, 'home.viewAllBtn')}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden><polyline points="9 6 15 12 9 18"/></svg>
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
                className={`mh-week-dot-cell${isToday ? ' is-today' : ''}${isSelected ? ' is-selected' : ''}`}
                onClick={() => onSelectWeekDate(d.iso)}
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
              <button
                key={event.id}
                type="button"
                className="mh-upcoming-row mh-upcoming-row--featured"
                onClick={() => onOpenEventDetail(event.id)}
              >
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

      {/* ─── 인도자 전용 — 담당 카드 진행 (미니 카드 그리드) ─── */}
      {role === 'leader' && leaderCards.length > 0 && (
        <section className="mobile-home-section">
          <div className="mh-sec-head">
            <h2>
              {t(language, 'home.assignedCards')}
              <span className="mh-cnt">{leaderCards.length}</span>
            </h2>
            {leaderCards.length > 8 && (
              <button className="mh-all" onClick={() => {
                navigate('/zone?reset=true')
                onOpenZone()
              }} type="button">
                {t(language, 'home.viewAllBtn')}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden><polyline points="9 6 15 12 9 18"/></svg>
              </button>
            )}
          </div>
          <div className="mh-card-grid">
            {leaderCards.slice(0, 8).map((card) => {
              const pct = Math.min(100, Math.max(0, card.progress ?? 0))
              const colorClass = pct >= 70 ? 'high' : pct >= 30 ? 'mid' : 'low'
              return (
                <button
                  key={card.id}
                  type="button"
                  className="mh-card-tile"
                  onClick={() => {
                    navigate(`/zone?region=${encodeURIComponent(card.region)}&dong=${encodeURIComponent(card.area)}`)
                    onOpenZone()
                  }}
                >
                  <span className="mh-card-tile-name">{card.name}</span>
                  <span className="mh-card-tile-bottom">
                    <span className={`mh-card-tile-pct ${colorClass}`}>{pct}%</span>
                    <span className="mh-card-tile-meta">{card.completed}/{card.units}</span>
                  </span>
                </button>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}
