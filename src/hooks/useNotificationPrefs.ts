// 알림 설정 (notification_preferences) 조회 + 저장
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export type NotificationPrefs = {
  pushNewNotice: boolean
  pushEventChange: boolean
  pushComment: boolean
  pushChat: boolean
  pushMention: boolean
  pushServiceStatus: boolean
  quietHoursStart: string | null  // "HH:MM" or null
  quietHoursEnd: string | null
}

const DEFAULT_PREFS: NotificationPrefs = {
  pushNewNotice: true,
  pushEventChange: true,
  pushComment: true,
  pushChat: true,
  pushMention: true,
  pushServiceStatus: true,
  quietHoursStart: '22:00',
  quietHoursEnd: '07:00',
}

type RawPrefs = {
  user_id: number
  push_new_notice: boolean
  push_event_change: boolean
  push_comment: boolean
  push_chat: boolean
  push_mention: boolean
  push_service_status: boolean
  quiet_hours_start: string | null
  quiet_hours_end: string | null
}

function toPrefs(raw: RawPrefs): NotificationPrefs {
  return {
    pushNewNotice: raw.push_new_notice,
    pushEventChange: raw.push_event_change,
    pushComment: raw.push_comment,
    pushChat: raw.push_chat,
    pushMention: raw.push_mention,
    pushServiceStatus: raw.push_service_status,
    quietHoursStart: raw.quiet_hours_start ? raw.quiet_hours_start.slice(0, 5) : null,
    quietHoursEnd: raw.quiet_hours_end ? raw.quiet_hours_end.slice(0, 5) : null,
  }
}

export function useNotificationPrefs(userId: number | null | undefined) {
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const fetch = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    const { data, error } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()
    setLoading(false)
    if (error) {
      console.warn('[notification_prefs] fetch failed:', error)
      return
    }
    if (data) {
      setPrefs(toPrefs(data as RawPrefs))
    } else {
      setPrefs(DEFAULT_PREFS)
    }
  }, [userId])

  useEffect(() => {
    fetch()
  }, [fetch])

  const update = useCallback(
    async (patch: Partial<NotificationPrefs>) => {
      if (!userId) return
      const next = { ...prefs, ...patch }
      // 낙관적 갱신
      setPrefs(next)
      setSaving(true)

      const { error } = await supabase
        .from('notification_preferences')
        .upsert(
          {
            user_id: userId,
            push_new_notice: next.pushNewNotice,
            push_event_change: next.pushEventChange,
            push_comment: next.pushComment,
            push_chat: next.pushChat,
            push_mention: next.pushMention,
            push_service_status: next.pushServiceStatus,
            quiet_hours_start: next.quietHoursStart,
            quiet_hours_end: next.quietHoursEnd,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        )

      setSaving(false)
      if (error) {
        console.warn('[notification_prefs] update failed:', error)
        await fetch() // 롤백
      }
    },
    [userId, prefs, fetch]
  )

  return { prefs, loading, saving, update, refetch: fetch }
}
