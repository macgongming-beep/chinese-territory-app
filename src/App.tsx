import { lazy, Suspense, useEffect, useState } from 'react'
import { Toast } from './components/Toast'
import { useStore } from './hooks/useStore'
import { useAuth } from './hooks/useAuth'
import type { Role } from './types'
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

function getInitialDesktopMode() {
  if (typeof window === 'undefined') return true
  return window.matchMedia(DESKTOP_MEDIA_QUERY).matches
}

function App() {
  const { user, login, signup, logout, loading: authLoading, allUsers } = useAuth()
  const actualRole: Role = user?.role ?? 'user'
  const [mobileViewMode, setMobileViewMode] = useState<Role>(actualRole)
  const [isDesktop, setIsDesktop] = useState<boolean>(getInitialDesktopMode)
  const [forceMobileView, setForceMobileView] = useState<boolean>(false)

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
          <Login onLogin={login} onSignup={signup} />
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
      <Suspense
        fallback={
          <div className="app-loading">
            <div className="app-loading-spinner" />
            <p>화면 구성 불러오는 중...</p>
          </div>
        }
      >
        {isDesktop && !forceMobileView ? (
          <DesktopApp
            forceMobileView={forceMobileView}
            onSetForceMobileView={setForceMobileView}
            leaderNames={leaderNames}
            buildings={buildings}
            calendarEvents={calendarEvents}
            cards={cards}
            cardBoundaries={cardBoundaries}
            currentVisitor={user.name}
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
            onUpdateBuilding={updateBuilding}
            onMoveBuildingToCard={moveBuildingToCard}
            onReassignBuildingsToCards={reassignBuildingsToCards}
            onDeleteSpecialPeriod={deleteSpecialPeriod}
            specialPeriods={specialPeriods}
            onDeleteCardBoundary={deleteCardBoundary}
            onDeleteNotice={deleteNotice}
            onDeleteUnit={deleteUnitFromBuilding}
            onRemoveParticipantFromEvent={removeParticipantFromEvent}
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
            onUpdateUnitFlags={updateUnitFlags}
            onSaveCardBoundary={saveCardBoundary}
            visitHistories={visitHistories}
            onChangeViewMode={setMobileViewMode}
            onLogout={logout}
            reviewTasks={reviewTasks}
            onCreateReviewTask={createReviewTask}
            onCompleteReviewTask={completeReviewTask}
            onUncompleteReviewTask={uncompleteReviewTask}
            onUpdateReviewTask={updateReviewTask}
            onDeleteReviewTask={deleteReviewTask}
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
              actualRole={actualRole}
              viewMode={mobileViewMode}
              notices={notices}
              serviceSessions={serviceSessions}
              onChangeViewMode={setMobileViewMode}
              onApplyToEvent={applyToEvent}
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
              onStartServiceSession={startServiceSession}
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
              onLogout={logout}
              visitHistories={visitHistories}
              forceMobileView={forceMobileView}
              onSetForceMobileView={setForceMobileView}
            />
          </div>
        )}
      </Suspense>
    </>
  )
}

export default App
