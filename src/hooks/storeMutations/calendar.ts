import type { CalendarEvent } from '../../types'
import { supabase, showToast, reportMutationError, getCurrentVisitor } from './shared'
import { createSystemChatMessage } from './chatSystem'
import { logServiceAction } from './serviceLog'
import { msg } from '../../lib/msg'

/** 일정 입력 공통 타입 */
export type CalendarEventInput = {
  time: string
  endTime?: string
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
    end_time: input.endTime?.trim() || null,
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

export function makeCalendarMutations(deps: {
  fetchAll: () => Promise<void>
  refetchAfterParticipantRemoval?: () => Promise<void>
  calendarEvents: CalendarEvent[]
}) {
  const { fetchAll, refetchAfterParticipantRemoval, calendarEvents } = deps

  // ─── 일정 CRUD ───────────────────────────────────────────────
  const createCalendarEvent = async (input: { date: string } & CalendarEventInput) => {
    const payload = { ...buildEventPayload(input), event_date: input.date }
    const result = await supabase.from('calendar_events').insert(payload).select('id').single()
    if (result.error) {
      reportMutationError(msg('일정을 등록하지 못했습니다.'), result.error)
      return
    }
    // 시스템 채팅 메시지 ("채팅방이 생성되었습니다") 제거 — 불필요 알림 줄이기
    await fetchAll()
    showToast(msg('일정이 등록됐습니다'))
  }

  const createRepeatCalendarEvents = async (dates: string[], input: CalendarEventInput) => {
    // 종료일이 시작일보다 이전이면 dates 가 비어 0개 등록되는 사고 방지
    if (!dates || dates.length === 0) {
      showToast(msg('반복 종료일을 시작일 이후로 정해 주세요.'), 'error')
      return
    }
    const seriesId = crypto.randomUUID()
    const basePayload = buildEventPayload(input)
    const result = await supabase.from('calendar_events').insert(
      dates.map((date) => ({ ...basePayload, event_date: date, series_id: seriesId })),
    ).select('id')
    if (result.error) {
      reportMutationError(msg('반복 일정을 등록하지 못했습니다.'), result.error)
      return
    }
    // 시스템 채팅 메시지 ("채팅방이 생성되었습니다") 제거 — 불필요 알림 줄이기
    await fetchAll()
    showToast(msg('{length}개 일정이 등록됐습니다', { length: dates.length }))
  }

  const updateCalendarEvent = async (eventId: number, input: CalendarEventInput) => {
    const result = await supabase.from('calendar_events').update(buildEventPayload(input)).eq('id', eventId)
    if (result.error) {
      reportMutationError(msg('일정을 수정하지 못했습니다.'), result.error)
      return
    }
    await fetchAll()
    showToast(msg('일정이 수정됐습니다'))
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
      reportMutationError(msg('반복 일정을 수정하지 못했습니다.'), result.error)
      return
    }
    await fetchAll()
    showToast(msg('이후 모든 반복 일정이 수정됐습니다'))
  }

  const deleteCalendarEvent = async (eventId: number) => {
    const result = await supabase.from('calendar_events').delete().eq('id', eventId)
    if (result.error) {
      reportMutationError(msg('일정을 삭제하지 못했습니다.'), result.error)
      return
    }
    await fetchAll()
    showToast(msg('일정이 삭제됐습니다'))
  }

  const deleteCalendarEventSeries = async (seriesId: string, fromDate: string) => {
    const result = await supabase.from('calendar_events')
      .delete()
      .eq('series_id', seriesId)
      .gte('event_date', fromDate)
    if (result.error) {
      reportMutationError(msg('반복 일정 삭제에 실패했습니다.'), result.error)
      return
    }
    await fetchAll()
    showToast(msg('이후 반복 일정이 모두 삭제됐습니다'))
  }

  const linkEventsToSeries = async (eventIds: number[]) => {
    const seriesId = crypto.randomUUID()
    const result = await supabase.from('calendar_events')
      .update({ series_id: seriesId })
      .in('id', eventIds)
    if (result.error) {
      reportMutationError(msg('시리즈 묶기에 실패했습니다. series_id 컬럼이 있는지 확인해 주세요.'), result.error)
      return
    }
    await fetchAll()
    showToast(msg('{length}개 일정이 시리즈로 묶였습니다', { length: eventIds.length }))
  }

  // ─── 참가자 / 신청 ───────────────────────────────────────────
  const applyToEvent = async (eventId: number) => {
    const currentVisitor = getCurrentVisitor()
    const event = calendarEvents.find((e) => e.id === eventId)
    const isApplied = event?.applicants.includes(currentVisitor)
    if (event && !event.allowApplications && !isApplied) {
      showToast(msg('이 일정은 봉사 신청을 받지 않습니다.'), 'info')
      return
    }
    if (isApplied) {
      const result = await supabase.from('event_participants')
        .delete()
        .eq('event_id', eventId)
        .eq('user_name', currentVisitor)
      if (result.error) {
        reportMutationError(msg('봉사 신청을 취소하지 못했습니다.'), result.error)
        return
      }
      await logServiceAction({
        eventId,
        action: 'left',
        targetType: 'event_participant',
        details: { user_name: currentVisitor, source: 'self_cancel' },
      })
    } else {
      const result = await supabase.from('event_participants').upsert(
        { event_id: eventId, user_name: currentVisitor, role: '신청' },
        { onConflict: 'event_id,user_name' },
      )
      if (result.error) {
        reportMutationError(msg('봉사 신청을 저장하지 못했습니다.'), result.error)
        return
      }
      // 시스템 채팅 메시지 ("합류했습니다") 제거 — 불필요 알림 줄이기
      await logServiceAction({
        eventId,
        action: 'joined',
        targetType: 'event_participant',
        details: { user_name: currentVisitor, source: 'self_apply' },
      })
    }
    await fetchAll()
    showToast(isApplied ? '신청이 취소됐습니다' : '일정에 신청됐습니다')
  }

  const assignToEvent = async (eventId: number, userName: string) => {
    await supabase.from('event_participants').upsert(
      { event_id: eventId, user_name: userName, role: '입명' },
      { onConflict: 'event_id,user_name' },
    )
    await createSystemChatMessage(eventId, `${userName}님이 배정되었습니다.`)
    await fetchAll()
  }

  const removeParticipantFromEvent = async (eventId: number, userName: string) => {
    const multiCardResult = await supabase.from('event_card_assignment_cards')
      .delete()
      .eq('event_id', eventId)
      .eq('user_name', userName)
    if (multiCardResult.error) {
      reportMutationError(msg('참가자의 추가 카드 배정을 정리하지 못했습니다.'), multiCardResult.error)
      return
    }

    const cardAssignmentResult = await supabase.from('event_card_assignments')
      .delete()
      .eq('event_id', eventId)
      .eq('user_name', userName)
    if (cardAssignmentResult.error) {
      reportMutationError(msg('참가자의 카드 배정을 정리하지 못했습니다.'), cardAssignmentResult.error)
      return
    }

    const informalResult = await supabase.from('event_informal_assignments')
      .delete()
      .eq('event_id', eventId)
      .eq('user_name', userName)
    if (informalResult.error) {
      reportMutationError(msg('참가자의 비공식 배정을 정리하지 못했습니다.'), informalResult.error)
      return
    }

    const restaurantResult = await supabase.from('event_restaurant_assignments')
      .delete()
      .eq('event_id', eventId)
      .eq('user_name', userName)
    if (restaurantResult.error) {
      reportMutationError(msg('참가자의 식당 배정을 정리하지 못했습니다.'), restaurantResult.error)
      return
    }

    const sessionResult = await supabase.from('service_sessions')
      .delete()
      .eq('calendar_event_id', eventId)
      .eq('user_name', userName)
      .eq('source', 'assigned')
    if (sessionResult.error) {
      reportMutationError(msg('참가자의 자동 봉사 세션을 정리하지 못했습니다.'), sessionResult.error)
      return
    }

    const participantResult = await supabase.from('event_participants')
      .delete()
      .eq('event_id', eventId)
      .eq('user_name', userName)
    if (participantResult.error) {
      reportMutationError(msg('참가자를 제외하지 못했습니다.'), participantResult.error)
      return
    }

    await logServiceAction({
      eventId,
      action: 'left',
      targetType: 'event_participant',
      details: { user_name: userName, source: 'admin_remove' },
    })
    await (refetchAfterParticipantRemoval ?? fetchAll)()
    showToast(msg('{userName}님을 참가자와 배정에서 제외했습니다', { userName: userName }))
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
      reportMutationError(msg('참가자를 추가하지 못했습니다.'), result.error)
      return
    }
    // 시스템 채팅 메시지 ("합류했습니다") 제거 — 불필요 알림 줄이기
    await logServiceAction({
      eventId,
      action: 'joined',
      targetType: 'event_participant',
      details: { user_name: userName, source: 'admin_add' },
    })
    await fetchAll()
    showToast(msg('{userName}님을 신청자로 추가했습니다', { userName: userName }))
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
