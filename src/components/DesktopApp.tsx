import { useMemo, useRef, useState } from 'react'
import { showToast } from '../lib/toast'
import { Routes, Route, Navigate, useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import { DesktopCalendar } from './DesktopCalendar'
import { DesktopHome } from './DesktopHome'
import { DesktopNotices } from './DesktopNotices'
import { DesktopSettings } from './DesktopSettings'
import { DesktopStats } from './DesktopStats'
import { DesktopTerritory } from './DesktopTerritory'
import { DesktopMyService } from './DesktopMyService'
import { DesktopMap } from './DesktopMap'
import { DesktopAdminAssignment } from './DesktopAdminAssignment'
import { DesktopLeaderAssignment } from './DesktopLeaderAssignment'
import { DesktopUsers } from './DesktopUsers'
import { ServiceLogPage } from './ServiceLogPage'
import { AppHeaderActionButtons } from './AppHeader'
import type { Building, CalendarEvent, CardBoundary, DesktopPage, EventInformalAssignment, EventRestaurantAssignment, GeoPoint, InformalAsset, InformalGroup, Notice, ReturnVisit, ReturnVisitLog, ReviewTask, Role, ServiceSession, SpecialPeriod, TerritoryCard, TimeSlot, Unit, UnitStatus, VisitHistory } from '../types'
import { roleLabels } from '../types'

const pageToPath: Record<DesktopPage, string> = {
  '홈': '/',
  '공지': '/notices',
  '캘린더': '/calendar',
  '구역': '/zone',       // 구역 관리 (인도자/관리자)
  '활동': '/territory', // 개인 봉사 (봉사자/인도자)
  '지도': '/map',
  '배정': '/assignment',
  '사용자': '/users',
  '통계': '/stats',
  '설정': '/settings'
}

const pathToPage: Record<string, DesktopPage> = {
  '/': '홈',
  '/notices': '공지',
  '/calendar': '캘린더',
  '/territory': '활동',
  '/zone': '구역',
  '/map': '지도',
  '/assignment': '배정',
  '/users': '사용자',
  '/stats': '통계',
  '/settings': '설정'
}

export function DesktopApp({
  buildings,
  calendarEvents,
  cardBoundaries,
  cards,
  currentVisitor,
  currentUserId,
  actualRole,
  viewMode,
  notices,
  serviceSessions,
  onAddUnit,
  onApplyToEvent,
  onSetCardLeaders,
  onSetMultipleCardLeaders,
  onAssignToEvent,
  onStartServiceSession,
  onEndServiceSession,
  onAssignCardToEventParticipant,
  onAssignCardsToEventParticipantsBulk,
  onCreateCalendarEvent,
  onCreateRepeatCalendarEvents,
  onUpdateCalendarEvent,
  onUpdateCalendarEventSeries,
  onDeleteCalendarEvent,
  onDeleteCalendarEventSeries,
  onLinkEventsToSeries,
  onCreateCard,
  onCreateBuilding,
  onImportBuildings,
  onCreateNotice,
  onCreateSpecialPeriod,
  onDeleteBuilding,
  onDeleteBuildings,
  onDeleteCards,
  onMergeDuplicateBuildings,
  onDeleteCardBoundary,
  onMoveBuildingToCard,
  onReassignBuildingsToCards,
  onDeleteNotice,
  onDeleteSpecialPeriod,
  specialPeriods,
  onDeleteUnit,
  onRemoveParticipantFromEvent,
  onAddParticipantToEvent,
  allUsers,
  returnVisits,
  returnVisitLogs,
  onAddReturnVisitLog,
  onToggleRegularVisit,
  onSetRegularVisitor,
  onToggleChinese,
  onToggleUser: _onToggleUser,
  onUndoLatestVisit,
  onAddVisitHistory,
  onUpdateVisitHistory,
  onDeleteVisitHistory,
  onUpdateUnitStatus,
  onQuickLogVisit,
  onToggleInvitationLeft,
  onUpdateUnitFlags,
  onUpdateBuilding,
  onSaveCardBoundary,
  visitHistories,
  onChangeViewMode,
  onLogout,
  leaderNames,
  reviewTasks,
  onCreateReviewTask,
  onCompleteReviewTask,
  onUncompleteReviewTask,
  onUpdateReviewTask,
  onDeleteReviewTask,
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
}: {
  buildings: Building[]
  calendarEvents: CalendarEvent[]
  cardBoundaries: CardBoundary[]
  cards: TerritoryCard[]
  currentVisitor: string
  currentUserId: number
  actualRole: Role
  viewMode: Role
  leaderNames: string[]
  notices: Notice[]
  serviceSessions: ServiceSession[]
  onAddUnit: (buildingId: number, unitNumber: string) => void
  onApplyToEvent: (eventId: number) => void
  onSetCardLeaders: (cardId: number, leaderNames: string[], options?: { silentSuccess?: boolean }) => Promise<void> | void
  onSetMultipleCardLeaders: (cardIds: number[], leaderNames: string[], options?: { silentSuccess?: boolean }) => Promise<void> | void
  onAssignToEvent: (eventId: number, userName: string) => void
  onStartServiceSession: (input: {
    role: Role
    timeSlot: TimeSlot
    primaryCardId?: number | null
    calendarEventId?: number | null
    assignedCardId?: number | null
    assignmentId?: number | null
    source?: ServiceSession['source']
    memo?: string
  }) => Promise<number | null>
  onEndServiceSession: (sessionId: number) => void
  onAssignCardToEventParticipant: (eventId: number, userName: string, cardId: number | null) => void
  onAssignCardsToEventParticipantsBulk: (
    eventId: number,
    assignments: Array<{ userName: string; cardId?: number | null; cardIds?: number[] | null }>,
    options?: { silentSuccess?: boolean },
  ) => Promise<void> | void
  onCreateCalendarEvent: (input: { date: string; time: string; title: string; place: string; leader: string; memo: string; hasMeeting: boolean; allowApplications: boolean }) => void
  onCreateRepeatCalendarEvents: (dates: string[], input: { time: string; title: string; place: string; leader: string; memo: string; hasMeeting: boolean; allowApplications: boolean }) => void
  onUpdateCalendarEvent: (eventId: number, input: { time: string; title: string; place: string; leader: string; memo: string; hasMeeting: boolean; allowApplications: boolean }) => void
  onUpdateCalendarEventSeries: (seriesId: string, fromDate: string, input: { time: string; title: string; place: string; leader: string; memo: string; hasMeeting: boolean; allowApplications: boolean }) => void
  onDeleteCalendarEvent: (eventId: number) => void
  onDeleteCalendarEventSeries: (seriesId: string, fromDate: string) => void
  onLinkEventsToSeries: (eventIds: number[]) => void
  onCreateCard: (input: {
    area: string
    region: string
    index: number
    pinCount: number
  }) => Promise<number | null> | number | null
  onCreateBuilding: (input: {
    cardId: number
    name: string
    address: string
    type: Building['type']
    lat: number
    lng: number
  }) => void
  onImportBuildings: (inputs: Array<{
    cardId: number
    name: string
    address: string
    type: Building['type']
    lat: number
    lng: number
    units: Array<{
      number: string
      status: UnitStatus
      isChinese: boolean
      isRegularVisit: boolean
      regularVisitor?: string
      memo?: string
    }>
  }>) => Promise<{ inserted: number; skipped: number }>
  onCreateNotice: (input: { title: string; content: string; priority: Notice['priority']; author: string }) => void
  onCreateSpecialPeriod: (input: { label: string; startDate: string; endDate: string; color: string }) => void
  onDeleteBuilding: (buildingId: number) => void
  onDeleteBuildings: (buildingIds: number[]) => void
  onDeleteCards: (cardIds: number[]) => void
  onMergeDuplicateBuildings: (scopeCardId?: number, nameOverrides?: Record<number, string>, selectedPrimaryIds?: number[]) => Promise<void>
  onUpdateBuilding: (buildingId: number, name: string, address: string, lat?: number, lng?: number, type?: Building['type'], memo?: string, isChineseHeavy?: boolean) => void
  onMoveBuildingToCard: (buildingId: number, cardId: number) => void
  onReassignBuildingsToCards: (updates: Array<{ buildingId: number; cardId: number }>) => Promise<{ updated: number; failed: number }>
  onDeleteCardBoundary: (cardId: number) => void
  onDeleteNotice: (id: number) => void
  onDeleteSpecialPeriod: (id: number) => void
  specialPeriods: SpecialPeriod[]
  onDeleteUnit: (buildingId: number, unitId: number) => void
  onRemoveParticipantFromEvent: (eventId: number, userName: string) => void
  onAddParticipantToEvent: (eventId: number, userName: string) => void
  allUsers: Array<{ id: number; name: string; role: string }>
  returnVisits?: ReturnVisit[]
  returnVisitLogs?: ReturnVisitLog[]
  onAddReturnVisitLog?: (returnVisitId: number, result: '만남' | '부재' | null, memo: string) => Promise<void>
  onToggleRegularVisit: (buildingId: number, unitId: number, visitorName?: string) => void
  onSetRegularVisitor: (unitId: number, visitorName: string) => void
  onToggleChinese: (buildingId: number, unitId: number) => void
  onToggleUser: (cardId: number, userName: string) => void
  onUndoLatestVisit: (buildingId: number, unitId: number) => void
  onAddVisitHistory: (
    buildingId: number,
    unitId: number,
    input: { result: UnitStatus; timeSlot: TimeSlot; memo: string; visitedAt: string },
  ) => void
  onUpdateVisitHistory: (
    historyId: number,
    unitId: number,
    input: { result: UnitStatus; timeSlot: TimeSlot; memo: string; visitedAt: string },
  ) => void
  onDeleteVisitHistory: (historyId: number, unitId: number) => void
  onUpdateUnitStatus: (buildingId: number, unitId: number, status: UnitStatus, memo?: string) => void
  onQuickLogVisit: (buildingId: number, unitId: number, result: UnitStatus, invitationLeft?: boolean) => void
  onToggleInvitationLeft: (buildingId: number, unitId: number) => void
  onUpdateUnitFlags: (unitId: number, flags: Partial<Unit>) => void
  onSaveCardBoundary: (cardId: number, points: GeoPoint[]) => Promise<void> | void
  visitHistories: VisitHistory[]
  onChangeViewMode: (role: Role) => void
  onLogout: () => void
  reviewTasks: ReviewTask[]
  onCreateReviewTask: (title: string, content: string, createdBy: string) => Promise<void>
  onCompleteReviewTask: (id: number) => Promise<void>
  onUncompleteReviewTask: (id: number) => Promise<void>
  onUpdateReviewTask: (id: number, title: string, content: string) => Promise<void>
  onDeleteReviewTask: (id: number) => Promise<void>
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
}) {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  
  const [boundaryEditRequest, setBoundaryEditRequest] = useState(0)
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false)
  const roleDropdownRef = useRef<HTMLDivElement>(null)

  const handleViewModeChange = (role: Role) => {
    onChangeViewMode(role)
    setRoleDropdownOpen(false)
    const label = role === 'user' ? '봉사자' : roleLabels[role]
    showToast(`${label}로 변경되었습니다.`, 'success')
  }
  // /zone?view=map 에서 지도 뷰 (인도자 구역 탭 내부 토글)
  const showZoneMapView = location.pathname === '/zone' && searchParams.get('view') === 'map'

  const rawActivePage = pathToPage[location.pathname] || '홈'
  // 인도자가 /map에 있을 때 → '구역' 탭 활성화 (지도 탭 없음)
  const activePage: DesktopPage =
    rawActivePage === '지도' && viewMode === 'leader' ? '구역' : rawActivePage

  const visibleDesktopPages: DesktopPage[] = viewMode === 'user'
    ? ['홈', '캘린더', '활동', '지도', '설정']
    : viewMode === 'leader'
      ? ['홈', '캘린더', '활동', '배정', '구역', '설정']
      : ['홈', '공지', '캘린더', '구역', '지도', '배정', '사용자', '통계', '설정']

  const focusedMapCardId = searchParams.get('cardId') ? Number(searchParams.get('cardId')) : null
  const focusedMapBuildingId = searchParams.get('buildingId') ? Number(searchParams.get('buildingId')) : null
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
    return ids
  }, [cards, currentVisitor, serviceSessions])
  const isUserMapScope = viewMode === 'user'
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
  const safeFocusedMapBuildingId =
    isUserMapScope && focusedMapBuildingId && !mapBuildings.some((building) => building.id === focusedMapBuildingId)
      ? null
      : focusedMapBuildingId

  const openCardOnMap = (cardId: number, editBoundary = false) => {
    if (editBoundary) setBoundaryEditRequest((request) => request + 1)
    if (viewMode === 'leader') {
      navigate(`/zone?view=map&cardId=${cardId}`)
    } else {
      navigate(`/map?cardId=${cardId}`)
    }
  }

  const openBuildingOnMap = (buildingId: number) => {
    const building = buildings.find((item) => item.id === buildingId)
    if (!building) return
    if (viewMode === 'leader') {
      navigate(`/zone?view=map&cardId=${building.cardId}&buildingId=${building.id}`)
    } else {
      navigate(`/map?cardId=${building.cardId}&buildingId=${building.id}`)
    }
  }

  const startServiceSessionAndOpenMap = async (input: {
    role: Role
    timeSlot: TimeSlot
    primaryCardId?: number | null
    calendarEventId?: number | null
    assignedCardId?: number | null
    assignmentId?: number | null
    source?: ServiceSession['source']
    memo?: string
  }) => {
    const id = await onStartServiceSession(input)
    if (id && input.primaryCardId) {
      if (viewMode === 'leader') {
        navigate(`/zone?view=map&cardId=${input.primaryCardId}`)
      } else {
        navigate(`/map?cardId=${input.primaryCardId}`)
      }
    }
    return id
  }

  return (
    <main className="desktop-shell">
      <header className="desktop-header">
        <div className="nav-brand">
          <div className="nav-mark" aria-hidden="true">
            <svg viewBox="0 0 28 28">
              <path d="M6 7.5 12.5 5l6 2.5L22 6v15l-6.5 2.5-6-2.5L6 22Z" />
              <path d="M12.5 5v16M18.5 7.5v16" />
              <circle cx="14" cy="13.5" r="2.6" />
            </svg>
          </div>
          <div className="nav-brand-text">
            <strong>CHS-Yongin</strong>
            <span>용인 중국어</span>
          </div>
        </div>
        <nav className="desktop-nav" aria-label="관리 메뉴">
          {visibleDesktopPages.map((item) => (
            <button
              className={item === activePage ? 'active' : ''}
              key={item}
              onClick={() => navigate(pageToPath[item])}
              type="button"
            >
              {item}
            </button>
          ))}
        </nav>
        <div className="nav-user" ref={roleDropdownRef}>
          <AppHeaderActionButtons
            userId={currentUserId}
            userName={currentVisitor}
            role={viewMode}
            chatUsers={allUsers.map((user) => ({ id: user.id, name: user.name, role: user.role as Role }))}
            onOpenMenu={() => navigate('/settings')}
            className="desktop-header-actions"
            buttonClassName="desktop-header-action"
          />
          <div className="nav-user-info">
            <strong className="nav-user-name">{currentVisitor}</strong>
            {actualRole === 'admin' ? (
              <div className="nav-role-dropdown-wrap">
                <button
                  className="nav-role-dropdown-btn"
                  onClick={() => setRoleDropdownOpen((o) => !o)}
                  type="button"
                >
                  {viewMode === 'user' ? '봉사자' : roleLabels[viewMode]} 뷰
                  <span className="nav-role-chevron">{roleDropdownOpen ? '▴' : '▾'}</span>
                </button>
                {roleDropdownOpen && (
                  <div className="nav-role-dropdown-menu">
                    {(['admin', 'leader', 'user'] as Role[]).map((role) => (
                      <button
                        className={viewMode === role ? 'active' : ''}
                        key={role}
                        onClick={() => handleViewModeChange(role)}
                        type="button"
                      >
                        {role === 'user' ? '봉사자' : roleLabels[role]}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <span className="nav-user-role">{roleLabels[actualRole]}</span>
            )}
          </div>
          <div className={`nav-avatar${actualRole === 'admin' ? ' nav-avatar--admin' : ''}`}>
            {currentVisitor.slice(0, 1) || '사'}
          </div>
        </div>
      </header>

      <Routes>
        <Route path="/" element={
          <DesktopHome
            calendarEvents={calendarEvents}
            cards={cards}
            currentVisitor={currentVisitor}
            notices={notices}
            role={viewMode}
            serviceSessions={serviceSessions}
            returnVisits={returnVisits}
            returnVisitLogs={returnVisitLogs}
            onApplyToEvent={onApplyToEvent}
            onStartServiceSession={(input) => startServiceSessionAndOpenMap({ ...input, role: viewMode })}
            onEndServiceSession={onEndServiceSession}
            onOpenCalendar={() => navigate('/calendar')}
            onOpenNotices={() => navigate('/notices')}
            onOpenTerritory={() => navigate('/territory')}
            reviewTasks={reviewTasks}
            onCreateReviewTask={(title, content) => onCreateReviewTask(title, content, currentVisitor)}
            onCompleteReviewTask={onCompleteReviewTask}
            onUncompleteReviewTask={onUncompleteReviewTask}
            onUpdateReviewTask={onUpdateReviewTask}
            onDeleteReviewTask={onDeleteReviewTask}
            specialPeriods={specialPeriods}
            onOpenSettings={() => navigate('/settings')}
          />
        } />
        <Route path="/calendar" element={
          <DesktopCalendar
            currentVisitor={currentVisitor}
            currentUserId={currentUserId}
            leaderNames={leaderNames}
            events={calendarEvents}
            role={viewMode}
            allUserNames={allUsers.map((u) => u.name)}
            mentionUsers={allUsers.map((user) => ({ id: user.id, name: user.name, role: user.role }))}
            onApplyToEvent={onApplyToEvent}
            onAssignToEvent={onAssignToEvent}
            onAssignCardToEventParticipant={onAssignCardToEventParticipant}
            cards={cards}
            onCreateEvent={onCreateCalendarEvent}
            onCreateRepeatEvents={onCreateRepeatCalendarEvents}
            onUpdateEvent={onUpdateCalendarEvent}
            onUpdateEventSeries={onUpdateCalendarEventSeries}
            onDeleteEvent={onDeleteCalendarEvent}
            onDeleteEventSeries={onDeleteCalendarEventSeries}
            onLinkEventsToSeries={onLinkEventsToSeries}
            onCreateSpecialPeriod={onCreateSpecialPeriod}
            onDeleteSpecialPeriod={onDeleteSpecialPeriod}
            specialPeriods={specialPeriods}
            onRemoveParticipant={onRemoveParticipantFromEvent}
            onAddParticipant={onAddParticipantToEvent}
          />
        } />
        {/* /territory → 나의봉사 (개인 봉사 현황) */}
        <Route path="/territory" element={
          viewMode === 'admin' ? (
            <DesktopTerritory
              buildings={buildings}
              cardBoundaries={cardBoundaries}
              cards={cards}
              role={viewMode}
              onSetCardLeaders={onSetCardLeaders}
              onSetMultipleCardLeaders={onSetMultipleCardLeaders}
              onCreateCard={onCreateCard}
              onImportBuildings={onImportBuildings}
              onDeleteBuildings={onDeleteBuildings}
              onDeleteCards={onDeleteCards}
              onMergeDuplicateBuildings={onMergeDuplicateBuildings}
              onAddUnit={onAddUnit}
              onDeleteUnit={onDeleteUnit}
              onMoveBuildingToCard={onMoveBuildingToCard}
              onReassignBuildingsToCards={onReassignBuildingsToCards}
              onUpdateBuilding={onUpdateBuilding}
              onToggleChinese={onToggleChinese}
              onToggleRegularVisit={onToggleRegularVisit}
              onSetRegularVisitor={onSetRegularVisitor}
              onUpdateUnitFlags={onUpdateUnitFlags}
              onUpdateUnitStatus={onUpdateUnitStatus}
              onOpenCardMap={openCardOnMap}
              onOpenBuildingMap={openBuildingOnMap}
              visitHistories={visitHistories}
              onCreateBuilding={onCreateBuilding}
              currentVisitor={currentVisitor}
              informalAssets={informalAssets}
              informalGroups={informalGroups}
              onUploadInformalAsset={onUploadInformalAsset}
              onDeleteInformalAsset={onDeleteInformalAsset}
              onCreateInformalGroup={onCreateInformalGroup}
              onRenameInformalGroup={onRenameInformalGroup}
              onDeleteInformalGroup={onDeleteInformalGroup}
              onMoveAssetToGroup={onMoveAssetToGroup}
              onToggleBuildingRestaurant={onToggleBuildingRestaurant}
            />
          ) : (
            <DesktopMyService
              buildings={buildings}
              calendarEvents={calendarEvents}
              cards={cards}
              currentVisitor={currentVisitor}
              role={viewMode}
              serviceSessions={serviceSessions}
              returnVisits={returnVisits}
              returnVisitLogs={returnVisitLogs}
              onOpenMap={openCardOnMap}
              onEndServiceSession={onEndServiceSession}
              onAddReturnVisitLog={onAddReturnVisitLog}
            />
          )
        } />

        {/* /zone → 구역 관리 (인도자·관리자용, 목록↔지도 토글) */}
        <Route path="/zone" element={
          <div style={{ position: 'relative' }}>
            {showZoneMapView ? (
              <DesktopMap
                buildings={buildings}
                boundaryEditRequest={boundaryEditRequest}
                cardBoundaries={cardBoundaries}
                cards={cards}
                currentVisitor={currentVisitor}
                actualRole={viewMode}
                serviceSessions={serviceSessions}
                focusedCardId={focusedMapCardId}
                focusedBuildingId={focusedMapBuildingId}
                onAddUnit={onAddUnit}
                onCreateBuilding={onCreateBuilding}
                onDeleteBuilding={onDeleteBuilding}
                onUpdateBuilding={onUpdateBuilding}
                onDeleteCardBoundary={onDeleteCardBoundary}
                onDeleteUnit={onDeleteUnit}
                onSaveCardBoundary={onSaveCardBoundary}
                onToggleRegularVisit={onToggleRegularVisit}
                onToggleChinese={onToggleChinese}
                onUndoLatestVisit={onUndoLatestVisit}
                onAddVisitHistory={onAddVisitHistory}
                onUpdateVisitHistory={onUpdateVisitHistory}
                onDeleteVisitHistory={onDeleteVisitHistory}
                onUpdateUnitStatus={onUpdateUnitStatus}
                onQuickLogVisit={onQuickLogVisit}
                onToggleInvitationLeft={onToggleInvitationLeft}
                onUpdateUnitFlags={onUpdateUnitFlags}
                visitHistories={visitHistories}
                onSwitchToList={() => navigate('/zone')}
              />
            ) : (
              <DesktopTerritory
                buildings={buildings}
                cardBoundaries={cardBoundaries}
                cards={cards}
                role={viewMode}
                onSetCardLeaders={onSetCardLeaders}
                onSetMultipleCardLeaders={onSetMultipleCardLeaders}
                onCreateCard={onCreateCard}
                onImportBuildings={onImportBuildings}
                onDeleteBuildings={onDeleteBuildings}
                onDeleteCards={onDeleteCards}
                onMergeDuplicateBuildings={onMergeDuplicateBuildings}
                onAddUnit={onAddUnit}
                onDeleteUnit={onDeleteUnit}
                onMoveBuildingToCard={onMoveBuildingToCard}
                onReassignBuildingsToCards={onReassignBuildingsToCards}
                onUpdateBuilding={onUpdateBuilding}
                onToggleChinese={onToggleChinese}
                onToggleRegularVisit={onToggleRegularVisit}
                onSetRegularVisitor={onSetRegularVisitor}
                onUpdateUnitFlags={onUpdateUnitFlags}
                onUpdateUnitStatus={onUpdateUnitStatus}
                onOpenCardMap={openCardOnMap}
                onOpenBuildingMap={openBuildingOnMap}
                visitHistories={visitHistories}
                onCreateBuilding={onCreateBuilding}
                onSwitchToMap={() => navigate('/zone?view=map')}
                currentVisitor={currentVisitor}
                informalAssets={informalAssets}
                informalGroups={informalGroups}
                onUploadInformalAsset={onUploadInformalAsset}
                onDeleteInformalAsset={onDeleteInformalAsset}
                onCreateInformalGroup={onCreateInformalGroup}
                onRenameInformalGroup={onRenameInformalGroup}
                onDeleteInformalGroup={onDeleteInformalGroup}
                onMoveAssetToGroup={onMoveAssetToGroup}
                onToggleBuildingRestaurant={onToggleBuildingRestaurant}
              />
            )}
          </div>
        } />
        <Route path="/map" element={
          <DesktopMap
            buildings={mapBuildings}
            boundaryEditRequest={boundaryEditRequest}
            cardBoundaries={mapCardBoundaries}
            cards={mapCards}
            currentVisitor={currentVisitor}
            actualRole={viewMode}
            serviceSessions={serviceSessions}
            focusedCardId={safeFocusedMapCardId}
            focusedBuildingId={safeFocusedMapBuildingId}
            onAddUnit={onAddUnit}
            onCreateBuilding={onCreateBuilding}
            onDeleteBuilding={onDeleteBuilding}
            onUpdateBuilding={onUpdateBuilding}
            onDeleteCardBoundary={onDeleteCardBoundary}
            onDeleteUnit={onDeleteUnit}
            onSaveCardBoundary={onSaveCardBoundary}
            onToggleRegularVisit={onToggleRegularVisit}
            onToggleChinese={onToggleChinese}
            onUndoLatestVisit={onUndoLatestVisit}
            onAddVisitHistory={onAddVisitHistory}
            onUpdateVisitHistory={onUpdateVisitHistory}
            onDeleteVisitHistory={onDeleteVisitHistory}
            onUpdateUnitStatus={onUpdateUnitStatus}
            onQuickLogVisit={onQuickLogVisit}
            onToggleInvitationLeft={onToggleInvitationLeft}
            onUpdateUnitFlags={onUpdateUnitFlags}
            visitHistories={visitHistories}
            specialPeriods={specialPeriods}
          />
        } />
        <Route path="/assignment" element={
          viewMode === 'admin' ? (
            <DesktopAdminAssignment
              cards={cards}
              currentVisitor={currentVisitor}
              leaderNames={leaderNames}
              onSetCardLeaders={onSetCardLeaders}
            />
          ) : (
            <DesktopLeaderAssignment
              cards={cards}
              calendarEvents={calendarEvents}
              currentVisitor={currentVisitor}
              role={viewMode}
              leaderNames={leaderNames}
              onSetCardLeaders={onSetCardLeaders}
              onSetMultipleCardLeaders={onSetMultipleCardLeaders}
              onAssignCardsToEventParticipantsBulk={onAssignCardsToEventParticipantsBulk}
              buildings={buildings}
              informalAssets={informalAssets}
              eventInformalAssignments={eventInformalAssignments}
              eventRestaurantAssignments={eventRestaurantAssignments}
              onAssignInformalToUser={onAssignInformalToUser}
              onRemoveInformalAssignment={onRemoveInformalAssignment}
              onAssignRestaurantToUser={onAssignRestaurantToUser}
              onRemoveRestaurantAssignment={onRemoveRestaurantAssignment}
              onToggleBuildingRestaurant={onToggleBuildingRestaurant}
            />
          )
        } />
        <Route path="/users" element={
          <DesktopUsers
            visitHistories={visitHistories}
          />
        } />
        <Route path="/notices" element={
          <DesktopNotices
            currentVisitor={currentVisitor}
            currentUserId={currentUserId}
            role={actualRole}
            notices={notices}
            mentionUsers={allUsers.map((user) => ({ id: user.id, name: user.name, role: user.role }))}
            onCreateNotice={onCreateNotice}
            onDeleteNotice={onDeleteNotice}
          />
        } />
        <Route path="/stats" element={
          <DesktopStats
            cards={cards}
            buildings={buildings}
            visitHistories={visitHistories}
            serviceSessions={serviceSessions}
            specialPeriods={specialPeriods}
            actualRole={actualRole}
          />
        } />
        <Route path="/settings" element={
          <DesktopSettings
            currentVisitor={currentVisitor}
            currentUserId={currentUserId}
            actualRole={actualRole}
            onLogout={onLogout}
            specialPeriods={specialPeriods}
            onCreateSpecialPeriod={async (input) => onCreateSpecialPeriod(input)}
            onDeleteSpecialPeriod={async (id) => onDeleteSpecialPeriod(id)}
          />
        } />
        <Route path="/service-logs" element={
          (viewMode === 'leader' || viewMode === 'admin')
            ? <ServiceLogPage cards={cards} calendarEvents={calendarEvents} role={viewMode} />
            : <Navigate to="/" replace />
        } />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </main>
  )
}
