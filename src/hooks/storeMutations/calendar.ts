import type { CalendarEvent } from '../../types'
import { supabase, showToast, reportMutationError, getCurrentVisitor } from './shared'

/** 일정 입력 공통 타입 */
export type CalendarEventInput = {
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
