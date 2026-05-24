/**
 * Supabase Raw Row → 앱 타입 변환 함수 모음
 *
 * useStore.ts 에서 사용하는 모든 transformer 와 DB row 타입.
 * mutate 로직은 useStore.ts 에 그대로 두고, 순수 변환만 분리.
 */
import type {
  Building,
  CalendarEvent,
  CardBoundary,
  CardType,
  EventCardAssignment,
  EventInformalAssignment,
  EventRestaurantAssignment,
  GeoPoint,
  InformalAsset,
  InformalGroup,
  Notice,
  Role,
  ScheduleType,
  ServiceSession,
  ServiceSessionStatus,
  TerritoryCard,
  TimeSlot,
  UnitStatus,
  VisitHistory,
} from '../types'

// ─── 호수 정렬: 지하(B/b) → 지상 숫자 → 한글/기타 ───────────────────
const _collator = new Intl.Collator('ko-KR', { numeric: true, sensitivity: 'base' })
const _unitPriority = (s: string) => /^[Bb]/.test(s) ? 0 : /^[0-9]/.test(s) ? 1 : 2
export function compareUnitNumbers(a: string, b: string): number {
  const diff = _unitPriority(a) - _unitPriority(b)
  return diff !== 0 ? diff : _collator.compare(a, b)
}
const unitNumberCollator = { compare: compareUnitNumbers }

// ===============================================================
// DB row 타입
// ===============================================================
export type RawUnit = {
  id: number
  building_id: number
  number: string
  status: UnitStatus
  is_chinese: boolean
  is_forbidden?: boolean | null
  memo: string | null
  regular_visits: { visitor_name: string; registered_at?: string | null }[]
}

export type RawBuilding = {
  id: number
  card_id: number
  name: string
  address: string
  type: '주택' | '상가'
  lat: number
  lng: number
  warning: boolean
  memo: string | null
  is_chinese_heavy: boolean | null
  is_restaurant?: boolean | null
  units: RawUnit[]
}

export type RawCard = {
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

export type RawCalendarEvent = {
  id: number
  event_date: string
  time: string
  end_time?: string | null
  title: string
  type: string
  place: string
  meeting_map_url?: string | null
  leader_name: string
  card_name: string
  has_meeting: boolean
  allow_applications?: boolean | null
  memo: string
  series_id: string | null
  event_participants: { user_name: string; role: string }[]
}

export type RawEventCardAssignment = {
  id: number
  event_id: number
  user_name: string
  assigned_card_id: number
  assigned_by: string | null
  assigned_at: string
  memo: string | null
}

export type RawInformalAsset = {
  id: number
  name: string
  image_url: string
  image_path: string
  uploaded_by: string
  created_at: string
  archived: boolean
  group_id?: number | null
}

export type RawInformalGroup = {
  id: number
  name: string
  position: number
  created_by: string
  created_at: string
}

export type RawEventInformalAssignment = {
  id: number
  event_id: number
  user_name: string
  asset_id: number
  assigned_by: string | null
  assigned_at: string
  memo: string | null
}

export type RawEventRestaurantAssignment = {
  id: number
  event_id: number
  user_name: string
  building_id: number
  assigned_by: string | null
  assigned_at: string
  memo: string | null
}

export type RawEventCardAssignmentCard = {
  id: number
  event_id: number
  user_name: string
  card_id: number
}

export type RawVisitHistory = {
  id: number
  unit_id: number
  service_session_id?: number | null
  visitor_name: string
  result: UnitStatus
  time_slot: TimeSlot
  memo: string | null
  visited_at: string
  created_at: string
  special_period_id?: number | null
  invitation_left?: boolean | null
  visit_type?: 'card' | 'restaurant' | null
}

export type RawRestaurantRequest = {
  id: number
  name: string
  address: string
  requested_by: string
  requested_at: string
  status: 'pending' | 'approved' | 'rejected'
  memo: string | null
  visited_at: string | null
  reviewer: string | null
  reviewed_at: string | null
  building_id: number | null
}

export type RawServiceSession = {
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

export type RawCardBoundary = {
  card_id: number
  points: unknown
}

export type RawNotice = {
  id: number
  title: string
  content: string
  priority: string
  author: string
  created_at: string
}

// ===============================================================
// 상수
// ===============================================================
export const PRIORITY_MAP: Record<string, Notice['priority']> = {
  normal: '일반', important: '긴급', urgent: '긴급',
  일반: '일반', 중요: '긴급', 긴급: '긴급', 정보: '정보',
}

// ===============================================================
// Transformer 함수
// ===============================================================
export function toBuilding(raw: RawBuilding): Building {
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
    isChineseHeavy: raw.is_chinese_heavy ?? false,
    isRestaurant: raw.is_restaurant ?? false,
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
        regularVisitStart: u.regular_visits
          ? (Array.isArray(u.regular_visits) ? u.regular_visits[0]?.registered_at ?? undefined : (u.regular_visits as any).registered_at ?? undefined)
          : undefined,
      })),
  }
}

export function normalizeCardType(): CardType {
  return '전체'
}

export function toCard(raw: RawCard, buildings: Building[]): TerritoryCard {
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

export function toCalendarEvent(
  raw: RawCalendarEvent,
  cardAssignments: EventCardAssignment[] = [],
): CalendarEvent {
  const participants = raw.event_participants ?? []
  return {
    id: raw.id,
    date: raw.event_date,
    time: raw.time,
    endTime: raw.end_time ?? undefined,
    title: raw.title,
    type: raw.type as ScheduleType,
    place: raw.place,
    mapLink: raw.meeting_map_url ?? undefined,
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

export function toEventCardAssignment(raw: RawEventCardAssignment): EventCardAssignment {
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

export function toInformalAsset(raw: RawInformalAsset): InformalAsset {
  return {
    id: raw.id,
    name: raw.name,
    imageUrl: raw.image_url,
    imagePath: raw.image_path,
    uploadedBy: raw.uploaded_by ?? '',
    createdAt: raw.created_at,
    archived: !!raw.archived,
    groupId: raw.group_id ?? null,
  }
}

export function toInformalGroup(raw: RawInformalGroup): InformalGroup {
  return {
    id: raw.id,
    name: raw.name,
    position: raw.position ?? 0,
    createdBy: raw.created_by ?? '',
    createdAt: raw.created_at,
  }
}

export function toEventInformalAssignment(raw: RawEventInformalAssignment): EventInformalAssignment {
  return {
    id: raw.id,
    eventId: raw.event_id,
    userName: raw.user_name,
    assetId: raw.asset_id,
    assignedBy: raw.assigned_by ?? '',
    assignedAt: raw.assigned_at,
    memo: raw.memo ?? '',
  }
}

export function toEventRestaurantAssignment(raw: RawEventRestaurantAssignment): EventRestaurantAssignment {
  return {
    id: raw.id,
    eventId: raw.event_id,
    userName: raw.user_name,
    buildingId: raw.building_id,
    assignedBy: raw.assigned_by ?? '',
    assignedAt: raw.assigned_at,
    memo: raw.memo ?? '',
  }
}

export function mergeEventCardAssignments(
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
    if (!groupedIds || groupedIds.length === 0) return assignment
    const deduped = Array.from(new Set(groupedIds))
    return {
      ...assignment,
      assignedCardIds: deduped,
      assignedCardId: deduped[0] ?? assignment.assignedCardId,
    }
  })
}

export function toVisitHistory(raw: RawVisitHistory): VisitHistory {
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
    specialPeriodId: raw.special_period_id ?? null,
    invitationLeft: raw.invitation_left ?? false,
    visitType: raw.visit_type ?? 'card',
  }
}

export function toRestaurantRequest(raw: RawRestaurantRequest): import('../types').RestaurantRequest {
  return {
    id: raw.id,
    name: raw.name,
    address: raw.address,
    requestedBy: raw.requested_by,
    requestedAt: raw.requested_at,
    status: raw.status,
    memo: raw.memo,
    visitedAt: raw.visited_at,
    reviewer: raw.reviewer,
    reviewedAt: raw.reviewed_at,
    buildingId: raw.building_id,
  }
}

export function toServiceSession(raw: RawServiceSession): ServiceSession {
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

export function toCardBoundary(raw: RawCardBoundary): CardBoundary | null {
  if (!Array.isArray(raw.points)) return null
  const points = raw.points.filter((point): point is GeoPoint => {
    if (!point || typeof point !== 'object') return false
    const candidate = point as Partial<GeoPoint>
    return typeof candidate.lat === 'number' && typeof candidate.lng === 'number'
  })
  if (points.length < 3) return null
  return { cardId: raw.card_id, points }
}

export function toNotice(raw: RawNotice): Notice {
  return {
    id: raw.id,
    title: raw.title,
    content: raw.content ?? '',
    priority: PRIORITY_MAP[raw.priority] ?? '일반',
    author: raw.author ?? '',
    createdAt: raw.created_at,
  }
}

export function toServiceSuggestion(row: any): import('../types').ServiceSuggestion {
  return {
    id: row.id,
    title: row.title || '',
    show_title_on_home: row.show_title_on_home ?? false,
    tags: row.tags || [],
    last_used_at: row.last_used_at,
    is_visible: row.is_visible ?? false,
    content: row.content || [],
    created_at: row.created_at,
  }
}
