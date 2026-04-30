/**
 * useStore 의 도메인별 mutation factory 모음
 *
 * 패턴:
 *   const { createNotice, deleteNotice } = makeXxxMutations({ fetchAll, setXxx })
 *
 * 의존성을 명시적으로 받아 useStore 내부에서 호출하면, 각 도메인의
 * 비즈니스 로직이 별도 파일에 정리되면서도 useStore 의 state 와 fetchAll 을
 * 공유할 수 있다.
 */
import type { Dispatch, SetStateAction } from 'react'
import { supabase } from '../lib/supabase'
import { showToast } from '../lib/toast'
import { isValidMapCoordinate } from '../utils/mapUtils'
import { getCurrentTimeSlot } from '../utils/timeUtils'
import type {
  Building,
  CalendarEvent,
  CardBoundary,
  GeoPoint,
  Notice,
  ReturnVisit,
  ReviewTask,
  ServiceSession,
  TerritoryCard,
  TimeSlot,
  Unit,
  UnitStatus,
  VisitHistory,
} from '../types'

/** YYYY-MM-DD (로컬) */
function getLocalDateString() {
  const date = new Date()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

/** localStorage 의 currentVisitor 를 직접 사용 (useStore 의 getCurrentVisitor 와 동일) */
function getCurrentVisitor(): string {
  return localStorage.getItem('currentVisitor') ?? '김민준'
}

/** 일정 입력 공통 타입 */
type CalendarEventInput = {
  time: string
  title: string
  place: string
  mapLink?: string
  leader: string
  memo: string
  hasMeeting: boolean
  allowApplications: boolean
}

/** DB payload 변환 (mapLink 옵셔널 처리 포함) */
function buildEventPayload(input: CalendarEventInput): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    time: input.time,
    title: input.title,
    place: input.place,
    leader_name: input.leader,
    memo: input.memo,
    has_meeting: input.hasMeeting,
    allow_applications: input.allowApplications,
  }
  if (input.mapLink?.trim()) payload.meeting_map_url = input.mapLink.trim()
  return payload
}

function reportMutationError(message: string, error: unknown) {
  console.error(message, error)
  showToast(message, 'error')
}

// ===============================================================
// 공지사항 (Notice)
// ===============================================================
export function makeNoticeMutations(deps: { fetchAll: () => Promise<void> }) {
  const { fetchAll } = deps

  const createNotice = async (input: {
    title: string
    content: string
    priority: Notice['priority']
    author: string
  }) => {
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

  return { createNotice, deleteNotice }
}

// ===============================================================
// 특별봉사 시즌 (SpecialPeriod)
// ===============================================================
export function makeSpecialPeriodMutations(deps: { fetchAll: () => Promise<void> }) {
  const { fetchAll } = deps

  const createSpecialPeriod = async (input: {
    label: string
    startDate: string
    endDate: string
    color: string
  }) => {
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

  return { createSpecialPeriod, deleteSpecialPeriod }
}

// ===============================================================
// 카드 구역선 (CardBoundary)
// ===============================================================
export function makeCardBoundaryMutations(deps: {
  fetchAll: () => Promise<void>
  cardBoundaries: CardBoundary[]
}) {
  const { fetchAll, cardBoundaries } = deps

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

  return { saveCardBoundary, deleteCardBoundary }
}

// ===============================================================
// 검토 항목 (ReviewTask)
// ===============================================================
export function makeReviewTaskMutations(deps: {
  fetchAll: () => Promise<void>
  setReviewTasks: Dispatch<SetStateAction<ReviewTask[]>>
}) {
  const { fetchAll, setReviewTasks } = deps

  const createReviewTask = async (title: string, content: string, createdBy: string) => {
    const { error } = await supabase.from('review_tasks').insert({
      title,
      content: content || null,
      status: 'pending',
      created_by: createdBy,
    })
    if (error) { showToast('항목 추가에 실패했습니다.', 'error'); return }
    showToast('검토 항목이 추가됐습니다.', 'success')
    await fetchAll()
  }

  const completeReviewTask = async (id: number) => {
    const now = new Date().toISOString()
    const { error } = await supabase.from('review_tasks').update({ status: 'done', completed_at: now }).eq('id', id)
    if (error) { showToast('완료 처리에 실패했습니다.', 'error'); return }
    setReviewTasks((prev) => prev.map((t) => t.id === id ? { ...t, status: 'done' as const, completedAt: now } : t))
  }

  const uncompleteReviewTask = async (id: number) => {
    const { error } = await supabase.from('review_tasks').update({ status: 'pending', completed_at: null }).eq('id', id)
    if (error) { showToast('완료 취소에 실패했습니다.', 'error'); return }
    setReviewTasks((prev) => prev.map((t) => t.id === id ? { ...t, status: 'pending' as const, completedAt: null } : t))
  }

  const updateReviewTask = async (id: number, title: string, content: string) => {
    const { error } = await supabase.from('review_tasks').update({ title, content: content || null }).eq('id', id)
    if (error) { showToast('수정에 실패했습니다.', 'error'); return }
    showToast('항목이 수정됐습니다.', 'success')
    setReviewTasks((prev) => prev.map((t) => t.id === id ? { ...t, title, content } : t))
  }

  const deleteReviewTask = async (id: number) => {
    const { error } = await supabase.from('review_tasks').update({ status: 'deleted' }).eq('id', id)
    if (error) { showToast('삭제에 실패했습니다.', 'error'); return }
    setReviewTasks((prev) => prev.filter((t) => t.id !== id))
  }

  return {
    createReviewTask,
    completeReviewTask,
    uncompleteReviewTask,
    updateReviewTask,
    deleteReviewTask,
  }
}

// ===============================================================
// 캘린더 일정 (CalendarEvent + Participants)
// ===============================================================
export function makeCalendarMutations(deps: {
  fetchAll: () => Promise<void>
  calendarEvents: CalendarEvent[]
}) {
  const { fetchAll, calendarEvents } = deps

  // ─── 일정 CRUD ───────────────────────────────────────────────
  const createCalendarEvent = async (input: { date: string } & CalendarEventInput) => {
    const payload = { ...buildEventPayload(input), event_date: input.date }
    const result = await supabase.from('calendar_events').insert(payload)
    if (result.error) {
      reportMutationError('일정을 등록하지 못했습니다.', result.error)
      return
    }
    await fetchAll()
    showToast('일정이 등록됐습니다')
  }

  const createRepeatCalendarEvents = async (dates: string[], input: CalendarEventInput) => {
    const seriesId = crypto.randomUUID()
    const basePayload = buildEventPayload(input)
    const result = await supabase.from('calendar_events').insert(
      dates.map((date) => ({ ...basePayload, event_date: date, series_id: seriesId })),
    )
    if (result.error) {
      reportMutationError('반복 일정을 등록하지 못했습니다.', result.error)
      return
    }
    await fetchAll()
    showToast(`${dates.length}개 일정이 등록됐습니다`)
  }

  const updateCalendarEvent = async (eventId: number, input: CalendarEventInput) => {
    const result = await supabase.from('calendar_events').update(buildEventPayload(input)).eq('id', eventId)
    if (result.error) {
      reportMutationError('일정을 수정하지 못했습니다.', result.error)
      return
    }
    await fetchAll()
    showToast('일정이 수정됐습니다')
  }

  const updateCalendarEventSeries = async (
    seriesId: string,
    fromDate: string,
    input: CalendarEventInput,
  ) => {
    const result = await supabase.from('calendar_events')
      .update(buildEventPayload(input))
      .eq('series_id', seriesId)
      .gte('event_date', fromDate)
    if (result.error) {
      reportMutationError('반복 일정을 수정하지 못했습니다.', result.error)
      return
    }
    await fetchAll()
    showToast('이후 모든 반복 일정이 수정됐습니다')
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

  // ─── 참가자 / 신청 ───────────────────────────────────────────
  const applyToEvent = async (eventId: number) => {
    const currentVisitor = getCurrentVisitor()
    const event = calendarEvents.find((e) => e.id === eventId)
    const isApplied = event?.applicants.includes(currentVisitor)
    if (event && !event.allowApplications && !isApplied) {
      showToast('이 일정은 봉사 신청을 받지 않습니다.', 'info')
      return
    }
    if (isApplied) {
      const result = await supabase.from('event_participants')
        .delete()
        .eq('event_id', eventId)
        .eq('user_name', currentVisitor)
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
    await supabase.from('event_participants')
      .delete()
      .eq('event_id', eventId)
      .eq('user_name', userName)
    await fetchAll()
  }

  const addParticipantToEvent = async (eventId: number, userName: string) => {
    const event = calendarEvents.find((e) => e.id === eventId)
    if (!event) return
    if (event.applicants.includes(userName)) return
    const result = await supabase.from('event_participants').upsert(
      { event_id: eventId, user_name: userName, role: '신청' },
      { onConflict: 'event_id,user_name' },
    )
    if (result.error) {
      reportMutationError('참가자를 추가하지 못했습니다.', result.error)
      return
    }
    await fetchAll()
    showToast(`${userName}님을 신청자로 추가했습니다`)
  }

  return {
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
  }
}

// ===============================================================
// 카드 / 인도자 (Cards + Leaders + Assignments)
// ===============================================================
export function makeCardMutations(deps: {
  fetchAll: () => Promise<void>
  cards: TerritoryCard[]
}) {
  const { fetchAll, cards } = deps

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

  return {
    assignLeaderToCard,
    setCardLeaders,
    setMultipleCardLeaders,
    toggleUserOnCard,
    createCard,
    deleteCards,
  }
}

// ===============================================================
// 건물 / 호수 (Buildings + Units)
// ===============================================================
export function makeBuildingMutations(deps: {
  fetchAll: () => Promise<void>
  buildings: Building[]
}) {
  const { fetchAll, buildings } = deps

  const createBuilding = async (input: {
    cardId: number
    name: string
    address: string
    type: Building['type']
    lat: number
    lng: number
  }) => {
    if (!input.address.trim()) {
      showToast('주소를 입력해 주세요.', 'error')
      return
    }
    // 이름이 없으면 주소에서 자동 추출 (예: "언동로 213")
    const autoName = input.name.trim() || (() => {
      const m = input.address.match(/([가-힣]+(?:로|길)\s*[\d\-]+)/)
      if (m) return m[1].replace(/\s+/, ' ').trim()
      const parts = input.address.trim().split(/\s+/)
      return parts.slice(-2).join(' ')
    })()

    const result = await supabase.from('buildings').insert({
      card_id: input.cardId,
      name: autoName,
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
    showToast(`"${autoName}" 건물이 추가됐습니다`)
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

  /**
   * 같은 카드 내 중복 주소 건물들을 합칩니다.
   * - 주소가 동일한 건물들 중 id가 가장 작은 건물(기준)에 나머지 건물의 호수를 모두 이전
   * - 호수 번호가 겹칠 경우 기준 건물의 호수를 유지 (중복 삽입 스킵)
   * - 나머지 건물 삭제
   */
  const mergeDuplicateBuildings = async (
    scopeCardId?: number,
    nameOverrides?: Record<number, string>,
    selectedPrimaryIds?: number[],
  ) => {
    const scope = scopeCardId
      ? buildings.filter((b) => b.cardId === scopeCardId)
      : buildings

    const normalizeAddr = (addr: string) =>
      addr.trim().toLowerCase().replace(/\s+/g, '').replace(/[-‐]/g, '-')

    const groups = new Map<string, typeof scope>()
    for (const b of scope) {
      const key = `${b.cardId}::${normalizeAddr(b.address)}`
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(b)
    }

    const selectedPrimaryIdSet = selectedPrimaryIds ? new Set(selectedPrimaryIds) : null
    const duplicateGroups = Array.from(groups.values()).filter((g) => {
      if (g.length <= 1) return false
      if (!selectedPrimaryIdSet) return true
      const primaryId = [...g].sort((a, b) => a.id - b.id)[0].id
      return selectedPrimaryIdSet.has(primaryId)
    })
    if (duplicateGroups.length === 0) {
      showToast('중복 주소 건물이 없습니다.', 'info')
      return
    }

    let mergedBuildings = 0
    let movedUnits = 0

    for (const group of duplicateGroups) {
      const sorted = [...group].sort((a, b) => a.id - b.id)
      const [primary, ...rest] = sorted

      const chosenName = nameOverrides?.[primary.id]
      if (chosenName && chosenName !== primary.name) {
        const nameRes = await supabase
          .from('buildings')
          .update({ name: chosenName })
          .eq('id', primary.id)
        if (nameRes.error) {
          reportMutationError('건물 이름 변경 중 오류가 발생했습니다.', nameRes.error)
          return
        }
      }

      const existingNumbers = new Set(primary.units.map((u) => u.number))

      for (const duplicate of rest) {
        for (const unit of duplicate.units) {
          if (existingNumbers.has(unit.number)) continue
          const res = await supabase
            .from('units')
            .update({ building_id: primary.id })
            .eq('id', unit.id)
          if (res.error) {
            reportMutationError('호수 이전 중 오류가 발생했습니다.', res.error)
            return
          }
          existingNumbers.add(unit.number)
          movedUnits++
        }
        const delRes = await supabase.from('buildings').delete().eq('id', duplicate.id)
        if (delRes.error) {
          reportMutationError('중복 건물 삭제 중 오류가 발생했습니다.', delRes.error)
          return
        }
        mergedBuildings++
      }
    }

    await fetchAll()
    showToast(`중복 건물 ${mergedBuildings}개 합병 완료 (호수 ${movedUnits}개 이전)`)
  }

  const updateBuilding = async (
    buildingId: number,
    name: string,
    address: string,
    lat?: number,
    lng?: number,
    type?: string,
    memo?: string,
  ) => {
    const payload: Record<string, unknown> = { name, address }
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

  const reassignBuildingsToCards = async (
    updates: Array<{ buildingId: number; cardId: number }>,
  ) => {
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

  return {
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
  }
}

// ===============================================================
// 방문 / 호수 상태 (Visit / Unit operations)
// ===============================================================
export function makeVisitMutations(deps: {
  fetchAll: () => Promise<void>
  visitHistories: VisitHistory[]
  /** 봉사 세션 기록을 위한 헬퍼 (useStore 내부에서 주입) */
  getRecordServiceSession: (buildingId?: number, visitedAt?: string) => ServiceSession | undefined
  /** 활성 특별봉사 시즌 ID 반환 */
  getActiveSpecialPeriodIdForDate: (dateStr: string) => number | null
}) {
  const { fetchAll, visitHistories, getRecordServiceSession, getActiveSpecialPeriodIdForDate } = deps

  const updateUnitStatus = async (
    buildingId: number,
    unitId: number,
    status: UnitStatus,
    memo?: string,
    timeSlot: TimeSlot = getCurrentTimeSlot(),
    invitationLeft: boolean = false,
  ) => {
    const recordSession = getRecordServiceSession(buildingId)
    const effectiveTimeSlot = recordSession?.timeSlot ?? timeSlot
    const statusResult = await supabase.from('units').update({ status }).eq('id', unitId)
    if (statusResult.error) {
      reportMutationError('호수 상태를 저장하지 못했습니다.', statusResult.error)
      return
    }

    const visitedAt = getLocalDateString()
    const visitor = localStorage.getItem('currentVisitor') ?? '김민준'
    const existingAttemptResult = await supabase
      .from('visit_histories')
      .select('id')
      .eq('unit_id', unitId)
      .eq('visitor_name', visitor)
      .eq('visited_at', visitedAt)
      .eq('time_slot', effectiveTimeSlot)
      .order('created_at', { ascending: false })
      .limit(1)

    if (existingAttemptResult.error) {
      reportMutationError('기존 방문 이력을 확인하지 못했습니다. 호수 상태는 변경됐을 수 있습니다.', existingAttemptResult.error)
      return
    }

    const existingAttempt = existingAttemptResult.data?.[0]
    const activePeriodId = getActiveSpecialPeriodIdForDate(visitedAt)
    const historyPayload = {
      result: status,
      memo: memo?.trim() || null,
      ...(recordSession ? { service_session_id: recordSession.id } : {}),
      special_period_id: activePeriodId,
      invitation_left: invitationLeft,
    }
    const historyResult = existingAttempt
      ? await supabase.from('visit_histories').update(historyPayload).eq('id', existingAttempt.id)
      : await supabase.from('visit_histories').insert({
          unit_id: unitId,
          visitor_name: visitor,
          result: status,
          time_slot: effectiveTimeSlot,
          ...(recordSession ? { service_session_id: recordSession.id } : {}),
          memo: memo?.trim() || null,
          visited_at: visitedAt,
          special_period_id: activePeriodId,
          invitation_left: invitationLeft,
        })

    if (historyResult.error) {
      reportMutationError('방문 이력을 저장하지 못했습니다. 호수 상태는 변경됐을 수 있습니다.', historyResult.error)
      return
    }
    await fetchAll()
  }

  const toggleInvitationLeft = async (buildingId: number, unitId: number) => {
    const todayStr = getLocalDateString()
    const recordSession = getRecordServiceSession(buildingId)
    const slot = recordSession?.timeSlot ?? getCurrentTimeSlot()
    const visitor = localStorage.getItem('currentVisitor') ?? '김민준'

    const existingResult = await supabase
      .from('visit_histories')
      .select('id, invitation_left')
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

    if (existing) {
      const next = !existing.invitation_left
      const updateResult = await supabase
        .from('visit_histories')
        .update({ invitation_left: next })
        .eq('id', existing.id)
      if (updateResult.error) {
        reportMutationError('초대장 표시를 업데이트하지 못했습니다.', updateResult.error)
        return
      }
    } else {
      const activePeriodId = getActiveSpecialPeriodIdForDate(todayStr)
      const insertResult = await supabase.from('visit_histories').insert({
        unit_id: unitId,
        visitor_name: visitor,
        result: '미방문',
        visited_at: todayStr,
        time_slot: slot,
        ...(recordSession ? { service_session_id: recordSession.id } : {}),
        special_period_id: activePeriodId,
        invitation_left: true,
      })
      if (insertResult.error) {
        reportMutationError('초대장 기록을 저장하지 못했습니다.', insertResult.error)
        return
      }
    }
    await fetchAll()
  }

  const quickLogVisit = async (
    buildingId: number,
    unitId: number,
    result: UnitStatus,
    invitationLeft: boolean = false,
  ) => {
    const todayStr = getLocalDateString()
    const recordSession = getRecordServiceSession(buildingId)
    const slot = recordSession?.timeSlot ?? getCurrentTimeSlot()
    const visitor = localStorage.getItem('currentVisitor') ?? '김민준'

    const unitUpdate = await supabase.from('units').update({ status: result }).eq('id', unitId)
    if (unitUpdate.error) {
      reportMutationError('세대 상태를 업데이트하지 못했습니다.', unitUpdate.error)
      return
    }

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
          result,
          ...(recordSession ? { service_session_id: recordSession.id } : {}),
          ...(invitationLeft ? { invitation_left: true } : {}),
        })
        .eq('id', existing.id)
      if (updateResult.error) {
        reportMutationError('방문 기록을 업데이트하지 못했습니다.', updateResult.error)
        return
      }
      historyStatus = '업데이트됨'
    } else {
      const activePeriodId = getActiveSpecialPeriodIdForDate(todayStr)
      const insertResult = await supabase.from('visit_histories').insert({
        unit_id: unitId,
        visitor_name: visitor,
        result,
        visited_at: todayStr,
        time_slot: slot,
        ...(recordSession ? { service_session_id: recordSession.id } : {}),
        special_period_id: activePeriodId,
        invitation_left: invitationLeft,
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
    const dbFlags: Record<string, unknown> = {}
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
    const unitHistories = visitHistories.filter((h) => h.unitId === unitId)
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
    input: { result: UnitStatus; timeSlot: TimeSlot; memo: string; visitedAt: string },
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

    const latestHistory = visitHistories.find((h) => h.unitId === unitId)
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
    buildingId: number,
    unitId: number,
    input: { result: UnitStatus; timeSlot: TimeSlot; memo: string; visitedAt: string; invitationLeft?: boolean },
  ) => {
    const recordSession = getRecordServiceSession(buildingId, input.visitedAt)
    const activePeriodId = getActiveSpecialPeriodIdForDate(input.visitedAt)
    const visitor = localStorage.getItem('currentVisitor') ?? '김민준'

    const insertResult = await supabase.from('visit_histories').insert({
      unit_id: unitId,
      visitor_name: visitor,
      result: input.result,
      time_slot: input.timeSlot,
      ...(recordSession ? { service_session_id: recordSession.id, time_slot: recordSession.timeSlot } : {}),
      memo: input.memo.trim() || null,
      visited_at: input.visitedAt,
      special_period_id: activePeriodId,
      invitation_left: input.invitationLeft ?? false,
    })

    if (insertResult.error) {
      reportMutationError('방문 이력을 추가하지 못했습니다.', insertResult.error)
      return
    }

    const unitHistories = visitHistories.filter((h) => h.unitId === unitId)
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

    const remainingHistories = visitHistories.filter((h) => h.unitId === unitId && h.id !== historyId)
    const latestRemaining = remainingHistories[0]
    const newStatus = latestRemaining?.result ?? '미방문'

    const statusUpdate = await supabase.from('units').update({ status: newStatus }).eq('id', unitId)
    if (statusUpdate.error) {
      reportMutationError('호수 상태 동기화에 실패했습니다.', statusUpdate.error)
    }

    await fetchAll()
    showToast('방문 기록이 삭제되었습니다.')
  }

  return {
    updateUnitStatus,
    toggleInvitationLeft,
    quickLogVisit,
    updateUnitFlags,
    undoLatestVisit,
    updateVisitHistory,
    addVisitHistory,
    deleteVisitHistory,
  }
}

// ===============================================================
// 정기방문 / 재방문 / 중국인 거주 (Regular / Return / Chinese)
// ===============================================================
export function makeRegularVisitMutations(deps: {
  fetchAll: () => Promise<void>
  buildings: Building[]
  cards: TerritoryCard[]
  returnVisits: ReturnVisit[]
}) {
  const { fetchAll, buildings, cards, returnVisits } = deps

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
      const name = visitorName || (localStorage.getItem('currentVisitor') ?? '김민준')
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
        let nameWithoutRegion = cardName
        for (const r of ['처인구', '기흥구', '수지구', '영통구', '화성시']) {
          if (cardName.startsWith(r)) { nameWithoutRegion = cardName.slice(r.length).trim(); break }
        }
        if (region && nameWithoutRegion === cardName && cardName.startsWith(region)) {
          nameWithoutRegion = cardName.slice(region.length).trim()
        }
        const dong = nameWithoutRegion.split(' ')[0] || building.name
        const displayName = `${dong} ${unit.number}`
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

  const addReturnVisitLog = async (
    returnVisitId: number,
    result: '만남' | '부재' | null,
    memo: string,
  ) => {
    const visitor = localStorage.getItem('currentVisitor') ?? '김민준'
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
    if (result) {
      await supabase.from('return_visits')
        .update({ last_visited_at: now, last_result: result })
        .eq('id', returnVisitId)
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
    const visitor = localStorage.getItem('currentVisitor') ?? '김민준'
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

  return {
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
  }
}
