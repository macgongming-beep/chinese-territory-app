import { useMemo, useState } from 'react'
import { Routes, Route, Navigate, useNavigate, useLocation, useSearchParams } from 'react-router-dom'
// MobileCalendar 는 디자인 v2 적용 후 미사용 (AdminMobileCalendar 가 모든 역할 처리)
// import { MobileCalendar } from './MobileCalendar'
import { MobileAdminAssignment } from './MobileAdminAssignment'
import { MobileLeaderAssignment } from './MobileLeaderAssignment'
import { MobileMap } from './MobileMap'
import { MobileNotices } from './MobileNotices'
import { MobileTerritory } from './MobileTerritory'
import { MobileRegularVisitDetail } from './MobileRegularVisitDetail'
import { AdminMobileHome } from './admin/AdminMobileHome'
import { AdminMobileCalendar } from './admin/AdminMobileCalendar'
import { AdminMobileZone } from './admin/AdminMobileZone'
import { MobileUsers } from './MobileUsers'
import { MobileSignupRequests } from './MobileSignupRequests'
import { MobileProfileSettings } from './MobileProfileSettings'
import type { Building, CalendarEvent, CardBoundary, EventInformalAssignment, EventRestaurantAssignment, InformalAsset, InformalGroup, Notice, ReturnVisit, ReturnVisitLog, Role, ServiceSession, SpecialPeriod, TerritoryCard, TimeSlot, Unit, UnitStatus, VisitHistory } from '../types'
// InformalCardsTab / RestaurantsTab 은 AdminMobileZone 내부에서 사용됨 (직접 import 불필요)
import type { AuthUser } from '../hooks/useAuth'
import type { AppLanguage } from '../i18n'
import { languageLabels, t, formatLeaderOf, formatJoined, formatApplied, formatLeadSub, formatPeriod, weekdayShortLabels } from '../i18n'
import { SpecialPeriodBanner } from './SpecialPeriodBanner'
import { SpecialPeriodSettings } from './SpecialPeriodSettings'
import { PwaInstallSection } from './PwaInstall'
import { NotificationSettings } from './NotificationSettings'
import { AppUpdateCard } from './AppUpdateCard'
import { AppHeader } from './AppHeader'
import { formatRelativeVisitDate, getLatestReturnVisitDate, getUserReturnVisits } from '../utils/returnVisits'

type MobileTab = '홈' | '캘린더' | '활동' | '구역' | '지도' | '배정' | '설정'

const tabToPath: Record<MobileTab, string> = {
  '홈': '/',
  '캘린더': '/calendar',
  '활동': '/territory',
  '구역': '/zone',
  '지도': '/map',
  '배정': '/assignment',
  '설정': '/settings',
}

const pathToTab: Record<string, MobileTab> = {
  '/': '홈',
  '/notices': '설정',
  '/profile': '설정',
  '/special-periods': '설정',
  '/signup-requests': '설정',
  '/calendar': '캘린더',
  '/territory': '활동',
  '/zone': '구역',
  '/map': '지도',
  '/assignment': '배정',
  '/users': '설정',
  '/settings': '설정',
}

type IconName = 'home' | 'calendar' | 'territory' | 'map' | 'assignment' | 'settings' | 'notice'

const navIcons: Record<MobileTab, IconName> = {
  '홈': 'home',
  '캘린더': 'calendar',
  '활동': 'territory',
  '구역': 'territory',
  '지도': 'map',
  '배정': 'assignment',
  '설정': 'settings',
}

const homeWeekdayLabels: Record<AppLanguage, string[]> = {
  ko: ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'],
  zh: ['周日', '周一', '周二', '周三', '周四', '周五', '周六'],
  en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
}

function formatHomeDate(date: Date, language: AppLanguage) {
  if (language === 'en') {
    return new Intl.DateTimeFormat('en', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }).format(date)
  }
  if (language === 'zh') {
    return `${date.getFullYear()}年 ${date.getMonth() + 1}月 ${date.getDate()}日 ${homeWeekdayLabels.zh[date.getDay()]}`
  }
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 ${homeWeekdayLabels.ko[date.getDay()]}`
}


function NavIcon({ name }: { name: IconName }) {
  if (name === 'home') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 11.5 12 5l8 6.5" />
        <path d="M6.5 10.5V20h11V10.5" />
        <path d="M10 20v-5h4v5" />
      </svg>
    )
  }
  if (name === 'calendar') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7 4v3M17 4v3M5 9h14" />
        <rect x="5" y="6" width="14" height="14" rx="2" />
      </svg>
    )
  }
  if (name === 'territory') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="m4 7 5-2 6 2 5-2v12l-5 2-6-2-5 2Z" />
        <path d="M9 5v12M15 7v12" />
      </svg>
    )
  }
  if (name === 'map') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 21s6-5.4 6-11a6 6 0 0 0-12 0c0 5.6 6 11 6 11Z" />
        <circle cx="12" cy="10" r="2.2" />
      </svg>
    )
  }
  if (name === 'settings') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="3" />
        <path d="M19 12a7.5 7.5 0 0 0-.1-1.2l2-1.5-2-3.4-2.4 1a7.4 7.4 0 0 0-2.1-1.2L14 3h-4l-.4 2.7a7.4 7.4 0 0 0-2.1 1.2l-2.4-1-2 3.4 2 1.5A7.5 7.5 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.5 2 3.4 2.4-1a7.4 7.4 0 0 0 2.1 1.2L10 21h4l.4-2.7a7.4 7.4 0 0 0 2.1-1.2l2.4 1 2-3.4-2-1.5c.1-.4.1-.8.1-1.2Z" />
      </svg>
    )
  }
  if (name === 'assignment') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 7h16M4 12h10M4 17h7" />
        <path d="m17 11 3 3-3 3" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 4v10" />
      <path d="M12 18h.01" />
    </svg>
  )
}

function SettingsIcon({ name }: { name: 'notice' | 'users' | 'signup' | 'season' | 'notification' | 'logout' }) {
  if (name === 'users') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
        <path d="M3 21v-1a6 6 0 0 1 12 0v1" />
        <path d="M17 10a3 3 0 1 0 0-6" />
        <path d="M17 14a5 5 0 0 1 4 5v1" />
      </svg>
    )
  }
  if (name === 'season') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1L12 16.9l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9Z" />
      </svg>
    )
  }
  if (name === 'signup') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
        <path d="M3 21v-1a6 6 0 0 1 12 0v1" />
        <path d="m17 9 2 2 4-4" />
        <path d="M18 15v5" />
      </svg>
    )
  }
  if (name === 'logout') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M10 6H6v12h4" />
        <path d="M13 8l4 4-4 4" />
        <path d="M17 12H9" />
      </svg>
    )
  }
  if (name === 'notification') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M18 9a6 6 0 1 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
        <path d="M10 21a2 2 0 0 0 4 0" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 10v4" />
      <path d="M9 8v8" />
      <path d="M13 6v12" />
      <path d="M17 9v6" />
      <path d="M20 6v12" />
    </svg>
  )
}


// 구역 관련 헬퍼/상수는 디자인 v2 통합 후 AdminMobileZone 내부로 이동.

export function MobileHome({
  leaderNames = [],
  buildings,
  calendarEvents,
  cardBoundaries,
  cards,
  currentVisitor,
  currentUser,
  language,
  actualRole,
  viewMode,
  notices,
  serviceSessions,
  onChangeViewMode,
  onChangeLanguage,
  onSetCardLeaders,
  onAddUnit,
  allUsers = [],
  onChangePin,
  onUpdateMyProfile,
  onApplyToEvent,
  onAddParticipantToEvent: _onAddParticipantToEvent,
  onToggleUser: _onToggleUser,
  onEndServiceSession,
  onAssignCardToEventParticipant: _onAssignCardToEventParticipant,
  onAssignCardsToEventParticipantsBulk,
  onCreateBuilding,
  onDeleteBuilding,
  onUpdateBuilding,
  onDeleteUnit,
  onCreateCalendarEvent,
  onCreateRepeatCalendarEvents,
  onDeleteCalendarEvent,
  onDeleteCalendarEventSeries,
  onUpdateCalendarEvent,
  onUpdateCalendarEventSeries,
  onCreateNotice,
  onDeleteNotice,
  returnVisits = [],
  returnVisitLogs = [],
  onToggleRegularVisit,
  onCreateManualReturnVisit,
  onAddReturnVisitLog,
  onUpdateReturnVisitLog,
  onDeleteReturnVisitLog,
  onDeleteReturnVisit,
  onUpdateReturnVisitNickname,
  onUpdateReturnVisitAddress,
  onToggleChinese,
  onUndoLatestVisit,
  onUpdateVisitHistory,
  onDeleteVisitHistory,
  onUpdateUnitStatus: _onUpdateUnitStatus,
  onQuickLogVisit,
  onUpdateUnitFlags,
  onToggleInvitationLeft,
  onLogout,
  visitHistories,
  specialPeriods,
  onCreateSpecialPeriod,
  onUpdateSpecialPeriod,
  onDeleteSpecialPeriod,
  // v2 신 배정 모델
  informalAssets = [],
  eventInformalAssignments = [],
  eventRestaurantAssignments = [],
  informalGroups = [],
  onUploadInformalAsset,
  onDeleteInformalAsset,
  onCreateInformalGroup,
  onRenameInformalGroup,
  onDeleteInformalGroup,
  onMoveAssetToGroup,
  onAssignInformalToUser,
  onRemoveInformalAssignment,
  onAssignRestaurantToUser,
  onRemoveRestaurantAssignment,
  onToggleBuildingRestaurant,
  onSetRegularVisitor,
  onAddRestaurantVisit,
  onSubmitRestaurantRequest,
  restaurantRequests = [],
  onApproveRestaurantRequest,
  onRejectRestaurantRequest,
}: {
  leaderNames?: string[]
  buildings: Building[]
  calendarEvents: CalendarEvent[]
  cardBoundaries: CardBoundary[]
  cards: TerritoryCard[]
  currentVisitor: string
  currentUser: AuthUser
  language: AppLanguage
  actualRole: Role
  viewMode: Role
  notices: Notice[]
  serviceSessions: ServiceSession[]
  onChangeViewMode: (role: Role) => void
  onChangeLanguage: (language: AppLanguage) => void
  onSetCardLeaders: (cardId: number, leaderNames: string[], options?: { silentSuccess?: boolean }) => Promise<void> | void
  onAddUnit: (buildingId: number, unitNumber: string) => void
  allUsers?: Array<{ id: number; name: string; phone?: string | null; role: string; approvalStatus?: 'pending' | 'approved' | 'blocked' }>
  onChangePin: (newPin: string) => Promise<boolean>
  onUpdateMyProfile: (input: { name: string; phone?: string | null }) => Promise<boolean>
  onApplyToEvent: (eventId: number) => void
  onAddParticipantToEvent?: (eventId: number, userName: string) => void
  onToggleUser: (cardId: number, userName: string) => void
  onEndServiceSession: (sessionId: number) => void
  onAssignCardToEventParticipant: (eventId: number, userName: string, cardId: number | null) => void
  onAssignCardsToEventParticipantsBulk: (
    eventId: number,
    assignments: Array<{ userName: string; cardId?: number | null; cardIds?: number[] | null }>,
    options?: { silentSuccess?: boolean },
  ) => Promise<void> | void
  onCreateBuilding: (input: { cardId: number; name: string; address: string; type: Building['type']; lat: number; lng: number }) => void
  onDeleteBuilding: (buildingId: number) => void
  onUpdateBuilding: (buildingId: number, name: string, address: string, lat?: number, lng?: number) => void
  onDeleteUnit: (buildingId: number, unitId: number) => void
  onCreateCalendarEvent: (input: { date: string; time: string; title: string; place: string; mapLink?: string; leader: string; memo: string; hasMeeting: boolean; allowApplications: boolean }) => void
  onCreateRepeatCalendarEvents?: (dates: string[], input: { time: string; endTime?: string; title: string; place: string; mapLink?: string; leader: string; memo: string; hasMeeting: boolean; allowApplications: boolean }) => void
  onDeleteCalendarEvent: (id: number) => void
  onDeleteCalendarEventSeries?: (seriesId: string, fromDate: string) => void
  onUpdateCalendarEvent: (id: number, input: { time: string; title: string; place: string; mapLink?: string; leader: string; memo: string; hasMeeting: boolean; allowApplications: boolean }) => void
  onUpdateCalendarEventSeries?: (seriesId: string, fromDate: string, input: { time: string; endTime?: string; title: string; place: string; mapLink?: string; leader: string; memo: string; hasMeeting: boolean; allowApplications: boolean }) => void
  onCreateNotice: (input: { title: string; content: string; priority: Notice['priority']; author: string }) => void
  onDeleteNotice: (id: number) => void
  returnVisits?: ReturnVisit[]
  returnVisitLogs?: ReturnVisitLog[]
  onToggleRegularVisit: (buildingId: number, unitId: number, visitorName?: string) => void
  onCreateManualReturnVisit?: (input: { displayName: string; address: string; memo: string; unitId?: number | null; buildingId?: number | null }) => Promise<void>
  onAddReturnVisitLog?: (returnVisitId: number, result: '만남' | '부재' | null, memo: string) => Promise<void>
  onUpdateReturnVisitLog?: (id: number, result: '만남' | '부재' | null, memo: string) => Promise<void>
  onDeleteReturnVisitLog?: (id: number) => Promise<void>
  onDeleteReturnVisit?: (id: number) => Promise<void>
  onUpdateReturnVisitNickname?: (id: number, nickname: string) => Promise<void>
  onUpdateReturnVisitAddress?: (id: number, address: string) => Promise<void>
  onToggleChinese: (buildingId: number, unitId: number) => void
  onUndoLatestVisit: (buildingId: number, unitId: number) => void
  onUpdateVisitHistory: (historyId: number, unitId: number, input: { result: UnitStatus; timeSlot: TimeSlot; memo: string; visitedAt: string }) => void
  onDeleteVisitHistory: (historyId: number, unitId: number) => void
  onUpdateUnitStatus: (buildingId: number, unitId: number, status: UnitStatus, memo?: string) => void
  onQuickLogVisit: (buildingId: number, unitId: number, result: UnitStatus) => void
  onUpdateUnitFlags: (unitId: number, flags: Partial<Unit>) => void
  onToggleInvitationLeft?: (buildingId: number, unitId: number) => void
  onLogout: () => void
  visitHistories: VisitHistory[]
  specialPeriods?: SpecialPeriod[]
  onCreateSpecialPeriod?: (input: { label: string; startDate: string; endDate: string; color: string }) => Promise<void> | void
  onUpdateSpecialPeriod?: (id: number, input: { label: string; startDate: string; endDate: string; color: string }) => Promise<void> | void
  onDeleteSpecialPeriod?: (id: number) => Promise<void> | void
  // v2 신 배정 모델
  informalAssets?: InformalAsset[]
  eventInformalAssignments?: EventInformalAssignment[]
  eventRestaurantAssignments?: EventRestaurantAssignment[]
  informalGroups?: InformalGroup[]
  onUploadInformalAsset?: (input: { file: File; name: string; uploadedBy: string; groupId?: number | null }) => Promise<{ ok: boolean; assetId?: number; error?: string }>
  onDeleteInformalAsset?: (assetId: number) => Promise<void>
  onCreateInformalGroup?: (input: { name: string; createdBy: string }) => Promise<number | null>
  onRenameInformalGroup?: (groupId: number, name: string) => Promise<void>
  onDeleteInformalGroup?: (groupId: number) => Promise<void>
  onMoveAssetToGroup?: (assetId: number, groupId: number | null) => Promise<void>
  onAssignInformalToUser?: (input: { eventId: number; userName: string; assetId: number; assignedBy: string }) => Promise<boolean>
  onRemoveInformalAssignment?: (assignmentId: number) => Promise<void>
  onAssignRestaurantToUser?: (input: { eventId: number; userName: string; buildingId: number; assignedBy: string }) => Promise<boolean>
  onRemoveRestaurantAssignment?: (assignmentId: number) => Promise<void>
  onToggleBuildingRestaurant?: (buildingId: number, isRestaurant: boolean) => Promise<void>
  onSetRegularVisitor?: (unitId: number, visitorName: string, registeredAt?: string) => Promise<void>
  onAddRestaurantVisit?: (unitId: number, memo: string) => Promise<void>
  onSubmitRestaurantRequest?: (name: string, address: string, memo: string) => Promise<void>
  restaurantRequests?: import('../types').RestaurantRequest[]
  onApproveRestaurantRequest?: (id: number, opts: { name: string; address: string; reviewer: string }) => Promise<void>
  onRejectRestaurantRequest?: (id: number, reviewer: string) => Promise<void>
}) {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const role = actualRole === 'admin' ? viewMode : actualRole

  const headerChatUsers = useMemo(
    () => allUsers.map((user) => ({ id: user.id, name: user.name, role: user.role as Role })),
    [allUsers],
  )
  // 디자인 v2: 홈에서 "오늘 봉사한 카드" 섹션 제거됨 (활동 탭으로 이동)
  // 토글 상태는 디버그/스위치용으로 보존 — 활동 탭에서 재사용 가능
  const [todayCardsCollapsed, setTodayCardsCollapsed] = useState(() =>
    window.localStorage.getItem('mobileTodaySessionsCollapsed') === 'true'
  )
  void todayCardsCollapsed; void setTodayCardsCollapsed

  // A안 선택 날짜 (dot row 클릭으로 변경)
  const [selectedWeekDate, setSelectedWeekDate] = useState<string | null>(null)

  const rawActiveTab = pathToTab[location.pathname] || '홈'
  // 인도자는 '지도' 탭이 없으므로 /map 접근 시 '구역' 탭 활성화
  const activeTab: MobileTab =
    rawActiveTab === '지도' && role === 'leader' ? '구역' : rawActiveTab

  // KST(로컬) 기준 오늘. toISOString 은 UTC 라 새벽 시간대에 하루 어긋남 → local 날짜 사용
  const today = useMemo(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }, [])
  const todayLabel = useMemo(() => formatHomeDate(new Date(), language), [language])
  const leaderCards = useMemo(() => cards.filter((c) => c.assignedLeader === currentVisitor), [cards, currentVisitor])
  const inProgressCards = useMemo(() => cards.filter((c) => c.status === '진행중'), [cards])
  const totalUnits = useMemo(() => cards.reduce((sum, card) => sum + card.units, 0), [cards])
  const completedUnits = useMemo(() => cards.reduce((sum, card) => sum + card.completed, 0), [cards])
  const latestNotices = useMemo(() =>
    notices.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 2),
    [notices])
  const todayEvents = useMemo(() =>
    calendarEvents.filter((e) => e.date === today).sort((a, b) => a.time.localeCompare(b.time)),
    [calendarEvents, today])
  // 7일치 dot row 데이터 (오늘부터 7일) — A안
  const weekDays = useMemo(() => {
    const todayDate = new Date(today + 'T00:00:00')
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(todayDate)
      d.setDate(todayDate.getDate() + i)
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      return { date: d, iso, hasEvent: calendarEvents.some((e) => e.date === iso) }
    })
  }, [calendarEvents, today])
  // A안: 선택된 날짜의 일정 목록
  const selectedDateEvents = useMemo(() => {
    const date = selectedWeekDate ?? today
    return calendarEvents
      .filter((e) => e.date === date)
      .sort((a, b) => a.time.localeCompare(b.time))
  }, [calendarEvents, selectedWeekDate, today])

  // 디자인 v2: 활동 탭으로 이동. 홈에서는 사용 안 함.
  const myTodaySessions = useMemo(() =>
    serviceSessions.filter((session) => session.serviceDate === today && session.userName === currentVisitor),
    [currentVisitor, serviceSessions, today])
  void myTodaySessions

  // 오늘 봉사 — 모든 오늘 일정 표시.
  // 본인이 인도자면 kind='lead' (ink border + "인도" pill),
  // 신청/배정자면 kind='join', 아무 관여 없으면 kind='avail' (신청 가능).
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

  const myRegularVisits = useMemo(
    () => getUserReturnVisits(returnVisits, currentVisitor),
    [currentVisitor, returnVisits],
  )
  const latestReturnVisitDate = useMemo(
    () => getLatestReturnVisitDate(myRegularVisits, returnVisitLogs),
    [myRegularVisits, returnVisitLogs],
  )
  // 디자인 v2: 홈 정기방문 섹션에서 latestReturnVisitLabel 직접 노출 안 함 (카드 내부 last 로 흡수)
  const latestReturnVisitLabel = formatRelativeVisitDate(latestReturnVisitDate, language)
  void latestReturnVisitLabel

  // (정기방문 미리보기는 활동 탭으로 이동, 홈에서는 미사용)
  const focusedMapCardId = searchParams.get('cardId') ? Number(searchParams.get('cardId')) : null
  const focusedMapCardIds = useMemo(() => {
    const raw = searchParams.get('cardIds')
    if (!raw) return []
    return raw
      .split(',')
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value))
  }, [searchParams])
  const focusedMapScopeLabel = searchParams.get('scope') === 'mine' ? t(language, 'zone.myTerritories') : undefined
  // map 의 onBack 은 navigate(-1) 로 직전 URL(드릴 상태 포함) 정확 복귀.
  const userVisibleMapCardIds = useMemo(() => {
    const ids = new Set<number>()
    cards.forEach((card) => {
      if (card.assignedUsers.includes(currentVisitor)) ids.add(card.id)
    })
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000
    serviceSessions.forEach((session) => {
      if (session.userName !== currentVisitor) return
      const sessionTime = new Date(session.serviceDate || session.startedAt).getTime()
      if (Number.isFinite(sessionTime) && sessionTime < cutoff) return
      if (session.primaryCardId) ids.add(session.primaryCardId)
      if (session.assignedCardId) ids.add(session.assignedCardId)
    })
    // 일정별 카드 배정 (event_card_assignments) — 최근 14일 + 미래
    const eventCutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
      .toISOString().slice(0, 10)
    calendarEvents.forEach((event) => {
      if (event.date < eventCutoff) return
      event.cardAssignments.forEach((assignment) => {
        if (assignment.userName !== currentVisitor) return
        const list = assignment.assignedCardIds && assignment.assignedCardIds.length > 0
          ? assignment.assignedCardIds
          : [assignment.assignedCardId]
        list.forEach((cardId) => {
          if (cardId) ids.add(cardId)
        })
      })
    })
    return ids
  }, [cards, currentVisitor, serviceSessions, calendarEvents])
  const isUserMapScope = role === 'user'
  const mapCards = useMemo(
    () => isUserMapScope ? cards.filter((card) => userVisibleMapCardIds.has(card.id)) : cards,
    [cards, isUserMapScope, userVisibleMapCardIds],
  )
  const mapBuildings = useMemo(
    () => isUserMapScope ? buildings.filter((building) => userVisibleMapCardIds.has(building.cardId)) : buildings,
    [buildings, isUserMapScope, userVisibleMapCardIds],
  )
  const mapCardBoundaries = useMemo(
    () => isUserMapScope ? cardBoundaries.filter((boundary) => userVisibleMapCardIds.has(boundary.cardId)) : cardBoundaries,
    [cardBoundaries, isUserMapScope, userVisibleMapCardIds],
  )
  const safeFocusedMapCardId =
    isUserMapScope && focusedMapCardId && !userVisibleMapCardIds.has(focusedMapCardId)
      ? null
      : focusedMapCardId
  const safeFocusedMapCardIds = isUserMapScope
    ? focusedMapCardIds.filter((cardId) => userVisibleMapCardIds.has(cardId))
    : focusedMapCardIds
  const roleLabel = role === 'admin' ? t(language, 'role.admin') : role === 'leader' ? t(language, 'role.leader') : t(language, 'role.user')
  const pendingSignupCount = useMemo(
    () => allUsers.filter((item) => item.approvalStatus === 'pending').length,
    [allUsers],
  )
  const tabLabel = (tab: MobileTab) => {
    if (tab === '홈') return t(language, 'nav.home')
    if (tab === '캘린더') return t(language, 'nav.calendar')
    if (tab === '활동') return t(language, 'nav.myService')
    if (tab === '구역') return t(language, 'nav.zone')
    if (tab === '지도') return t(language, 'nav.map')
    if (tab === '배정') return t(language, 'nav.assignment')
    return t(language, 'nav.settings')
  }

  const _toggleTodayCardsCollapsed = () => {
    const next = !todayCardsCollapsed
    setTodayCardsCollapsed(next)
    window.localStorage.setItem('mobileTodaySessionsCollapsed', String(next))
  }
  void _toggleTodayCardsCollapsed

  const visibleTabs: MobileTab[] = role === 'user'
    ? ['홈', '캘린더', '활동', '설정']
    : role === 'leader'
      ? ['홈', '캘린더', '활동', '배정', '구역', '설정']
      : ['홈', '캘린더', '구역', '배정', '설정']  // admin

  const BottomNav = (
    <nav className="bottom-nav" aria-label="주요 메뉴">
      {visibleTabs.map((item) => (
        <button
          className={item === activeTab ? 'active' : ''}
          key={item}
          onClick={() => navigate(tabToPath[item])}
          type="button"
        >
          <NavIcon name={navIcons[item]} />
          {tabLabel(item)}
        </button>
      ))}
    </nav>
  )


  return (
    <Routes>
      <Route path="/map" element={
        <>
          <MobileMap
            language={language}
            buildings={mapBuildings}
            cardBoundaries={mapCardBoundaries}
            cards={mapCards}
            currentVisitor={currentVisitor}
            currentUserId={currentUser.id}
            actualRole={role}
            serviceSessions={serviceSessions}
            focusedCardId={safeFocusedMapCardId}
            focusedCardIds={safeFocusedMapCardIds}
            focusedScopeLabel={focusedMapScopeLabel}
            onBack={() => navigate(-1)}
            onAddUnit={onAddUnit}
            onCreateBuilding={onCreateBuilding}
            onDeleteBuilding={onDeleteBuilding}
            onUpdateBuilding={onUpdateBuilding}
            onDeleteUnit={onDeleteUnit}
            onToggleRegularVisit={onToggleRegularVisit}
            onToggleChinese={onToggleChinese}
            onUndoLatestVisit={onUndoLatestVisit}
            onUpdateVisitHistory={onUpdateVisitHistory}
            onDeleteVisitHistory={onDeleteVisitHistory}
            onQuickLogVisit={onQuickLogVisit}
            onUpdateUnitFlags={onUpdateUnitFlags}
            onToggleInvitationLeft={onToggleInvitationLeft}
            visitHistories={visitHistories}
            specialPeriods={specialPeriods}
            allUsers={allUsers.map(u => ({ id: u.id, name: u.name }))}
            onSetRegularVisitor={onSetRegularVisitor}
          />
          {BottomNav}
        </>
      } />
      <Route path="/*" element={
        <main className="app-shell" style={{ paddingBottom: 72 }}>
          <Routes>
            {/* 홈 */}
            <Route path="/" element={
              <>
                <AppHeader
                  pageTitle={t(language, 'nav.home')}
                  subtitle={todayLabel}
                  userId={currentUser.id}
                  userName={currentVisitor}
                  role={role}
                  chatUsers={headerChatUsers}
                  onOpenMenu={() => navigate('/settings')}
                />

                {specialPeriods && specialPeriods.length > 0 && (
                  <div style={{ padding: '0 16px', marginTop: '12px', marginBottom: '4px' }}>
                    <SpecialPeriodBanner specialPeriods={specialPeriods} variant="compact" onClick={() => navigate('/settings')} />
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
                    onOpenNotices={() => navigate('/notices')}
                    onOpenCalendar={() => navigate('/calendar')}
                    onOpenZone={() => navigate('/zone')}
                    weekDays={weekDays}
                    today={today}
                    selectedWeekDate={selectedWeekDate}
                    selectedDateEvents={selectedDateEvents}
                    onSelectWeekDate={setSelectedWeekDate}
                    onOpenEventDetail={(id) => navigate(`/calendar?openEvent=${id}`)}
                  />
                ) : (<div className="mh-page">

                {/* ─── 공지 (최상단) ─── */}
                {latestNotices.length > 0 && (
                  <section className="mobile-home-section">
                    <div className="mh-sec-head">
                      <h2>
                        {t(language, 'home.notice')}
                        <span className="mh-cnt">{notices.length}</span>
                      </h2>
                      <button className="mh-all" onClick={() => navigate('/notices')} type="button">
                        {t(language, 'home.viewAllBtn')}
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden><polyline points="9 6 15 12 9 18"/></svg>
                      </button>
                    </div>
                    <div className="mh-notice-list">
                      {latestNotices.map((notice) => (
                        <button
                          key={notice.id}
                          type="button"
                          className="mh-notice-row"
                          onClick={() => navigate('/notices')}
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
                    <button className="mh-all" onClick={() => navigate('/calendar')} type="button">
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
                            onClick={() => navigate(`/calendar?openEvent=${event.id}`)}
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
                              {event.place && (
                                <span className="mh-today-where">
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 21s6-5.2 6-11a6 6 0 0 0-12 0c0 5.8 6 11 6 11Z"/><circle cx="12" cy="10" r="2"/></svg>
                                  {event.place}
                                </span>
                              )}
                              {sub && <span className="mh-today-sub">{sub}</span>}
                            </span>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><polyline points="9 6 15 12 9 18"/></svg>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </section>

                {/* ─── 이번 주 일정 (A안) ─── */}
                {(() => {
                  const activeDate = selectedWeekDate ?? today
                  const wdShort = weekdayShortLabels[language]
                  return (
                    <section className="mobile-home-section">
                      <div className="mh-sec-head">
                        <h2>{t(language, 'home.weekSchedule')}</h2>
                        <button className="mh-all" onClick={() => navigate('/calendar')} type="button">
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
                              onClick={() => setSelectedWeekDate(d.iso)}
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
                              onClick={() => navigate(`/calendar?openEvent=${event.id}`)}
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
                  )
                })()}

                {/* ─── 인도자 전용 — 담당 카드 진행 (미니 카드 그리드) ─── */}
                {role === 'leader' && leaderCards.length > 0 && (
                  <section className="mobile-home-section">
                    <div className="mh-sec-head">
                      <h2>
                        {t(language, 'home.assignedCards')}
                        <span className="mh-cnt">{leaderCards.length}</span>
                      </h2>
                      {leaderCards.length > 4 && (
                        <button className="mh-all" onClick={() => navigate('/zone?reset=true')} type="button">
                          {t(language, 'home.viewAllBtn')}
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden><polyline points="9 6 15 12 9 18"/></svg>
                        </button>
                      )}
                    </div>
                    <div className="mh-card-grid">
                      {leaderCards.slice(0, 4).map((card) => {
                        const pct = Math.min(100, Math.max(0, card.progress ?? 0))
                        const colorClass = pct >= 70 ? 'high' : pct >= 30 ? 'mid' : 'low'
                        return (
                          <button
                            key={card.id}
                            type="button"
                            className="mh-card-tile"
                            onClick={() => navigate(`/zone?region=${encodeURIComponent(card.region)}&dong=${encodeURIComponent(card.area)}`)}
                          >
                            <span className="mh-card-tile-name">{card.name}</span>
                            <span className={`mh-card-tile-pct ${colorClass}`}>{pct}%</span>
                            <span className="mh-card-tile-meta">{card.completed}/{card.units}세대</span>
                          </button>
                        )
                      })}
                    </div>
                  </section>
                )}

                {/* ─── 인도자 전용 — 진행률 바 리스트 ─── */}
                {role === 'leader' && leaderCards.length > 0 && (
                  <section className="mobile-home-section">
                    <div className="mh-sec-head">
                      <h2>{t(language, 'home.progressRate')}</h2>
                    </div>
                    <div className="mh-progress-list">
                      {leaderCards.slice(0, 5).map((card) => {
                        const pct = Math.min(100, Math.max(0, card.progress ?? 0))
                        const colorClass = pct >= 70 ? 'high' : pct >= 30 ? 'mid' : 'low'
                        return (
                          <div key={card.id} className="mh-progress-row">
                            <span className="mh-progress-name">{card.name}</span>
                            <div className="mh-progress-bar-track">
                              <div className={`mh-progress-bar-fill ${colorClass}`} style={{ width: `${pct}%` }} />
                            </div>
                            <span className="mh-progress-pct">{pct}%</span>
                          </div>
                        )
                      })}
                    </div>
                  </section>
                )}

                </div>)}
              </>
            } />

            {/* 공지 */}
            <Route path="/notices" element={
              <>
                <AppHeader
                  pageTitle={t(language, 'settings.notice')}
                  subtitle={`${notices.length}개 · 관리자 작성`}
                  showBack
                  onBack={() => navigate('/settings')}
                  userId={currentUser.id}
                  userName={currentVisitor}
                  role={role}
                  chatUsers={headerChatUsers}
                  onOpenMenu={() => navigate('/settings')}
                />
                <MobileNotices
                  currentVisitor={currentVisitor}
                  currentUserId={currentUser.id}
                  notices={notices}
                  role={role}
                  mentionUsers={allUsers.map((user) => ({ id: user.id, name: user.name, role: user.role }))}
                  onCreateNotice={onCreateNotice}
                  onDeleteNotice={onDeleteNotice}
                />
              </>
            } />

            {/* 내 정보 */}
            <Route path="/profile" element={
              <MobileProfileSettings
                user={currentUser}
                onChangePin={onChangePin}
                onUpdateProfile={onUpdateMyProfile}
              />
            } />

            {/* 캘린더 */}
            <Route path="/calendar" element={
              <>
                <AppHeader
                  pageTitle={t(language, 'nav.calendar')}
                  subtitle={(() => {
                    const now = new Date()
                    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
                    const count = calendarEvents.filter((e) => e.date.startsWith(ym)).length
                    return `${now.getFullYear()}년 ${now.getMonth() + 1}월 · 일정 ${count}개`
                  })()}
                  userId={currentUser.id}
                  userName={currentVisitor}
                  role={role}
                  chatUsers={headerChatUsers}
                  onOpenMenu={() => navigate('/settings')}
                />
                {/* 모든 역할이 AdminMobileCalendar 사용 — 권한별 콜백 가시성으로 차등 */}
                <AdminMobileCalendar
                  language={language}
                  currentVisitor={currentVisitor}
                  currentUserId={currentUser.id}
                  role={role}
                  events={calendarEvents}
                  leaderNames={leaderNames}
                  mentionUsers={allUsers.map((user) => ({ id: user.id, name: user.name, role: user.role }))}
                  /* 일정 생성/수정/삭제: admin + leader 만. user 는 신청만. */
                  onCreateEvent={role === 'user' ? undefined : onCreateCalendarEvent}
                  onCreateRepeatEvents={role === 'user' ? undefined : onCreateRepeatCalendarEvents}
                  onDeleteEvent={role === 'user' ? undefined : onDeleteCalendarEvent}
                  onDeleteEventSeries={role === 'user' ? undefined : onDeleteCalendarEventSeries}
                  onUpdateEvent={role === 'user' ? undefined : onUpdateCalendarEvent}
                  onUpdateEventSeries={role === 'user' ? undefined : onUpdateCalendarEventSeries}
                  onApplyToEvent={onApplyToEvent}
                  specialPeriods={specialPeriods}
                />
                {/* (legacy MobileCalendar 유지 — 향후 제거 가능. 일정 상세 시트 시점별 액션은
                    AdminEventDetailSheet 가 role prop 받아 분기.) */}
              </>
            } />

            {/* 정기방문 상세 (풀스크린) — 디자인 핸드오프 대기 */}
            <Route path="/territory/regular/:id" element={
              role === 'admin' ? (
                <Navigate to="/zone" replace />
              ) : (
                <MobileRegularVisitDetail
                  language={language}
                  returnVisits={returnVisits}
                  returnVisitLogs={returnVisitLogs}
                  buildings={buildings}
                  currentVisitor={currentVisitor}
                  onAddReturnVisitLog={onAddReturnVisitLog}
                  onUpdateReturnVisitLog={onUpdateReturnVisitLog}
                  onDeleteReturnVisitLog={onDeleteReturnVisitLog}
                  onDeleteReturnVisit={onDeleteReturnVisit}
                  onUpdateReturnVisitNickname={onUpdateReturnVisitNickname}
                  onUpdateReturnVisitAddress={onUpdateReturnVisitAddress}
                />
              )
            } />

            {/* 나의봉사 (개인 봉사 현황) */}
            <Route path="/territory" element={
              role === 'admin' ? (
                <Navigate to="/zone" replace />
              ) : (
                <>
                <AppHeader
                  pageTitle={t(language, 'nav.myService')}
                  subtitle={(() => {
                    const myEvents = calendarEvents.filter((e) =>
                      e.date === today && (
                        e.leader === currentVisitor ||
                        e.assigned?.includes(currentVisitor) ||
                        e.applicants?.includes(currentVisitor)
                      )
                    )
                    return myEvents.length > 0 ? '오늘 봉사 진행중' : '오늘 봉사 없음'
                  })()}
                  userId={currentUser.id}
                  userName={currentVisitor}
                  role={role}
                  chatUsers={headerChatUsers}
                  onOpenMenu={() => navigate('/settings')}
                />
                <MobileTerritory
                  language={language}
                  buildings={buildings}
                  cards={cards}
                  calendarEvents={calendarEvents}
                  currentVisitor={currentVisitor}
                  role={role}
                  serviceSessions={serviceSessions}
                  returnVisits={returnVisits}
                  returnVisitLogs={returnVisitLogs}
                  onOpenMap={(cardId) => navigate(`/map?cardId=${cardId}`)}
                  onEndServiceSession={onEndServiceSession}
                  onCreateManualReturnVisit={onCreateManualReturnVisit}
                  onAddReturnVisitLog={onAddReturnVisitLog}
                  onUpdateReturnVisitLog={onUpdateReturnVisitLog}
                  onDeleteReturnVisitLog={onDeleteReturnVisitLog}
                  onDeleteReturnVisit={onDeleteReturnVisit}
                  onUpdateReturnVisitNickname={onUpdateReturnVisitNickname}
                  onUpdateReturnVisitAddress={onUpdateReturnVisitAddress}
                  informalAssets={informalAssets}
                  eventInformalAssignments={eventInformalAssignments}
                  eventRestaurantAssignments={eventRestaurantAssignments}
                  visitHistories={visitHistories}
                  onAddRestaurantVisit={onAddRestaurantVisit}
                  onSubmitRestaurantRequest={onSubmitRestaurantRequest}
                />
                </>
              )
            } />

            {/* 구역 (인도자·관리자용 — 목록↔지도 토글) */}
            <Route path="/zone" element={
              <>
              <AppHeader
                pageTitle={t(language, 'nav.zone')}
                subtitle={(() => {
                  if (role === 'admin') {
                    const total = cards.length
                    const unassigned = cards.filter((c) => c.status === '미배정').length
                    return `구역 카드 ${total} · 미배정 ${unassigned}`
                  }
                  const myCards = cards.filter((c) =>
                    c.assignedLeaders?.includes(currentVisitor) ||
                    c.assignedLeader === currentVisitor ||
                    c.assignedUsers?.includes(currentVisitor)
                  ).length
                  return `담당 카드 ${myCards}개`
                })()}
                userId={currentUser.id}
                userName={currentVisitor}
                role={role}
                chatUsers={headerChatUsers}
                onOpenMenu={() => navigate('/settings')}
              />
              {/* 디자인 v2: 모든 역할이 AdminMobileZone 사용 — 권한별 콜백 가시성으로 차등.
                  admin: 모든 콜백 / leader: 식당 토글만 / user: 자료 관리 콜백 일체 차단 */}
              <AdminMobileZone
                cards={cards}
                buildings={buildings}
                currentVisitor={currentVisitor}
                role={role}
                informalAssets={informalAssets}
                informalGroups={informalGroups}
                onOpenMap={(cardId) => navigate(`/map?cardId=${cardId}`)}
                onOpenAssignedMap={(cardIds, context) => {
                  const params = new URLSearchParams()
                  if (cardIds.length > 0) params.set('cardIds', cardIds.join(','))
                  if (context?.scope === 'mine') params.set('scope', 'mine')
                  if (context?.region) params.set('region', context.region)
                  if (context?.dong) params.set('dong', context.dong)
                  navigate(`/map${params.toString() ? `?${params.toString()}` : ''}`)
                }}
                onShowMapView={() => navigate('/map')}
                /* 비공식 자료 업로드/삭제/그룹 관리는 admin 만 */
                onUploadInformalAsset={role === 'admin' ? onUploadInformalAsset : undefined}
                onDeleteInformalAsset={role === 'admin' ? onDeleteInformalAsset : undefined}
                onCreateInformalGroup={role === 'admin' ? onCreateInformalGroup : undefined}
                onRenameInformalGroup={role === 'admin' ? onRenameInformalGroup : undefined}
                onDeleteInformalGroup={role === 'admin' ? onDeleteInformalGroup : undefined}
                onMoveAssetToGroup={role === 'admin' ? onMoveAssetToGroup : undefined}
                /* 식당 토글은 leader/admin 모두, user 는 제외 */
                onToggleBuildingRestaurant={role === 'user' ? undefined : onToggleBuildingRestaurant}
                restaurantRequests={restaurantRequests}
                onApproveRestaurantRequest={onApproveRestaurantRequest}
                onRejectRestaurantRequest={onRejectRestaurantRequest}
              />
              </>
            } />

            {/* 배정 */}
            <Route path="/assignment" element={
              <>
              <AppHeader
                pageTitle={t(language, 'nav.assignment')}
                subtitle={role === 'admin' ? (() => {
                  const leaderCount = leaderNames.length
                  const unassigned = cards.filter((c) => {
                    const ls = c.assignedLeaders?.length ? c.assignedLeaders : c.assignedLeader ? [c.assignedLeader] : []
                    return ls.length === 0
                  }).length
                  return `인도자 ${leaderCount}명 · 미배정 ${unassigned}개`
                })() : (() => {
                  const myEvents = calendarEvents.filter((e) =>
                    e.date === today && (
                      e.leader === currentVisitor ||
                      e.assigned?.includes(currentVisitor) ||
                      e.applicants?.includes(currentVisitor)
                    )
                  )
                  if (myEvents.length === 0) return '오늘 일정 없음'
                  const total = myEvents.reduce((sum, e) => {
                    const participants = new Set([...(e.assigned ?? []), ...(e.applicants ?? [])])
                    return sum + participants.size
                  }, 0)
                  return `오늘 참여자 ${total}명`
                })()}
                userId={currentUser.id}
                userName={currentVisitor}
                role={role}
                chatUsers={headerChatUsers}
                onOpenMenu={() => navigate('/settings')}
              />
              {role === 'admin' ? (
                <MobileAdminAssignment
                  cards={cards}
                  buildings={buildings}
                  leaderNames={leaderNames}
                  currentVisitor={currentVisitor}
                  onSetCardLeaders={onSetCardLeaders}
                  onOpenMapView={(cardIds) => {
                    const query = cardIds && cardIds.length > 0
                      ? `?cardIds=${cardIds.join(',')}&return=assignment`
                      : '?return=assignment'
                    navigate(`/map${query}`)
                  }}
                />
              ) : (
                <MobileLeaderAssignment
                  cards={cards}
                  buildings={buildings}
                  calendarEvents={calendarEvents}
                  currentVisitor={currentVisitor}
                  role={role}
                  onAssignCardsToEventParticipantsBulk={onAssignCardsToEventParticipantsBulk}
                  informalAssets={informalAssets}
                  informalGroups={informalGroups}
                  eventInformalAssignments={eventInformalAssignments}
                  eventRestaurantAssignments={eventRestaurantAssignments}
                  onAssignInformalToUser={onAssignInformalToUser}
                  onRemoveInformalAssignment={onRemoveInformalAssignment}
                  onAssignRestaurantToUser={onAssignRestaurantToUser}
                  onRemoveRestaurantAssignment={onRemoveRestaurantAssignment}
                  onToggleBuildingRestaurant={onToggleBuildingRestaurant}
                />
              )}
              </>
            } />

            {/* 사용자 */}
            <Route path="/users" element={<MobileUsers />} />

            {/* 가입 신청 관리 */}
            <Route path="/signup-requests" element={
              role === 'admin' ? <MobileSignupRequests /> : <Navigate to="/settings" replace />
            } />

            {/* 특별 봉사 시즌 관리 */}
            <Route path="/special-periods" element={
              role === 'admin' ? (
                <div className="mobile-settings-page">
                  <AppHeader
                    pageTitle="특별 봉사 시즌 관리"
                    showBack
                    onBack={() => navigate('/settings')}
                    userId={currentUser.id}
                    userName={currentVisitor}
                    role={role}
                    chatUsers={headerChatUsers}
                    onOpenMenu={() => navigate('/settings')}
                  />
                  <SpecialPeriodSettings
                    isAdmin
                    specialPeriods={specialPeriods}
                    onCreateSpecialPeriod={onCreateSpecialPeriod}
                    onUpdateSpecialPeriod={onUpdateSpecialPeriod}
                    onDeleteSpecialPeriod={onDeleteSpecialPeriod}
                  />
                </div>
              ) : (
                <Navigate to="/settings" replace />
              )
            } />

            {/* 알림 설정 */}
            <Route path="/notification-settings" element={
              <div className="mobile-settings-page">
                <AppHeader
                  pageTitle="알림 설정"
                  showBack
                  onBack={() => navigate('/settings')}
                  userId={currentUser.id}
                  userName={currentVisitor}
                  role={role}
                  chatUsers={headerChatUsers}
                  onOpenMenu={() => navigate('/settings')}
                />
                <div style={{ padding: '0 16px', marginBottom: 16 }}>
                  <NotificationSettings userId={currentUser.id} />
                </div>
              </div>
            } />

            {/* 설정 */}
            <Route path="/settings" element={
              <div className="mobile-settings-page">
                <AppHeader
                  pageTitle={t(language, 'settings.title')}
                  subtitle={`${currentVisitor} · ${roleLabel}`}
                  userId={currentUser.id}
                  userName={currentVisitor}
                  role={role}
                  chatUsers={headerChatUsers}
                  onOpenMenu={() => navigate('/settings')}
                />

                <button className="mobile-settings-profile" onClick={() => navigate('/profile')} type="button" aria-label="내 정보 관리">
                  <div className="mobile-settings-avatar" aria-hidden="true">
                    {currentVisitor.slice(0, 1)}
                  </div>
                  <div className="mobile-settings-profile-text">
                    <strong>{currentVisitor}</strong>
                    <span>{t(language, 'settings.currentRole')} · {roleLabel}</span>
                  </div>
                  <span className="mobile-settings-chevron" aria-hidden="true">›</span>
                </button>

                {actualRole === 'admin' && (
                  <section className="mobile-settings-switch" aria-label="화면 보기 전환">
                    <p>{t(language, 'settings.viewMode')}</p>
                    <div className="mobile-role-grid">
                      {(['admin', 'leader', 'user'] as Role[]).map((r) => (
                        <button
                          key={r}
                          onClick={() => onChangeViewMode(r)}
                          className={role === r ? 'active' : ''}
                          type="button"
                        >
                          {r === 'admin' ? t(language, 'role.admin') : r === 'leader' ? t(language, 'role.leader') : t(language, 'role.user')}
                        </button>
                      ))}
                    </div>
                  </section>
                )}

                <section className="mobile-settings-switch" aria-label="언어 설정">
                  <p>{t(language, 'settings.language')}</p>
                  <div className="mobile-language-grid">
                    {(['ko', 'zh', 'en'] as AppLanguage[]).map((item) => (
                      <button
                        key={item}
                        className={language === item ? 'active' : ''}
                        onClick={() => onChangeLanguage(item)}
                        type="button"
                      >
                        {languageLabels[item]}
                      </button>
                    ))}
                  </div>
                </section>

                <section className="mobile-settings-menu" aria-label="관리 메뉴">
                  <button onClick={() => navigate('/notices')} type="button">
                    <span className="mobile-settings-icon mobile-settings-icon-neutral" aria-hidden="true">
                      <SettingsIcon name="notice" />
                    </span>
                    <span className="mobile-settings-row-text">
                      <strong>{t(language, 'settings.notice')}</strong>
                      <small>{t(language, 'settings.noticeDesc')}</small>
                    </span>
                    <span className="mobile-settings-chevron" aria-hidden="true">›</span>
                  </button>
                  <button onClick={() => navigate('/notification-settings')} type="button">
                    <span className="mobile-settings-icon mobile-settings-icon-neutral" aria-hidden="true">
                      <SettingsIcon name="notification" />
                    </span>
                    <span className="mobile-settings-row-text">
                      <strong>알림 설정</strong>
                      <small>받을 알림과 방해금지 시간 관리</small>
                    </span>
                    <span className="mobile-settings-chevron" aria-hidden="true">›</span>
                  </button>
                  {role === 'admin' && (
                    <>
                      <button onClick={() => navigate('/users')} type="button">
                        <span className="mobile-settings-icon mobile-settings-icon-neutral" aria-hidden="true">
                          <SettingsIcon name="users" />
                        </span>
                        <span className="mobile-settings-row-text">
                          <strong>{t(language, 'settings.users')}</strong>
                          <small>{t(language, 'settings.usersDesc')}</small>
                        </span>
                        <span className="mobile-settings-chevron" aria-hidden="true">›</span>
                      </button>
                      <button onClick={() => navigate('/signup-requests')} type="button">
                        <span className="mobile-settings-icon mobile-settings-icon-neutral" aria-hidden="true">
                          <SettingsIcon name="signup" />
                        </span>
                        <span className="mobile-settings-row-text">
                          <strong>가입 신청</strong>
                          <small>승인 대기 중인 사용자 확인</small>
                        </span>
                        {pendingSignupCount > 0 && (
                          <span className="mobile-settings-badge" aria-label={`승인 대기 ${pendingSignupCount}명`}>
                            {pendingSignupCount}
                          </span>
                        )}
                        <span className="mobile-settings-chevron" aria-hidden="true">›</span>
                      </button>
                      <button onClick={() => navigate('/special-periods')} type="button">
                        <span className="mobile-settings-icon mobile-settings-icon-season" aria-hidden="true">
                          <SettingsIcon name="season" />
                        </span>
                        <span className="mobile-settings-row-text">
                          <strong>{t(language, 'settings.specialSeason')}</strong>
                          <small>{t(language, 'settings.specialSeasonDesc')}</small>
                        </span>
                        <span className="mobile-settings-chevron" aria-hidden="true">›</span>
                      </button>
                    </>
                  )}
                </section>

                <div style={{ padding: '0 16px', marginBottom: 16 }}>
                  <PwaInstallSection />
                </div>

                <div style={{ padding: '0 16px', marginBottom: 16 }}>
                  <AppUpdateCard variant="mobile" />
                </div>

                <button className="mobile-settings-logout" onClick={onLogout} type="button">
                  <span className="mobile-settings-icon mobile-settings-icon-danger" aria-hidden="true">
                    <SettingsIcon name="logout" />
                  </span>
                  <strong>{t(language, 'settings.logout')}</strong>
                </button>

                <p className="mobile-settings-version">{t(language, 'settings.version')}</p>
              </div>
            } />
          </Routes>

          {BottomNav}
        </main>
      } />
    </Routes>
  )
}
