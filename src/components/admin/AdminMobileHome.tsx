// 관리자 모바일 홈 — design_handoff_admin_redesign 01 화면
// 구조: 공지 → 오늘의 봉사 → 운영 현황
//
// 헤더는 상위(MobileHome.tsx)의 AppHeader 가 그림.

import type { CalendarEvent, Notice, TerritoryCard } from '../../types'
import type { AppLanguage } from '../../i18n'
import { t, formatLeaderOf, formatJoined, formatPeriod, weekdayShortLabels } from '../../i18n'
import { Card } from '../ui'

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
  noticeReadCount,
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
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
        padding: '20px 16px 24px',
      }}
    >
      {/* ── 공지 ────────────────────────── */}
      <section>
        <SectionHeader title={t(language, 'home.notice')} onAll={onOpenNotices} viewAllLabel={t(language, 'home.viewAllBtn')} />
        {latestNotice ? (
          <button
            type="button"
            onClick={onOpenNotices}
            style={{
              display: 'block',
              width: '100%',
              padding: 0,
              border: 'none',
              background: 'transparent',
              marginTop: 10,
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <Card padding={14}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      background: 'var(--tint)',
                      color: 'var(--muted)',
                      fontSize: 10.5,
                      padding: '2px 7px',
                      borderRadius: 999,
                      fontWeight: 600,
                      letterSpacing: '0.04em',
                      flexShrink: 0,
                    }}
                  >
                    {t(language, 'home.noticePill')}
                  </span>
                  <span
                    style={{
                      fontSize: 14,
                      color: 'var(--text)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      minWidth: 0,
                    }}
                  >
                    {latestNotice.title}
                  </span>
                </div>
                {noticeReadCount && (
                  <span style={{ fontSize: 12, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                    {noticeReadCount.read}/{noticeReadCount.total} {t(language, 'home.readSuffix')}
                  </span>
                )}
              </div>
            </Card>
          </button>
        ) : (
          <Card padding={14} style={{ marginTop: 10, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
            {t(language, 'home.noNoticesShort')}
          </Card>
        )}
      </section>

      {/* ── 오늘의 봉사 ──────────────────── */}
      <section>
        <SectionHeader
          title={
            <>
              {t(language, 'home.todayServiceAdmin')} <span style={{ fontWeight: 500, color: 'var(--muted)', fontSize: 13, marginLeft: 6 }}>{todayEvents.length}</span>
            </>
          }
          onAll={onOpenCalendar}
          viewAllLabel={t(language, 'home.viewAllBtn')}
        />
        {todayEvents.length === 0 ? (
          <Card padding={18} style={{ marginTop: 10, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
            {t(language, 'home.noEventsShort')}
          </Card>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
            {todayEvents.slice(0, 3).map((event) => {
              const tb = timeBlock(event.time || '', language)
              return (
                <button
                  key={event.id}
                  type="button"
                  onClick={onOpenCalendar}
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: 0,
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <Card padding={14}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div
                        style={{
                          width: 54,
                          height: 54,
                          borderRadius: 10,
                          background: 'var(--ink)',
                          color: '#fff',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          lineHeight: 1,
                        }}
                      >
                        <span style={{ fontSize: 18, fontWeight: 700 }}>{tb.display}</span>
                        <span style={{ fontSize: 10, opacity: 0.7, marginTop: 2 }}>{tb.period}</span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, gap: 2 }}>
                        <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>{event.title}</span>
                        <span style={{ fontSize: 12, color: 'var(--muted)', display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          {event.place && (
                            <>
                              <PinIcon />
                              <span>{event.place}</span>
                            </>
                          )}
                          {event.place && event.leader && <span style={{ color: 'var(--muted-3)' }}>·</span>}
                          {event.leader && (
                            <>
                              <UserIcon />
                              <span>{event.leader}</span>
                            </>
                          )}
                        </span>
                      </div>
                      <ChevR />
                    </div>
                  </Card>
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
          <section>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '0 4px' }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.01em' }}>{t(language, 'home.weekSchedule')}</h2>
              <button type="button" onClick={onOpenCalendar} style={{ border: 'none', background: 'transparent', font: 'inherit', fontSize: 13, fontWeight: 500, color: 'var(--muted)', display: 'inline-flex', alignItems: 'center', gap: 2, cursor: 'pointer', padding: 0 }}>
                {t(language, 'home.viewAllBtn')} <ChevR size={12} color="var(--muted)" />
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginTop: 10, padding: 10, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 12 }}>
              {weekDays.map((d, i) => {
                const isToday = i === 0
                const isSelected = d.iso === activeDate
                return (
                  <button
                    key={d.iso}
                    type="button"
                    onClick={() => onSelectWeekDate(d.iso)}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                      padding: '6px 2px', border: isSelected ? '2px solid var(--brand-700)' : '2px solid transparent',
                      background: isToday || isSelected ? 'var(--tint)' : 'transparent',
                      cursor: 'pointer', borderRadius: 8,
                    }}
                  >
                    <span style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 600 }}>{wdShort[d.date.getDay()]}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: isToday || isSelected ? 'var(--brand-700)' : 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>{d.date.getDate()}</span>
                    <span style={{ width: 5, height: 5, borderRadius: 99, background: d.hasEvent ? '#B8862A' : 'transparent', marginTop: 1 }} />
                  </button>
                )
              })}
            </div>
            {selectedDateEvents.length === 0 ? (
              <Card padding={14} style={{ marginTop: 10, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
                {activeDate === today ? t(language, 'home.noEventsToday') : t(language, 'home.noEventsThisDay')}
              </Card>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
                {selectedDateEvents.map((event) => {
                  const date = new Date(event.date + 'T00:00:00')
                  const todayDate = new Date(today + 'T00:00:00')
                  const diff = Math.round((date.getTime() - todayDate.getTime()) / 86400000)
                  const dateLabel = diff === 0 ? t(language, 'home.dateToday') : diff === 1 ? t(language, 'home.dateTomorrow') : diff === 2 ? t(language, 'home.dateDayAfter') : `${date.getMonth() + 1}/${date.getDate()}(${wdShort[date.getDay()]})`
                  const participantCount = new Set([...(event.assigned ?? []), ...(event.applicants ?? [])]).size
                  return (
                    <button key={event.id} type="button" onClick={() => onOpenEventDetail(event.id)} style={{ display: 'block', width: '100%', padding: 0, border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left' }}>
                      <Card padding={14}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: '#B8862A' }}>{dateLabel} {event.time}</span>
                          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{event.title}</span>
                          <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                            {event.leader ? formatLeaderOf(language, event.leader) : ''}
                            {participantCount > 0 ? ` · ${formatJoined(language, participantCount)}` : ''}
                          </span>
                        </div>
                      </Card>
                    </button>
                  )
                })}
              </div>
            )}
          </section>
        )
      })()}

      {/* ── 운영 현황 ────────────────────── */}
      <section>
        <SectionHeader title={t(language, 'home.operationStatus')} onAll={onOpenZone} viewAllLabel={t(language, 'home.viewAllBtn')} />
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 8,
            marginTop: 10,
          }}
        >
          <StatTile num={cards.length} sub={t(language, 'home.totalCards')} />
          <StatTile num={inProgressCount} sub={t(language, 'home.inProgress')} />
          <StatTile num={unassignedCount} sub={t(language, 'zone.unassigned')} danger />
          <StatTile num={completedPctText} unit="%" sub={`${t(language, 'home.completedUnits')} ${completedUnits} / ${totalUnits}`} />
        </div>
      </section>
    </div>
  )
}

function SectionHeader({ title, onAll, viewAllLabel = '전체보기' }: { title: React.ReactNode; onAll?: () => void; viewAllLabel?: string }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        padding: '0 4px',
      }}
    >
      <h2
        style={{
          margin: 0,
          fontSize: 16,
          fontWeight: 600,
          color: 'var(--ink)',
          letterSpacing: '-0.01em',
        }}
      >
        {title}
      </h2>
      {onAll && (
        <button
          type="button"
          onClick={onAll}
          style={{
            border: 'none',
            background: 'transparent',
            font: 'inherit',
            fontSize: 13,
            fontWeight: 500,
            color: 'var(--muted)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 2,
            cursor: 'pointer',
            padding: 0,
            minHeight: 0,
          }}
        >
          {viewAllLabel} <ChevR size={12} color="var(--muted)" />
        </button>
      )}
    </div>
  )
}

function StatTile({ num, unit, sub, danger }: { num: number | string; unit?: string; sub: string; danger?: boolean }) {
  return (
    <Card padding="14px 14px">
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
      <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 500, marginTop: 2 }}>{sub}</div>
    </Card>
  )
}
