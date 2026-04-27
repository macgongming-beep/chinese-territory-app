import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { showToast } from '../lib/toast'
import { getCurrentTimeSlot } from "../utils/timeUtils"
import { isValidMapCoordinate } from '../utils/mapUtils'
import type {
  Building,
  CalendarEvent,
  CardBoundary,
  CardType,
  EventCardAssignment,
  GeoPoint,
  Notice,
  ReturnVisit,
  ReturnVisitLog,
  ReviewTask,
  ReviewTaskStatus,
  Role,
  ScheduleType,
  ServiceSession,
  ServiceSessionStatus,
  SpecialPeriod,
  TerritoryCard,
  TimeSlot,
  UnitStatus,
  VisitHistory,
  Unit,
} from '../types'

export function getCurrentVisitor(): string {
  return localStorage.getItem('currentVisitor') ?? '김민준'
}

const unitNumberCollator = new Intl.Collator('ko-KR', { numeric: true, sensitivity: 'base' })

// ── DB row types ──────────────────────────────────────────────
type RawUnit = {
  id: number
  building_id: number
  number: string
  status: UnitStatus
  is_chinese: boolean
  is_forbidden?: boolean | null
  memo: string | null
  regular_visits: { visitor_name: string }[]
}

type RawBuilding = {
  id: number
  card_id: number
  name: string
  address: string
  type: '주택' | '상가'
  lat: number
  lng: number
  warning: boolean
  memo: string | null
  units: RawUnit[]
}

type RawCard = {
  id: number
  name: string
  area: string
  region: string
  type: string
  status: '미배정' | '진행중' | '완료' | '보류'
  leader_name: string | null
  card_assignments: { user_name: string }[]
  card_leader_assignments?: { user_name: string }[]
}

type RawCalendarEvent = {
  id: number
  event_date: string
  time: string
  title: string
  type: string
  place: string
  leader_name: string
  card_name: string
  has_meeting: boolean
  allow_applications?: boolean | null
  memo: string
  series_id: string | null
  event_participants: { user_name: string; role: string }[]
}

type RawEventCardAssignment = {
  id: number
  event_id: number
  user_name: string
  assigned_card_id: number
  assigned_by: string | null
  assigned_at: string
  memo: string | null
}

type RawEventCardAssignmentCard = {
  id: number
  event_id: number
  user_name: string
  card_id: number
}

type RawVisitHistory = {
  id: number
  unit_id: number
  service_session_id?: number | null
  visitor_name: string
  result: UnitStatus
  time_slot: TimeSlot
  memo: string | null
  visited_at: string
  created_at: string
}

type RawServiceSession = {
  id: number
  user_name: string
  role: Role
  calendar_event_id?: number | null
  started_at: string
  ended_at: string | null
  service_date: string
  time_slot: TimeSlot
  status: ServiceSessionStatus
  primary_card_id: number | null
  assigned_card_id?: number | null
  assignment_id?: number | null
  source?: 'assigned' | 'manual' | 'manual_override'
  memo: string | null
  created_at: string
}

type RawCardBoundary = {
  card_id: number
  points: unknown
}

// ── Transformers ──────────────────────────────────────────────
function toBuilding(raw: RawBuilding): Building {
  return {
    id: raw.id,
    cardId: raw.card_id,
    name: raw.name,
    address: raw.address,
    type: raw.type,
    lat: Number(raw.lat),
    lng: Number(raw.lng),
    warning: raw.warning,
    memo: raw.memo ?? undefined,
    units: [...raw.units]
      .sort((a, b) => unitNumberCollator.compare(a.number, b.number))
      .map((u) => ({
        id: u.id,
        number: u.number,
        status: u.status,
        isChinese: u.is_chinese,
        isForbidden: Boolean(u.is_forbidden) || u.status === '거절',
        memo: u.memo ?? undefined,
        isRegularVisit: !!(u.regular_visits && (Array.isArray(u.regular_visits) ? u.regular_visits.length > 0 : true)),
        regularVisitor: u.regular_visits
          ? (Array.isArray(u.regular_visits) ? u.regular_visits[0]?.visitor_name : (u.regular_visits as any).visitor_name)
          : undefined,
      })),
  }
}

function toCard(raw: RawCard, buildings: Building[]): TerritoryCard {
  const cardBuildings = buildings.filter((b) => b.cardId === raw.id)
  const allUnits = cardBuildings.flatMap((b) => b.units)
  const completed = allUnits.filter((u) => u.status !== '미방문').length
  const total = allUnits.length
  const progress = total > 0 ? Math.round((completed / total) * 100) : 0
  const regularVisitPoints = cardBuildings.flatMap((b) =>
    b.units
      .filter((u) => u.isRegularVisit)
      .map((u) => ({ point: `${b.name} ${u.number}`, visitor: u.regularVisitor ?? '' })),
  )

  const assignedLeaders = Array.from(
    new Set((raw.card_leader_assignments ?? []).map((entry) => entry.user_name).filter(Boolean)),
  )

  return {
    id: raw.id,
    name: raw.name,
    area: raw.area,
    region: raw.region,
    type: normalizeCardType(),
    status: raw.status,
    buildings: cardBuildings.length,
    units: total,
    completed,
    progress,
    regularVisits: regularVisitPoints.length,
    regularVisitPoints,
    assignedLeader: assignedLeaders[0] ?? raw.leader_name,
    assignedLeaders,
    assignedUsers: (raw.card_assignments ?? []).map((a) => a.user_name),
  }
}

function normalizeCardType(): CardType {
  return '전체'
}

function toCalendarEvent(raw: RawCalendarEvent, cardAssignments: EventCardAssignment[] = []): CalendarEvent {
  const participants = raw.event_participants ?? []
  return {
    id: raw.id,
    date: raw.event_date,
    time: raw.time,
    title: raw.title,
    type: raw.type as ScheduleType,
    place: raw.place,
    leader: raw.leader_name,
    card: raw.card_name,
    hasMeeting: raw.has_meeting,
    allowApplications: raw.allow_applications ?? true,
    applicants: participants.map((p) => p.user_name),
    assigned: participants.filter((p) => p.role === '입명').map((p) => p.user_name),
    cardAssignments,
    memo: raw.memo,
    seriesId: raw.series_id ?? undefined,
  }
}

function toEventCardAssignment(raw: RawEventCardAssignment): EventCardAssignment {
  return {
    id: raw.id,
    eventId: raw.event_id,
    userName: raw.user_name,
    assignedCardId: raw.assigned_card_id,
    assignedCardIds: [raw.assigned_card_id],
    assignedBy: raw.assigned_by ?? '',
    assignedAt: raw.assigned_at,
    memo: raw.memo ?? '',
  }
}

function mergeEventCardAssignments(
  baseAssignments: EventCardAssignment[],
  cardRows: RawEventCardAssignmentCard[],
): EventCardAssignment[] {
  if (cardRows.length === 0) return baseAssignments

  const grouped = new Map<string, number[]>()
  cardRows.forEach((row) => {
    const key = `${row.event_id}:${row.user_name}`
    const current = grouped.get(key) ?? []
    current.push(row.card_id)
    grouped.set(key, current)
  })

  return baseAssignments.map((assignment) => {
    const key = `${assignment.eventId}:${assignment.userName}`
    const groupedIds = grouped.get(key)
    if (!groupedIds || groupedIds.length === 0) {
      return assignment
    }
    const deduped = Array.from(new Set(groupedIds))
    return {
      ...assignment,
      assignedCardIds: deduped,
      assignedCardId: deduped[0] ?? assignment.assignedCardId,
    }
  })
}

function toVisitHistory(raw: RawVisitHistory): VisitHistory {
  return {
    id: raw.id,
    buildingId: 0, // not stored in DB, lookup from unit if needed
    unitId: raw.unit_id,
    serviceSessionId: raw.service_session_id ?? null,
    visitor: raw.visitor_name,
    result: raw.result,
    timeSlot: raw.time_slot,
    memo: raw.memo ?? undefined,
    visitedAt: raw.visited_at,
    createdAt: raw.created_at,
  }
}

function toServiceSession(raw: RawServiceSession): ServiceSession {
  return {
    id: raw.id,
    userName: raw.user_name,
    role: raw.role,
    calendarEventId: raw.calendar_event_id ?? null,
    startedAt: raw.started_at,
    endedAt: raw.ended_at,
    serviceDate: raw.service_date,
    timeSlot: raw.time_slot,
    status: raw.status,
    primaryCardId: raw.primary_card_id,
    assignedCardId: raw.assigned_card_id ?? null,
    assignmentId: raw.assignment_id ?? null,
    source: raw.source ?? 'manual',
    memo: raw.memo ?? '',
    createdAt: raw.created_at,
  }
}

function toCardBoundary(raw: RawCardBoundary): CardBoundary | null {
  if (!Array.isArray(raw.points)) return null
  const points = raw.points.filter((point): point is GeoPoint => {
    if (!point || typeof point !== 'object') return false
    const candidate = point as Partial<GeoPoint>
    return typeof candidate.lat === 'number' && typeof candidate.lng === 'number'
  })
  if (points.length < 3) return null
  return { cardId: raw.card_id, points }
}

function reportMutationError(message: string, error: unknown) {
  console.error(message, error)
  showToast(message, 'error')
}

// getCurrentTimeSlot is now imported from ../utils/timeUtils

export function getLocalDateString() {
  const date = new Date()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

// ── Hook ──────────────────────────────────────────────────────
type RawNotice = {
  id: number
  title: string
  content: string
  priority: string
  author: string
  created_at: string
}

const PRIORITY_MAP: Record<string, Notice['priority']> = {
  normal: '일반', important: '긴급', urgent: '긴급',
  일반: '일반', 중요: '긴급', 긴급: '긴급', 정보: '정보',
}

function toNotice(raw: RawNotice): Notice {
  return {
    id: raw.id,
    title: raw.title,
    content: raw.content ?? '',
    priority: PRIORITY_MAP[raw.priority] ?? '일반',
    author: raw.author ?? '',
    createdAt: raw.created_at,
  }
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

  const assignLeaderToCard = async (cardId: number, leaderName: string) => {
    const trimmedLeader = leaderName.trim()
    const targetCard = cards.find((c) => c.id === cardId)
    const hasAssignedUsers = (targetCard?.assignedUsers?.length ?? 0) > 0
    const nextLeader = trimmedLeader.length > 0 ? trimmedLeader : null
    const newStatus =
      nextLeader
        ? targetCard?.status === '미배정' ? '진행중' : undefined
        : !hasAssignedUsers ? '미배정' : undefined

    await supabase
      .from('cards')
      .update({ leader_name: nextLeader, ...(newStatus ? { status: newStatus } : {}) })
      .eq('id', cardId)
    await fetchAll()
    showToast(nextLeader ? '인도자가 배정됐습니다' : '인도자 배정이 해제됐습니다')
  }

  const setCardLeaders = async (
    cardId: number,
    leaderNames: string[],
    options?: { silentSuccess?: boolean },
  ) => {
    const silentSuccess = options?.silentSuccess === true
    const normalizedLeaders = Array.from(new Set(leaderNames.map((name) => name.trim()).filter(Boolean)))
    const primaryLeader = normalizedLeaders[0] ?? null
    const targetCard = cards.find((card) => card.id === cardId)
    const hasAssignedUsers = (targetCard?.assignedUsers.length ?? 0) > 0
    const newStatus = primaryLeader ? (targetCard?.status === '미배정' ? '진행중' : undefined) : (!hasAssignedUsers ? '미배정' : undefined)

    const cardUpdateResult = await supabase
      .from('cards')
      .update({ leader_name: primaryLeader, ...(newStatus ? { status: newStatus } : {}) })
      .eq('id', cardId)

    if (cardUpdateResult.error) {
      reportMutationError('인도자 정보를 저장하지 못했습니다.', cardUpdateResult.error)
      return
    }

    const deleteResult = await supabase
      .from('card_leader_assignments')
      .delete()
      .eq('card_id', cardId)

    if (deleteResult.error) {
      if (deleteResult.error.message.includes('card_leader_assignments')) {
        await fetchAll()
        if (normalizedLeaders.length > 1) {
          showToast('다수 인도자 저장을 위해 SQL 마이그레이션을 실행해 주세요.', 'error')
        } else if (!silentSuccess) {
          showToast(primaryLeader ? '인도자가 배정됐습니다' : '인도자 배정이 해제됐습니다')
        }
        return
      }
      reportMutationError('기존 인도자 배정을 정리하지 못했습니다.', deleteResult.error)
      return
    }

    if (normalizedLeaders.length > 0) {
      const insertResult = await supabase
        .from('card_leader_assignments')
        .insert(normalizedLeaders.map((name) => ({ card_id: cardId, user_name: name })))
      if (insertResult.error) {
        reportMutationError('다수 인도자 배정을 저장하지 못했습니다.', insertResult.error)
        return
      }
    }

    await fetchAll()
    if (!silentSuccess) {
      showToast(normalizedLeaders.length > 0 ? '인도자 배정을 저장했습니다' : '인도자 배정을 해제했습니다')
    }
  }

  const setMultipleCardLeaders = async (
    cardIds: number[],
    leaderNames: string[],
    options?: { silentSuccess?: boolean },
  ) => {
    const normalizedCardIds = Array.from(new Set(cardIds)).filter(Boolean)
    if (normalizedCardIds.length === 0) return

    const silentSuccess = options?.silentSuccess === true
    const normalizedLeaders = Array.from(new Set(leaderNames.map((name) => name.trim()).filter(Boolean)))
    const primaryLeader = normalizedLeaders[0] ?? null
    const targetCards = cards.filter((card) => normalizedCardIds.includes(card.id))
    const idsToProgress = targetCards
      .filter((card) => primaryLeader && card.status === '미배정')
      .map((card) => card.id)
    const idsToUnassign = targetCards
      .filter((card) => !primaryLeader && card.assignedUsers.length === 0)
      .map((card) => card.id)

    const leaderUpdateResult = await supabase
      .from('cards')
      .update({ leader_name: primaryLeader })
      .in('id', normalizedCardIds)

    if (leaderUpdateResult.error) {
      reportMutationError('인도자 정보를 저장하지 못했습니다.', leaderUpdateResult.error)
      return
    }

    if (idsToProgress.length > 0) {
      const progressResult = await supabase
        .from('cards')
        .update({ status: '진행중' })
        .in('id', idsToProgress)
      if (progressResult.error) {
        reportMutationError('카드 진행 상태를 저장하지 못했습니다.', progressResult.error)
        return
      }
    }

    if (idsToUnassign.length > 0) {
      const unassignResult = await supabase
        .from('cards')
        .update({ status: '미배정' })
        .in('id', idsToUnassign)
      if (unassignResult.error) {
        reportMutationError('카드 배정 상태를 저장하지 못했습니다.', unassignResult.error)
        return
      }
    }

    const deleteResult = await supabase
      .from('card_leader_assignments')
      .delete()
      .in('card_id', normalizedCardIds)

    if (deleteResult.error) {
      if (deleteResult.error.message.includes('card_leader_assignments')) {
        await fetchAll()
        if (normalizedLeaders.length > 1) {
          showToast('다수 인도자 저장을 위해 SQL 마이그레이션을 실행해 주세요.', 'error')
        } else if (!silentSuccess) {
          showToast(primaryLeader ? '인도자 배정을 저장했습니다' : '인도자 배정을 해제했습니다')
        }
        return
      }
      reportMutationError('기존 인도자 배정을 정리하지 못했습니다.', deleteResult.error)
      return
    }

    if (normalizedLeaders.length > 0) {
      const rows = normalizedCardIds.flatMap((cardId) =>
        normalizedLeaders.map((name) => ({ card_id: cardId, user_name: name })),
      )
      const insertResult = await supabase
        .from('card_leader_assignments')
        .insert(rows)
      if (insertResult.error) {
        reportMutationError('다수 인도자 배정을 저장하지 못했습니다.', insertResult.error)
        return
      }
    }

    await fetchAll()
    if (!silentSuccess) {
      showToast(
        normalizedLeaders.length > 0
          ? `카드 ${normalizedCardIds.length}개 인도자 배정을 저장했습니다`
          : `카드 ${normalizedCardIds.length}개 인도자 배정을 해제했습니다`,
      )
    }
  }

  const toggleUserOnCard = async (cardId: number, userName: string) => {
    const card = cards.find((c) => c.id === cardId)
    if (!card) return
    if (card.assignedUsers.includes(userName)) {
      await supabase
        .from('card_assignments')
        .delete()
        .eq('card_id', cardId)
        .eq('user_name', userName)
    } else {
      await supabase.from('card_assignments').insert({ card_id: cardId, user_name: userName })
    }
    await fetchAll()
  }

  const updateUnitStatus = async (
    _buildingId: number,
    unitId: number,
    status: UnitStatus,
    memo?: string,
    timeSlot: TimeSlot = getCurrentTimeSlot(),
  ) => {
    const recordSession = getRecordServiceSession(_buildingId)
    const effectiveTimeSlot = recordSession?.timeSlot ?? timeSlot
    const statusResult = await supabase.from('units').update({ status }).eq('id', unitId)
    if (statusResult.error) {
      reportMutationError('호수 상태를 저장하지 못했습니다.', statusResult.error)
      return
    }

    const visitedAt = getLocalDateString()
    const existingAttemptResult = await supabase
      .from('visit_histories')
      .select('id')
      .eq('unit_id', unitId)
      .eq('visitor_name', getCurrentVisitor())
      .eq('visited_at', visitedAt)
      .eq('time_slot', effectiveTimeSlot)
      .order('created_at', { ascending: false })
      .limit(1)

    if (existingAttemptResult.error) {
      reportMutationError('기존 방문 이력을 확인하지 못했습니다. 호수 상태는 변경됐을 수 있습니다.', existingAttemptResult.error)
      return
    }

    const existingAttempt = existingAttemptResult.data?.[0]
    const historyPayload = {
      result: status,
      memo: memo?.trim() || null,
      ...(recordSession ? { service_session_id: recordSession.id } : {}),
    }
    const historyResult = existingAttempt
      ? await supabase.from('visit_histories').update(historyPayload).eq('id', existingAttempt.id)
      : await supabase.from('visit_histories').insert({
          unit_id: unitId,
          visitor_name: getCurrentVisitor(),
          result: status,
          time_slot: effectiveTimeSlot,
          ...(recordSession ? { service_session_id: recordSession.id } : {}),
          memo: memo?.trim() || null,
          visited_at: visitedAt,
        })

    if (historyResult.error) {
      reportMutationError('방문 이력을 저장하지 못했습니다. 호수 상태는 변경됐을 수 있습니다.', historyResult.error)
      return
    }
    await fetchAll()
  }

  const quickLogVisit = async (_buildingId: number, unitId: number, result: UnitStatus) => {
    const todayStr = getLocalDateString()
    const recordSession = getRecordServiceSession(_buildingId)
    const slot = recordSession?.timeSlot ?? getCurrentTimeSlot()
    const visitor = getCurrentVisitor()

    // 1. 상태 업데이트
    const unitUpdate = await supabase
      .from('units')
      .update({ status: result })
      .eq('id', unitId)
    
    if (unitUpdate.error) {
      reportMutationError('세대 상태를 업데이트하지 못했습니다.', unitUpdate.error)
      return
    }

    // 2. 같은 세션(날짜+시간대+방문자)의 기록이 있는지 확인
    const existingResult = await supabase
      .from('visit_histories')
      .select('id')
      .eq('unit_id', unitId)
      .eq('visitor_name', visitor)
      .eq('visited_at', todayStr)
      .eq('time_slot', slot)
      .order('created_at', { ascending: false })
      .limit(1)

    if (existingResult.error) {
      reportMutationError('기존 방문 기록 확인에 실패했습니다.', existingResult.error)
      return
    }

    const existing = existingResult.data?.[0]

    let historyStatus = ''
    if (existing) {
      const updateResult = await supabase
        .from('visit_histories')
        .update({
          result: result,
          ...(recordSession ? { service_session_id: recordSession.id } : {}),
        })
        .eq('id', existing.id)
      
      if (updateResult.error) {
        reportMutationError('방문 기록을 업데이트하지 못했습니다.', updateResult.error)
        return
      }
      historyStatus = '업데이트됨'
    } else {
      const insertResult = await supabase
        .from('visit_histories')
        .insert({
          unit_id: unitId,
          visitor_name: visitor,
          result: result,
          visited_at: todayStr,
          time_slot: slot,
          ...(recordSession ? { service_session_id: recordSession.id } : {}),
        })
      
      if (insertResult.error) {
        reportMutationError('방문 기록을 저장하지 못했습니다.', insertResult.error)
        return
      }
      historyStatus = '기록됨'
    }

    await fetchAll()
    showToast(`${slot} ${result} ${historyStatus}`, 'success')
  }

  const updateUnitFlags = async (unitId: number, flags: Partial<Unit>) => {
    const dbFlags: any = {}
    if (flags.isChinese !== undefined) dbFlags.is_chinese = flags.isChinese
    if (flags.isKorean !== undefined) dbFlags.is_korean = flags.isKorean
    if (flags.memo !== undefined) dbFlags.memo = flags.memo

    if (Object.keys(dbFlags).length > 0) {
      const result = await supabase.from('units').update(dbFlags).eq('id', unitId)
      if (result.error) {
        reportMutationError('세대 정보를 수정하지 못했습니다.', result.error)
        return
      }
    }

    if (flags.isForbidden !== undefined) {
      const statusResult = await supabase
        .from('units')
        .update({ status: flags.isForbidden ? '거절' : '미방문' })
        .eq('id', unitId)
      if (statusResult.error) {
        reportMutationError('방문금지 상태를 수정하지 못했습니다.', statusResult.error)
        return
      }
    }
    await fetchAll()
  }

  const undoLatestVisit = async (_buildingId: number, unitId: number) => {
    const unitHistories = visitHistories.filter((history) => history.unitId === unitId)
    const latestHistory = unitHistories[0]
    const previousHistory = unitHistories[1]
    if (!latestHistory) return

    const deleteResult = await supabase.from('visit_histories').delete().eq('id', latestHistory.id)
    if (deleteResult.error) {
      reportMutationError('최근 방문 이력을 취소하지 못했습니다.', deleteResult.error)
      return
    }

    const restoreStatus: UnitStatus = previousHistory?.result ?? '미방문'
    const statusResult = await supabase.from('units').update({ status: restoreStatus }).eq('id', unitId)
    if (statusResult.error) {
      reportMutationError('방문 이력은 취소됐지만 호수 상태를 되돌리지 못했습니다.', statusResult.error)
      return
    }

    await fetchAll()
    showToast('최근 입력이 취소됐습니다')
  }

  const updateVisitHistory = async (
    historyId: number,
    unitId: number,
    input: {
      result: UnitStatus
      timeSlot: TimeSlot
      memo: string
      visitedAt: string
    },
  ) => {
    const historyResult = await supabase
      .from('visit_histories')
      .update({
        result: input.result,
        time_slot: input.timeSlot,
        memo: input.memo.trim() || null,
        visited_at: input.visitedAt,
      })
      .eq('id', historyId)

    if (historyResult.error) {
      reportMutationError('방문 이력을 수정하지 못했습니다.', historyResult.error)
      return
    }

    const latestHistory = visitHistories.find((history) => history.unitId === unitId)
    if (latestHistory?.id === historyId) {
      const statusResult = await supabase.from('units').update({ status: input.result }).eq('id', unitId)
      if (statusResult.error) {
        reportMutationError('방문 이력은 수정됐지만 호수 대표 상태를 맞추지 못했습니다.', statusResult.error)
        return
      }
    }

    await fetchAll()
  }

  const addVisitHistory = async (
    _buildingId: number,
    unitId: number,
    input: {
      result: UnitStatus
      timeSlot: TimeSlot
      memo: string
      visitedAt: string
    },
  ) => {
    const recordSession = getRecordServiceSession(_buildingId, input.visitedAt)
    const insertResult = await supabase.from('visit_histories').insert({
      unit_id: unitId,
      visitor_name: getCurrentVisitor(),
      result: input.result,
      time_slot: input.timeSlot,
      ...(recordSession ? { service_session_id: recordSession.id, time_slot: recordSession.timeSlot } : {}),
      memo: input.memo.trim() || null,
      visited_at: input.visitedAt,
    })

    if (insertResult.error) {
      reportMutationError('방문 이력을 추가하지 못했습니다.', insertResult.error)
      return
    }

    const unitHistories = visitHistories.filter((history) => history.unitId === unitId)
    const latestExistingDate = unitHistories[0]?.visitedAt ?? ''
    if (!latestExistingDate || input.visitedAt >= latestExistingDate) {
      const statusResult = await supabase.from('units').update({ status: input.result }).eq('id', unitId)
      if (statusResult.error) {
        reportMutationError('방문 이력은 추가됐지만 호수 대표 상태를 맞추지 못했습니다.', statusResult.error)
        return
      }
    }

    await fetchAll()
    showToast('방문 기록이 추가됐습니다')
  }

  const deleteVisitHistory = async (historyId: number, unitId: number) => {
    const result = await supabase.from('visit_histories').delete().eq('id', historyId)
    if (result.error) {
      reportMutationError('방문 히스토리 삭제를 실패했습니다.', result.error)
      return
    }

    // 만약 삭제한 기록이 가장 최신이었다면, 그 다음 최신 상태로 unit status 복구
    const remainingHistories = visitHistories.filter(h => h.unitId === unitId && h.id !== historyId)
    const latestRemaining = remainingHistories[0] // visitHistories is sorted DESC by visited_at/created_at
    const newStatus = latestRemaining?.result ?? '미방문'

    const statusUpdate = await supabase.from('units').update({ status: newStatus }).eq('id', unitId)
    if (statusUpdate.error) {
      reportMutationError('호수 상태 동기화에 실패했습니다.', statusUpdate.error)
    }

    await fetchAll()
    showToast('방문 기록이 삭제되었습니다.')
  }

  const createCard = async (input: {
    area: string
    region: string
    index: number
    pinCount: number
  }) => {
    const cardName = `${input.region} ${input.area} ${input.index}`
    if (cards.some((card) => card.name === cardName)) {
      showToast(`이미 "${cardName}" 카드가 있습니다`, 'error')
      return null
    }
    const result = await supabase
      .from('cards')
      .insert({
        name: cardName,
        area: input.area,
        region: input.region,
        type: '전체',
        status: '미배정',
      })
      .select('id')
      .single()
    if (result.error) {
      reportMutationError('카드를 생성하지 못했습니다.', result.error)
      return null
    }
    await fetchAll()
    showToast(`카드 "${cardName}"이 생성됐습니다`)
    return result.data.id as number
  }

  const createBuilding = async (input: {
    cardId: number
    name: string
    address: string
    type: Building['type']
    lat: number
    lng: number
  }) => {
    if (!input.name.trim() || !input.address.trim()) {
      showToast('건물명과 주소를 입력해 주세요.', 'error')
      return
    }

    const result = await supabase.from('buildings').insert({
      card_id: input.cardId,
      name: input.name.trim(),
      address: input.address.trim(),
      type: input.type,
      lat: input.lat,
      lng: input.lng,
    })
    if (result.error) {
      reportMutationError('건물을 추가하지 못했습니다.', result.error)
      return
    }
    await fetchAll()
    showToast(`"${input.name.trim()}" 건물이 추가됐습니다`)
  }

  const importBuildings = async (inputs: Array<{
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
  }>) => {
    const cleanedInputs = inputs
      .map((input) => ({
        ...input,
        name: input.name.trim(),
        address: input.address.trim(),
        units: Array.from(
          new Map(
            input.units
              .map((unit) => ({ ...unit, number: unit.number.trim(), memo: unit.memo?.trim() }))
              .filter((unit) => unit.number)
              .map((unit) => [unit.number, unit]),
          ).values(),
        ),
      }))
      .filter((input) => input.name && input.address && isValidMapCoordinate(input.lat, input.lng))

    if (cleanedInputs.length === 0) {
      showToast('업로드할 건물 데이터가 없습니다.', 'error')
      return { inserted: 0, skipped: inputs.length }
    }

    let inserted = 0
    let skipped = inputs.length - cleanedInputs.length
    const existingKeys = new Set(buildings.map((building) => `${building.cardId}|${building.address}|${building.name}`))

    for (const input of cleanedInputs) {
      const key = `${input.cardId}|${input.address}|${input.name}`
      if (existingKeys.has(key)) {
        skipped += 1
        continue
      }

      const buildingResult = await supabase
        .from('buildings')
        .insert({
          card_id: input.cardId,
          name: input.name,
          address: input.address,
          type: input.type,
          lat: input.lat,
          lng: input.lng,
        })
        .select('id')
        .single()

      if (buildingResult.error || !buildingResult.data?.id) {
        skipped += 1
        continue
      }

      const units = input.units.length > 0
        ? input.units
        : [{ number: '101호', status: '미방문' as UnitStatus, isChinese: false, isRegularVisit: false, regularVisitor: undefined, memo: undefined }]
      const unitsResult = await supabase.from('units').insert(
        units.map((unit) => ({
          building_id: buildingResult.data.id,
          number: unit.number,
          status: unit.status,
          is_chinese: unit.isChinese,
          memo: unit.memo || null,
        })),
      ).select('id, number')

      if (unitsResult.error) {
        skipped += 1
        continue
      }

      const regularVisitRows = units
        .filter((unit) => unit.isRegularVisit && unit.regularVisitor)
        .map((unit) => {
          const insertedUnit = unitsResult.data?.find((item: { id: number; number: string }) => item.number === unit.number)
          return insertedUnit ? { unit_id: insertedUnit.id, visitor_name: unit.regularVisitor } : null
        })
        .filter(Boolean)

      if (regularVisitRows.length > 0) {
        const regularResult = await supabase.from('regular_visits').insert(regularVisitRows)
        if (regularResult.error) {
          skipped += 1
          continue
        }
      }

      existingKeys.add(key)
      inserted += 1
    }

    await fetchAll()
    showToast(`CSV 업로드 완료: 건물 ${inserted}개 추가, ${skipped}개 제외`, inserted > 0 ? 'success' : 'info')
    return { inserted, skipped }
  }

  const addUnitToBuilding = async (buildingId: number, unitNumber: string) => {
    if (!unitNumber.trim()) return
    const result = await supabase.from('units').insert({
      building_id: buildingId,
      number: unitNumber.trim(),
      status: '미방문',
    })
    if (result.error) {
      reportMutationError('호수를 추가하지 못했습니다.', result.error)
      return
    }
    await fetchAll()
    showToast(`${unitNumber.trim()} 호수가 추가됐습니다`)
  }

  const deleteUnitFromBuilding = async (_buildingId: number, unitId: number) => {
    const result = await supabase.from('units').delete().eq('id', unitId)
    if (result.error) {
      reportMutationError('호수를 삭제하지 못했습니다.', result.error)
      return
    }
    await fetchAll()
    showToast('호수가 삭제됐습니다')
  }

  const deleteBuilding = async (buildingId: number) => {
    const result = await supabase.from('buildings').delete().eq('id', buildingId)
    if (result.error) {
      reportMutationError('건물을 삭제하지 못했습니다.', result.error)
      return
    }
    await fetchAll()
    showToast('건물이 삭제됐습니다')
  }

  const deleteBuildings = async (buildingIds: number[]) => {
    const ids = Array.from(new Set(buildingIds)).filter(Number.isFinite)
    if (ids.length === 0) {
      showToast('삭제할 건물이 없습니다.', 'info')
      return
    }
    const result = await supabase.from('buildings').delete().in('id', ids)
    if (result.error) {
      reportMutationError('건물을 삭제하지 못했습니다.', result.error)
      return
    }
    await fetchAll()
    showToast(`건물 ${ids.length}개가 삭제됐습니다`)
  }

  const deleteCards = async (cardIds: number[]) => {
    const ids = Array.from(new Set(cardIds)).filter(Number.isFinite)
    if (ids.length === 0) {
      showToast('삭제할 카드가 없습니다.', 'info')
      return
    }

    const buildingDeleteResult = await supabase.from('buildings').delete().in('card_id', ids)
    if (buildingDeleteResult.error) {
      reportMutationError('카드에 속한 건물을 삭제하지 못했습니다.', buildingDeleteResult.error)
      return
    }

    await supabase.from('card_boundaries').delete().in('card_id', ids)
    await supabase.from('card_assignments').delete().in('card_id', ids)

    const result = await supabase.from('cards').delete().in('id', ids)
    if (result.error) {
      reportMutationError('카드를 삭제하지 못했습니다.', result.error)
      return
    }
    await fetchAll()
    showToast(`카드 ${ids.length}개가 삭제됐습니다`)
  }

  const updateBuilding = async (buildingId: number, name: string, address: string, lat?: number, lng?: number, type?: string, memo?: string) => {
    const payload: any = { name, address }
    if (lat !== undefined) payload.lat = lat
    if (lng !== undefined) payload.lng = lng
    if (type !== undefined) payload.type = type
    if (memo !== undefined) payload.memo = memo
    const result = await supabase.from('buildings').update(payload).eq('id', buildingId)
    if (result.error) {
      reportMutationError('건물 정보를 수정하지 못했습니다.', result.error)
      return
    }
    await fetchAll()
    if (lat === undefined) {
      showToast('건물 정보가 수정됐습니다')
    }
  }

  const moveBuildingToCard = async (buildingId: number, cardId: number) => {
    const result = await supabase.from('buildings').update({ card_id: cardId }).eq('id', buildingId)
    if (result.error) {
      reportMutationError('건물 카드를 변경하지 못했습니다.', result.error)
      return
    }
    await fetchAll()
    showToast('건물 카드가 변경됐습니다')
  }

  const reassignBuildingsToCards = async (updates: Array<{ buildingId: number; cardId: number }>) => {
    if (updates.length === 0) {
      showToast('재배정할 건물이 없습니다.', 'info')
      return { updated: 0, failed: 0 }
    }

    let updated = 0
    let failed = 0
    const chunkSize = 40
    for (let index = 0; index < updates.length; index += chunkSize) {
      const chunk = updates.slice(index, index + chunkSize)
      const results = await Promise.all(
        chunk.map((item) =>
          supabase
            .from('buildings')
            .update({ card_id: item.cardId })
            .eq('id', item.buildingId),
        ),
      )
      results.forEach((result) => {
        if (result.error) failed += 1
        else updated += 1
      })
    }

    await fetchAll()
    showToast(`좌표 기준 카드 재배정 완료: ${updated}개 변경${failed ? `, ${failed}개 실패` : ''}`, failed ? 'info' : 'success')
    return { updated, failed }
  }

  const saveCardBoundary = async (cardId: number, points: GeoPoint[]) => {
    if (points.length < 3) {
      showToast('카드 구역선은 최소 3개 점이 필요합니다.', 'error')
      return
    }
    const result = await supabase.from('card_boundaries').upsert(
      {
        card_id: cardId,
        points,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'card_id' },
    )
    if (result.error) {
      reportMutationError('카드 구역선을 저장하지 못했습니다. Supabase에 card_boundaries 테이블이 있는지 확인해 주세요.', result.error)
      return
    }
    await fetchAll()
    showToast('구역선이 저장됐습니다')
  }

  const deleteCardBoundary = async (cardId: number) => {
    // 삭제 전 현재 데이터 백업 (복구용)
    const originalBoundary = cardBoundaries.find((b) => b.cardId === cardId)
    const originalPoints = originalBoundary ? [...originalBoundary.points] : null

    const result = await supabase.from('card_boundaries').delete().eq('card_id', cardId)
    if (result.error) {
      reportMutationError('카드 구역선을 삭제하지 못했습니다.', result.error)
      return
    }
    await fetchAll()

    if (originalPoints) {
      showToast('구역선이 삭제됐습니다', 'info', {
        label: '삭제 취소',
        onClick: () => {
          saveCardBoundary(cardId, originalPoints)
        },
      })
    } else {
      showToast('구역선이 삭제됐습니다')
    }
  }

  const createCalendarEvent = async (input: {
    date: string
    time: string
    title: string
    place: string
    leader: string
    memo: string
    hasMeeting: boolean
    allowApplications: boolean
  }) => {
    const result = await supabase.from('calendar_events').insert({
      event_date: input.date,
      time: input.time,
      title: input.title,
      place: input.place,
      leader_name: input.leader,
      memo: input.memo,
      has_meeting: input.hasMeeting,
      allow_applications: input.allowApplications,
    })
    if (result.error) {
      reportMutationError('일정을 등록하지 못했습니다.', result.error)
      return
    }
    await fetchAll()
    showToast('일정이 등록됐습니다')
  }

  const createRepeatCalendarEvents = async (
    dates: string[],
    input: { time: string; title: string; place: string; leader: string; memo: string; hasMeeting: boolean; allowApplications: boolean },
  ) => {
    const seriesId = crypto.randomUUID()
    const result = await supabase.from('calendar_events').insert(
      dates.map((date) => ({
        event_date: date,
        time: input.time,
        title: input.title,
        place: input.place,
        leader_name: input.leader,
        memo: input.memo,
        has_meeting: input.hasMeeting,
        allow_applications: input.allowApplications,
        series_id: seriesId,
      })),
    )
    if (result.error) {
      reportMutationError('반복 일정을 등록하지 못했습니다.', result.error)
      return
    }
    await fetchAll()
    showToast(`${dates.length}개 일정이 등록됐습니다`)
  }

  const updateCalendarEventSeries = async (
    seriesId: string,
    fromDate: string,
    input: { time: string; title: string; place: string; leader: string; memo: string; hasMeeting: boolean; allowApplications: boolean },
  ) => {
    const result = await supabase.from('calendar_events')
      .update({
        time: input.time,
        title: input.title,
        place: input.place,
        leader_name: input.leader,
        memo: input.memo,
        has_meeting: input.hasMeeting,
        allow_applications: input.allowApplications,
      })
      .eq('series_id', seriesId)
      .gte('event_date', fromDate)
    if (result.error) {
      reportMutationError('반복 일정을 수정하지 못했습니다.', result.error)
      return
    }
    await fetchAll()
    showToast('이후 모든 반복 일정이 수정됐습니다')
  }

  const updateCalendarEvent = async (
    eventId: number,
    input: { time: string; title: string; place: string; leader: string; memo: string; hasMeeting: boolean; allowApplications: boolean },
  ) => {
    const result = await supabase.from('calendar_events').update({
      time: input.time,
      title: input.title,
      place: input.place,
      leader_name: input.leader,
      memo: input.memo,
      has_meeting: input.hasMeeting,
      allow_applications: input.allowApplications,
    }).eq('id', eventId)
    if (result.error) {
      reportMutationError('일정을 수정하지 못했습니다.', result.error)
      return
    }
    await fetchAll()
    showToast('일정이 수정됐습니다')
  }

  const deleteCalendarEvent = async (eventId: number) => {
    const result = await supabase.from('calendar_events').delete().eq('id', eventId)
    if (result.error) {
      reportMutationError('일정을 삭제하지 못했습니다.', result.error)
      return
    }
    await fetchAll()
    showToast('일정이 삭제됐습니다')
  }

  const deleteCalendarEventSeries = async (seriesId: string, fromDate: string) => {
    const result = await supabase.from('calendar_events')
      .delete()
      .eq('series_id', seriesId)
      .gte('event_date', fromDate)
    if (result.error) {
      reportMutationError('반복 일정 삭제에 실패했습니다.', result.error)
      return
    }
    await fetchAll()
    showToast('이후 반복 일정이 모두 삭제됐습니다')
  }

  const linkEventsToSeries = async (eventIds: number[]) => {
    const seriesId = crypto.randomUUID()
    const result = await supabase.from('calendar_events')
      .update({ series_id: seriesId })
      .in('id', eventIds)
    if (result.error) {
      reportMutationError('시리즈 묶기에 실패했습니다. series_id 컬럼이 있는지 확인해 주세요.', result.error)
      return
    }
    await fetchAll()
    showToast(`${eventIds.length}개 일정이 시리즈로 묶였습니다`)
  }

  const applyToEvent = async (eventId: number) => {
    const currentVisitor = getCurrentVisitor()
    const event = calendarEvents.find((e) => e.id === eventId)
    const isApplied = event?.applicants.includes(currentVisitor)
    if (event && !event.allowApplications && !isApplied) {
      showToast('이 일정은 봉사 신청을 받지 않습니다.', 'info')
      return
    }
    if (isApplied) {
      const result = await supabase.from('event_participants').delete().eq('event_id', eventId).eq('user_name', currentVisitor)
      if (result.error) {
        reportMutationError('봉사 신청을 취소하지 못했습니다.', result.error)
        return
      }
    } else {
      const result = await supabase.from('event_participants').upsert(
        { event_id: eventId, user_name: currentVisitor, role: '신청' },
        { onConflict: 'event_id,user_name' },
      )
      if (result.error) {
        reportMutationError('봉사 신청을 저장하지 못했습니다.', result.error)
        return
      }
    }
    await fetchAll()
    showToast(isApplied ? '신청이 취소됐습니다' : '일정에 신청됐습니다')
  }

  const assignToEvent = async (eventId: number, userName: string) => {
    await supabase.from('event_participants').upsert(
      { event_id: eventId, user_name: userName, role: '입명' },
      { onConflict: 'event_id,user_name' },
    )
    await fetchAll()
  }

  const removeParticipantFromEvent = async (eventId: number, userName: string) => {
    await supabase.from('event_participants').delete().eq('event_id', eventId).eq('user_name', userName)
    await fetchAll()
  }

  const toggleRegularVisit = async (buildingId: number, unitId: number, visitorName?: string) => {
    const building = buildings.find((b) => b.id === buildingId)
    const unit = building?.units.find((u) => u.id === unitId)
    if (!building || !unit) return

    if (unit.isRegularVisit) {
      const result = await supabase.from('regular_visits').delete().eq('unit_id', unitId)
      if (result.error) {
        reportMutationError('정기방문을 해제하지 못했습니다.', result.error)
        return
      }
      await fetchAll()
      showToast('정기방문이 해제됐습니다')
    } else {
      const name = visitorName || getCurrentVisitor()
      const result = await supabase.from('regular_visits').insert({ unit_id: unitId, visitor_name: name })
      if (result.error) {
        reportMutationError('정기방문을 등록하지 못했습니다.', result.error)
        return
      }
      // return_visits 생성 (중복 방지: 같은 unit_id 존재 시 skip)
      const existing = returnVisits.find((rv) => rv.unitId === unitId)
      if (!existing) {
        const card = cards.find((c) => c.id === building.cardId)
        const region = (card?.region as string) ?? ''
        const cardName = card?.name ?? ''
        // 구 접두사 제거 후 첫 단어(동)를 추출
        let nameWithoutRegion = cardName
        for (const r of ['처인구', '기흥구', '수지구', '영통구', '화성시']) {
          if (cardName.startsWith(r)) { nameWithoutRegion = cardName.slice(r.length).trim(); break }
        }
        if (region && nameWithoutRegion === cardName && cardName.startsWith(region)) {
          nameWithoutRegion = cardName.slice(region.length).trim()
        }
        const dong = nameWithoutRegion.split(' ')[0] || building.name
        const displayName = `${dong} ${unit.number}호`
        await supabase.from('return_visits').insert({
          unit_id: unitId,
          building_id: buildingId,
          display_name: displayName,
          address: building.address,
          unit_number: unit.number,
          assigned_user_name: name,
          created_by: name,
        })
      }
      await fetchAll()
      showToast('정기방문이 등록됐습니다')
    }
  }

  const addReturnVisitLog = async (
    returnVisitId: number,
    result: '만남' | '부재' | null,
    memo: string,
  ) => {
    const visitor = getCurrentVisitor()
    const now = new Date().toISOString()
    const logRes = await supabase.from('return_visit_logs').insert({
      return_visit_id: returnVisitId,
      result: result ?? null,
      memo,
      created_by: visitor,
      visited_at: now,
    })
    if (logRes.error) {
      reportMutationError('기록을 저장하지 못했습니다.', logRes.error)
      return
    }
    // 만남/부재가 있을 때만 last_visited_at 갱신
    if (result) {
      await supabase.from('return_visits').update({
        last_visited_at: now,
        last_result: result,
      }).eq('id', returnVisitId)
    }
    await fetchAll()
    showToast('기록이 저장됐습니다')
  }

  const createManualReturnVisit = async (input: {
    displayName: string
    address: string
    memo: string
    unitId?: number | null
    buildingId?: number | null
  }) => {
    const visitor = getCurrentVisitor()
    const res = await supabase.from('return_visits').insert({
      unit_id: input.unitId ?? null,
      building_id: input.buildingId ?? null,
      display_name: input.displayName,
      nickname: input.displayName,
      address: input.address,
      unit_number: '',
      assigned_user_name: visitor,
      created_by: visitor,
    })
    if (res.error) { reportMutationError('정기방문을 추가하지 못했습니다.', res.error); return }
    await fetchAll()
    showToast('정기방문이 추가됐습니다')
  }

  const updateReturnVisitLog = async (id: number, result: '만남' | '부재' | null, memo: string) => {
    const res = await supabase.from('return_visit_logs').update({ result: result ?? null, memo }).eq('id', id)
    if (res.error) { reportMutationError('기록을 수정하지 못했습니다.', res.error); return }
    await fetchAll()
    showToast('기록이 수정됐습니다')
  }

  const deleteReturnVisitLog = async (id: number) => {
    const res = await supabase.from('return_visit_logs').delete().eq('id', id)
    if (res.error) {
      reportMutationError('기록을 삭제하지 못했습니다.', res.error)
      return
    }
    await fetchAll()
    showToast('기록이 삭제됐습니다')
  }

  const deleteReturnVisit = async (id: number) => {
    const res = await supabase.from('return_visits').delete().eq('id', id)
    if (res.error) {
      reportMutationError('정기방문을 삭제하지 못했습니다.', res.error)
      return
    }
    await fetchAll()
    showToast('정기방문이 삭제됐습니다')
  }

  const updateReturnVisitNickname = async (id: number, nickname: string) => {
    const res = await supabase.from('return_visits').update({ nickname: nickname.trim() }).eq('id', id)
    if (res.error) { reportMutationError('별칭을 저장하지 못했습니다.', res.error); return }
    await fetchAll()
    showToast('별칭이 저장됐습니다')
  }

  const updateReturnVisitAddress = async (id: number, address: string) => {
    const res = await supabase.from('return_visits').update({ address: address.trim() }).eq('id', id)
    if (res.error) { reportMutationError('주소를 저장하지 못했습니다.', res.error); return }
    await fetchAll()
    showToast('주소가 저장됐습니다')
  }

  const setRegularVisitor = async (unitId: number, visitorName: string) => {
    const name = visitorName.trim()
    if (!name) {
      const result = await supabase.from('regular_visits').delete().eq('unit_id', unitId)
      if (result.error) {
        reportMutationError('정기방문자를 해제하지 못했습니다.', result.error)
        return
      }
      await fetchAll()
      showToast('정기방문자가 해제됐습니다')
      return
    }

    const result = await supabase
      .from('regular_visits')
      .upsert({ unit_id: unitId, visitor_name: name }, { onConflict: 'unit_id' })

    if (result.error) {
      reportMutationError('정기방문자를 저장하지 못했습니다.', result.error)
      return
    }
    await fetchAll()
    showToast('정기방문자가 저장됐습니다')
  }

  const toggleChinese = async (buildingId: number, unitId: number) => {
    const building = buildings.find((b) => b.id === buildingId)
    const unit = building?.units.find((u) => u.id === unitId)
    if (!building || !unit) return

    const newValue = !unit.isChinese
    const result = await supabase.from('units').update({ is_chinese: newValue }).eq('id', unitId)
    if (result.error) {
      reportMutationError('중국인 거주 여부를 저장하지 못했습니다.', result.error)
      return
    }
    await fetchAll()
    showToast(newValue ? '중국인 거주가 등록됐습니다' : '중국인 거주가 해제됐습니다')
  }

  const createNotice = async (input: { title: string; content: string; priority: Notice['priority']; author: string }) => {
    const result = await supabase.from('notices').insert({
      title: input.title.trim(),
      content: input.content.trim(),
      priority: input.priority,
      author: input.author.trim(),
    })
    if (result.error) {
      reportMutationError('공지를 등록하지 못했습니다. notices 테이블이 있는지 확인해 주세요.', result.error)
      return
    }
    await fetchAll()
    showToast('공지가 등록됐습니다')
  }

  const deleteNotice = async (id: number) => {
    const result = await supabase.from('notices').delete().eq('id', id)
    if (result.error) {
      reportMutationError('공지를 삭제하지 못했습니다.', result.error)
      return
    }
    await fetchAll()
    showToast('공지가 삭제됐습니다')
  }

  const createSpecialPeriod = async (input: { label: string; startDate: string; endDate: string; color: string }) => {
    const result = await supabase.from('special_periods').insert({
      label: input.label.trim(),
      start_date: input.startDate,
      end_date: input.endDate,
      color: input.color,
    })
    if (result.error) {
      reportMutationError('특별기간을 등록하지 못했습니다. special_periods 테이블이 있는지 확인해 주세요.', result.error)
      return
    }
    await fetchAll()
    showToast('특별기간이 등록됐습니다')
  }

  const deleteSpecialPeriod = async (id: number) => {
    const result = await supabase.from('special_periods').delete().eq('id', id)
    if (result.error) {
      reportMutationError('특별기간을 삭제하지 못했습니다.', result.error)
      return
    }
    await fetchAll()
    showToast('특별기간이 삭제됐습니다')
  }

  // ── 검토 항목 CRUD ────────────────────────────────────────────
  const createReviewTask = useCallback(async (title: string, content: string, createdBy: string) => {
    const { error } = await supabase.from('review_tasks').insert({
      title, content: content || null, status: 'pending', created_by: createdBy,
    })
    if (error) { showToast('항목 추가에 실패했습니다.', 'error'); return }
    showToast('검토 항목이 추가됐습니다.', 'success')
    await fetchAll()
  }, [fetchAll])

  const completeReviewTask = useCallback(async (id: number) => {
    const now = new Date().toISOString()
    const { error } = await supabase.from('review_tasks').update({ status: 'done', completed_at: now }).eq('id', id)
    if (error) { showToast('완료 처리에 실패했습니다.', 'error'); return }
    setReviewTasks((prev) => prev.map((t) => t.id === id ? { ...t, status: 'done' as const, completedAt: now } : t))
  }, [])

  const uncompleteReviewTask = useCallback(async (id: number) => {
    const { error } = await supabase.from('review_tasks').update({ status: 'pending', completed_at: null }).eq('id', id)
    if (error) { showToast('완료 취소에 실패했습니다.', 'error'); return }
    setReviewTasks((prev) => prev.map((t) => t.id === id ? { ...t, status: 'pending' as const, completedAt: null } : t))
  }, [])

  const updateReviewTask = useCallback(async (id: number, title: string, content: string) => {
    const { error } = await supabase.from('review_tasks').update({ title, content: content || null }).eq('id', id)
    if (error) { showToast('수정에 실패했습니다.', 'error'); return }
    showToast('항목이 수정됐습니다.', 'success')
    setReviewTasks((prev) => prev.map((t) => t.id === id ? { ...t, title, content } : t))
  }, [])

  const deleteReviewTask = useCallback(async (id: number) => {
    const { error } = await supabase.from('review_tasks').update({ status: 'deleted' }).eq('id', id)
    if (error) { showToast('삭제에 실패했습니다.', 'error'); return }
    setReviewTasks((prev) => prev.filter((t) => t.id !== id))
  }, [])

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
  }
}
