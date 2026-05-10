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

  // 5. push_subscriptions 조회
  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  const { data: subscriptions, error: dbError } = await supabase
    .from('push_subscriptions')
    .select('id, user_id, endpoint, p256dh, auth')
    .in('user_id', payload.recipient_ids)

  if (dbError) {
    return jsonResponse({ error: 'Failed to query subscriptions', detail: dbError.message }, 500)
  }

  const subs: PushSubscriptionRow[] = subscriptions ?? []
  if (subs.length === 0) {
    return jsonResponse({ ok: true, sent: 0, message: 'No subscriptions for recipients' })
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
