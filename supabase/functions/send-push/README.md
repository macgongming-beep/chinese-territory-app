# Edge Function: send-push

PostgreSQL 트리거(`dispatch_push_notification`)에서 호출되는 웹 푸시 발송 함수.

## 환경변수 설정 (Supabase Dashboard)

**Project Settings → Edge Functions → Secrets**

```
VAPID_PUBLIC_KEY=<web-push로 생성한 public key>
VAPID_PRIVATE_KEY=<web-push로 생성한 private key — 절대 git에 커밋 X>
VAPID_SUBJECT=mailto:your-email@example.com
PUSH_EDGE_FUNCTION_KEY=<랜덤 UUID 생성해서 입력>
```

**키 생성:**
```bash
node -e "const wp=require('web-push');console.log(wp.generateVAPIDKeys());"
```

⚠️ **VAPID_PRIVATE_KEY 보안:**
- 절대 git, 문서, 클라이언트 코드에 노출 금지
- Supabase Vault 또는 Edge Function Secrets에만 저장
- 노출 시 즉시 새 키로 재발급 필요

> `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`는 Edge Function이 자동으로 가짐.

PUSH_EDGE_FUNCTION_KEY는 아무 랜덤 문자열이면 됨 (예: `uuidgen` 결과).

## 배포

```bash
# Supabase CLI 설치 (최초 1회)
npm install -g supabase

# 로그인
supabase login

# 프로젝트 연결
supabase link --project-ref qdxemvdorasoryfysuoq

# 배포 (JWT 검증 비활성화 — 자체 인증 사용)
supabase functions deploy send-push --no-verify-jwt
```

배포 URL: `https://qdxemvdorasoryfysuoq.supabase.co/functions/v1/send-push`

## PostgreSQL 설정 (한 번만 — SQL Editor)

```sql
-- Edge Function URL과 Key를 PostgreSQL에 저장
alter database postgres set app.push_edge_function_url = 'https://qdxemvdorasoryfysuoq.supabase.co/functions/v1/send-push';
alter database postgres set app.push_edge_function_key = '<위에서 정한 PUSH_EDGE_FUNCTION_KEY>';

-- 변경 적용 (Postgres 재시작 효과)
select pg_reload_conf();

-- 확인
show app.push_edge_function_url;
show app.push_edge_function_key;
```

## 테스트

```sql
-- 임의 사용자에게 푸시 발송 테스트 (user_id 1)
select public.dispatch_push_notification(
  ARRAY[1]::integer[],
  'notice',
  '테스트 알림',
  '푸시 알림이 잘 작동합니다',
  '/notices',
  null
);
```

## 흐름

```
[댓글 작성 등]
   ↓
PostgreSQL 트리거
   ↓
insert_notifications() — DB에 알림 저장
   ↓
dispatch_push_notification() — Edge Function 호출
   ↓
send-push (이 함수) — push_subscriptions 조회 후 Web Push 발송
   ↓
[브라우저 Service Worker]
   ↓
push 이벤트 → showNotification()
   ↓
사용자가 알림 클릭 → notificationclick → 해당 URL 이동
```

## 알림 종류 (notification_preferences 컬럼과 매핑)

| type | 설명 | preferences 컬럼 |
|---|---|---|
| `notice` | 새 공지 | `push_new_notice` |
| `event_change` | 일정 시간/장소 변경 | `push_event_change` |
| `comment` | 댓글 | `push_comment` |
| `mention` | @멘션 | `push_mention` |
| `chat` | 채팅 메시지 | `push_chat` |
| `service_started` | 봉사 시작 | `push_service_status` |
| `service_ended` | 봉사 종료 | `push_service_status` |

(새 일정 등록 시 알림은 발송 안 함 — 일정 추가/삭제가 잦으므로)
