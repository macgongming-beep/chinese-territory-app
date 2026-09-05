import { useEffect, useMemo, useState } from 'react'
import type { ReturnVisit } from '../types'
import { fetchPendingPlaceChangeRequestCount } from './storeMutations/placeChangeRequests'
import { countBrokenReturnVisits, type AttentionUser } from '../utils/adminAttention'
import { ADMIN_ATTENTION_CHANGED_EVENT } from '../lib/adminAttentionEvents'

export function useAdminAttentionCounts({
  enabled,
  users,
  returnVisits,
  refreshKey,
}: {
  enabled: boolean
  users: AttentionUser[]
  returnVisits: ReturnVisit[]
  refreshKey?: string
}) {
  const [placeRequests, setPlaceRequests] = useState(0)
  const signupRequests = useMemo(
    () => users.filter((user) => user.approvalStatus === 'pending').length,
    [users],
  )
  const regularVisits = useMemo(
    () => countBrokenReturnVisits(returnVisits, users),
    [returnVisits, users],
  )

  useEffect(() => {
    if (!enabled) return

    let active = true
    const refresh = async () => {
      const count = await fetchPendingPlaceChangeRequestCount()
      if (active && count !== null) setPlaceRequests(count)
    }
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void refresh()
    }

    void refresh()
    window.addEventListener('focus', refresh)
    window.addEventListener(ADMIN_ATTENTION_CHANGED_EVENT, refresh)
    document.addEventListener('visibilitychange', refreshWhenVisible)
    return () => {
      active = false
      window.removeEventListener('focus', refresh)
      window.removeEventListener(ADMIN_ATTENTION_CHANGED_EVENT, refresh)
      document.removeEventListener('visibilitychange', refreshWhenVisible)
    }
  }, [enabled, refreshKey])

  return {
    signupRequests: enabled ? signupRequests : 0,
    regularVisits: enabled ? regularVisits : 0,
    placeRequests: enabled ? placeRequests : 0,
  }
}
