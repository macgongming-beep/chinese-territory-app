// Supabase Edge Function: cleanup-chat-images
//
// 6개월 지난 채팅 사진을 Storage에서 삭제하고
// chat_messages.image_url = NULL, image_expired = TRUE로 업데이트.
//
// 호출 방법:
//   1. Supabase Dashboard → Edge Functions → Schedule
//      → 매일 새벽 3시 (cron: "0 3 * * *")
//   2. 또는 외부 cron이 HTTP POST로 호출 (Authorization 헤더 필요)
//
// 환경변수:
//   - SUPABASE_URL (자동)
//   - SUPABASE_SERVICE_ROLE_KEY (자동)
//   - CLEANUP_FUNCTION_KEY (수동 설정, Supabase secrets)
//
// 배포: supabase functions deploy cleanup-chat-images --no-verify-jwt

// @ts-ignore Deno
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const BUCKET = 'chat-attachments'
const EXPIRE_MONTHS = 6
const BATCH_SIZE = 100 // 한 번 실행에 처리할 최대 메시지 수

interface MessageRow {
  id: number
  image_url: string
  created_at: string
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

  // 인증 (스케줄러는 자동, 수동 호출은 키 필요)
  // @ts-ignore Deno
  const expectedKey = Deno.env.get('CLEANUP_FUNCTION_KEY')
  const authHeader = req.headers.get('Authorization') ?? ''
  const providedKey = authHeader.replace(/^Bearer\s+/i, '')

  if (expectedKey && providedKey !== expectedKey) {
    return jsonResponse({ error: 'Unauthorized' }, 401)
  }

  // @ts-ignore Deno
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  // @ts-ignore Deno
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !supabaseServiceKey) {
    return jsonResponse({ error: 'Missing environment variables' }, 500)
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  // 1. 6개월 지난 만료 후보 조회
  const cutoffDate = new Date()
  cutoffDate.setMonth(cutoffDate.getMonth() - EXPIRE_MONTHS)
  const cutoffIso = cutoffDate.toISOString()

  const { data: messages, error: queryError } = await supabase
    .from('chat_messages')
    .select('id, image_url, created_at')
    .eq('image_expired', false)
    .not('image_url', 'is', null)
    .lt('created_at', cutoffIso)
    .limit(BATCH_SIZE)

  if (queryError) {
    return jsonResponse({ error: 'Query failed', detail: queryError.message }, 500)
  }

  const rows: MessageRow[] = (messages ?? []) as MessageRow[]

  if (rows.length === 0) {
    return jsonResponse({ ok: true, processed: 0, message: 'No expired images' })
  }

  // 2. publicUrl에서 Storage path 추출
  // 예: https://xxx.supabase.co/storage/v1/object/public/chat-attachments/event-123/abc.jpg
  //   → event-123/abc.jpg
  const pathPrefix = `/storage/v1/object/public/${BUCKET}/`
  const paths: { id: number; path: string }[] = []
  const malformed: number[] = []

  for (const row of rows) {
    try {
      const url = new URL(row.image_url)
      const idx = url.pathname.indexOf(pathPrefix)
      if (idx === -1) {
        malformed.push(row.id)
        continue
      }
      const path = url.pathname.slice(idx + pathPrefix.length)
      paths.push({ id: row.id, path })
    } catch {
      malformed.push(row.id)
    }
  }

  // 3. Storage에서 일괄 삭제
  let deletedCount = 0
  let storageError: string | null = null
  if (paths.length > 0) {
    const { error: rmError } = await supabase.storage.from(BUCKET).remove(paths.map((p) => p.path))
    if (rmError) {
      // Storage 삭제 실패해도 DB는 업데이트 (파일 못 찾는 경우 = 이미 삭제됨)
      console.warn('[cleanup] storage remove warning:', rmError.message)
      storageError = rmError.message
    } else {
      deletedCount = paths.length
    }
  }

  // 4. DB UPDATE: image_url = null, image_expired = true
  // 잘못된 URL도 같이 만료 처리 (조회에서 제외하기 위해)
  const allIds = [...paths.map((p) => p.id), ...malformed]
  const { error: updateError } = await supabase
    .from('chat_messages')
    .update({ image_url: null, image_expired: true })
    .in('id', allIds)

  if (updateError) {
    return jsonResponse(
      {
        error: 'DB update failed',
        detail: updateError.message,
        deletedFromStorage: deletedCount,
      },
      500
    )
  }

  return jsonResponse({
    ok: true,
    processed: rows.length,
    storageDeleted: deletedCount,
    malformedUrls: malformed.length,
    storageWarning: storageError,
    cutoff: cutoffIso,
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
