import { useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { subscribeWithRecovery } from '../lib/realtimeRecovery'

/**
 * 건물 하나를 지우면 하위 세대 삭제 이벤트도 연달아 온다. 이벤트마다 다시 받지
 * 않고 한 묶음으로 합쳐, 현재 화면을 유지한 채 구역 자료만 동기화한다.
 */
export function usePlaceDeletionRealtime(
  onDelete: () => void,
  options?: { enabled?: boolean; debounceMs?: number },
) {
  const enabled = options?.enabled !== false
  const debounceMs = options?.debounceMs ?? 500
  const callbackRef = useRef(onDelete)

  useEffect(() => {
    callbackRef.current = onDelete
  }, [onDelete])

  useEffect(() => {
    if (!enabled) return

    let pending: ReturnType<typeof setTimeout> | null = null
    const scheduleSync = () => {
      if (pending) clearTimeout(pending)
      pending = setTimeout(() => callbackRef.current(), debounceMs)
    }

    const channel = supabase
      .channel(`place_deletion_sync:${Date.now()}`)
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'buildings' }, scheduleSync)
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'units' }, scheduleSync)

    subscribeWithRecovery(channel, () => callbackRef.current())

    return () => {
      if (pending) clearTimeout(pending)
      void supabase.removeChannel(channel)
    }
  }, [enabled, debounceMs])
}
