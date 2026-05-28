import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { trackFetch } from '../lib/perfTracker'
import type {
  Building,
  CalendarEvent,
  CardBoundary,
  EventInformalAssignment,
  EventRestaurantAssignment,
  InformalAsset,
  InformalGroup,
  Notice,
  RestaurantRequest,
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
  toRestaurantRequest,
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
  makeRestaurantServiceMutations,
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
  RawRestaurantRequest,
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
  const [restaurantRequests, setRestaurantRequests] = useState<RestaurantRequest[]>([])
  const [globalSettings, setGlobalSettings] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [, setMissingCardLeaderAssignmentsTable] = useState(false)
  // 마지막 auto_close 호출 시각 (5분 디바운스)
  const lastAutoCloseAtRef = useRef(0)

  // ─── Phase 1: Slice 기반 fetch 아키텍처 ─────────────────────────
  // 각 slice는 도메인 단위로 묶인 테이블 + transform + setter를 캡슐화.
  // fetchSlices(['visits']) 같이 부분 호출 가능. fetchAll = 전체 slice 호출.
  //
  // Slice 의존성:
  //   territory   → buildings, cards, card_boundaries (cards transform은 buildings 필요 → 같이 fetch)
  //   visits      → visit_histories, service_sessions
  //   calendar    → calendar_events, event_card_assignments, event_card_assignment_cards (transform 의존성으로 묶음)
  //   resources   → informal_assets, informal_groups, event_informal_assignments, event_restaurant_assignments
  //   communication → notices
  //   returnVisits → return_visits, return_visit_logs
  //   specialPeriods → special_periods
  //   reviewTasks → review_tasks
  //   restaurantRequests → restaurant_requests
  //   system      → app_settings

  type Slice =
    | 'territory'
    | 'visits'
    | 'calendar'
    | 'resources'
    | 'communication'
    | 'returnVisits'
    | 'specialPeriods'
    | 'reviewTasks'
    | 'restaurantRequests'
    | 'system'

  const ALL_SLICES: Slice[] = [
    'territory', 'visits', 'calendar', 'resources', 'communication',
    'returnVisits', 'specialPeriods', 'reviewTasks', 'restaurantRequests', 'system',
  ]

  // 각 slice를 독립적으로 fetch. 페이로드 크기 누적 반환.
  const fetchSlice = useCallback(async (slice: Slice): Promise<number> => {
    let approxBytes = 0
    const measure = (data: unknown) => {
      try { approxBytes += JSON.stringify(data ?? null).length } catch { /* ignore */ }
    }

    switch (slice) {
      case 'territory': {
        // cards에 card_leader_assignments 컬럼이 없으면 폴백
        const cardsQueryPromise = (async () => {
          const withLeader = await supabase
            .from('cards')
            .select('*, card_assignments(user_name), card_leader_assignments(user_name)')
            .order('id')
          if (!withLeader.error) {
            setMissingCardLeaderAssignmentsTable(false)
            return withLeader
          }
          if (withLeader.error.message.includes('card_leader_assignments')) {
            setMissingCardLeaderAssignmentsTable(true)
            return supabase.from('cards').select('*, card_assignments(user_name)').order('id')
          }
          return withLeader
        })()

        const [buildingsRes, cardsRes, boundariesRes] = await Promise.all([
          supabase.from('buildings').select('*, units(*, regular_visits(*))').order('id'),
          cardsQueryPromise,
          supabase.from('card_boundaries').select('*'),
        ])

        if (buildingsRes.error || cardsRes.error) {
          setError('영역 데이터를 불러오지 못했습니다.')
          return 0
        }

        measure(buildingsRes.data)
        measure(cardsRes.data)
        measure(boundariesRes.data)

        const transformedBuildings = (buildingsRes.data as RawBuilding[]).map(toBuilding)
        const transformedCards = (cardsRes.data as RawCard[]).map((raw) => toCard(raw, transformedBuildings))
        const transformedBoundaries = boundariesRes.error
          ? []
          : ((boundariesRes.data as RawCardBoundary[]).map(toCardBoundary).filter(Boolean) as CardBoundary[])

        if (boundariesRes.error) {
          console.warn('카드별 구역선 로드 실패 (card_boundaries 스키마 미적용 가능).', boundariesRes.error)
        }

        setBuildings(transformedBuildings)
        setCards(transformedCards)
        setCardBoundaries(transformedBoundaries)
        return approxBytes
      }

      case 'visits': {
        const [visitsRes, sessionsRes] = await Promise.all([
          supabase.from('visit_histories').select('*').order('created_at', { ascending: false }),
          supabase.from('service_sessions').select('*').order('started_at', { ascending: false }).limit(100),
        ])

        if (visitsRes.error) {
          setError('방문 기록을 불러오지 못했습니다.')
          return 0
        }

        measure(visitsRes.data)
        measure(sessionsRes.data)

        setVisitHistories((visitsRes.data as RawVisitHistory[]).map(toVisitHistory))
        setServiceSessions(sessionsRes.error
          ? []
          : (sessionsRes.data as RawServiceSession[]).map(toServiceSession))

        if (sessionsRes.error) {
          console.warn('봉사 세션 로드 실패.', sessionsRes.error)
        }
        return approxBytes
      }

      case 'calendar': {
        const [eventsRes, eventCardAssignmentsRes, eventAssignmentCardsRes] = await Promise.all([
          supabase.from('calendar_events').select('*, event_participants(*)').order('event_date').order('time'),
          supabase.from('event_card_assignments').select('*'),
          supabase.from('event_card_assignment_cards').select('*'),
        ])

        if (eventsRes.error) {
          setError('일정을 불러오지 못했습니다.')
          return 0
        }

        measure(eventsRes.data)
        measure(eventCardAssignmentsRes.data)
        measure(eventAssignmentCardsRes.data)

        const base = eventCardAssignmentsRes.error
          ? []
          : (eventCardAssignmentsRes.data as RawEventCardAssignment[]).map(toEventCardAssignment)
        const merged = eventAssignmentCardsRes.error
          ? base
          : mergeEventCardAssignments(base, eventAssignmentCardsRes.data as RawEventCardAssignmentCard[])
        const transformedEvents = (eventsRes.data as RawCalendarEvent[]).map((event) =>
          toCalendarEvent(event, merged.filter((a) => a.eventId === event.id)),
        )
        setCalendarEvents(transformedEvents)

        if (eventCardAssignmentsRes.error) {
          console.warn('일정별 카드 배정 로드 실패.', eventCardAssignmentsRes.error)
        }
        if (eventAssignmentCardsRes.error) {
          console.warn('다중 카드 배정 로드 실패.', eventAssignmentCardsRes.error)
        }
        return approxBytes
      }

      case 'resources': {
        const [informalAssetsRes, eventInformalRes, eventRestaurantRes, informalGroupsRes] = await Promise.all([
          supabase.from('informal_assets').select('*').eq('archived', false).order('created_at', { ascending: false }),
          supabase.from('event_informal_assignments').select('*'),
          supabase.from('event_restaurant_assignments').select('*'),
          supabase.from('informal_groups').select('*').order('position').order('created_at'),
        ])

        measure(informalAssetsRes.data)
        measure(eventInformalRes.data)
        measure(eventRestaurantRes.data)
        measure(informalGroupsRes.data)

        setInformalAssets(informalAssetsRes.error ? [] : (informalAssetsRes.data as RawInformalAsset[]).map(toInformalAsset))
        setEventInformalAssignments(eventInformalRes.error ? [] : (eventInformalRes.data as RawEventInformalAssignment[]).map(toEventInformalAssignment))
        setEventRestaurantAssignments(eventRestaurantRes.error ? [] : (eventRestaurantRes.data as RawEventRestaurantAssignment[]).map(toEventRestaurantAssignment))
        setInformalGroups(informalGroupsRes.error ? [] : (informalGroupsRes.data as RawInformalGroup[]).map(toInformalGroup))

        if (informalAssetsRes.error || eventInformalRes.error || eventRestaurantRes.error || informalGroupsRes.error) {
          console.warn('v2 신 배정 모델 일부 미적용 — supabase/v2_assignment_model.sql 실행 필요')
        }
        return approxBytes
      }

      case 'communication': {
        const noticesRes = await supabase.from('notices').select('*').order('created_at', { ascending: false }).limit(50)
        measure(noticesRes.data)
        setNotices(noticesRes.error ? [] : (noticesRes.data as RawNotice[]).map(toNotice))
        return approxBytes
      }

      case 'returnVisits': {
        const [returnVisitsRes, returnVisitLogsRes] = await Promise.all([
          supabase.from('return_visits').select('*').order('created_at', { ascending: false }),
          supabase.from('return_visit_logs').select('*').order('visited_at', { ascending: false }),
        ])

        measure(returnVisitsRes.data)
        measure(returnVisitLogsRes.data)

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
        return approxBytes
      }

      case 'specialPeriods': {
        const periodsRes = await supabase.from('special_periods').select('*').order('start_date')
        measure(periodsRes.data)
        setSpecialPeriods(periodsRes.error ? [] : (periodsRes.data as { id: number; label: string; start_date: string; end_date: string; color: string; has_invitation?: boolean }[]).map((r) => ({
          id: r.id, label: r.label, startDate: r.start_date, endDate: r.end_date, color: r.color, hasInvitation: r.has_invitation ?? false,
        })))
        return approxBytes
      }

      case 'reviewTasks': {
        const reviewTasksRes = await supabase.from('review_tasks').select('*').neq('status', 'deleted').order('created_at', { ascending: false })
        measure(reviewTasksRes.data)
        setReviewTasks(reviewTasksRes.error ? [] : (reviewTasksRes.data as {
          id: number; title: string; content: string | null; status: ReviewTaskStatus;
          created_by: string; created_at: string; completed_at: string | null; updated_at: string;
        }[]).map((r) => ({
          id: r.id, title: r.title, content: r.content ?? '', status: r.status,
          createdBy: r.created_by, createdAt: r.created_at,
          completedAt: r.completed_at, updatedAt: r.updated_at,
        })))
        if (reviewTasksRes.error) {
          console.warn('검토 항목 로드 실패 (review_tasks 미적용 가능).', reviewTasksRes.error)
        }
        return approxBytes
      }

      case 'restaurantRequests': {
        const res = await supabase.from('restaurant_requests').select('*').order('requested_at', { ascending: false })
        measure(res.data)
        setRestaurantRequests(res.error ? [] : (res.data as RawRestaurantRequest[]).map(toRestaurantRequest))
        if (res.error) {
          console.warn('식당봉사 신청 로드 실패 (v3_restaurant_service.sql 미적용 가능).', res.error)
        }
        return approxBytes
      }

      case 'system': {
        const settingsRes = await supabase.from('app_settings').select('*')
        measure(settingsRes.data)
        setGlobalSettings(settingsRes.error ? {} : Object.fromEntries((settingsRes.data as { key: string; value: string }[]).map((r) => [r.key, r.value])))
        return approxBytes
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 공개 API: 특정 slice만 fetch. 측정 자동 기록.
  const fetchSlices = useCallback(async (
    slices: Slice[],
    options?: { triggeredBy?: string },
  ): Promise<void> => {
    const start = performance.now()
    const bytesArr = await Promise.all(slices.map((s) => fetchSlice(s)))
    const duration = Math.round(performance.now() - start)
    const totalBytes = bytesArr.reduce((a, b) => a + b, 0)
    trackFetch({
      triggeredBy: options?.triggeredBy ?? 'fetchSlices',
      slices,
      approxBytes: totalBytes,
      durationMs: duration,
      timestamp: Date.now(),
    })
  }, [fetchSlice])

  // 기존 fetchAll: 모든 slice + auto_close 부수효과 유지 (100% 후방호환)
  const fetchAll = useCallback(async () => {
    // 자동 종료 함수 호출 (5분 디바운스, 백그라운드 fire-and-forget)
    if (Date.now() - lastAutoCloseAtRef.current > 5 * 60 * 1000) {
      lastAutoCloseAtRef.current = Date.now()
      void supabase.rpc('auto_close_stale_sessions').then((res) => {
        if (res.error && !res.error.message?.includes('Could not find the function')) {
          console.warn('[auto_close_stale_sessions] failed:', res.error)
        }
      })
    }
    await fetchSlices(ALL_SLICES, { triggeredBy: 'fetchAll' })
    setError(null)
    setLoading(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchSlices])

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

  // ── Phase 3: Mutation별 slice-scoped refetcher ─────────────
  // mutation 파일은 fetchAll: () => Promise<void> 를 기대하므로,
  // 도메인별로 적절한 slice만 refetch하는 함수를 만들어서 주입.
  // 결과: mutation 파일 손대지 않고 부분 refetch 적용.
  const refetchVisits = useCallback(
    () => fetchSlices(['visits', 'territory'], { triggeredBy: 'mutation:visits' }),
    [fetchSlices],
  )
  const refetchTerritory = useCallback(
    () => fetchSlices(['territory'], { triggeredBy: 'mutation:territory' }),
    [fetchSlices],
  )
  const refetchCalendar = useCallback(
    () => fetchSlices(['calendar'], { triggeredBy: 'mutation:calendar' }),
    [fetchSlices],
  )
  const refetchCommunication = useCallback(
    () => fetchSlices(['communication'], { triggeredBy: 'mutation:communication' }),
    [fetchSlices],
  )
  const refetchReturnVisits = useCallback(
    () => fetchSlices(['territory', 'returnVisits'], { triggeredBy: 'mutation:returnVisits' }),
    [fetchSlices],
  )
  const refetchSpecialPeriods = useCallback(
    () => fetchSlices(['specialPeriods'], { triggeredBy: 'mutation:specialPeriods' }),
    [fetchSlices],
  )
  const refetchResources = useCallback(
    () => fetchSlices(['resources'], { triggeredBy: 'mutation:resources' }),
    [fetchSlices],
  )
  const refetchRestaurantRequests = useCallback(
    () => fetchSlices(['restaurantRequests', 'territory', 'visits'], { triggeredBy: 'mutation:restaurantRequests' }),
    [fetchSlices],
  )

  // ── Mutations ─────────────────────────────────────────────
  const { getRecordServiceSession, startServiceSession, endServiceSession } =
    makeServiceSessionMutations({ fetchAll: refetchVisits, serviceSessions, buildings })

  const { assignCardToEventParticipant, assignCardsToEventParticipantsBulk } =
    makeEventAssignmentMutations({ fetchAll: refetchCalendar })

  const {
    assignLeaderToCard,
    setCardLeaders,
    setMultipleCardLeaders,
    toggleUserOnCard,
    createCard,
    deleteCards,
  } = makeCardMutations({ fetchAll: refetchTerritory, cards })

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
  } = makeVisitMutations({ fetchAll: refetchVisits, visitHistories, buildings, cards, getRecordServiceSession, getActiveSpecialPeriodIdForDate })

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
  } = makeBuildingMutations({ fetchAll: refetchTerritory, buildings, cards })

  const { saveCardBoundary, deleteCardBoundary, restoreCardBoundaries, mergeCardBoundaries, undoMergeCardBoundaries } = makeCardBoundaryMutations({ fetchAll: refetchTerritory, cardBoundaries, buildings })

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
  } = makeCalendarMutations({ fetchAll: refetchCalendar, calendarEvents })

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
  } = makeRegularVisitMutations({ fetchAll: refetchReturnVisits, buildings, cards, returnVisits })

  // ── 도메인별 mutation 분리 (storeMutations.ts) ──────────────
  const { createNotice, deleteNotice } = makeNoticeMutations({ fetchAll: refetchCommunication })
  const { createSpecialPeriod, updateSpecialPeriod, deleteSpecialPeriod } = makeSpecialPeriodMutations({ fetchAll: refetchSpecialPeriods })
  const {
    createReviewTask,
    completeReviewTask,
    uncompleteReviewTask,
    updateReviewTask,
    deleteReviewTask,
  } = makeReviewTaskMutations({ fetchAll, setReviewTasks })  // reviewTasks는 setter 직접 사용 (fetchAll 호출 거의 없음)

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
    removeRestaurantUnit,
    bulkSetRestaurantFlag,
  } = makeV2AssignmentMutations({ fetchAll: refetchResources })

  const {
    addRestaurantVisit,
    submitRestaurantRequest,
    updateRestaurantRequestMemo,
    approveRestaurantRequest,
    rejectRestaurantRequest,
  } = makeRestaurantServiceMutations({ fetchAll: refetchRestaurantRequests, buildings })

  return {
    refetchAll: fetchAll,
    refetchSlices: fetchSlices,
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
    removeRestaurantUnit,
    bulkSetRestaurantFlag,
    globalSettings,
    // 식당봉사
    restaurantRequests,
    addRestaurantVisit,
    submitRestaurantRequest,
    updateRestaurantRequestMemo,
    approveRestaurantRequest,
    rejectRestaurantRequest,
  }
}
