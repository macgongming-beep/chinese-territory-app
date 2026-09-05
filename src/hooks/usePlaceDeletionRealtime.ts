import { useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { subscribeWithRecovery } from '../lib/realtimeRecovery'
import type { PlaceDeletionSignal } from '../types'

type RawPlaceDeletionSignal = {
  id: number
  target_type: 'building' | 'unit'
  building_id: number | null
  unit_id: number | null
  unit_ids: number[] | null
  return_visit_ids: number[] | null
}

function toPlaceDeletionSignal(raw: RawPlaceDeletionSignal): PlaceDeletionSignal {
  return {
    id: raw.id,
    targetType: raw.target_type,
    buildingId: raw.building_id,
    unitId: raw.unit_id,
    unitIds: raw.unit_ids ?? [],
    returnVisitIds: raw.return_visit_ids ?? [],
  }
}

/**
 * 건물 하나를 지우면 하위 세대 삭제 이벤트도 연달아 온다. 이벤트마다 다시 받지
 * 않고 한 묶음으로 합쳐, 현재 화면을 유지한 채 구역 자료만 동기화한다.
 */
export function usePlaceDeletionRealtime(
  onDelete: (signal: PlaceDeletionSignal) => void,
  options?: { enabled?: boolean; onRecover?: () => void },
) {
  const enabled = options?.enabled !== false
  const callbackRef = useRef(onDelete)
  const recoverRef = useRef(options?.onRecover)
  const channelIdRef = useRef<string | null>(null)

  useEffect(() => {
    callbackRef.current = onDelete
    recoverRef.current = options?.onRecover
  }, [onDelete, options?.onRecover])

  useEffect(() => {
    if (!enabled) return
    if (channelIdRef.current === null) {
      channelIdRef.current = typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`
    }

    const channel = supabase
      .channel(`place_deletion_sync:${channelIdRef.current}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'place_change_signals' },
        (payload) => callbackRef.current(toPlaceDeletionSignal(payload.new as RawPlaceDeletionSignal)),
      )

    subscribeWithRecovery(channel, () => recoverRef.current?.())

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [enabled])
}
