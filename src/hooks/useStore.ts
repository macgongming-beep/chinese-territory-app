import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { showToast } from '../lib/toast'
import type {
  Building,
  CalendarEvent,
  CardBoundary,
  Notice,
  ReturnVisit,
  ReturnVisitLog,
  ReviewTask,
  ReviewTaskStatus,
  Role,
  ServiceSession,
  ServiceSessionStatus,
  SpecialPeriod,
  TerritoryCard,
  TimeSlot,
  VisitHistory,
} from '../types'
import {
  toBuilding,
  toCard,
  toCalendarEvent,
  toEventCardAssignment,
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
} from './storeMutations'
import type {
  RawBuilding,
  RawCard,
  RawCalendarEvent,
  RawEventCardAssignment,
  RawEventCardAssignmentCard,
  RawVisitHistory,
  RawServiceSession,
  RawCardBoundary,
  RawNotice,
} from './storeTransforms'

export function getCurrentVisitor(): string {
  return localStorage.getItem('currentVisitor') ?? '김민준'
}

function reportMutationError(message: string, error: unknown) {
  console.error(message, error)
  showToast(message, 'error')
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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [missingCardLeaderAssignmentsTable, setMissingCardLeaderAssignmentsTable] = useState(false)

  const fetchAll = useCallback(async () => {
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

    const [buildingsRes, cardsRes, visitsRes, sessionsRes, eventsRes, eventCardAssignmentsRes, eventAssignmentCardsRes, boundariesRes, noticesRes, periodsRes, returnVisitsRes, returnVisitLogsRes, reviewTasksRes] = await Promise.all([
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

  // ── Mutations ─────────────────────────────────────────────
  const getRecordServiceSession = (buildingId?: number, visitedAt: string = getLocalDateString()) => {
    if (visitedAt !== getLocalDateString()) return undefined

    const visitor = getCurrentVisitor()
    const buildingCardId = buildingId
      ? buildings.find((building) => building.id === buildingId)?.cardId
      : undefined
    const todaySessions = serviceSessions
      .filter((session) => session.userName === visitor && session.serviceDate === visitedAt)
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt))

    if (buildingCardId) {
      const activeSameCard = todaySessions.find((session) =>
        session.status === 'active' &&
        !session.endedAt &&
        session.primaryCardId === buildingCardId
      )
      if (activeSameCard) return activeSameCard

      const endedSameCard = todaySessions.find((session) =>
        session.status === 'ended' &&
        session.primaryCardId === buildingCardId
      )
      if (endedSameCard) return endedSameCard

      return undefined
    }

    return todaySessions.find((session) => session.status === 'active' && !session.endedAt)
  }

  const startServiceSession = async (input: {
    role: Role
    timeSlot: TimeSlot
    primaryCardId?: number | null
    calendarEventId?: number | null
    assignedCardId?: number | null
    assignmentId?: number | null
    source?: ServiceSession['source']
    memo?: string
  }) => {
    const serviceDate = getLocalDateString()
    const visitor = getCurrentVisitor()
    let sameSessionQuery = supabase
      .from('service_sessions')
      .select('id')
      .eq('user_name', visitor)
      .eq('service_date', serviceDate)
      .eq('time_slot', input.timeSlot)
      .eq('status', 'active')
      .limit(1)

    sameSessionQuery = input.primaryCardId
      ? sameSessionQuery.eq('primary_card_id', input.primaryCardId)
      : sameSessionQuery.is('primary_card_id', null)

    const existingResult = await sameSessionQuery
    if (existingResult.error) {
      reportMutationError('봉사 시작을 저장하지 못했습니다. service_sessions SQL을 먼저 실행해 주세요.', existingResult.error)
      return null
    }

    const existingId = existingResult.data?.[0]?.id
    const activeSessionsToEnd = serviceSessions.filter((session) =>
      session.userName === visitor &&
      session.serviceDate === serviceDate &&
      session.status === 'active' &&
      !session.endedAt &&
      session.id !== existingId
    )

    if (activeSessionsToEnd.length > 0) {
      const endResult = await supabase
        .from('service_sessions')
        .update({ status: 'ended', ended_at: new Date().toISOString() })
        .in('id', activeSessionsToEnd.map((session) => session.id))

      if (endResult.error) {
        reportMutationError('기존 봉사 세션을 종료하지 못했습니다.', endResult.error)
        return null
      }
    }

    const payload = {
      user_name: visitor,
      role: input.role,
      calendar_event_id: input.calendarEventId ?? null,
      service_date: serviceDate,
      time_slot: input.timeSlot,
      primary_card_id: input.primaryCardId ?? null,
      assigned_card_id: input.assignedCardId ?? null,
      assignment_id: input.assignmentId ?? null,
      source: input.source ?? 'manual',
      memo: input.memo?.trim() || '',
      status: 'active' as ServiceSessionStatus,
      ended_at: null,
    }

    const result = existingId
      ? await supabase.from('service_sessions').update(payload).eq('id', existingId).select('id').single()
      : await supabase.from('service_sessions').insert(payload).select('id').single()

    if (result.error) {
      reportMutationError('봉사 시작을 저장하지 못했습니다.', result.error)
      return null
    }

    await fetchAll()
    showToast(activeSessionsToEnd.length > 0
      ? `이전 봉사를 종료하고 ${input.timeSlot} 봉사를 시작했습니다`
      : `${input.timeSlot} 봉사를 시작했습니다`)
    return result.data?.id ?? existingId ?? null
  }

  const endServiceSession = async (sessionId: number) => {
    const result = await supabase
      .from('service_sessions')
      .update({ status: 'ended', ended_at: new Date().toISOString() })
      .eq('id', sessionId)

    if (result.error) {
      reportMutationError('봉사 세션을 종료하지 못했습니다.', result.error)
      return
    }

    await fetchAll()
    showToast('봉사 세션을 종료했습니다')
  }

  const assignCardToEventParticipant = async (eventId: number, userName: string, cardId: number | null) => {
    if (!cardId) {
      await supabase
        .from('event_card_assignment_cards')
        .delete()
        .eq('event_id', eventId)
        .eq('user_name', userName)
      const deleteResult = await supabase
        .from('event_card_assignments')
        .delete()
        .eq('event_id', eventId)
        .eq('user_name', userName)
      if (deleteResult.error) {
        reportMutationError('카드 배정을 해제하지 못했습니다.', deleteResult.error)
        return
      }
      await fetchAll()
      showToast('카드 배정을 해제했습니다')
      return
    }

    const result = await supabase
      .from('event_card_assignments')
      .upsert(
        {
          event_id: eventId,
          user_name: userName,
          assigned_card_id: cardId,
          assigned_by: getCurrentVisitor(),
        },
        { onConflict: 'event_id,user_name' },
      )

    if (result.error) {
      reportMutationError('참여자 카드 배정을 저장하지 못했습니다. event_card_assignments SQL을 먼저 실행해 주세요.', result.error)
      return
    }

    await supabase
      .from('event_card_assignment_cards')
      .delete()
      .eq('event_id', eventId)
      .eq('user_name', userName)
    await supabase
      .from('event_card_assignment_cards')
      .insert({
        event_id: eventId,
        user_name: userName,
        card_id: cardId,
      })

    await fetchAll()
    showToast('참여자 카드가 배정됐습니다')
  }

  const assignCardsToEventParticipantsBulk = async (
    eventId: number,
    assignments: Array<{ userName: string; cardId?: number | null; cardIds?: number[] | null }>,
    options?: { silentSuccess?: boolean },
  ) => {
    const silentSuccess = options?.silentSuccess === true
    const normalizedAssignments = Array.from(
      new Map(
        assignments
          .map((item) => {
            const rawCardIds = Array.isArray(item.cardIds)
              ? item.cardIds
              : item.cardId
                ? [item.cardId]
                : []
            const cardIds = Array.from(new Set(rawCardIds.filter((value): value is number => typeof value === 'number' && value > 0)))
            return {
              userName: item.userName.trim(),
              cardId: cardIds[0] ?? null,
              cardIds,
            }
          })
          .filter((item) => item.userName.length > 0)
          .map((item) => [item.userName, item]),
      ).values(),
    )

    await supabase
      .from('event_card_assignment_cards')
      .delete()
      .eq('event_id', eventId)

    const deleteResult = await supabase
      .from('event_card_assignments')
      .delete()
      .eq('event_id', eventId)

    if (deleteResult.error) {
      reportMutationError('기존 참여자 카드 배정을 정리하지 못했습니다.', deleteResult.error)
      return
    }

    const rows = normalizedAssignments
      .filter((item) => item.cardId)
      .map((item) => ({
        event_id: eventId,
        user_name: item.userName,
        assigned_card_id: item.cardId as number,
        assigned_by: getCurrentVisitor(),
      }))

    if (rows.length > 0) {
      const insertResult = await supabase
        .from('event_card_assignments')
        .insert(rows)

      if (insertResult.error) {
        reportMutationError('참여자 카드 일괄 배정을 저장하지 못했습니다. event_card_assignments SQL을 먼저 실행해 주세요.', insertResult.error)
        return
      }
    }

    const multiCardRows = normalizedAssignments.flatMap((item) =>
      item.cardIds.map((cardId) => ({
        event_id: eventId,
        user_name: item.userName,
        card_id: cardId,
      })),
    )

    if (multiCardRows.length > 0) {
      const multiCardResult = await supabase
        .from('event_card_assignment_cards')
        .insert(multiCardRows)

      if (multiCardResult.error) {
        console.warn('여러 카드 배정 저장에 실패했습니다. event_card_assignment_cards SQL이 필요할 수 있습니다.', multiCardResult.error)
        showToast('대표 카드 배정은 저장됐지만, 여러 카드 동기화는 SQL 실행 후 완전하게 사용됩니다.')
      }
    }

    await fetchAll()
    if (!silentSuccess) {
      showToast(`참여자 카드 배정 ${normalizedAssignments.length}건을 저장했습니다`)
    }
  }

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

  const { saveCardBoundary, deleteCardBoundary } = makeCardBoundaryMutations({ fetchAll, cardBoundaries })

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
  const { createSpecialPeriod, deleteSpecialPeriod } = makeSpecialPeriodMutations({ fetchAll })
  const {
    createReviewTask,
    completeReviewTask,
    uncompleteReviewTask,
    updateReviewTask,
    deleteReviewTask,
  } = makeReviewTaskMutations({ fetchAll, setReviewTasks })

  return {
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
    deleteSpecialPeriod,
    getActiveSpecialPeriodIdForDate,
    reviewTasks,
    createReviewTask,
    completeReviewTask,
    uncompleteReviewTask,
    updateReviewTask,
    deleteReviewTask,
  }
}
