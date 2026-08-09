// Supabase Edge Function: send-push
// 호출자: PostgreSQL 트리거 (dispatch_push_notification RPC)
// 역할: recipient_ids 받아서 각 사용자의 push_subscriptions 조회 후 Web Push 발송
//
// 환경변수 (Supabase Dashboard → Project Settings → Edge Functions):
//   - SUPABASE_URL
//   - SUPABASE_SERVICE_ROLE_KEY
//   - VAPID_PUBLIC_KEY
//   - VAPID_PRIVATE_KEY
//   - VAPID_SUBJECT (mailto:...)
//   - PUSH_EDGE_FUNCTION_KEY (Authorization 헤더 검증용)
//
// 배포: supabase functions deploy send-push --no-verify-jwt
// Postgres 설정 (한 번만):
//   alter database postgres set app.push_edge_function_url = '<URL>';
//   alter database postgres set app.push_edge_function_key = '<KEY>';

// @ts-ignore Deno 환경
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'
// @ts-ignore Deno 환경
import * as webpush from 'https://esm.sh/web-push@3.6.7'

interface SendPushPayload {
  recipient_ids: number[]
  type: string
  title: string
  body?: string | null
  link?: string | null
  related_id?: number | null
}

interface PushSubscriptionRow {
  id: number
  user_id: number
  endpoint: string
  p256dh: string
  auth: string
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.slice(0, 5).split(':').map(Number)
  return h * 60 + m
}

function isInQuietHours(start: string | null, end: string | null): boolean {
  if (!start || !end) return false
  const now = new Date()
  const kstMin = ((now.getUTCHours() + 9) % 24) * 60 + now.getUTCMinutes()
  const s = toMinutes(start)
  const e = toMinutes(end)
  if (s === e) return false
  return s < e ? (kstMin >= s && kstMin < e) : (kstMin >= s || kstMin < e)
}

// @ts-ignore Deno 환경
Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, content-type',
      },
    })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  // 1. 인증: Authorization 헤더 검증
  // @ts-ignore Deno 환경
  const expectedKey = Deno.env.get('PUSH_EDGE_FUNCTION_KEY')
  const authHeader = req.headers.get('Authorization') ?? ''
  const providedKey = authHeader.replace(/^Bearer\s+/i, '')

  if (!expectedKey || providedKey !== expectedKey) {
    return jsonResponse({ error: 'Unauthorized' }, 401)
  }

  // 2. 요청 페이로드 파싱
  let payload: SendPushPayload
  try {
    payload = await req.json()
  } catch (e) {
    return jsonResponse({ error: 'Invalid JSON' }, 400)
  }

  if (!payload.recipient_ids || payload.recipient_ids.length === 0) {
    return jsonResponse({ ok: true, sent: 0, message: 'No recipients' })
  }

  // 3. 환경변수 로드
  // @ts-ignore Deno 환경
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  // @ts-ignore Deno 환경
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  // @ts-ignore Deno 환경
  const vapidPublic = Deno.env.get('VAPID_PUBLIC_KEY')
  // @ts-ignore Deno 환경
  const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY')
  // @ts-ignore Deno 환경
  const vapidSubject = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:noreply@example.com'

  if (!supabaseUrl || !supabaseServiceKey || !vapidPublic || !vapidPrivate) {
    return jsonResponse({ error: 'Missing environment variables' }, 500)
  }

  // 4. VAPID 설정
  webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate)

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  // 5a. 전체 알림 금지 시간 — 앱 전체에 적용되는 푸시 차단 창
  // 앱 안 알림(notifications row)은 유지하고, Web Push 발송만 건너뛴다.
  const { data: globalQuietRows, error: globalQuietError } = await supabase
    .from('app_private_settings')
    .select('key, value')
    .in('key', ['global_push_quiet_enabled', 'global_push_quiet_start', 'global_push_quiet_end'])
  if (globalQuietError) {
    console.warn('[send-push] global quiet-hours lookup failed:', globalQuietError.message)
  } else {
    const globalQuiet = new Map<string, string>()
    for (const row of globalQuietRows ?? []) {
      globalQuiet.set(row.key, row.value)
    }
    const globalQuietEnabled = globalQuiet.get('global_push_quiet_enabled') === 'true'
    const globalQuietStart = globalQuiet.get('global_push_quiet_start') ?? '22:00'
    const globalQuietEnd = globalQuiet.get('global_push_quiet_end') ?? '07:00'
    if (globalQuietEnabled && isInQuietHours(globalQuietStart, globalQuietEnd)) {
      return jsonResponse({
        ok: true,
        sent: 0,
        skipped_global_quiet: payload.recipient_ids.length,
        message: 'Global quiet hours',
      })
    }
  }

  // 5. push_subscriptions 조회
  const { data: subscriptions, error: dbError } = await supabase
    .from('push_subscriptions')
    .select('id, user_id, endpoint, p256dh, auth')
    .in('user_id', payload.recipient_ids)

  if (dbError) {
    return jsonResponse({ error: 'Failed to query subscriptions', detail: dbError.message }, 500)
  }

  const allSubs: PushSubscriptionRow[] = subscriptions ?? []
  if (allSubs.length === 0) {
    return jsonResponse({ ok: true, sent: 0, message: 'No subscriptions for recipients' })
  }

  // 5b. 방해금지 시간 필터 — quiet_hours 안의 사용자는 발송 제외
  // KST(UTC+9) 기준 HH:MM 비교. start <= end (same day) 또는 start > end (자정 넘김)
  // ⚠ 조회 실패를 무시하면 방해금지가 조용히 무시된다 (실제로 그런 적 있음:
  //   없는 테이블 user_notification_prefs 를 보고 있었다) — 반드시 로그를 남긴다
  const { data: prefsRows, error: prefsError } = await supabase
    .from('notification_preferences')
    .select('user_id, quiet_hours_start, quiet_hours_end')
    .in('user_id', payload.recipient_ids)
  if (prefsError) {
    console.error('[send-push] quiet-hours lookup failed:', prefsError.message)
  }
  const prefsByUser = new Map<number, { start: string | null; end: string | null }>()
  for (const row of prefsRows ?? []) {
    prefsByUser.set(row.user_id, { start: row.quiet_hours_start, end: row.quiet_hours_end })
  }
  const subs = allSubs.filter((s) => {
    const pref = prefsByUser.get(s.user_id)
    return !pref || !isInQuietHours(pref.start, pref.end)
  })
  const filteredOut = allSubs.length - subs.length
  if (subs.length === 0) {
    return jsonResponse({ ok: true, sent: 0, skipped_quiet: filteredOut, message: 'All recipients in quiet hours' })
  }

  // 6. 알림 페이로드 (Service Worker가 수신)
  const pushPayload = JSON.stringify({
    title: payload.title,
    body: payload.body ?? '',
    link: payload.link ?? '/',
    type: payload.type,
    related_id: payload.related_id,
    timestamp: Date.now(),
  })

  // 7. Web Push 발송 (병렬)
  const results = await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          pushPayload,
          { TTL: 60 * 60 * 24 } // 24시간 보관
        )
        // last_seen_at 갱신
        await supabase
          .from('push_subscriptions')
          .update({ last_seen_at: new Date().toISOString() })
          .eq('id', sub.id)
        return { id: sub.id, ok: true }
      } catch (err: any) {
        // 410 Gone / 404 Not Found → 만료된 구독, 삭제
        if (err.statusCode === 410 || err.statusCode === 404) {
          await supabase.from('push_subscriptions').delete().eq('id', sub.id)
          return { id: sub.id, ok: false, removed: true, status: err.statusCode }
        }
        return { id: sub.id, ok: false, status: err.statusCode, error: err.message }
      }
    })
  )

  const sent = results.filter((r) => r.status === 'fulfilled' && (r.value as any).ok).length
  const removed = results.filter((r) => r.status === 'fulfilled' && (r.value as any).removed).length
  const failed = results.length - sent

  return jsonResponse({
    ok: true,
    total: subs.length,
    sent,
    failed,
    removed,
  })
})

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  })
}
