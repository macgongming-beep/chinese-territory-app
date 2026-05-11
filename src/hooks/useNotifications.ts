// 사용자별 알림 함 + 안 읽음 카운트 + Realtime
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { getAuthToken } from '../lib/authToken'

export type NotificationType =
  | 'notice'
  | 'event_change'
  | 'comment'
  | 'mention'
  | 'chat'
  | 'service_started'
  | 'service_ended'

export type AppNotification = {
  id: number
  userId: number
  type: NotificationType
  title: string
  body: string | null
  link: string | null
  relatedId: number | null
  isRead: boolean
  createdAt: string
}

type RawNotification = {
  id: number
  user_id: number
  type: string
  title: string
  body: string | null
  link: string | null
  related_id: number | null
  is_read: boolean
  created_at: string
}

function toNotification(raw: RawNotification): AppNotification {
  return {
    id: raw.id,
    userId: raw.user_id,
    type: raw.type as NotificationType,
    title: raw.title,
    body: raw.body,
    link: raw.link,
    relatedId: raw.related_id,
    isRead: raw.is_read,
    createdAt: raw.created_at,
  }
}

const PAGE_SIZE = 50

export function useNotifications(userId: number | null | undefined) {
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [loading, setLoading] = useState(false)
  const channelIdRef = useRef(
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  )

  const fetchAll = useCallback(async () => {
    if (!userId) return
    const token = getAuthToken()
    if (!token) {
      setNotifications([])
      return
    }
    setLoading(true)
    const { data, error } = await supabase.rpc('get_my_notifications', {
      p_token: token,
      p_limit: PAGE_SIZE,
    })
    setLoading(false)
    if (error) {
      console.warn('[notifications] fetch failed:', error)
      return
    }
    setNotifications((data as RawNotification[]).map(toNotification))
  }, [userId])

  // 초기 로드
  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  // Realtime 구독
  useEffect(() => {
    if (!userId) return
    const channel = supabase
      .channel(`notifications:user:${userId}:${channelIdRef.current}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const raw = payload.new as RawNotification
          setNotifications((prev) => {
            // 중복 방지
            if (prev.some((n) => n.id === raw.id)) return prev
            return [toNotification(raw), ...prev].slice(0, PAGE_SIZE)
          })
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const raw = payload.new as RawNotification
          setNotifications((prev) =>
            prev.map((n) => (n.id === raw.id ? toNotification(raw) : n))
          )
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId])

  // 안 읽음 카운트
  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.isRead).length,
    [notifications]
  )

  // 단일 알림 읽음 처리
  const markRead = useCallback(
    async (notificationId: number) => {
      const token = getAuthToken()
      if (!token) return
      // 낙관적 갱신
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, isRead: true } : n))
      )
      const { error } = await supabase.rpc('mark_notification_read', {
        p_token: token,
        p_notification_id: notificationId,
      })
      if (error) {
        console.warn('[notifications] markRead failed:', error)
        await fetchAll()
      }
    },
    [fetchAll]
  )

  // 모두 읽음
  const markAllRead = useCallback(async () => {
    if (!userId || notifications.every((n) => n.isRead)) return
    const token = getAuthToken()
    if (!token) return
    // 낙관적 갱신
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
    const { error } = await supabase.rpc('mark_all_notifications_read', {
      p_token: token,
    })
    if (error) {
      console.warn('[notifications] markAllRead failed:', error)
      await fetchAll()
    }
  }, [userId, notifications, fetchAll])

  return {
    notifications,
    unreadCount,
    loading,
    markRead,
    markAllRead,
    refetch: fetchAll,
  }
}
