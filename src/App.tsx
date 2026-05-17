import { lazy, Suspense, useEffect, useState } from 'react'
import { Toast } from './components/Toast'
import { PwaInstallBanner } from './components/PwaInstall'
import { PullToRefresh } from './components/PullToRefresh'
import { useStore } from './hooks/useStore'
import { useAuth } from './hooks/useAuth'
import type { Role } from './types'
import type { AppLanguage } from './i18n'
import { isAppLanguage } from './i18n'
import './App.css'

const DesktopApp = lazy(() =>
  import('./components/DesktopApp').then((module) => ({ default: module.DesktopApp }))
)
const MobileHome = lazy(() =>
  import('./components/MobileHome').then((module) => ({ default: module.MobileHome }))
)
const Login = lazy(() =>
  import('./components/Login').then((module) => ({ default: module.Login }))
)

const DESKTOP_MEDIA_QUERY = '(min-width: 980px)'
const ROLE_VALUES: Role[] = ['admin', 'leader', 'user']

function getInitialDesktopMode() {
  if (typeof window === 'undefined') return true
  return window.matchMedia(DESKTOP_MEDIA_QUERY).matches
}

function getViewModeStorageKey(userId: number) {
  return `chsViewMode:${userId}`
}

function getLanguageStorageKey(userId: number) {
  return `chsLanguage:${userId}`
}

function getInitialLanguage(): AppLanguage {
  if (typeof window === 'undefined') return 'ko'
  const storedLanguage = window.localStorage.getItem('chsLanguage:guest')
  return isAppLanguage(storedLanguage) ? storedLanguage : 'ko'
}

function isRole(value: unknown): value is Role {
  return typeof value === 'string' && ROLE_VALUES.includes(value as Role)
}

function App() {
  const { user, login, signup, logout, changePin, updateMyProfile, loading: authLoading, allUsers } = useAuth()
  const actualRole: Role = user?.role ?? 'user'
  const [mobileViewMode, setMobileViewMode] = useState<Role>(actualRole)
  const [language, setLanguage] = useState<AppLanguage>(getInitialLanguage)
  const [isDesktop, setIsDesktop] = useState<boolean>(getInitialDesktopMode)

  const {
    cards,
    buildings,
    visitHistories,
    serviceSessions,
    calendarEvents,
    cardBoundaries,
    notices,
    loading,
    error,
    setCardLeaders,
    setMultipleCardLeaders,
    toggleUserOnCard,
    startServiceSession,
    endServiceSession,
    updateUnitStatus,
    quickLogVisit,
    toggleInvitationLeft,
    updateUnitFlags,
    undoLatestVisit,
    addVisitHistory,
    updateVisitHistory,
    deleteVisitHistory,
    createCard,
    createBuilding,
    importBuildings,
    addUnitToBuilding,
    deleteUnitFromBuilding,
    deleteBuilding,
    deleteBuildings,
    deleteCards,
    updateBuilding,
    moveBuildingToCard,
    reassignBuildingsToCards,
    saveCardBoundary,
    deleteCardBoundary,
    returnVisits,
    returnVisitLogs,
    createManualReturnVisit,
    toggleRegularVisit,
    addReturnVisitLog,
    updateReturnVisitLog,
    deleteReturnVisitLog,
    deleteReturnVisit,
    updateReturnVisitNickname,
    updateReturnVisitAddress,
    setRegularVisitor,
    toggleChinese,
    createCalendarEvent,
    createRepeatCalendarEvents,
    updateCalendarEvent,
    updateCalendarEventSeries,
    deleteCalendarEvent,
    deleteCalendarEventSeries,
    linkEventsToSeries,
    applyToEvent,
    assignToEvent,
    removeParticipantFromEvent,
    addParticipantToEvent,
    mergeDuplicateBuildings,
    assignCardToEventParticipant,
    assignCardsToEventParticipantsBulk,
    createNotice,
    deleteNotice,
    specialPeriods,
    createSpecialPeriod,
    deleteSpecialPeriod,
    reviewTasks,
    createReviewTask,
    completeReviewTask,
    uncompleteReviewTask,
    updateReviewTask,
    deleteReviewTask,
    refetchAll,
    // v2 신 배정 모델
    informalAssets,
    eventInformalAssignments,
    eventRestaurantAssignments,
    informalGroups,
    uploadInformalAsset,
    deleteInformalAsset,
    createInformalGroup,
    renameInformalGroup,
    deleteInformalGroup,
    moveAssetToGroup,
    assignInformalToUser,
    removeInformalAssignment,
    assignRestaurantToUser,
    removeRestaurantAssignment,
    toggleBuildingRestaurant,
  } = useStore()

  // role이 leader 또는 admin인 유저만 인도자 목록으로
  const leaderNames = allUsers
    .filter((u) => u.role === 'leader' || u.role === 'admin')
    .map((u) => u.name)
    .sort((a, b) => a.localeCompare(b, 'ko'))

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mediaQuery = window.matchMedia(DESKTOP_MEDIA_QUERY)
    const onChange = (event: MediaQueryListEvent) => setIsDesktop(event.matches)
    setIsDesktop(mediaQuery.matches)
    mediaQuery.addEventListener('change', onChange)
    return () => mediaQuery.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    if (!user) return
    if (actualRole !== 'admin') {
      setMobileViewMode(actualRole)
      return
    }

    const storedViewMode = window.localStorage.getItem(getViewModeStorageKey(user.id))
    setMobileViewMode(isRole(storedViewMode) ? storedViewMode : 'admin')
  }, [actualRole, user])

  useEffect(() => {
    if (!user) return
    const storedLanguage = window.localStorage.getItem(getLanguageStorageKey(user.id))
    setLanguage(isAppLanguage(storedLanguage) ? storedLanguage : 'ko')
  }, [user])

  const handleChangeViewMode = (role: Role) => {
    setMobileViewMode(role)
    if (user && actualRole === 'admin') {
      window.localStorage.setItem(getViewModeStorageKey(user.id), role)
    }
  }

  const handleChangeLanguage = (nextLanguage: AppLanguage) => {
    setLanguage(nextLanguage)
    if (user) {
      window.localStorage.setItem(getLanguageStorageKey(user.id), nextLanguage)
    } else {
      window.localStorage.setItem('chsLanguage:guest', nextLanguage)
    }
  }

  if (authLoading || loading) {
    return (
      <div className="app-loading">
        <div className="app-loading-spinner" />
        <p>데이터 불러오는 중...</p>
      </div>
    )
  }

  if (!user) {
    return (
      <>
        <Toast />
        <Suspense
          fallback={
            <div className="app-loading">
              <div className="app-loading-spinner" />
              <p>로그인 화면 불러오는 중...</p>
            </div>
          }
        >
          <Login
            language={language}
            onChangeLanguage={handleChangeLanguage}
            onLogin={login}
            onSignup={signup}
          />
        </Suspense>
      </>
    )
  }

  if (error) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', height: '100svh', fontWeight: 700, color: 'var(--danger-600)' }}>
        {error}
      </div>
    )
  }

  return (
    <>
      <Toast />
      <PwaInstallBanner />
      <PullToRefresh onRefresh={refetchAll} />
      <Suspense
        fallback={
          <div className="app-loading">
            <div className="app-loading-spinner" />
            <p>화면 구성 불러오는 중...</p>
          </div>
        }
      >
        {isDesktop ? (
          <DesktopApp
            leaderNames={leaderNames}
            buildings={buildings}
            calendarEvents={calendarEvents}
            cards={cards}
            cardBoundaries={cardBoundaries}
            currentVisitor={user.name}
            currentUserId={user.id}
            actualRole={actualRole}
            viewMode={mobileViewMode}
            notices={notices}
            serviceSessions={serviceSessions}
            onAddUnit={addUnitToBuilding}
            onApplyToEvent={applyToEvent}
            onSetCardLeaders={setCardLeaders}
            onSetMultipleCardLeaders={setMultipleCardLeaders}
            onAssignToEvent={assignToEvent}
            onAssignCardToEventParticipant={assignCardToEventParticipant}
            onAssignCardsToEventParticipantsBulk={assignCardsToEventParticipantsBulk}
            onCreateCalendarEvent={createCalendarEvent}
            onCreateRepeatCalendarEvents={createRepeatCalendarEvents}
            onUpdateCalendarEvent={updateCalendarEvent}
            onUpdateCalendarEventSeries={updateCalendarEventSeries}
            onDeleteCalendarEvent={deleteCalendarEvent}
            onDeleteCalendarEventSeries={deleteCalendarEventSeries}
            onLinkEventsToSeries={linkEventsToSeries}
            onCreateCard={createCard}
            onCreateBuilding={createBuilding}
            onImportBuildings={importBuildings}
            onCreateNotice={createNotice}
            onCreateSpecialPeriod={createSpecialPeriod}
            onDeleteBuilding={deleteBuilding}
            onDeleteBuildings={deleteBuildings}
            onDeleteCards={deleteCards}
            onMergeDuplicateBuildings={mergeDuplicateBuildings}
            onUpdateBuilding={updateBuilding}
            onMoveBuildingToCard={moveBuildingToCard}
            onReassignBuildingsToCards={reassignBuildingsToCards}
            onDeleteSpecialPeriod={deleteSpecialPeriod}
            specialPeriods={specialPeriods}
            onDeleteCardBoundary={deleteCardBoundary}
            onDeleteNotice={deleteNotice}
            onDeleteUnit={deleteUnitFromBuilding}
            allUsers={allUsers}
            returnVisits={returnVisits}
            returnVisitLogs={returnVisitLogs}
            onAddReturnVisitLog={addReturnVisitLog}
            onRemoveParticipantFromEvent={removeParticipantFromEvent}
            onAddParticipantToEvent={addParticipantToEvent}
            onToggleRegularVisit={toggleRegularVisit}
            onSetRegularVisitor={setRegularVisitor}
            onToggleChinese={toggleChinese}
            onToggleUser={toggleUserOnCard}
            onStartServiceSession={startServiceSession}
            onEndServiceSession={endServiceSession}
            onUndoLatestVisit={undoLatestVisit}
            onAddVisitHistory={addVisitHistory}
            onUpdateVisitHistory={updateVisitHistory}
            onDeleteVisitHistory={deleteVisitHistory}
            onUpdateUnitStatus={updateUnitStatus}
            onQuickLogVisit={quickLogVisit}
            onToggleInvitationLeft={toggleInvitationLeft}
            onUpdateUnitFlags={updateUnitFlags}
            onSaveCardBoundary={saveCardBoundary}
            visitHistories={visitHistories}
            onChangeViewMode={handleChangeViewMode}
            onLogout={logout}
            reviewTasks={reviewTasks}
            onCreateReviewTask={createReviewTask}
            onCompleteReviewTask={completeReviewTask}
            onUncompleteReviewTask={uncompleteReviewTask}
            onUpdateReviewTask={updateReviewTask}
            onDeleteReviewTask={deleteReviewTask}
            informalAssets={informalAssets}
            eventInformalAssignments={eventInformalAssignments}
            eventRestaurantAssignments={eventRestaurantAssignments}
            informalGroups={informalGroups}
            onUploadInformalAsset={uploadInformalAsset}
            onDeleteInformalAsset={deleteInformalAsset}
            onCreateInformalGroup={createInformalGroup}
            onRenameInformalGroup={renameInformalGroup}
            onDeleteInformalGroup={deleteInformalGroup}
            onMoveAssetToGroup={moveAssetToGroup}
            onAssignInformalToUser={assignInformalToUser}
            onRemoveInformalAssignment={removeInformalAssignment}
            onAssignRestaurantToUser={assignRestaurantToUser}
            onRemoveRestaurantAssignment={removeRestaurantAssignment}
            onToggleBuildingRestaurant={toggleBuildingRestaurant}
          />
        ) : (
          <div className="mobile-shell-host">
            <MobileHome
              leaderNames={leaderNames}
              buildings={buildings}
              calendarEvents={calendarEvents}
              cardBoundaries={cardBoundaries}
              cards={cards}
              currentVisitor={user.name}
              currentUser={user}
              language={language}
              actualRole={actualRole}
              viewMode={mobileViewMode}
              notices={notices}
              serviceSessions={serviceSessions}
              onChangeViewMode={handleChangeViewMode}
              onChangeLanguage={handleChangeLanguage}
              onSetCardLeaders={setCardLeaders}
              allUsers={allUsers}
              onChangePin={changePin}
              onUpdateMyProfile={updateMyProfile}
              onApplyToEvent={applyToEvent}
              onAddParticipantToEvent={addParticipantToEvent}
              onCreateCalendarEvent={createCalendarEvent}
              onDeleteCalendarEvent={deleteCalendarEvent}
              onUpdateCalendarEvent={updateCalendarEvent}
              onCreateNotice={createNotice}
              onDeleteNotice={deleteNotice}
              onAddUnit={addUnitToBuilding}
              onCreateBuilding={createBuilding}
              onDeleteBuilding={deleteBuilding}
              onUpdateBuilding={updateBuilding}
              onDeleteUnit={deleteUnitFromBuilding}
              onToggleUser={toggleUserOnCard}
              onEndServiceSession={endServiceSession}
              onAssignCardToEventParticipant={assignCardToEventParticipant}
              onAssignCardsToEventParticipantsBulk={assignCardsToEventParticipantsBulk}
              returnVisits={returnVisits}
              returnVisitLogs={returnVisitLogs}
              onCreateManualReturnVisit={createManualReturnVisit}
              onToggleRegularVisit={toggleRegularVisit}
              onAddReturnVisitLog={addReturnVisitLog}
              onUpdateReturnVisitLog={updateReturnVisitLog}
              onDeleteReturnVisitLog={deleteReturnVisitLog}
              onDeleteReturnVisit={deleteReturnVisit}
              onUpdateReturnVisitNickname={updateReturnVisitNickname}
              onUpdateReturnVisitAddress={updateReturnVisitAddress}
              onToggleChinese={toggleChinese}
              onUndoLatestVisit={undoLatestVisit}
              onUpdateVisitHistory={updateVisitHistory}
              onDeleteVisitHistory={deleteVisitHistory}
              onUpdateUnitStatus={updateUnitStatus}
              onQuickLogVisit={quickLogVisit}
              onUpdateUnitFlags={updateUnitFlags}
              onToggleInvitationLeft={toggleInvitationLeft}
              onLogout={logout}
              visitHistories={visitHistories}
              specialPeriods={specialPeriods}
              onCreateSpecialPeriod={createSpecialPeriod}
              onDeleteSpecialPeriod={deleteSpecialPeriod}
              informalAssets={informalAssets}
              eventInformalAssignments={eventInformalAssignments}
              eventRestaurantAssignments={eventRestaurantAssignments}
              informalGroups={informalGroups}
              onUploadInformalAsset={uploadInformalAsset}
              onDeleteInformalAsset={deleteInformalAsset}
              onCreateInformalGroup={createInformalGroup}
              onRenameInformalGroup={renameInformalGroup}
              onDeleteInformalGroup={deleteInformalGroup}
              onMoveAssetToGroup={moveAssetToGroup}
              onAssignInformalToUser={assignInformalToUser}
              onRemoveInformalAssignment={removeInformalAssignment}
              onAssignRestaurantToUser={assignRestaurantToUser}
              onRemoveRestaurantAssignment={removeRestaurantAssignment}
              onToggleBuildingRestaurant={toggleBuildingRestaurant}
            />
          </div>
        )}
      </Suspense>
    </>
  )
}

export default App
