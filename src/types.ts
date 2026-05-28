export type Role = 'user' | 'leader' | 'admin' | 'developer'
export type ScheduleType = '비공식' | '상가' | '주택' | '정기방문' | '혼합'
export type DesktopPage = '홈' | '공지' | '캘린더' | '구역' | '활동' | '지도' | '배정' | '사용자' | '통계' | '설정'
export type UnitStatus = '미방문' | '만남' | '부재' | '대상외' | '거절' | '확인필요'
export type BuildingStatus = '방문필요' | '방문완료' | '방문금지' | '정기방문'
export type TimeSlot = '오전' | '오후' | '저녁'
export type ServiceSessionStatus = 'active' | 'ended' | 'expired'
export type TerritoryRegion = '처인구' | '기흥구' | '수지구' | '영통구' | '화성시'
export type CardType = '전체'
export type VisitTargetType = '상가' | '주택' | '전체'

export type GeoPoint = {
  lat: number
  lng: number
}

export type CalendarEvent = {
  id: number
  date: string  // 'YYYY-MM-DD'
  time: string
  endTime?: string  // 'HH:MM' — 종료 시간 (선택)
  title: string
  type: ScheduleType
  place: string
  mapLink?: string
  leader: string
  card: string
  hasMeeting: boolean
  allowApplications: boolean
  applicants: string[]
  assigned: string[]
  cardAssignments: EventCardAssignment[]
  assignmentStatus?: 'draft' | 'confirmed' | 'shared'
  assignmentSharedAt?: string | null
  assignmentSharedBy?: string | null
  memo: string
  seriesId?: string  // set when created as part of a repeat series
}

export type EventCardAssignment = {
  id: number
  eventId: number
  userName: string
  assignedCardId: number
  assignedCardIds?: number[]
  assignedBy: string
  assignedAt: string
  memo: string
}

export type InformalAsset = {
  id: number
  name: string
  imageUrl: string
  imagePath: string
  uploadedBy: string
  createdAt: string
  archived: boolean
  groupId: number | null
}

export type InformalGroup = {
  id: number
  name: string
  position: number
  createdBy: string
  createdAt: string
}

export type EventInformalAssignment = {
  id: number
  eventId: number
  userName: string
  assetId: number
  assignedBy: string
  assignedAt: string
  memo: string
}

export type EventRestaurantAssignment = {
  id: number
  eventId: number
  userName: string
  buildingId: number
  assignedBy: string
  assignedAt: string
  memo: string
}

export type TerritoryCard = {
  id: number
  name: string
  area: string
  region: TerritoryRegion | string
  type: CardType
  buildings: number
  units: number
  completed: number
  regularVisits: number
  regularVisitPoints: { point: string; visitor: string }[]
  progress: number
  assignedLeader: string | null
  assignedLeaders?: string[]
  assignedUsers: string[]
  status: '미배정' | '진행중' | '완료' | '보류'
}

export type CardBoundary = {
  cardId: number
  points: GeoPoint[]
}

export type Unit = {
  id: number
  number: string
  status: UnitStatus
  isChinese?: boolean
  isKorean?: boolean
  isForbidden?: boolean
  isRegularVisit?: boolean
  regularVisitor?: string
  regularVisitStart?: string
  memo?: string
}

export type Building = {
  id: number
  cardId: number
  name: string
  address: string
  type: '주택' | '상가'
  lat: number
  lng: number
  warning?: boolean
  memo?: string
  isChineseHeavy?: boolean
  isRestaurant?: boolean
  units: Unit[]
}

export type VisitHistory = {
  id: number
  buildingId: number
  unitId: number
  visitor: string
  result: UnitStatus
  visitedAt: string
  timeSlot: TimeSlot
  serviceSessionId?: number | null
  createdAt?: string
  memo?: string
  specialPeriodId?: number | null
  invitationLeft?: boolean
  visitType?: 'card' | 'restaurant'
}

export type RestaurantRequest = {
  id: number
  name: string
  address: string
  requestedBy: string
  requestedAt: string
  status: 'pending' | 'approved' | 'rejected'
  memo: string | null
  visitedAt: string | null
  reviewer: string | null
  reviewedAt: string | null
  buildingId: number | null
}

export type ServiceSession = {
  id: number
  userName: string
  role: Role
  calendarEventId?: number | null
  startedAt: string
  endedAt?: string | null
  serviceDate: string
  timeSlot: TimeSlot
  status: ServiceSessionStatus
  primaryCardId?: number | null
  assignedCardId?: number | null
  assignmentId?: number | null
  source: 'assigned' | 'manual' | 'manual_override'
  memo: string
  createdAt?: string
}

export const roleLabels: Record<Role, string> = {
  user: '일반',
  leader: '인도자',
  admin: '관리자',
  developer: '개발자',
}

export const desktopPages: DesktopPage[] = [
  '홈', '공지', '캘린더', '구역', '지도', '배정', '사용자', '통계', '설정',
]

export const visitResults: UnitStatus[] = ['만남', '부재', '대상외', '거절', '확인필요']

export type SpecialPeriod = {
  id: number
  label: string
  startDate: string  // YYYY-MM-DD
  endDate: string    // YYYY-MM-DD
  color: string
  hasInvitation: boolean  // 초대장 봉사 여부 (true → 초대장 버튼 표시)
}

export const PERIOD_COLORS = [
  { label: '테라코타', value: '#C44536' },
  { label: '호박',     value: '#B8862A' },
  { label: '포레스트', value: '#4F7A4B' },
  { label: '스틸블루', value: '#3A6BA8' },
  { label: '머브',     value: '#7A5C8A' },
  { label: '슬레이트', value: '#5D5B54' },
]

export type Notice = {
  id: number
  title: string
  content: string
  priority: '긴급' | '일반' | '정보'
  author: string
  createdAt: string
}

export type ReturnVisit = {
  id: number
  unitId: number
  buildingId: number
  displayName: string   // "고림동 102호"
  nickname: string      // 별칭 (편집 가능)
  address: string
  unitNumber: string
  assignedUserName: string
  createdBy: string
  lastVisitedAt: string | null
  lastResult: '만남' | '부재' | null
  createdAt: string
}

export type ReturnVisitLog = {
  id: number
  returnVisitId: number
  visitedAt: string
  result: '만남' | '부재' | null
  memo: string
  createdBy: string
}

export type ReviewTaskStatus = 'pending' | 'done' | 'deleted'

export type ReviewTask = {
  id: number
  title: string
  content: string
  status: ReviewTaskStatus
  createdBy: string
  createdAt: string
  completedAt: string | null
  updatedAt: string
}

/** 식당봉사 활성 세션 (localStorage에 저장) */
export type ActiveRestaurantSession =
  | { kind: 'building'; buildingId: number; unitId: number; name: string; address: string; startedAt: string }
  | { kind: 'request'; requestId: number; name: string; address: string; startedAt: string }

export type SuggestionBlockFormat = 'structured' | 'free_text'

export interface StructuredSuggestionBlock {
  type: string
    format: 'structured'
  question: string
  scripture: string
  next_visit: string
}

export interface FreeTextSuggestionBlock {
  type: string
    format: 'free_text'
  body: string
}

export type SuggestionBlock = StructuredSuggestionBlock | FreeTextSuggestionBlock

export interface ServiceSuggestion {
  id: number
  title: string
  show_title_on_home: boolean
  tags: string[]
  last_used_at?: string | null
  is_visible: boolean
  content: SuggestionBlock[]
  created_at?: string
}
