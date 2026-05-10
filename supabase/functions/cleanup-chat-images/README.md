# Edge Function: cleanup-chat-images

매일 새벽 3시 자동 실행 — 6개월 지난 채팅 사진 정리.

## 동작

1. `chat_messages`에서 다음 조건의 메시지 조회 (최대 100건):
   - `image_expired = false`
   - `image_url IS NOT NULL`
   - `created_at < now() - 6 months`
2. publicUrl에서 Storage path 추출
3. `chat-attachments` Storage에서 파일 일괄 삭제
4. DB UPDATE: `image_url = null`, `image_expired = true`
5. 클라이언트는 `image_expired = true` 시 "[사진 만료됨]" 표시

## 환경변수 설정 (Supabase Dashboard)

**Project Settings → Edge Functions → Secrets**

```
CLEANUP_FUNCTION_KEY=<랜덤 UUID>
```

(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY는 자동)

## 배포

```bash
supabase functions deploy cleanup-chat-images --no-verify-jwt
```

## 스케줄 설정 (매일 새벽 3시)

### 옵션 A: Supabase Dashboard에서 (권장)

1. Supabase Dashboard → Database → Cron Jobs
2. + New Cron Job
3. Name: `cleanup-chat-images-daily`
4. Schedule: `0 3 * * *` (매일 03:00 UTC)
5. SQL Command:
```sql
select net.http_post(
  url := 'https://qdxemvdorasoryfysuoq.supabase.co/functions/v1/cleanup-chat-images',
  headers := jsonb_build_object(
    'Authorization', 'Bearer ' || vault.read_secret('cleanup_function_key'),
    'Content-Type', 'application/json'
  )
);
```

### 옵션 B: SQL로 직접 (pg_cron 활성화 후)

```sql
-- 한 번만 실행
select cron.schedule(
  'cleanup-chat-images-daily',
  '0 3 * * *',
  $$
  select net.http_post(
    url := 'https://qdxemvdorasoryfysuoq.supabase.co/functions/v1/cleanup-chat-images',
    headers := jsonb_build_object(
      'Authorization', 'Bearer <CLEANUP_FUNCTION_KEY>',
      'Content-Type', 'application/json'
    )
  );
  $$
);
```

⚠️ Bearer 토큰을 SQL에 직접 적으면 보안 약함. Vault 사용 권장.

## 수동 테스트

```bash
curl -X POST 'https://qdxemvdorasoryfysuoq.supabase.co/functions/v1/cleanup-chat-images' \
  -H 'Authorization: Bearer <CLEANUP_FUNCTION_KEY>' \
  -H 'Content-Type: application/json'
```

응답 예시:
```json
{
  "ok": true,
  "processed": 23,
  "storageDeleted": 23,
  "malformedUrls": 0,
  "cutoff": "2025-11-11T03:00:00.000Z"
}
```

## 안전장치

- `BATCH_SIZE = 100`: 한 번에 100건씩 처리 (대량 한꺼번에 처리 X)
- 매일 실행되므로 누적 처리 가능 (1000건 만료 → 10일에 걸쳐 처리)
- Storage 삭제 실패해도 DB는 업데이트 (파일이 이미 삭제된 경우 등)
- 잘못된 URL도 만료 처리 (다음 조회에서 제외)
