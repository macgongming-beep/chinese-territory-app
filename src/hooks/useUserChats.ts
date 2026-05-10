// 사용자가 참여한 일정 + 각 채팅방의 안 읽음 카운트
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

export type UserChat = {
  eventId: number
  eventTitle: string
  eventDate: string
  eventTime: string | null
  participantCount: number
  lastMessageAt: string | null
  unreadCount: number
  isLocked: boolean // service_session 종료 + 7일 경과
  hasEnded: boolean // service_session 종료 (1주일 활성)
}

type EventRow = {
  id: number
  event_date: string
  time: string | null
  title: string
}

type ParticipantRow = {
  event_id: number
  events?: EventRow | null
}

type ReadStatusRow = {
  event_id: number
  last_read_at: string
}

type MessageMetaRow = {
  event_id: number
  created_at: string
  author_id: number | null
}

type SessionRow = {
  calendar_event_id: number | null
  ended_at: string | null
}

function isLockedByEndedAt(latestEnded: number): boolean {
  return Date.now() - latestEnded > 7 * 24 * 60 * 60 * 1000
}

export function useUserChats(userId: number | null | undefined, userName: string | null | undefined) {
  const [chats, setChats] = useState<UserChat[]>([])
  const [loading, setLoading] = useState(false)

  const fetchAll = useCallback(async () => {
    if (!userId || !userName) {
      setChats([])
      return
    }
    setLoading(true)

    try {
      // 1. 사용자가 참여한 일정 (event_participants)
      const { data: participants } = await supabase
        .from('event_participants')
        .select('event_id, events:calendar_events(id, event_date, time, title)')
        .eq('user_name', userName)

      const events = ((participants ?? []) as unknown as ParticipantRow[])
        .map((p) => p.events)
        .filter((e): e is EventRow => Boolean(e))

      if (events.length === 0) {
        setChats([])
        return
      }

      const eventIds = events.map((e) => e.id)

      // 2. 채팅 읽음 상태
      const { data: readRows } = await supabase
        .from('chat_read_status')
        .select('event_id, last_read_at')
        .eq('user_id', userId)
        .in('event_id', eventIds)

      const readMap = new Map<number, string>()
      ;((readRows ?? []) as ReadStatusRow[]).forEach((r) => {
        readMap.set(r.event_id, r.last_read_at)
      })

      // 3. 채팅 메시지 메타 (참여자 카운트, 최신, 안 읽음 카운트용)
      const { data: messages } = await supabase
        .from('chat_messages')
        .select('event_id, created_at, author_id')
        .in('event_id', eventIds)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(1000)

      const messagesByEvent = new Map<number, MessageMetaRow[]>()
      ;((messages ?? []) as MessageMetaRow[]).forEach((m) => {
        const arr = messagesByEvent.get(m.event_id) ?? []
        arr.push(m)
        messagesByEvent.set(m.event_id, arr)
      })

      // 4. 일정별 참여 인원 카운트
      const { data: allParticipants } = await supabase
        .from('event_participants')
        .select('event_id')
        .in('event_id', eventIds)

      const participantCountByEvent = new Map<number, number>()
      ;((allParticipants ?? []) as { event_id: number }[]).forEach((p) => {
        participantCountByEvent.set(p.event_id, (participantCountByEvent.get(p.event_id) ?? 0) + 1)
      })

      // 5. 봉사 세션 (잠금 판단용)
      const { data: sessions } = await supabase
        .from('service_sessions')
        .select('calendar_event_id, ended_at')
        .in('calendar_event_id', eventIds)

      const sessionsByEvent = new Map<number, SessionRow[]>()
      ;((sessions ?? []) as SessionRow[]).forEach((s) => {
        if (!s.calendar_event_id) return
        const arr = sessionsByEvent.get(s.calendar_event_id) ?? []
        arr.push(s)
        sessionsByEvent.set(s.calendar_event_id, arr)
      })

      // 6. 합쳐서 UserChat 생성
      const result: UserChat[] = events.map((event) => {
        const eventMessages = messagesByEvent.get(event.id) ?? []
        const lastReadAt = readMap.get(event.id) ?? '1970-01-01'

        // 안 읽음: 본인 메시지 제외 + last_read_at 이후 메시지
        const unreadCount = eventMessages.filter(
          (m) => m.created_at > lastReadAt && m.author_id !== userId
        ).length

        // 봉사 세션 잠금
        const eventSessions = sessionsByEvent.get(event.id) ?? []
        const allEnded = eventSessions.length > 0 && eventSessions.every((s) => s.ended_at !== null)
        const latestEndedTime = allEnded
          ? Math.max(...eventSessions.map((s) => new Date(s.ended_at!).getTime()))
          : 0
        const isLocked = allEnded && isLockedByEndedAt(latestEndedTime)

        return {
          eventId: event.id,
          eventTitle: event.title,
          eventDate: event.event_date,
          eventTime: event.time,
          participantCount: participantCountByEvent.get(event.id) ?? 0,
          lastMessageAt: eventMessages[0]?.created_at ?? null,
          unreadCount,
          isLocked,
          hasEnded: allEnded,
        }
      })

      // 활성 (최신 메시지 시각 desc) → 종료 (날짜 desc) 정렬
      result.sort((a, b) => {
        if (a.isLocked !== b.isLocked) return a.isLocked ? 1 : -1
        if (a.hasEnded !== b.hasEnded) return a.hasEnded ? 1 : -1
        const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0
        const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0
        return bTime - aTime
      })

      setChats(result)
    } catch (e) {
      console.warn('[user_chats] fetch failed:', e)
      setChats([])
    } finally {
      setLoading(false)
    }
  }, [userId, userName])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  // Realtime: 채팅 메시지 변동 시 재조회 (가벼운 디바운스)
  useEffect(() => {
    if (!userId) return
    let pending: ReturnType<typeof setTimeout> | null = null
    const trigger = () => {
      if (pending) clearTimeout(pending)
      pending = setTimeout(() => fetchAll(), 800)
    }

    const channel = supabase
      .channel(`user_chats:user:${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_messages' }, trigger)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_read_status', filter: `user_id=eq.${userId}` }, trigger)
      .subscribe()

    return () => {
      if (pending) clearTimeout(pending)
      supabase.removeChannel(channel)
    }
  }, [userId, fetchAll])

  // 총 안 읽음 수
  const totalUnread = useMemo(
    () => chats.reduce((sum, c) => sum + c.unreadCount, 0),
    [chats]
  )

  // 활성 / 종료 분리
  const activeChats = useMemo(() => chats.filter((c) => !c.isLocked), [chats])
  const lockedChats = useMemo(() => chats.filter((c) => c.isLocked), [chats])

  return {
    chats,
    activeChats,
    lockedChats,
    totalUnread,
    loading,
    refetch: fetchAll,
  }
}
