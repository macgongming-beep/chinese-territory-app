import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { CalendarEvent, Notice, ReturnVisit, ReturnVisitLog, ReviewTask, Role, ServiceSession, SpecialPeriod, TerritoryCard, TimeSlot } from '../types'
import type { AppLanguage } from '../i18n'
import { SpecialPeriodBanner } from './SpecialPeriodBanner'
import { AdminMobileHome } from './admin/AdminMobileHome'
import { UserMobileHome } from './UserMobileHome'

export function DesktopHome({
  language,
  calendarEvents,
  cards,
  currentVisitor,
  notices,
  role,
  onOpenCalendar,
  onOpenNotices,
  specialPeriods,
  onOpenSettings,
  // Other required props by DesktopApp are ignored since we no longer use them
  serviceSessions: _ss,
  returnVisits: _rv,
  returnVisitLogs: _rvl,
  onApplyToEvent: _oate,
  onStartServiceSession: _osss,
  onEndServiceSession: _oess,
  onOpenTerritory: _oot,
  reviewTasks: _rt,
  onCreateReviewTask: _ocrt,
  onCompleteReviewTask: _ocort,
  onUncompleteReviewTask: _ourt,
  onUpdateReviewTask: _ourvt,
  onDeleteReviewTask: _odrt,
}: {
  language: AppLanguage
  calendarEvents: CalendarEvent[]
  cards: TerritoryCard[]
  currentVisitor: string
  notices: Notice[]
  role: Role
  serviceSessions: ServiceSession[]
  returnVisits?: ReturnVisit[]
  returnVisitLogs?: ReturnVisitLog[]
  onApplyToEvent: (eventId: number) => void
  onStartServiceSession: (input: {
    timeSlot: TimeSlot
    primaryCardId?: number | null
    calendarEventId?: number | null
    assignedCardId?: number | null
    assignmentId?: number | null
    source?: ServiceSession['source']
    memo?: string
  }) => Promise<number | null>
  onEndServiceSession: (sessionId: number) => void
  onOpenCalendar: () => void
  onOpenNotices: () => void
  onOpenTerritory: () => void
  reviewTasks: ReviewTask[]
  onCreateReviewTask: (title: string, content: string) => Promise<void>
  onCompleteReviewTask: (id: number) => Promise<void>
  onUncompleteReviewTask: (id: number) => Promise<void>
  onUpdateReviewTask: (id: number, title: string, content: string) => Promise<void>
  onDeleteReviewTask: (id: number) => Promise<void>
  specialPeriods?: SpecialPeriod[]
  onOpenSettings?: () => void
}) {
  const navigate = useNavigate()
  
  const today = useMemo(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }, [])
  const [selectedWeekDate, setSelectedWeekDate] = useState<string | null>(null)

  const todayEvents = useMemo(() =>
    calendarEvents.filter((e) => e.date === today).sort((a, b) => a.time.localeCompare(b.time)),
    [calendarEvents, today])

  const myTodayEvents = useMemo(() => {
    return todayEvents.map((event) => {
      const isLeader = event.leader === currentVisitor
      const isApplicant = event.applicants.includes(currentVisitor)
      const isAssigned = event.cardAssignments.some((a) => a.userName === currentVisitor)
        || (event.assigned ?? []).includes(currentVisitor)
      const kind: 'lead' | 'join' | 'avail' = isLeader
        ? 'lead'
        : (isApplicant || isAssigned) ? 'join' : 'avail'
      return { event, kind }
    })
  }, [todayEvents, currentVisitor])

  const weekDays = useMemo(() => {
    const todayDate = new Date(today + 'T00:00:00')
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(todayDate)
      d.setDate(todayDate.getDate() + i)
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      return { date: d, iso, hasEvent: calendarEvents.some((e) => e.date === iso) }
    })
  }, [calendarEvents, today])

  const selectedDateEvents = useMemo(() => {
    const date = selectedWeekDate ?? today
    return calendarEvents
      .filter((e) => e.date === date)
      .sort((a, b) => a.time.localeCompare(b.time))
  }, [calendarEvents, selectedWeekDate, today])

  const leaderCards = useMemo(() => cards.filter((c) => c.assignedLeader === currentVisitor), [cards, currentVisitor])
  const inProgressCards = useMemo(() => cards.filter((c) => c.status === '진행중'), [cards])
  const totalUnits = useMemo(() => cards.reduce((sum, card) => sum + card.units, 0), [cards])
  const completedUnits = useMemo(() => cards.reduce((sum, card) => sum + card.completed, 0), [cards])

  return (
    <section className="la-page" style={{ alignItems: 'center' }}>
      <div style={{ maxWidth: 640, width: '100%', paddingBottom: 40, paddingTop: 16 }}>
        {specialPeriods && specialPeriods.length > 0 && (
          <div style={{ padding: '0 16px', marginBottom: '16px' }}>
            <SpecialPeriodBanner specialPeriods={specialPeriods} variant="compact" onClick={onOpenSettings} />
          </div>
        )}
        
        {role === 'admin' ? (
          <AdminMobileHome
            language={language}
            notices={notices}
            todayEvents={todayEvents}
            cards={cards}
            totalUnits={totalUnits}
            completedUnits={completedUnits}
            inProgressCount={inProgressCards.length}
            unassignedCount={cards.filter((c) => c.status === '미배정').length}
            onOpenNotices={onOpenNotices}
            onOpenCalendar={onOpenCalendar}
            onOpenZone={() => navigate('/zone')}
            weekDays={weekDays}
            today={today}
            selectedWeekDate={selectedWeekDate}
            selectedDateEvents={selectedDateEvents}
            onSelectWeekDate={setSelectedWeekDate}
            onOpenEventDetail={(id) => navigate(`/calendar?openEvent=${id}`)}
          />
        ) : (
          <UserMobileHome
            language={language}
            notices={notices}
            myTodayEvents={myTodayEvents}
            today={today}
            selectedWeekDate={selectedWeekDate}
            weekDays={weekDays}
            selectedDateEvents={selectedDateEvents}
            leaderCards={leaderCards}
            role={role}
            onSelectWeekDate={setSelectedWeekDate}
            onOpenNotices={onOpenNotices}
            onOpenCalendar={onOpenCalendar}
            onOpenEventDetail={(id) => navigate(`/calendar?openEvent=${id}`)}
            onOpenZone={() => navigate('/zone')}
          />
        )}
      </div>
    </section>
  )
}
