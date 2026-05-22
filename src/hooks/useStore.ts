import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import type {
  Building,
  CalendarEvent,
  CardBoundary,
  EventInformalAssignment,
  EventRestaurantAssignment,
  InformalAsset,
  InformalGroup,
  Notice,
  ReturnVisit,
  ReturnVisitLog,
  ReviewTask,
  ReviewTaskStatus,
  ServiceSession,
  SpecialPeriod,
  TerritoryCard,
  VisitHistory,
} from '../types'
import {
  toBuilding,
  toCard,
  toCalendarEvent,
  toEventCardAssignment,
  toInformalAsset,
  toInformalGroup,
  toEventInformalAssignment,
  toEventRestaurantAssignment,
  mergeEventCardAssignments,
  toVisitHistory,
  toServiceSession,
  toCardBoundary,
  toNotice,
} from './storeTransforms'
import {
  makeNoticeMutations,
  makeSpecialPeriodMutations,
  makeReviewTaskMutations,
  makeCardBoundaryMutations,
  makeCalendarMutations,
  makeCardMutations,
  makeBuildingMutations,
  makeVisitMutations,
  makeRegularVisitMutations,
  makeServiceSessionMutations,
  makeEventAssignmentMutations,
  makeV2AssignmentMutations,
} from './storeMutations'
import type {
  RawBuilding,
  RawCard,
  RawCalendarEvent,
  RawEventCardAssignment,
  RawEventCardAssignmentCard,
  RawEventInformalAssignment,
  RawEventRestaurantAssignment,
  RawInformalAsset,
  RawInformalGroup,
  RawVisitHistory,
  RawServiceSession,
  RawCardBoundary,
  RawNotice,
} from './storeTransforms'

export function getCurrentVisitor(): string {
  return localStorage.getItem('currentVisitor') ?? '김민준'
}

export function getLocalDateString() {
  const date = new Date()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

export function useStore() {
  const [cards, setCards] = useState<TerritoryCard[]>([])
  const [buildings, setBuildings] = useState<Building[]>([])
  const [visitHistories, setVisitHistories] = useState<VisitHistory[]>([])
  const [serviceSessions, setServiceSessions] = useState<ServiceSession[]>([])
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([])
  const [cardBoundaries, setCardBoundaries] = useState<CardBoundary[]>([])
  const [notices, setNotices] = useState<Notice[]>([])
  const [specialPeriods, setSpecialPeriods] = useState<SpecialPeriod[]>([])
  const [returnVisits, setReturnVisits] = useState<ReturnVisit[]>([])
  const [returnVisitLogs, setReturnVisitLogs] = useState<ReturnVisitLog[]>([])
  const [reviewTasks, setReviewTasks] = useState<ReviewTask[]>([])
  const [informalAssets, setInformalAssets] = useState<InformalAsset[]>([])
  const [eventInformalAssignments, setEventInformalAssignments] = useState<EventInformalAssignment[]>([])
  const [eventRestaurantAssignments, setEventRestaurantAssignments] = useState<EventRestaurantAssignment[]>([])
  const [informalGroups, setInformalGroups] = useState<InformalGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [missingCardLeaderAssignmentsTable, setMissingCardLeaderAssignmentsTable] = useState(false)
  // 마지막 auto_close 호출 시각 (5분 디바운스)
  const lastAutoCloseAtRef = useRef(0)

  const fetchAll = useCallback(async () => {
    // 자동 종료 함수 호출 (5분 디바운스, 백그라운드 fire-and-forget)
    if (Date.now() - lastAutoCloseAtRef.current > 5 * 60 * 1000) {
      lastAutoCloseAtRef.current = Date.now()
      void supabase.rpc('auto_close_stale_sessions').then((res) => {
        if (res.error) {
          // 함수 없으면 (SQL 적용 전) 조용히 무시
          if (!res.error.message?.includes('Could not find the function')) {
            console.warn('[auto_close_stale_sessions] failed:', res.error)
          }
        }
      })
    }
    const cardsQueryPromise = (async () => {
      const withLeaderAssignments = await supabase
        .from('cards')
        .select('*, card_assignments(user_name), card_leader_assignments(user_name)')
        .order('id')

      if (!withLeaderAssignments.error) {
        setMissingCardLeaderAssignmentsTable(false)
        return withLeaderAssignments
      }

      if (withLeaderAssignments.error.message.includes('card_leader_assignments')) {
        setMissingCardLeaderAssignmentsTable(true)
        return supabase.from('cards').select('*, card_assignments(user_name)').order('id')
      }

      return withLeaderAssignments
    })()

    const [
      buildingsRes, cardsRes, visitsRes, sessionsRes, eventsRes,
      eventCardAssignmentsRes, eventAssignmentCardsRes, boundariesRes,
      noticesRes, periodsRes, returnVisitsRes, returnVisitLogsRes, reviewTasksRes,
      informalAssetsRes, eventInformalAssignmentsRes, eventRestaurantAssignmentsRes,
      informalGroupsRes,
    ] = await Promise.all([
      supabase.from('buildings').select('*, units(*, regular_visits(*))').order('id'),
      cardsQueryPromise,
      supabase.from('visit_histories').select('*').order('created_at', { ascending: false }),
      supabase.from('service_sessions').select('*').order('started_at', { ascending: false }).limit(100),
      supabase.from('calendar_events').select('*, event_participants(*)').order('event_date').order('time'),
      supabase.from('event_card_assignments').select('*'),
      supabase.from('event_card_assignment_cards').select('*'),
      supabase.from('card_boundaries').select('*'),
      supabase.from('notices').select('*').order('created_at', { ascending: false }).limit(50),
      supabase.from('special_periods').select('*').order('start_date'),
      supabase.from('return_visits').select('*').order('created_at', { ascending: false }),
      supabase.from('return_visit_logs').select('*').order('visited_at', { ascending: false }),
      supabase.from('review_tasks').select('*').neq('status', 'deleted').order('created_at', { ascending: false }),
      supabase.from('informal_assets').select('*').eq('archived', false).order('created_at', { ascending: false }),
      supabase.from('event_informal_assignments').select('*'),
      supabase.from('event_restaurant_assignments').select('*'),
      supabase.from('informal_groups').select('*').order('position').order('created_at'),
    ])

    if (buildingsRes.error || cardsRes.error || visitsRes.error || eventsRes.error) {
      setError('데이터를 불러오지 못했습니다.')
      setLoading(false)
      return
    }

    const transformedBuildings = (buildingsRes.data as RawBuilding[]).map(toBuilding)
    const transformedCards = (cardsRes.data as RawCard[]).map((raw) =>
      toCard(raw, transformedBuildings),
    )
    const transformedVisits = (visitsRes.data as RawVisitHistory[]).map(toVisitHistory)
    const transformedSessions = sessionsRes.error
      ? []
      : (sessionsRes.data as RawServiceSession[]).map(toServiceSession)
    const transformedEventCardAssignmentsBase = eventCardAssignmentsRes.error
      ? []
      : (eventCardAssignmentsRes.data as RawEventCardAssignment[]).map(toEventCardAssignment)
    const transformedEventCardAssignments = eventAssignmentCardsRes.error
      ? transformedEventCardAssignmentsBase
      : mergeEventCardAssignments(
          transformedEventCardAssignmentsBase,
          eventAssignmentCardsRes.data as RawEventCardAssignmentCard[],
        )
    const transformedEvents = (eventsRes.data as RawCalendarEvent[]).map((event) =>
      toCalendarEvent(event, transformedEventCardAssignments.filter((assignment) => assignment.eventId === event.id)),
    )
    const transformedBoundaries = boundariesRes.error
      ? []
      : ((boundariesRes.data as RawCardBoundary[]).map(toCardBoundary).filter(Boolean) as CardBoundary[])

    if (boundariesRes.error) {
      console.warn('카드별 구역선을 불러오지 못했습니다. card_boundaries 스키마가 아직 없을 수 있습니다.', boundariesRes.error)
    }
    if (sessionsRes.error) {
      console.warn('봉사 세션을 불러오지 못했습니다. service_sessions 스키마가 아직 없을 수 있습니다.', sessionsRes.error)
    }
    if (eventCardAssignmentsRes.error) {
      console.warn('일정별 카드 배정을 불러오지 못했습니다. event_card_assignments 스키마가 아직 없을 수 있습니다.', eventCardAssignmentsRes.error)
    }
    if (eventAssignmentCardsRes.error) {
      console.warn('여러 카드 배정을 불러오지 못했습니다. event_card_assignment_cards SQL을 실행하면 팀별 다중 카드가 동기화됩니다.', eventAssignmentCardsRes.error)
    }
    if (missingCardLeaderAssignmentsTable) {
      console.warn('다수 인도자 배정을 불러오지 못했습니다. card_leader_assignments SQL을 실행해 주세요.')
    }

    setBuildings(transformedBuildings)
    setCards(transformedCards)
    setVisitHistories(transformedVisits)
    setServiceSessions(transformedSessions)
    setCalendarEvents(transformedEvents)
    setCardBoundaries(transformedBoundaries)
    setNotices(noticesRes.error ? [] : (noticesRes.data as RawNotice[]).map(toNotice))
    setSpecialPeriods(periodsRes.error ? [] : (periodsRes.data as { id: number; label: string; start_date: string; end_date: string; color: string }[]).map((r) => ({
      id: r.id, label: r.label, startDate: r.start_date, endDate: r.end_date, color: r.color,
    })))
    setReturnVisits(returnVisitsRes.error ? [] : (returnVisitsRes.data as {
      id: number; unit_id: number; building_id: number; display_name: string;
      nickname: string | null; address: string; unit_number: string; assigned_user_name: string;
      created_by: string; last_visited_at: string | null; last_result: string | null; created_at: string;
    }[]).map((r) => ({
      id: r.id,
      unitId: r.unit_id,
      buildingId: r.building_id,
      displayName: r.display_name,
      nickname: r.nickname ?? '',
      address: r.address ?? '',
      unitNumber: r.unit_number ?? '',
      assignedUserName: r.assigned_user_name ?? '',
      createdBy: r.created_by ?? '',
      lastVisitedAt: r.last_visited_at ?? null,
      lastResult: (r.last_result as '만남' | '부재' | null) ?? null,
      createdAt: r.created_at,
    })))
    setReturnVisitLogs(returnVisitLogsRes.error ? [] : (returnVisitLogsRes.data as {
      id: number; return_visit_id: number; visited_at: string;
      result: string | null; memo: string | null; created_by: string;
    }[]).map((r) => ({
      id: r.id,
      returnVisitId: r.return_visit_id,
      visitedAt: r.visited_at,
      result: (r.result as '만남' | '부재' | null) ?? null,
      memo: r.memo ?? '',
      createdBy: r.created_by ?? '',
    })))
    setReviewTasks(reviewTasksRes.error ? [] : (reviewTasksRes.data as {
      id: number; title: string; content: string | null; status: ReviewTaskStatus;
      created_by: string; created_at: string; completed_at: string | null; updated_at: string;
    }[]).map((r) => ({
      id: r.id,
      title: r.title,
      content: r.content ?? '',
      status: r.status,
      createdBy: r.created_by,
      createdAt: r.created_at,
      completedAt: r.completed_at,
      updatedAt: r.updated_at,
    })))
    if (reviewTasksRes.error) {
      console.warn('검토 항목을 불러오지 못했습니다. review_tasks 테이블이 없을 수 있습니다.', reviewTasksRes.error)
    }

    // v2 신 배정 모델 데이터 (v2_assignment_model.sql 적용 전이면 모두 빈 배열)
    setInformalAssets(informalAssetsRes.error ? [] : (informalAssetsRes.data as RawInformalAsset[]).map(toInformalAsset))
    setEventInformalAssignments(eventInformalAssignmentsRes.error ? [] : (eventInformalAssignmentsRes.data as RawEventInformalAssignment[]).map(toEventInformalAssignment))
    setEventRestaurantAssignments(eventRestaurantAssignmentsRes.error ? [] : (eventRestaurantAssignmentsRes.data as RawEventRestaurantAssignment[]).map(toEventRestaurantAssignment))
    setInformalGroups(informalGroupsRes.error ? [] : (informalGroupsRes.data as RawInformalGroup[]).map(toInformalGroup))
    if (informalAssetsRes.error || eventInformalAssignmentsRes.error || eventRestaurantAssignmentsRes.error || informalGroupsRes.error) {
      console.warn('v2 신 배정 모델 테이블 일부 미적용 — supabase/v2_assignment_model.sql 실행 필요')
    }

    setError(null)
    setLoading(false)
  }, [missingCardLeaderAssignmentsTable])

  useEffect(() => {
    fetchAll().then(async () => {
      // "미배정 건물" 카드가 없으면 자동 생성
      const { data: existing } = await supabase
        .from('cards')
        .select('id')
        .eq('name', '미배정 건물')
        .limit(1)
      if (!existing || existing.length === 0) {
        await supabase.from('cards').insert({
          name: '미배정 건물',
          area: '미배정',
          region: '처인구',
          type: '전체',
          status: '미배정',
        })
        await fetchAll()
      }
    })
  }, [fetchAll])

  // PWA 백그라운드 → 포어그라운드 복귀 시 자동 갱신
  // (브라우저 새로고침이 없는 PWA에서 최신 데이터 확보)
  useEffect(() => {
    let lastFetchAt = Date.now()
    const onVisible = () => {
      if (document.hidden) return
      // 10초 이내 중복 호출 방지
      if (Date.now() - lastFetchAt < 10_000) return
      lastFetchAt = Date.now()
      void fetchAll()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [fetchAll])

  // ── Mutations ─────────────────────────────────────────────
  const { getRecordServiceSession, startServiceSession, endServiceSession } =
    makeServiceSessionMutations({ fetchAll, serviceSessions, buildings })

  const { assignCardToEventParticipant, assignCardsToEventParticipantsBulk } =
    makeEventAssignmentMutations({ fetchAll })

  const {
    assignLeaderToCard,
    setCardLeaders,
    setMultipleCardLeaders,
    toggleUserOnCard,
    createCard,
    deleteCards,
  } = makeCardMutations({ fetchAll, cards })

  // 특정 날짜에 활성화된 특별봉사 시즌 id 반환 (없으면 null)
  const getActiveSpecialPeriodIdForDate = (dateStr: string): number | null => {
    const found = specialPeriods.find(
      (p) => dateStr >= p.startDate && dateStr <= p.endDate,
    )
    return found?.id ?? null
  }

  const {
    updateUnitStatus,
    toggleInvitationLeft,
    quickLogVisit,
    updateUnitFlags,
    undoLatestVisit,
    updateVisitHistory,
    addVisitHistory,
    deleteVisitHistory,
  } = makeVisitMutations({ fetchAll, visitHistories, getRecordServiceSession, getActiveSpecialPeriodIdForDate })

  const {
    createBuilding,
    importBuildings,
    addUnitToBuilding,
    deleteUnitFromBuilding,
    deleteBuilding,
    deleteBuildings,
    mergeDuplicateBuildings,
    updateBuilding,
    moveBuildingToCard,
    reassignBuildingsToCards,
  } = makeBuildingMutations({ fetchAll, buildings })

  const { saveCardBoundary, deleteCardBoundary, restoreCardBoundaries, mergeCardBoundaries, undoMergeCardBoundaries } = makeCardBoundaryMutations({ fetchAll, cardBoundaries, buildings })

  const {
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
  } = makeCalendarMutations({ fetchAll, calendarEvents })

  const {
    toggleRegularVisit,
    setRegularVisitor,
    toggleChinese,
    addReturnVisitLog,
    createManualReturnVisit,
    updateReturnVisitLog,
    deleteReturnVisitLog,
    deleteReturnVisit,
    updateReturnVisitNickname,
    updateReturnVisitAddress,
  } = makeRegularVisitMutations({ fetchAll, buildings, cards, returnVisits })

  // ── 도메인별 mutation 분리 (storeMutations.ts) ──────────────
  const { createNotice, deleteNotice } = makeNoticeMutations({ fetchAll })
  const { createSpecialPeriod, updateSpecialPeriod, deleteSpecialPeriod } = makeSpecialPeriodMutations({ fetchAll })
  const {
    createReviewTask,
    completeReviewTask,
    uncompleteReviewTask,
    updateReviewTask,
    deleteReviewTask,
  } = makeReviewTaskMutations({ fetchAll, setReviewTasks })

  const {
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
  } = makeV2AssignmentMutations({ fetchAll })

  return {
    refetchAll: fetchAll,
    cards,
    buildings,
    visitHistories,
    serviceSessions,
    calendarEvents,
    cardBoundaries,
    notices,
    loading,
    error,
    assignLeaderToCard,
    setCardLeaders,
    setMultipleCardLeaders,
    toggleUserOnCard,
    startServiceSession,
    endServiceSession,
    assignCardToEventParticipant,
    assignCardsToEventParticipantsBulk,
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
    restoreCardBoundaries,
    mergeCardBoundaries,
    undoMergeCardBoundaries,
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
    createNotice,
    deleteNotice,
    specialPeriods,
    createSpecialPeriod,
    updateSpecialPeriod,
    deleteSpecialPeriod,
    getActiveSpecialPeriodIdForDate,
    reviewTasks,
    createReviewTask,
    completeReviewTask,
    uncompleteReviewTask,
    updateReviewTask,
    deleteReviewTask,
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
  }
}
