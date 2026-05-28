// 데이터 페치 성능 측정 (Phase 0 — 간소 측정)
// localStorage에 호출 카운터만 누적. console.log로 트리거별 분포 확인.
// 운영용 정밀 측정이 필요하면 Supabase Dashboard의 API Logs/Bandwidth 병행.

type FetchEvent = {
  triggeredBy: string  // 예: 'fetchAll:initial', 'mutation:addVisitHistory', 'realtime:user_chats'
  slices: string[]     // 예: ['territory', 'visits']
  approxBytes: number  // JSON.stringify 길이 (실제 egress와 다를 수 있음, 상대 비교용)
  durationMs: number
  timestamp: number
}

const KEY = 'perf_fetch_events_v2'
const MAX_EVENTS = 1000  // 최근 1000개만 유지

export function trackFetch(event: FetchEvent) {
  try {
    const raw = localStorage.getItem(KEY)
    const stored = raw ? (JSON.parse(raw) as FetchEvent[]) : []
    stored.push(event)
    if (stored.length > MAX_EVENTS) stored.splice(0, stored.length - MAX_EVENTS)
    localStorage.setItem(KEY, JSON.stringify(stored))
  } catch {
    // localStorage 한도 초과 시 조용히 무시
  }

  // 개발자 콘솔에 한 줄
  if (typeof window !== 'undefined' && window.console) {
    const kb = (event.approxBytes / 1024).toFixed(1)
    console.log(`[perf] ${event.triggeredBy} | slices=[${event.slices.join(',')}] | ${event.durationMs}ms | ~${kb}KB`)
  }
}

export type FetchStats = {
  totalCount: number
  byTrigger: Record<string, { count: number; totalBytes: number; totalMs: number; avgMs: number; avgKb: number }>
  bySlice: Record<string, number>
  recentEvents: FetchEvent[]
}

export function getFetchStats(): FetchStats {
  let events: FetchEvent[] = []
  try {
    const raw = localStorage.getItem(KEY)
    events = raw ? (JSON.parse(raw) as FetchEvent[]) : []
  } catch {
    events = []
  }

  const byTrigger: FetchStats['byTrigger'] = {}
  const bySlice: FetchStats['bySlice'] = {}

  for (const e of events) {
    if (!byTrigger[e.triggeredBy]) {
      byTrigger[e.triggeredBy] = { count: 0, totalBytes: 0, totalMs: 0, avgMs: 0, avgKb: 0 }
    }
    const t = byTrigger[e.triggeredBy]
    t.count++
    t.totalBytes += e.approxBytes
    t.totalMs += e.durationMs

    for (const s of e.slices) {
      bySlice[s] = (bySlice[s] || 0) + 1
    }
  }

  for (const t of Object.values(byTrigger)) {
    t.avgMs = Math.round(t.totalMs / t.count)
    t.avgKb = Number((t.totalBytes / 1024 / t.count).toFixed(1))
  }

  return {
    totalCount: events.length,
    byTrigger,
    bySlice,
    recentEvents: events.slice(-20),
  }
}

export function clearFetchStats() {
  localStorage.removeItem(KEY)
}

// 개발자 콘솔에서 호출 편의용 (window.__perf)
if (typeof window !== 'undefined') {
  ;(window as unknown as { __perf?: unknown }).__perf = {
    stats: getFetchStats,
    clear: clearFetchStats,
  }
}
