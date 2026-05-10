# V1 강화 — 작업 계획서

> 기존 chinese-territory-app 을 그대로 발전시킴.
> 댓글 / 채팅 / 푸시 알림 / PWA / 봉사 로그 추가.
>
> 작성일: 2026-05-05
> 이전 V2 분리 컨셉은 폐기 → `archive/V2_PLAN_archived.md` 참조

---

## 1. 핵심 컨셉 변경

**처음 V2 안 (폐기):**
- 밴드 vs 웹앱 역할 분리
- 캘린더·공지 제거
- 봉사 도구로만 단순화

**현재 결정 (V1 강화):**
- **모든 봉사 기능을 웹앱에 통합**
- 캘린더·공지 유지 + 댓글 추가
- 일정별 채팅방 추가
- 웹 푸시 알림으로 밴드 의존 점진 감소
- 밴드는 친목·일상으로 자연스럽게 분리

---

## 2. 추가될 기능 (5개 큰 묶음)

### A. 헤더 패턴 통일
- 모든 화면 우상단: 🔍 검색 / 🔔 알림(배지) / 💬 채팅(배지) / ⋮ 메뉴
- 카톡·밴드·당근 등에서 익숙한 패턴
- 어느 화면에 있든 알림/채팅 즉시 접근

### B. 댓글 시스템
- 위치: 공지 / 캘린더 일정
- 공개 (회중 누구나 보고 작성)
- 본인 작성만 수정/삭제
- @멘션 가능

### C. 일정별 채팅방
- 일정 등록 시 즉시 채팅방 생성
- 참여한 사람만 입장 / 메시지 작성
- 텍스트 + 사진 첨부
- @멘션 가능
- 시스템 메시지: 합류 / 봉사 종료 요약
- 봉사 종료 후 1주일 활성 → read-only
- 텍스트 영구 보존, 사진 6개월 자동 삭제

### D. 웹 푸시 알림
- 새 공지 / 일정 변경 / 댓글 / 채팅 / 멘션 시 발송
- **새 일정 등록 시 알림 X** (일정 추가/삭제 잦음)
- PWA 설치 필수 (iOS), 설치 안내 제공
- 사용자가 종류별 on/off, 방해금지 시간 설정
- 알림 묶음 처리 (5분 내 같은 채널)

### E. 관리자용 봉사 로그
- 봉사별 시간순 액션 기록 (방문/합류/메모 등)
- 통계와 별도, 감사 로그
- CSV 다운로드

---

## 3. 결정 사항 전체 표

### 3-1. 댓글 / 채팅 / 알림

| 항목 | 결정 |
|---|---|
| **댓글 위치** | 공지 / 캘린더 일정 |
| **댓글 권한** | 누구나 작성 / 본인만 수정·삭제 (시간 제한 없음) |
| **메시지 본인 삭제 시간 제한** | 5분 이내만 (채팅만) |
| **채팅 위치** | 일정에 종속 (참여자만) |
| **채팅 진입점** | 홈 위젯 + 헤더 💬 + 일정 상세 + 푸시 + 참여 후 토스트 |
| **참여 후 채팅 진입** | 자동 이동 X / **토스트 안내** "채팅방 입장됨 [열기]" |
| **채팅방 자동 생성 조건** | "봉사 신청 받음" 체크된 일정만 |
| **봉사 모임 없는 일정** | 댓글만, 채팅방 X |
| **비참여자 채팅 접근** | 안 보임 |
| **참여 후 과거 채팅** | 모두 볼 수 있음 |
| **인도자/관리자 권한** | 모든 채팅 조용히 보기 + 메시지/방 삭제 + 방 생성 |
| **채팅방 시작 시점** | 일정 등록 즉시 |
| **채팅 보존 (텍스트)** | 영구 |
| **채팅 보존 (사진)** | 6개월 후 자동 삭제 |
| **종료 후 채팅** | 1주일 활성 → read-only |
| **메시지 미리보기** | 채팅 목록/위젯에서 X (사생활 + 깔끔) |
| **메시지 답장 (Reply)** | 첫 버전 X |
| **메시지 본인 수정** | X |
| **메시지 본인 삭제** | OK (5분 이내) |
| **사진 첨부** | OK / 자동 압축 (1MB, 1280px) / 원본 X |
| **사진 미리보기** | 썸네일 → 풀스크린 + 다운로드 |
| **채팅방 인원 표시** | 헤더에 "N명", 누르면 명단 |
| **봉사 외 채팅방** | 안 만듦 |
| **반복 일정 채팅방** | 회차마다 따로 |
| **인도자 변경 시 채팅** | 그대로 유지 + 시스템 메시지 |
| **일정 삭제 시 채팅** | 삭제자가 선택 (보존/삭제) |
| **메시지 시간 표시** | 카톡 패턴 (1분 묶음, 5분+ 차이날 때 다시) |
| **본인 메시지 위치** | 우측 |
| **시스템 메시지** | 합류 + 봉사 종료 요약 (중앙 정렬, 회색) |
| **@멘션** | 누구나 / 댓글에서도 / 무조건 알림 |
| **멘션과 방해금지** | 방해금지 따름 (무음, 배지) |
| **채팅방 알림 끄기** | 가능 (방마다) |
| **알림 묶음** | OK (5분 내 같은 채팅) |
| **푸시 그룹화** | OK |
| **방해금지 시간** | 사용자 설정, 기본 22:00~07:00 |
| **방해금지 동작** | 알림 받되 무음 (배지로만) |
| **봉사 1시간 전 알림** | 안 함 |
| **일정 등록 시 알림** | 안 함 (일정 추가/삭제가 잦음) |
| **메시지 검색 전체** | 안 함 |

### 3-2. 헤더 / 홈 / UI

| 항목 | 결정 |
|---|---|
| **헤더 패턴** | 모든 화면 우상단: 페이지명 + 🔔 / 💬 / ⋮ (검색 X) |
| **헤더 + 날짜 통합** | 홈은 64px (페이지명 옆 날짜) — 184px → 64px |
| **다른 페이지 헤더** | 페이지명만 (날짜 X) |
| **시간슬롯 표시** | 등록된 일정만 (오전/오후/저녁 빈칸 없음) |
| **시간슬롯 이모지** | 안 넣음 (시간만 표시: "17:00") |
| **시간 표시 형식** | 12시간제 통일 ("오후 5:02") |
| **참여자 이름 5명 이상** | "이름1, 이름2, 이름3 외 N명" (3명까지 + 외 표시) |
| **시간슬롯 펴짐** | 진행중 우선 → 다음 봉사 → 최근 끝난 봉사 |
| **사용자 토글 우선** | 직접 펴고 접은 상태 우선 (당일 유지) |
| **봉사 통계 홈에서** | 빼기 (나의봉사 탭 + 봉사 종료 화면으로) |
| **빈 상태** | "오늘 예정된 봉사 없음" + [캘린더 보기] |
| **봉사자 본인 참여 표시** | ✓ 마크 + 카드 배경 약간 다르게 |
| **안 읽음 배지 색** | 빨간색 + 흰 숫자 |
| **헤더 배경** | 흰색 + 하단 미세 보더 |

### 3-3. 용어 / 일정 / 봉사

| 항목 | 결정 |
|---|---|
| **용어 통일** | "신청" → "참여" (참여 / 참여 취소) |
| **봉사 시작 버튼** | 명시적 (사용자가 누름) |
| **봉사 종료 버튼** | 명시적 (사용자가 누름) |
| **봉사 시작 시 시스템 메시지** | "봉사 시작됨" → 채팅에 표시 |
| **봉사 종료 시 시스템 메시지** | "봉사 종료. 방문 N세대 / 만남 X / 부재 Y" |
| **신청 마감 / 인원 제한** | 첫 버전 X (필요 시 추가) |
| **봉사 로그** | 별도 화면 (관리자용) |

### 3-4. PWA / 알림 설정

| 항목 | 결정 |
|---|---|
| **PWA 첫 방문 안내** | 모바일 5초 후 슬라이드업 배너 |
| **PWA 안내 닫기** | "나중에" 7일간 안 보임 / 설치 후 영구 |
| **PWA 설정 메뉴** | 항상 접근 가능 (설치 안내 + 알림 권한 상태) |
| **알림 종류별 on/off** | 가능 (설정에서) |

---

## 4. DB 스키마 변경

### 세션 토큰 시스템 (V1+ 보안 핵심)

**현 V1:** `auth_login` RPC + localStorage 세션 → 매 RPC 호출 시 검증 X
**V1+:** `auth_login` 성공 시 토큰 발급 → 모든 민감 RPC가 토큰 검증

```sql
-- 신규 테이블
CREATE TABLE auth_sessions (
  token UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id BIGINT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '30 days',
  last_used_at TIMESTAMPTZ DEFAULT NOW(),
  device_label TEXT,
  user_agent TEXT
);
CREATE INDEX idx_auth_sessions_user ON auth_sessions(user_id);
CREATE INDEX idx_auth_sessions_expires ON auth_sessions(expires_at);

-- 직접 SELECT 차단
REVOKE SELECT ON auth_sessions FROM anon, authenticated;
```

**auth_login 변경:**
```sql
-- 기존: 로그인 성공 시 user 정보만 반환
-- 신규: 토큰도 발급
CREATE OR REPLACE FUNCTION auth_login(
  p_login_id TEXT,
  p_pin TEXT,
  p_device_label TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
) RETURNS TABLE (
  token UUID,
  user_id BIGINT,
  user_name TEXT,
  role TEXT
) AS $$
DECLARE
  v_user_id BIGINT;
  v_user_name TEXT;
  v_role TEXT;
  v_approval_status TEXT;
  v_is_active BOOLEAN;
  v_token UUID;
BEGIN
  -- 1. PIN 검증 (bcrypt)
  SELECT id, name, role, approval_status, is_active
  INTO v_user_id, v_user_name, v_role, v_approval_status, v_is_active
  FROM app_users
  WHERE login_id = p_login_id
    AND pin = crypt(p_pin, pin);
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION '로그인 실패';
  END IF;
  
  -- 2. 승인 상태 체크
  IF v_approval_status IS DISTINCT FROM 'approved' THEN
    RAISE EXCEPTION '승인 대기 중인 계정입니다';
  END IF;
  
  -- 3. 비활성화 체크 (관리자 차단)
  IF v_is_active IS FALSE THEN
    RAISE EXCEPTION '비활성화된 계정입니다';
  END IF;
  
  -- 4. 토큰 발급
  INSERT INTO auth_sessions (user_id, device_label, user_agent)
  VALUES (v_user_id, p_device_label, p_user_agent)
  RETURNING auth_sessions.token INTO v_token;
  
  -- 5. last_login_at + login_logs 기록 (기존 로직 유지)
  UPDATE app_users SET last_login_at = NOW() WHERE id = v_user_id;
  INSERT INTO login_logs (user_id, logged_in_at) VALUES (v_user_id, NOW());
  
  RETURN QUERY SELECT v_token, v_user_id, v_user_name, v_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**전제: app_users에 다음 컬럼 있다고 가정 (기존 V1 schema 확인 필요):**
```sql
-- 없으면 마이그레이션에서 추가
ALTER TABLE app_users 
  ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
```

**모든 민감 RPC: 토큰 검증 함수 사용:**
```sql
-- 검증 헬퍼
CREATE OR REPLACE FUNCTION verify_session(p_token UUID)
RETURNS BIGINT AS $$
DECLARE
  v_user_id BIGINT;
BEGIN
  SELECT user_id INTO v_user_id
  FROM auth_sessions
  WHERE token = p_token AND expires_at > NOW();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION '세션 만료. 다시 로그인해주세요';
  END IF;
  
  -- last_used_at 갱신
  UPDATE auth_sessions SET last_used_at = NOW() WHERE token = p_token;
  
  RETURN v_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 사용 예: 모든 민감 RPC가 이렇게
CREATE OR REPLACE FUNCTION send_chat_message(
  p_token UUID,         -- ← 클라이언트가 보낸 user_id 대신 토큰
  p_event_id BIGINT,
  p_content TEXT
) RETURNS BIGINT AS $$
DECLARE
  v_author_id BIGINT;
  v_session_ended TIMESTAMPTZ;
  v_message_id BIGINT;
BEGIN
  -- 1. 토큰 검증 → 진짜 user_id 추출
  v_author_id := verify_session(p_token);
  
  -- 2. 잠금 체크 (생략)
  
  -- 3. 메시지 INSERT
  INSERT INTO chat_messages (event_id, author_id, author_name, content, type)
  VALUES (p_event_id, v_author_id,
          (SELECT name FROM app_users WHERE id = v_author_id),
          p_content, 'text')
  RETURNING id INTO v_message_id;
  
  RETURN v_message_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**클라이언트 변경:**
```typescript
// 로그인 시 토큰 받아서 저장
const { token, userId, userName, role } = await auth_login(loginId, pin)
localStorage.setItem('auth_token', token)
localStorage.setItem('auth_session', JSON.stringify({ userId, userName, role }))

// 모든 민감 RPC 호출 시 토큰 포함
const token = localStorage.getItem('auth_token')
await supabase.rpc('send_chat_message', {
  p_token: token,
  p_event_id: eventId,
  p_content: content
})

// 토큰 만료 시 (RPC가 에러 던짐) → 로그아웃 + 로그인 화면
```

**Cron: 만료 토큰 정리**
```sql
-- 매일 새벽 3시
DELETE FROM auth_sessions WHERE expires_at < NOW() - INTERVAL '7 days';
```

### 사용자 식별 원칙

**작성자·행위자·표시되는 사람 정보가 있는 테이블에 적용:**
- `xxx_id BIGINT REFERENCES app_users(id) ON DELETE SET NULL` (참조)
- `xxx_name TEXT NOT NULL` (작성 시점 이름 snapshot)
- 사용자 삭제: id NULL, name은 보존 (메시지/댓글 그대로 표시)
- 이름 변경: 과거 메시지엔 옛 이름 (snapshot)
- 동명이인: id로 구분

**적용 대상:**
- comments (author_id, author_name, mention_ids, mention_names)
- chat_messages (author_id, author_name, mention_ids, mention_names)
- service_logs (actor_id, actor_name)

**미적용 (상태/설정 테이블):**
- chat_read_status — 단순 상태 (user_id만, name snapshot 불필요)
- push_subscriptions — 디바이스 정보 (user_id만)
- notification_preferences — 사용자 설정 (user_id가 PK, name 불필요)
- notifications — 사용자별 알림함 (user_id만, 표시 X)

### 신규 테이블

```sql
-- 댓글 (공지/일정 통합)
CREATE TABLE comments (
  id BIGSERIAL PRIMARY KEY,
  target_type TEXT NOT NULL,    -- 'notice' | 'calendar_event'
  target_id BIGINT NOT NULL,
  author_id BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  author_name TEXT NOT NULL,    -- snapshot
  content TEXT NOT NULL,
  mention_ids BIGINT[],         -- @멘션된 사용자 ID 배열
  mention_names TEXT[],         -- snapshot
  deleted_at TIMESTAMPTZ,       -- soft delete (감사 로그 보존)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_comments_target ON comments(target_type, target_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_comments_author ON comments(author_id);

-- 채팅 메시지
CREATE TABLE chat_messages (
  id BIGSERIAL PRIMARY KEY,
  event_id BIGINT NOT NULL REFERENCES calendar_events(id) ON DELETE CASCADE,
  author_id BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  author_name TEXT NOT NULL,    -- snapshot
  type TEXT NOT NULL DEFAULT 'text',   -- 'text' | 'image' | 'system'
  content TEXT,
  image_url TEXT,
  image_expired BOOLEAN DEFAULT FALSE,  -- 6개월 만료 시 TRUE
  mention_ids BIGINT[],
  mention_names TEXT[],
  deleted_at TIMESTAMPTZ,       -- soft delete
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_chat_event ON chat_messages(event_id, created_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_chat_author ON chat_messages(author_id);

-- 채팅 읽음 상태
CREATE TABLE chat_read_status (
  event_id BIGINT NOT NULL REFERENCES calendar_events(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  last_read_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (event_id, user_id)
);

-- 푸시 구독
CREATE TABLE push_subscriptions (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  device_label TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_push_user ON push_subscriptions(user_id);

-- 알림 (사용자별 알림함)
CREATE TABLE notifications (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,           -- 'notice' | 'event_change' | 'comment' | 'mention' 
                                -- | 'chat' | 'service_started' | 'service_ended'
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  related_id BIGINT,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_notif_user ON notifications(user_id, is_read, created_at DESC);

-- 알림 설정 (사용자별)
CREATE TABLE notification_preferences (
  user_id BIGINT PRIMARY KEY REFERENCES app_users(id) ON DELETE CASCADE,
  push_new_notice BOOLEAN DEFAULT TRUE,
  push_event_change BOOLEAN DEFAULT TRUE,  -- 새 일정 X, 변경만
  push_comment BOOLEAN DEFAULT TRUE,
  push_chat BOOLEAN DEFAULT TRUE,
  push_mention BOOLEAN DEFAULT TRUE,
  dnd_enabled BOOLEAN DEFAULT TRUE,
  dnd_start TIME DEFAULT '22:00',
  dnd_end TIME DEFAULT '07:00',
  dnd_silent BOOLEAN DEFAULT TRUE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 봉사 로그 (감사 로그)
CREATE TABLE service_logs (
  id BIGSERIAL PRIMARY KEY,
  session_id BIGINT REFERENCES service_sessions(id),
  event_id BIGINT REFERENCES calendar_events(id),
  card_id BIGINT REFERENCES cards(id),  -- 카드 직접 참조 (필터 정확성)
  actor_id BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  actor_name TEXT NOT NULL,     -- snapshot
  action TEXT NOT NULL,         -- 'session_started', 'joined', 'visit_recorded', 'memo_added', 'message_deleted', etc.
  target_type TEXT,             -- 'unit' | 'building' | 'message' | 'memo' (의미 명확)
  target_id BIGINT,
  details JSONB,                -- 추가 정보 (방문 결과, 메모 원문, 삭제된 메시지 원문 등)
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_log_session ON service_logs(session_id, created_at);
CREATE INDEX idx_log_event ON service_logs(event_id, created_at);
CREATE INDEX idx_log_card ON service_logs(card_id, created_at);
CREATE INDEX idx_log_actor ON service_logs(actor_id);
```

**기존 테이블 수정 (점진적, 호환성 유지):**

기존 `visit_histories.visitor`, `service_sessions.user_name` 등은 **그대로 두고**,
신규 테이블만 user_id 패턴 적용. 기존 마이그레이션 부담 X.

### 사진 만료 처리

```sql
-- Cron Edge Function (매일 새벽 3시):
-- 1. chat_messages에서 6개월 지난 image_url 찾기
-- 2. Storage에서 파일 삭제
-- 3. 메시지 UPDATE: image_url = NULL, image_expired = TRUE
-- 4. 클라이언트는 image_expired = TRUE 시 "[사진 만료됨]" 표시
```

### Supabase Storage Bucket

```
chat-images/        # 채팅 사진
  ├ event_{id}/
  │   ├ {uuid}.jpg
  │   └ ...
```

**출시 단계 정책 (V1):**
- anon insert 허용 (Supabase Auth 미사용)
- 앱단에서 채팅방 참여자만 업로드 버튼 노출 (UI 차단)
- 외부 직접 업로드 가능 위험 → 80명 내부라 감수
- 자동 압축 (1MB, 1280px) 후 업로드
- 6개월 후 자동 삭제 (Cron + Edge Function)

**중장기 (안정화 후):**
- `createSignedUploadUrl` RPC로 서명된 URL 발급 → 직접 업로드
- 권한 검증 (RPC 안에서 채팅방 참여 확인)
- Storage 정책 = 서명된 URL만 허용
- 업로드 실패 시 재시도 (최대 3회)

### 민감 로그 보안 (RPC로 감싸기)

**문제:**
- service_logs.details에 메모 원문, 삭제된 메시지 원문 등 민감 정보
- anon 키로 직접 SELECT 가능 → 보안 위험

**해결: RPC로 조회 감싸기**

```sql
-- 1. service_logs 직접 SELECT 차단
REVOKE SELECT ON service_logs FROM anon, authenticated;

-- 2. 권한 체크된 RPC 함수만 허용 (토큰 검증)
CREATE OR REPLACE FUNCTION get_service_logs(
  p_token UUID,                              -- ← 토큰
  p_filter_event_id BIGINT DEFAULT NULL,
  p_filter_card_id BIGINT DEFAULT NULL,
  p_limit INT DEFAULT 100
) RETURNS SETOF service_logs AS $$
DECLARE
  v_user_id BIGINT;
  v_role TEXT;
BEGIN
  -- 1. 토큰 검증 → user_id 추출
  v_user_id := verify_session(p_token);
  
  -- 2. 권한 확인
  SELECT role INTO v_role FROM app_users WHERE id = v_user_id;
  
  IF v_role NOT IN ('leader', 'admin', 'developer') THEN
    RAISE EXCEPTION '권한 없음';
  END IF;
  
  -- 3. 조회 (card_id 컬럼으로 필터)
  RETURN QUERY
  SELECT * FROM service_logs
  WHERE (p_filter_event_id IS NULL OR event_id = p_filter_event_id)
    AND (p_filter_card_id IS NULL OR card_id = p_filter_card_id)
  ORDER BY created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_service_logs TO anon;
```

**INSERT도 RPC + 토큰:**
```sql
CREATE OR REPLACE FUNCTION log_service_action(
  p_token UUID,                  -- ← 토큰
  p_session_id BIGINT,
  p_event_id BIGINT,
  p_card_id BIGINT,
  p_action TEXT,
  p_target_type TEXT,
  p_target_id BIGINT,
  p_details JSONB
) RETURNS BIGINT AS $$
DECLARE
  v_actor_id BIGINT;
  v_actor_name TEXT;
  v_log_id BIGINT;
BEGIN
  -- 토큰 → user_id
  v_actor_id := verify_session(p_token);
  SELECT name INTO v_actor_name FROM app_users WHERE id = v_actor_id;
  
  INSERT INTO service_logs (
    session_id, event_id, card_id,
    actor_id, actor_name,
    action, target_type, target_id, details
  ) VALUES (
    p_session_id, p_event_id, p_card_id,
    v_actor_id, v_actor_name,
    p_action, p_target_type, p_target_id, p_details
  )
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION log_service_action TO anon;
```

### 인증 방식 (출시 단계 / 중장기 계획)

**현 상태:**
- 자체 PIN 인증 (`auth_login` RPC + localStorage 세션)
- Supabase Auth 미사용
- DB는 anon open access (RLS 거의 없음)

**출시 단계 — 클라이언트 필터링:**
- DB는 그대로 anon open
- 클라이언트가 모든 권한 체크 + 데이터 필터링
- 80명 내부 / URL 비공개 / 의도적 공격 가능성 낮음 → 충분
- 보안 약점: 개발자도구로 anon 키 알아내면 우회 가능 (의도적 공격만)

**중장기 (별도 페이즈):**
- Supabase Auth 마이그레이션
- 사용자에게 새 인증 방식 안내
- 진짜 RLS 정책 적용
- 시기: V1+ 출시 안정화 후 (3~6개월)

### 봉사자 카드 제한 (클라이언트 필터링)

**현실적 보안 모델:**
- V1은 자체 PIN 인증 (Supabase Auth 미사용)
- → 진짜 RLS 구현 어려움 (current_user_name() 정의 X)
- → **클라이언트 레벨 필터링** + 서버는 무방비

**전략:**
- 80명 내부 사용 + URL 비공개 + 의도적 공격 가능성 낮음
- 클라이언트가 봉사자 권한 체크하고 필터링
- 일반 사용자가 우회하기 어려운 정도면 OK
- **진짜 RLS는 추후 Supabase Auth 마이그레이션 시**

**구현:**
```typescript
// useStore.ts 또는 hooks/usePermissions.ts
function useVisibleCards(role: Role, mode: 'normal' | 'volunteer'): TerritoryCard[] {
  const { cards, currentUserName, serviceSessions } = useStore()
  
  // 인도자/관리자 + 일반 모드 → 모든 카드
  if ((role === 'leader' || role === 'admin') && mode === 'normal') {
    return cards
  }
  
  // 봉사자 또는 인도자 봉사자 모드 → 자기 참여 카드만
  const myCardIds = new Set(
    serviceSessions
      .filter(s => s.userName === currentUserName)
      .filter(s => isWithinDays(s.serviceDate, 7))
      .map(s => s.primaryCardId)
      .filter(Boolean)
  )
  
  return cards.filter(c => myCardIds.has(c.id))
}
```

**적용 위치:**
- `useVisibleCards()` 훅 → 모든 카드 목록 사용처에서
- `useVisibleBuildings(cards)` → 건물도 동일
- `useVisibleVisitHistories(buildings)` → 방문 기록도 동일

**라우트 가드:**
- 봉사자가 다른 카드 URL 직접 접근 시 → 홈으로 리다이렉트 (404 또는 권한 없음)

### 알림 발송 메커니즘

```sql
-- 1. 댓글 생성 시 트리거
CREATE OR REPLACE FUNCTION notify_on_comment()
RETURNS TRIGGER AS $$
DECLARE
  v_target_author_id BIGINT;
  v_recipient_ids BIGINT[];
BEGIN
  -- 게시물 작성자 ID 조회
  v_target_author_id := get_target_author_id(NEW.target_type, NEW.target_id);
  
  -- 본인 알림 제외
  v_recipient_ids := array_remove(
    NEW.mention_ids || ARRAY[v_target_author_id],
    NEW.author_id
  );
  
  -- notifications 테이블에 INSERT (RPC로 감싼 함수 호출)
  PERFORM insert_notifications(
    p_user_ids := v_recipient_ids,
    p_type := 'comment',
    p_title := '새 댓글',
    p_body := NEW.author_name || ': ' || LEFT(NEW.content, 50),
    p_link := CASE NEW.target_type
      WHEN 'notice' THEN '/notices/' || NEW.target_id
      WHEN 'calendar_event' THEN '/calendar/events/' || NEW.target_id
    END,
    p_related_id := NEW.id
  );
  
  -- 푸시 발송 (Edge Function)
  PERFORM net.http_post(
    url := 'https://xxx.supabase.co/functions/v1/send-push',
    headers := '{"Authorization": "Bearer xxx"}',
    body := json_build_object(
      'recipient_ids', v_recipient_ids,
      'type', 'comment',
      'title', '새 댓글',
      'body', NEW.author_name || ': ' || LEFT(NEW.content, 50),
      'link', CASE NEW.target_type
        WHEN 'notice' THEN '/notices/' || NEW.target_id
        WHEN 'calendar_event' THEN '/calendar/events/' || NEW.target_id
      END
    )::text
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_comment_insert
  AFTER INSERT ON comments
  FOR EACH ROW EXECUTE FUNCTION notify_on_comment();
```

같은 패턴으로:
- chat_messages INSERT → 채팅 참여자에게
- calendar_events UPDATE (시간/장소) → 참여자에게
- notices INSERT → 모든 사용자에게

**Edge Function (send-push):**
- recipients 배열 받음
- 각 사용자의 push_subscriptions 조회
- 방해금지 시간 체크 (있으면 silent: true)
- Web Push 발송

### 채팅방 잠금 (조회 시 계산, service_sessions.ended_at 기준)

**기준 통일: `service_sessions.ended_at` 사용**
- `calendar_events.endedAt`은 일정 자체의 종료 시각 (모호)
- `service_sessions.ended_at`은 **실제 봉사 종료 시각** (명확)
- 일정 등록만 되고 봉사 시작 안 한 경우 = service_session 없음 = 잠금 X (계속 활성)
- 봉사 시작 후 종료 = ended_at 설정됨 = 1주 후 잠금

```typescript
// 클라이언트 — 다중 세션 처리 (한 일정에 여러 세션 가능)
function isChatLocked(eventId: number, sessions: ServiceSession[]): boolean {
  const eventSessions = sessions.filter(s => s.calendarEventId === eventId)
  
  // 봉사 안 한 일정 (세션 0개) → 채팅방 항상 활성
  if (eventSessions.length === 0) return false
  
  // 진행 중인 세션 있음 → 활성
  const allEnded = eventSessions.every(s => s.endedAt !== null)
  if (!allEnded) return false
  
  // 모든 세션 종료됨 → 가장 마지막 ended_at + 7일
  const latestEnded = Math.max(
    ...eventSessions.map(s => new Date(s.endedAt!).getTime())
  )
  const lockTime = new Date(latestEnded)
  lockTime.setDate(lockTime.getDate() + 7)
  return new Date() > lockTime
}
```

**서버 RPC도 같은 로직:**
```sql
-- 모든 세션 종료된 시점부터 7일
SELECT MAX(ended_at) INTO v_last_ended
FROM service_sessions
WHERE calendar_event_id = p_event_id
  AND ended_at IS NOT NULL;

-- 진행 중 세션 있으면 NULL 반환 → 활성
SELECT EXISTS(
  SELECT 1 FROM service_sessions
  WHERE calendar_event_id = p_event_id AND ended_at IS NULL
) INTO v_has_active;

IF v_has_active THEN
  -- 활성, 잠금 X
  RETURN;
END IF;

IF v_last_ended IS NOT NULL AND v_last_ended < NOW() - INTERVAL '7 days' THEN
  RAISE EXCEPTION '채팅방이 잠겼습니다 (모든 세션 종료 후 1주일 경과)';
END IF;
```

```sql
-- 서버 RPC: 위 세션 토큰 섹션의 send_chat_message(p_token, ...) 와 동일
-- + 다중 세션 잠금 로직은 다음 코드 블록 참고
```

**일정에 봉사 안 한 경우 (service_session 없음):**
- 채팅방 항상 활성 (잠금 X)
- 메시지 자유롭게 작성 가능
- 단, "봉사 종료" 시스템 메시지는 안 옴 (당연)

### 자동 정리 Edge Function

```sql
-- 6개월 지난 사진 삭제 (매일 새벽 3시)
-- supabase/functions/cleanup-chat-images/

-- 종료 후 1주일 지난 채팅 read-only 마킹 (매일 새벽 3시) ← 안 함, 조회 시 계산
```

---

## 5. 헤더 패턴 명세

### 모바일

```
모든 화면 상단:
─────────────────────────────────────
[<] 페이지명               🔔(●)  💬(●)  ⋮
─────────────────────────────────────

좌:  뒤로가기 (필요한 경우만)
중:  현재 페이지 이름 (홈은 페이지명 + 날짜)
우:  알림 / 채팅 / 메뉴
```

각 아이콘 동작:
- **🔔 알림** — 알림 센터 슬라이드업, 배지로 미읽음 표시
- **💬 채팅** — 채팅 목록 슬라이드업, 배지로 미읽음 표시
- **⋮ 메뉴** — 페이지별 추가 액션 (편집, 공유 등)

**검색은 안 만듦** (필요해지면 그때 추가)

### PC

```
상단 nav bar:
─────────────────────────────────────
[로고] [홈] [캘린더] [구역] ...        🔔(●) 💬(●) [👤김철수 ▾]
─────────────────────────────────────
```

### 기존 화면에서 정리 필요

헤더 통일하면서 각 화면에서 중복되는 부분 제거:
- **DesktopHome**: 우상단 사용자 정보 → 헤더로 이동
- **DesktopCalendar**: 알림 아이콘 (있다면) 제거
- **MobileHome**: 우상단 사용자 정보 → 헤더로
- **MobileNotices**: 헤더 통일
- 등등

→ 헤더 컴포넌트 만든 후 각 화면에서 중복 정리 (1~2일 추가 작업)

---

## 5-A. 와이어프레임 (모바일 봉사자)

### 5-A-1. 모바일 홈 (헤더 + 날짜 통합 64px)

```
─────────────────────────────────────
🏠 홈                         🔔 💬 ⋮
   2026년 5월 10일 (일)        (3) (2)
─────────────────────────────────────

[특별봉사 시즌 배너 (있을 때만)]

🎯 오늘 봉사                 전체보기 ›
─────────────────────────────────
17:00  마평동 2 · 4명 ✓          ▴
       인도자 김철수
       👥 김철수, 박영희, 이민수
          외 1명
       💬 새 메시지 3개
       [봉사 시작 ▸]
─────────────────────────────────

📢 새 공지 (1)              전체보기 ›
─────────────────────────────────
[공지] 5월 특별 봉사 안내      04/30
김철수 · 댓글 5
─────────────────────────────────

💬 활성 채팅 (2)             전체보기 ›
─────────────────────────────────
5/5 마평동 봉사            [3]🔴
4명 참여 · 새 메시지 3
                      오후 5:02

5/3 김량장 봉사            ✓
                          5/3
─────────────────────────────────

─────────────────────────────────────
홈   캘린더   나의봉사   설정    ← 봉사자 4탭
─────────────────────────────────────
```

### 5-A-2. 시간슬롯 펴짐 로직 (오늘 봉사 카드)

**우선순위:**
1. 사용자가 직접 토글 → 그 상태 유지 (당일)
2. 현재 진행 중인 봉사 → 펴짐
3. 다음에 시작할 봉사 → 펴짐
4. 다 끝났으면 → 가장 마지막 봉사 펴짐 (회고용)

**예시 — 오후 1:00 봉사 (1:00~3:00) + 오후 3:30 봉사 (3:30~5:30):**

| 현재 시간 | 펴짐 |
|---|---|
| 12:30 | 1시 봉사 (다음) |
| 1:00 | 1시 봉사 (진행중) |
| 2:00 | 1시 봉사 (진행중) — 3:30 가까워도 1시 진행중이라 1시 유지 |
| 3:00 | 3:30 봉사 (1시 끝, 곧 시작) |
| 3:30 | 3:30 봉사 (진행중) |
| 5:30 | 3:30 봉사 (방금 끝남, 회고용) |
| 다음날 | 다음날 첫 봉사 펴짐, 사용자 토글 초기화 |

**사용자 토글:**
- 자동 펴진 거 접으면 → 자동 다른 거 안 펴짐 (의도 존중)
- 두 개 다 펴면 → 둘 다 유지
- 페이지 새로고침 → 토글 상태 유지 (당일)
- localStorage 기반

### 5-A-3. 빈 상태 (오늘 봉사 없음)

```
🎯 오늘 봉사
─────────────────────────────────
   [📅 아이콘]
   오늘 예정된 봉사가 없습니다
   
   [캘린더에서 다음 봉사 보기 ▸]
─────────────────────────────────
```

### 5-A-4. 일정 상세 (참여 + 채팅)

```
─────────────────────────────────────
< 일정 상세                  🔔 💬  ⋮
─────────────────────────────────────

📅 4월 30일 (목) 10:00
[봉사 모임]

봉사 모임 제목 (있다면)
─────────────────────────────────
📍 경희대 앞
👤 인도자: 장웅
💬 줌: 888 8888 8888 (비번 3941)

[참여 ✓]   ← 누르면 토스트: "채팅방 입장됨 [열기]"

👥 참여 5명
[관리자] [사용자1] [사용자5] [사용자2] [장웅]

╔═══════════════════════════════════╗
║ 💬 봉사 채팅방                     ║
║ 5명 참여 · 새 메시지 3             ║
║              [채팅방 열기 ▸]      ║
╚═══════════════════════════════════╝

─────────────────────────────────
📝 댓글 0
─────────────────────────────────
[댓글 입력...]
```

**핵심 변경:**
- "신청" → "참여"
- 미리보기 메시지 X
- 채팅방 진입 카드 (작게)
- 댓글 영역 추가

### 5-A-5. 채팅방

```
─────────────────────────────────────
< 5/5 마평동 봉사                  ⋮
  참여자 4명 ▾                      
─────────────────────────────────────

[김철수님이 합류했습니다]
                        오후 4:25

김철수                       오후 4:30
오늘 5시 정문에서 모여요

                  도착했어요!     박영희
                              오후 4:55

[봉사 시작됨]
                        오후 5:00

이민수                       오후 5:02
저 좀 늦어요 5분만

[정수진님이 합류했습니다]
                        오후 5:07

정수진                       오후 5:08
@김철수 어디 계세요?
       ↑ 멘션 강조

──────── 오후 6:30 ────────

[사진 1장]
                        박영희 오후 6:30

[봉사 종료]
방문 8세대 / 만남 1 / 부재 7
                        오후 7:00

─────────────────────────────────────
[메시지 입력...]            📷  ➤
─────────────────────────────────────
```

**메시지 우상단 ⋮ (누르면):**
- 복사
- 삭제 (본인만, 5분 이내)

**채팅방 ⋮ 메뉴:**
- 참여자 보기
- 사진 모아보기
- 알림 끄기
- (인도자/관리자) 채팅방 삭제

(채팅방 나가기 X — 일정 참여 취소는 일정 상세에서)

### 5-A-6. 알림 센터 (헤더 🔔)

```
헤더 🔔 누르면 슬라이드 다운:
─────────────────────────────────────
🔔 알림 (8)        [모두 읽음] [×]
─────────────────────────────────────

📌 새 알림

🔴 박영희님이 회원님을 언급했습니다
   "@김철수 105호 정보 확인해주세요"
   5/5 마평동 채팅 · 5분 전
   
🔴 새 공지: "5월 특별 봉사 안내"
   김철수 (관리자) · 30분 전
   
🔴 일정 변경: 5/8 김량장 봉사 시간이 18:00으로 변경
   이민수 · 1시간 전

────── 이전 알림 ──────

⚪ 정수진님이 회원님 댓글에 답글
   5월 봉사 안내 공지 · 5/4

⚪ 5/3 김량장 봉사 채팅 (3개)
   ← 묶음 알림 예시
   5/3

─────────────────────────────────────
            [모든 알림 보기]
─────────────────────────────────────
```

### 5-A-7-pre. 캘린더 (월뷰)

**기존 V1 캘린더 그대로 사용 + 헤더 통합 + 작은 변경만**

```
─────────────────────────────────────
< 캘린더                      🔔 💬 ⋮  ← 페이지 헤더 추가
─────────────────────────────────────
   ◀  2026년 5월  ▶          오늘    ← 기존 캘린더 컨트롤
─────────────────────────────────────
일  월  화  수  목  금  토
            1   2
            ●
3   4   5   6   7   8   9
                    ●
🔴10  11  12  13  14  15  16
↑오늘
─────────────────────────────────────
5월 10일 (일요일)            + 일정 추가
─────────────────────────────────────
17:00 ✓                  [봉사모임]   ← ✓ 본인 참여
오후
📍 용인왕국회관  👤 오세창
👥 참여 2명             [참여 취소]   ← 신청 → 참여
[오세창] [장웅]

╔══════════════════════════════════╗
║ 💬 봉사 채팅방                   ║   ← 참여한 일정만
║ 새 메시지 3 · [열기 ▸]           ║
╚══════════════════════════════════╝
─────────────────────────────────────
```

**변경 사항:**
- 페이지 헤더 추가 (🔔 💬 ⋮)
- "신청" → "참여" 용어 통일
- 본인 참여 일정: ✓ + 옅은 파랑 배경
- 참여한 일정에만 채팅방 진입 카드
- [+ 일정 추가] 버튼: 날짜 옆 (기존) + 헤더 ⋮ 메뉴 양쪽

**유지:**
- 월뷰 그대로 (월/주/일 토글 X)
- 점 표시, 오늘 강조, 좌우 화살표, "오늘" 버튼
- 일정 카드 정보 (시간/제목/장소/인도자/설명/인원/참여자)
- 시간슬롯 이모지 X (시간만)
- 과거 일정 별도 표시 X
- 목록 뷰 X (첫 버전)

### 5-A-7-2. 봉사 진행 화면

**기존 V1 MobileMap 그대로 + 봉사 컨텍스트 헤더 + 자기 카드 한정**

```
─────────────────────────────────────
< 마평동 2 봉사       🔔 💬(3) ⋮
  김철수, 박영희, 이민수 외 1명
  진행 1시간 32분 · 8/24 (33%)
─────────────────────────────────────

[지도 영역 — 기존 V1 그대로]
  - 카드 영역만 표시 (다른 카드 X)
  - 구역선
  - 건물 마커 (방문 상태 색)
  - 본인 위치 (선택, 토글)

┌─────────────────────────────────┐ ← 시트 (드래그)
│ ─── (드래그 핸들)                │
│ 마평동길 12 (8세대 · 2/8) ▼      │
│ 101 ✓ 만남     (오늘 17:15)      │
│ 102 ─ [+ 기록]                   │
│ ...                              │
│ 마평동길 14 (16세대 · 0/16) ▼    │
└─────────────────────────────────┘
```

**헤더 ⋮ 메뉴:**
```
─────────────────
참여자 보기 (4명)
지도 / 시트 토글
채팅 알림 끄기
본인 위치 표시 (토글)
───
[봉사 종료]   ← 누구나, 전체 종료 (확인 모달)
─────────────────
```

**봉사 종료 확인 모달:**
```
─────────────────────────
봉사 종료할까요?

방문 8세대
- 만남 1건
- 부재 7건
- 시간 1시간 32분 (지금까지)

⚠️ 4명 모두 봉사가 종료됩니다
   (5분 이내 다시 시작 가능)

[취소]  [종료]
─────────────────────────
```

**봉사 종료 직후 — 5분 재개 가능:**
```
─────────────────────────
✓ 봉사 종료됨
방문 8세대 / 만남 1 / 부재 7
시간 1시간 32분

[ 4분 50초 안에 종료 취소 가능 ]
[봉사 재개]
─────────────────────────
```

**중요 변경 (V1 대비):**
- 봉사자는 자기 카드만 (다른 카드 진입 X)
- 봉사자 하단 nav: 5탭 → 4탭 (지도 탭 제거)
- 헤더에 봉사 컨텍스트 (참여자, 시간, 진행률)
- 채팅방 빠른 진입 (헤더 💬 배지)
- [봉사 종료] 누구나 (확인 모달로 안전장치)

**유지 (V1 동일):**
- 지도 + 하단 시트 구조
- 호수 기록 인터랙션
- UnitSlotGrid (호수 상세 시간슬롯 매트릭스)
- 메모, 사진, 정기방문 등 모든 기능

---

### 5-A-7-3. 봉사 종료 요약 화면

봉사 종료 + 확인 모달 후 자동 진입.

```
─────────────────────────────────────
✓ 봉사 종료
─────────────────────────────────────

         🎉
    수고하셨어요!

─────────────────────────────────
 마평동 2 봉사
 5월 5일 (월) · 1시간 32분

 ┌──────────┬──────────┬──────────┐
 │    8     │    1     │    7     │
 │   방문   │   만남   │   부재   │
 └──────────┴──────────┴──────────┘
 
 함께한 봉사자
 김철수, 박영희, 이민수, 정수진
─────────────────────────────────

[💬 채팅방]   [🏠 홈으로]

────── 잘못 누르셨나요? ──────
[ 봉사 재개 (4분 50초) ]
─────────────────────────────────────
```

**핵심:**
- 격려 (🎉 수고하셨어요)
- 이번 봉사 통계만 (방문/만남/부재)
- 함께한 봉사자 이름
- 누적 통계 X (필요 시 [나의봉사]에서)
- 다음 행동: 채팅방 / 홈
- 봉사 재개 카운트다운 5분

---

### 5-A-8. 채팅 목록 (헤더 💬)

```
─────────────────────────────────────
💬 채팅                          [×]
─────────────────────────────────────

🟢 활성 (참여 중)
─────────────────────────
5/5 (토) 마평동 봉사       [3]🔴
4명 참여 · 새 메시지 3
                      오후 5:02

5/8 (화) 김량장 봉사
3명 참여 · 새 메시지 1
                      오후 2:15

────── 종료 ──────
✓ 5/3 (목) 김량장 봉사
                          5/3

✓ 5/1 (화) 마평동 봉사
                          5/1
─────────────────────────────────────
```

**핵심: 메시지 미리보기 X (사생활 + 깔끔)**

---

## 6. 댓글 시스템 명세

### 화면

```
공지 상세 / 일정 상세 화면 하단:
─────────────────────────
📝 댓글 5

박영희 · 2시간 전
잘 다녀오겠습니다!
                    [수정] [삭제]

김철수 · 1시간 전
@박영희 시간 맞춰서 출발하겠습니다
                    [수정] [삭제]
─────────────────────────
[댓글 입력...] [@] [등록]
```

### @멘션 UX
- `@` 입력 → 자동완성 드롭다운 (사용자 명단)
- 멘션 받은 사람에게 알림 발송
- 본인 멘션은 강조 표시

### 권한
- 작성: 누구나 (로그인된 사용자)
- 수정/삭제: 본인만
- 인도자/관리자: 부적절 댓글 삭제 가능

---

## 7. 일정별 채팅방 명세

### 채팅방 화면

```
─────────────────────────────────────
[<] 5/5 (토) 마평동 봉사     🔍 ⋮
    참여자 4명 ▾
─────────────────────────────────────

[김철수님이 합류했습니다]
                   오후 4:55

김철수                     오후 4:30
오늘 5시 정문에서 모여요

                 도착했어요!     박영희
                              오후 4:55

이민수                     오후 5:02
저 좀 늦어요 5분만

[사진 1장]
                   오후 5:30
                              
[봉사 종료]
방문 8세대 / 만남 1 / 부재 7
                   오후 7:00

─────────────────────────────────────
[메시지 입력...]            📷  ➤
─────────────────────────────────────
```

### 채팅방 메뉴 (⋮)
- 참여자 보기
- 사진 모아보기
- 알림 끄기 (방마다)
- (인도자/관리자만) 채팅방 삭제

(채팅방 나가기 X — 일정 참여 취소는 일정 상세에서 [참여 취소])

### 시스템 메시지 (5종)

| 트리거 | 메시지 |
|---|---|
| 사용자 합류 | "{이름}님이 합류했습니다" |
| 봉사 시작 | "봉사 시작됨 (오후 5:00)" |
| 봉사 종료 | "[봉사 종료] 방문 N세대 / 만남 X / 부재 Y" |
| 인도자 변경 | "인도자 변경: {기존} → {신규}" |
| 일정 시간/장소 변경 | "일정 변경: {변경 내용}" |

(메시지 삭제, 사진 첨부 등은 시스템 메시지 X — 너무 시끄러움)

### 사진 첨부 흐름

```
📷 → 갤러리 / 카메라 선택
    → 자동 압축 (max 1MB, 1280px)
    → Supabase Storage 업로드
    → 메시지로 전송
    
6개월 후:
    → 사진 자동 삭제
    → 메시지에 "[사진 만료됨]" 표시
```

### 봉사 종료 후 흐름

```
봉사 종료 누름
   ↓
1주일간 활성 (회고용 메시지, 알림 옴)
   ↓
1주일 후: read-only
   - 보기는 가능
   - 메시지 작성 불가
   - 사진 다운로드 가능
   ↓
사진 6개월 후 자동 삭제
텍스트는 영구 보존
```

---

## 8. 푸시 알림 명세

### 발송 트리거

| 상황 | 받는 사람 | 알림 종류 |
|---|---|---|
| 새 공지 등록 | 모든 사용자 | `notice` |
| ~~새 일정 등록~~ | ❌ 알림 안 함 (일정 추가/삭제 잦음) | - |
| 일정 시간/장소 변경 | 일정 참여자 | `event_change` |
| 공지/일정에 댓글 | 작성자 + 멘션받은 사람 | `comment` |
| 채팅 새 메시지 | 채팅방 참여자 (본인 제외) | `chat` |
| @멘션 (댓글/채팅) | 멘션받은 사람 | `mention` |
| 봉사 시작 | 채팅방 참여자 | `service_started` (시스템) |
| 봉사 종료 | 채팅방 참여자 | `service_ended` (시스템) |

### 알림 묶음 (Bundle)

**원칙: 첫 알림은 즉시, 5분 내 추가는 silent**

```
타임라인:
00:00  박영희 메시지 → 🔔 즉시 푸시 (sound, vibration)
00:30  김철수 메시지 → silent push (DB 누적, sound X)
02:00  이민수 메시지 → silent push (DB 누적)
                      
사용자 화면에서 보면:
🔔 5/5 마평동 봉사 채팅 (3개 새 메시지)
   박영희, 김철수, 이민수

5분 후 (00:00 알림 기준):
05:01 정수진 메시지 → 🔔 다시 즉시 푸시 (새 윈도우 시작)
```

**구현:**
- `notifications` 테이블에 항상 INSERT
- 푸시 발송 시 같은 `(user_id, type, related_id)`에 5분 내 알림 있으면 silent 플래그
- 클라이언트에서 묶어서 표시

### 채팅 읽음 처리

**언제 last_read_at 갱신?**
- 채팅방 진입 즉시 (배지 0으로)
- 채팅방 이탈 시 한 번 더 (안전)
- 새 메시지 도착 시 화면 보고 있으면 즉시 갱신

```typescript
// 진입
useEffect(() => {
  updateLastRead(eventId, currentUserId)
}, [eventId])

// 이탈 (cleanup)
useEffect(() => {
  return () => {
    updateLastRead(eventId, currentUserId)
  }
}, [eventId])

// 새 메시지 + 화면 활성
useEffect(() => {
  if (document.hidden) return  // 백그라운드면 X
  updateLastRead(eventId, currentUserId)
}, [messages])
```

### 본인 알림 제외 원칙

- 본인이 본인 게시물에 댓글 → 알림 X
- 본인이 본인 채팅방에 메시지 → 알림 X (당연)
- 본인이 본인 멘션 → 알림 X

```sql
-- 알림 발송 트리거에서:
WHERE recipient_id <> NEW.author_id
-- 또는 array_remove(recipients, NEW.author_id) 같은 형태로
```

### 방해금지 동작

```
22:00 ~ 07:00 (사용자 설정):
  - 알림 자체는 도착 (DB에 기록)
  - 푸시 sound/vibration 없음
  - 배지로만 표시
  - 핸드폰 켜면 알림 센터에서 확인 가능
  
멘션도 동일 (긴급 X)
```

### PWA 설치 필요성 (iOS)

```
iOS 16.4+ Safari에서:
  - PWA 설치 안 하면 푸시 알림 0%
  - 첫 방문 시 안내 배너로 설치 유도
  
Android Chrome:
  - 설치 안 해도 푸시 가능
  - 설치하면 더 빠르고 안정적
```

---

## 9. PWA 안내 명세

### 첫 방문 시 배너 (모바일)

```
페이지 진입 후 5초 경과 + 모바일 + PWA 미설치:

화면 하단에서 슬라이드업:
─────────────────────────────────────
📱 봉사 알림 받으시려면
   홈 화면에 추가해주세요

   [설치 안내 보기]   [나중에]
─────────────────────────────────────
```

### 설치 안내 모달

```
─────────────────────────────────────
앱 설치 안내

🍎 iPhone (Safari)
1. 하단 [공유] 버튼 탭
   [공유 아이콘 이미지]
2. "홈 화면에 추가" 선택
3. "추가" 탭

🤖 Android (Chrome)
1. 우상단 [⋮] 탭
2. "홈 화면에 추가"

[완료] [나중에]
─────────────────────────────────────
```

### 설정 메뉴에서 항상 접근 가능

```
설정 → 앱 설치 / 알림
─────────────────────────────────────
📱 앱 설치 상태
   ✅ 설치됨 (또는 ⚠️ 브라우저로 사용 중)
   [설치 안내]

🔔 알림 권한
   ✅ 허용됨 (또는 ❌ 거부됨)
   [브라우저 설정 열기]

알림 종류
☑ 새 공지
☑ 일정 변경 (시간/장소)
☑ 댓글
☑ 채팅 메시지
☑ @멘션
(새 일정 등록은 알림 안 옴 — 일정 잦음)

방해금지 시간
☑ 사용
시작: [22:00 ▾]
종료: [07:00 ▾]
●  무음 (배지로만)
○  완전 차단
─────────────────────────────────────
```

---

## 10. 봉사 로그 (관리자용)

### 화면

```
관리자 메뉴 → 봉사 로그
─────────────────────────────────────
[필터: 날짜 / 카드 / 봉사자 / 일정]
[CSV 다운로드]

📅 5/5 (토) 마평동 2 봉사
─────────────────────────────────────
17:00  ▶️ 봉사 시작 (인도자: 김철수)
17:02  ➕ 김철수 합류
17:04  ➕ 박영희 합류
17:08  ➕ 이민수 합류
17:15  📝 김철수 → 102호 부재 기록
17:20  ⭐ 박영희 → 105호 만남 기록
17:28  📝 김철수 → 107호 부재 기록
17:42  💬 메모 추가 - 105호 (김철수)
       "한국어 가능, 다음 주 다시 방문"
18:30  📷 채팅 사진 첨부 (이민수)
19:00  ⏹ 봉사 종료
       총 8세대 / 만남 1 / 부재 7

📅 5/5 (토) 김량장 봉사
─────────────────────────────────────
...
```

### 로그 항목

자동으로 service_logs에 기록되는 액션:
- `session_started` — 봉사 시작
- `joined` — 사용자 합류
- `left` — 사용자 이탈
- `visit_recorded` — 호수 방문 기록
- `visit_updated` — 방문 기록 수정
- `visit_deleted` — 방문 기록 삭제
- `memo_added` — 메모 추가
- `unit_flag_changed` — 호수 플래그 변경 (중국인/방문금지/정기방문)
- `building_added/updated` — 건물 추가/수정
- `chat_message` — 채팅 메시지 (요약)
- `chat_image` — 사진 첨부
- `session_ended` — 봉사 종료

---

## 10-A. 권한 / 개인정보 매트릭스

> 역할: **봉사자** / **인도자** / **관리자** / **개발자** (admin + 시스템 권한)
> 특수 상태: 승인대기 / 차단된 사용자

### 데이터 접근 권한

| 데이터 | 봉사자 | 인도자 | 관리자 | 개발자 |
|---|---|---|---|---|
| 본인 참여 봉사 채팅 (보기/쓰기) | ✅ | ✅ | ✅ | ✅ |
| 다른 팀 채팅 보기 | ❌ | ✅ (조용히) | ✅ | ✅ |
| 다른 팀 메시지 삭제 | ❌ | ✅ | ✅ | ✅ |
| 채팅방 삭제 | ❌ | ✅ | ✅ | ✅ |
| read-only 채팅 메시지 삭제 | ❌ | ✅ | ✅ | ✅ |
| read-only 채팅 보기 | 본인 참여 시 ✅ | ✅ | ✅ | ✅ |
| 본인 카드 호수 메모 | ✅ | ✅ | ✅ | ✅ |
| 다른 카드 호수 메모 | ❌ | ✅ | ✅ | ✅ |
| 본인 참여 봉사 방문 기록 | ✅ | ✅ | ✅ | ✅ |
| 다른 카드 방문 기록 | ❌ | ✅ | ✅ | ✅ |
| 봉사 로그 (감사) | ❌ | ✅ (자기 카드만) | ✅ (모든 봉사) | ✅ |
| CSV 다운로드 (봉사 로그) | ❌ | ✅ (자기 카드) | ✅ | ✅ |
| CSV에 메모 포함 | - | ✅ | ✅ | ✅ |
| 사용자 명단 보기 | 이름만 | 이름 + 폰 | 모두 (PIN 제외) | 모두 + 로그인 기록 |
| 공지 댓글 작성 | ✅ | ✅ | ✅ | ✅ |
| 일정 댓글 작성 (참여 무관) | ✅ (공개) | ✅ | ✅ | ✅ |
| 본인 댓글 수정/삭제 | ✅ (시간 제한 없음) | 동일 | 동일 | 동일 |
| 본인 채팅 메시지 삭제 | ✅ (5분 이내) | 동일 | 동일 | 동일 |
| 다른 사람 댓글 삭제 | ❌ | ✅ | ✅ | ✅ |
| 일정 추가/수정/삭제 | ❌ | ✅ | ✅ | ✅ |
| 일정 삭제 (채팅 함께 삭제) | - | ✅ | ✅ | ✅ |
| 공지 작성/삭제 | ❌ | ✅ | ✅ | ✅ |
| 봉사 종료 (전체 종료) | ✅ (참여자 누구나) | ✅ | ✅ | ✅ |
| 봉사 재개 (5분 이내) | ✅ (누구나) | ✅ | ✅ | ✅ |
| 다른 사용자 로그인 기록 조회 | ❌ | ❌ | ❌ | ✅ (개발자만) |

### 특수 상태 사용자

| 상태 | 진입 가능? | 비고 |
|---|---|---|
| **승인대기** (가입 신청 후 미승인) | 로그인 화면에 "승인 대기 중" 표시, 진입 X | 관리자가 승인해야 함 |
| **차단된 사용자** (관리자가 비활성화) | 로그인 자체 차단 | "비활성화된 계정" 안내 |
| **참여 취소한 사용자** | 채팅방 즉시 차단 | 과거 기록도 못 봄 |

### 참여 취소 / 일정 삭제 시 정책

- **참여 취소**: 채팅방에서 즉시 이탈, 더 이상 채팅 못 봄/못 씀 (24h read-only X)
- **일정 삭제**: 채팅방도 함께 삭제 (CASCADE)
  - 일정 삭제 시 확인 모달: "일정과 채팅 기록이 함께 삭제됩니다"
  - 봉사 로그(service_logs)에 액션 기록은 보존 (감사용)
  - 진짜 보존 필요하면 봉사 로그 CSV 다운로드 후 삭제

### 삭제·수정 보존 정책

| 액션 | 보존 방식 |
|---|---|
| 댓글 삭제 | soft delete (`deleted_at`), 화면엔 안 보임 / 봉사 로그엔 기록 |
| 메시지 삭제 | soft delete, 채팅에 "[메시지 삭제됨]" 표시 / 봉사 로그엔 원문 기록 |
| 일정 삭제 | hard delete (채팅 CASCADE로 함께 삭제) |
| 공지 삭제 | hard delete |
| 사용자 삭제 | author_id NULL, name snapshot 유지 |
| 사진 만료 (6개월) | Storage 삭제 + `image_expired = TRUE` / 메시지엔 "[사진 만료됨]" |

### 인도자/관리자 모니터링 표시

- 인도자/관리자가 봉사 외 채팅 볼 때 → **표시 X** (조용히)
- 일반 사용자가 모니터링 사실 모름
- 단, 메시지 삭제 시 → "관리자가 메시지를 삭제했습니다" 시스템 메시지

### 봉사자 인도자 모드 토글 시

- 인도자가 "봉사자 모드"로 전환하면:
  - 다른 카드 안 보임 (봉사자처럼 제한)
  - 모든 채팅 모니터링 권한 X
  - 자기 참여 봉사만 보임
- 다시 "인도자 모드"로 전환하면 권한 복구

---

## 11. 기존 화면 정리 필요 사항

헤더 패턴 도입하면서 중복 정리:

| 화면 | 제거할 것 | 헤더로 이동 |
|---|---|---|
| MobileHome | 우상단 사용자 카드 | 사용자 정보 → 헤더 ⋮ |
| DesktopHome | 우상단 알림 영역 | 알림 → 헤더 🔔 |
| MobileNotices | 자체 헤더 디자인 | 통일된 헤더 |
| DesktopCalendar | 일부 액션 버튼 | 헤더 ⋮ 또는 inline |
| 모든 페이지 | 다양한 헤더 스타일 | 통일 |

→ 헤더 컴포넌트 (`AppHeader.tsx`) 먼저 만들고 각 화면에 적용.

---

## 12. 작업 단계 (총 약 3주)

### Week 1: 기반 + 댓글 + 채팅 (핵심)

**Day 1~2: DB 스키마 + 세션 토큰 + 헤더**
- [ ] SQL 마이그레이션 파일 작성 + Supabase 적용
  - [ ] 신규 테이블 (auth_sessions, comments, chat_*, push_*, notifications, service_logs)
  - [ ] auth_login RPC 변경 (토큰 발급)
  - [ ] verify_session RPC
  - [ ] 모든 민감 RPC 토큰 검증 패턴 적용
  - [ ] REVOKE SELECT (auth_sessions, service_logs)
  - [ ] Cron: 만료 토큰 정리
- [ ] 클라이언트 useAuth 토큰 저장/관리 로직
- [ ] `AppHeader.tsx` 컴포넌트 (모바일/PC)
- [ ] 기존 화면에 헤더 적용 (점진적)

**Day 2~3: 댓글 시스템**
- [ ] `comments` 테이블 CRUD
- [ ] `CommentSection.tsx` 컴포넌트
- [ ] 공지/일정 상세 화면에 추가
- [ ] @멘션 자동완성
- [ ] 본인 댓글 수정/삭제

**Day 4~6: 일정별 채팅방**
- [ ] `chat_messages` 테이블 + Realtime 구독
- [ ] `ChatRoom.tsx`, `ChatList.tsx`
- [ ] 일정 등록 시 채팅방 자동 생성
- [ ] 참여자 자동 입장 / 권한 체크
- [ ] 사진 첨부 (Storage 업로드)
- [ ] 시스템 메시지 (합류/종료)
- [ ] 본인 메시지 삭제 (5분)
- [ ] 안 읽음 카운트
- [ ] 인도자 모니터링 + 삭제 권한

**Day 7: PWA 기본 설정**
- [ ] `manifest.json`, 아이콘
- [ ] Service Worker 등록
- [ ] PWA 설치 안내 배너
- [ ] 설치 안내 모달

### Week 2: 알림 시스템

**Day 8~10: 푸시 알림 인프라**
- [ ] VAPID 키 생성
- [ ] `push_subscriptions` 테이블
- [ ] 권한 요청 + 구독 등록
- [ ] Supabase Edge Function (push 발송)
- [ ] 토큰 만료 처리

**Day 11~12: 알림 트리거**
- [ ] 새 공지 → 모두에게 발송
- [ ] ~~새 일정 → 모두에게 발송~~ (안 함, 결정 변경)
- [ ] 일정 시간/장소 변경 → 참여자
- [ ] 댓글 → 작성자 + 멘션
- [ ] 채팅 → 참여자 (본인 제외)
- [ ] 멘션 → 해당 사람
- [ ] 봉사 시작/종료 시스템 메시지
- [ ] 알림 묶음 처리 (5분 윈도우)
- [ ] 방해금지 시간 체크

**Day 13: 알림 센터 + 설정**
- [ ] 헤더 🔔 → `NotificationCenter.tsx`
- [ ] 알림 목록 / 읽음 처리
- [ ] 설정 화면 (종류별 on/off, 방해금지)

**Day 14: 채팅 헤더 통합**
- [ ] 헤더 💬 → `ChatList.tsx` 모달
- [ ] 안 읽음 카운트 동기화
- [ ] 홈 화면 채팅 위젯

### Week 3: 봉사 로그 + 정리

**Day 15~16: 봉사 로그**
- [ ] `service_logs` 자동 기록 (각 액션 hook)
- [ ] `ServiceLogPage.tsx` (관리자 메뉴)
- [ ] 필터 / CSV 다운로드

**Day 17: 자동 정리 작업**
- [ ] Edge Function cron: 사진 6개월 삭제 + 메시지 `image_expired = TRUE` 업데이트
- [ ] ~~Edge Function cron: 채팅방 1주 후 read-only~~ (안 함, 조회 시 계산)

**Day 18~19: 기존 화면 정리**
- [ ] MobileHome 사용자 영역 → 헤더로
- [ ] DesktopHome 정리
- [ ] 헤더 패턴 모든 화면 적용
- [ ] 중복 UI 제거

**Day 20~21: 테스트 + 최적화**

플랫폼 테스트:
- [ ] iOS PWA 테스트
- [ ] Android PWA 테스트
- [ ] 알림 발송 테스트 (각 트리거)
- [ ] 채팅 Realtime 안정성
- [ ] 카드/지도 성능 점검

**권한 테스트 매트릭스:**
- [ ] 봉사자가 다른 카드 URL 직접 접근 → 차단 확인
- [ ] 봉사자가 다른 카드 API 직접 호출 → 결과 빈 배열 (필터링 동작)
- [ ] 비참여자가 채팅방 URL 직접 접근 → 차단
- [ ] 본인 아닌 메시지 삭제 시도 → 차단
- [ ] 본인 메시지 5분+ 후 삭제 시도 → 차단
- [ ] 인도자가 봉사자 모드일 때 다른 카드 안 보임
- [ ] 일반 봉사자가 [채팅방 삭제] 시도 → 메뉴 안 보임 (UI) + API 차단
- [ ] 잠긴 채팅방 (1주+)에 메시지 작성 → 거부
- [ ] 사용자 삭제 후 그 사람 댓글/메시지 → "[삭제된 사용자]" 또는 snapshot 이름 표시
- [ ] 만료된 사진 메시지 → "[사진 만료됨]" 표시

---

## 13. 단계별 출시

각 Week 끝나면 사용자 테스트 가능:

**Week 1 끝:** 댓글 + 채팅 + PWA 사용 가능
**Week 2 끝:** 알림 받기 시작
**Week 3 끝:** 정식 운영

각 단계마다 commit·push·배포 가능 (Vercel 자동).

---

## 14. 위험 / 대비

| 위험 | 대비책 |
|---|---|
| iOS PWA 설치 안 함 → 푸시 X | 첫 방문 안내 강화, 설정에서도 안내 |
| Supabase Realtime 끊김 | 폴백: 30초마다 polling |
| Push 인프라 장애 | 알림 누락, 다음 발송으로 회복 |
| 채팅 사진 용량 폭증 | 자동 압축 + 6개월 만료 |
| 알림 폭탄 | 묶음 처리 + 방해금지 |
| 부적절 메시지 | 인도자/관리자 삭제 권한 |

---

## 15. 비용

**초기 운영은 무료 범위 내 예상, 사용량 증가 시 재검토**

| 서비스 | 무료 한도 | 사용 예측 |
|---|---|---|
| Supabase DB | 500MB | 첫 1년 ~50MB (텍스트 위주) |
| Supabase Storage | 1GB | 채팅 사진 6개월 만료 → 유지 가능 |
| Supabase Realtime | 200 동시 연결 | 80명 회중 OK |
| Supabase Edge Functions | 500K 호출/월 | 알림 발송 트리거 충분 |
| Vercel | 100GB 대역폭 | OK |
| Push 알림 (Web Push) | 무료 | OK |

**모니터링 필요한 지표:**
- DB 크기 (월 단위)
- Storage 사용량 (사진 첨부 빈도에 따라)
- Edge Function 실행 횟수 (알림 발송)
- Realtime 동시 연결 수 (피크 시간)

**유료 전환 시점 (예상):**
- DB 400MB+ → 6개월 이상 후 채팅 메시지 누적 시
- Storage 800MB+ → 사진 첨부 매우 많을 시

진짜 한도 도달 시 Supabase Pro $25/월 ($25 × 12 = $300/년) 정도 검토.

---

## 16. 미결정 (나중에)

- 메시지 답장 (Reply) 기능 추가
- 1:1 메시지
- 메시지 검색 (전체)
- 사용자 신고 / 차단
- 알림 발송 통계 (관리자용)
- 자유 채팅방 (필요 시)
- 비공식 봉사 카드 시스템 (별도 작업)
- 식당 봉사 시스템 (별도 작업)

---

## 다음 액션

1. ✅ V2_PLAN.md → archive 이동
2. ✅ V1_ENHANCEMENT.md 작성 (이 문서)
3. 🔄 와이어프레임 작성 중 (섹션 5-A)
4. ⏭ DB 스키마 SQL 작성 + Supabase 적용
5. ⏭ AppHeader 컴포넌트 작성
6. ⏭ 댓글 시스템 구현
7. ⏭ 채팅 시스템 구현
8. ⏭ PWA + 푸시 알림
9. ⏭ 봉사 로그 + 정리

---

## 부록 A. 와이어프레임 진행 상태

### 모바일 봉사자
- ✅ 홈 (헤더 + 날짜 통합 64px)
- ✅ 시간슬롯 펴짐 로직
- ✅ 빈 상태
- ✅ 일정 상세 (참여 + 채팅 + 댓글)
- ✅ 채팅방
- ✅ 알림 센터 (헤더 🔔)
- ✅ 채팅 목록 (헤더 💬)
- ✅ 캘린더 (기존 월뷰 + 헤더만 추가)
- ✅ 봉사 진행 화면 (V1 지도+시트 + 헤더 강화)
- ✅ 봉사 종료 메커니즘 (전체 종료 + 5분 재개 + 24h 추가기록)
- ✅ 봉사 종료 요약 화면 (단순: 격려 + 봉사 통계 + 참여자)
- ⏭ PWA 설치 안내 모달

### 모바일 인도자
- ✅ 기존 V1 그대로 + 헤더 통일 (변경점 없음)

### 모바일 관리자
- ✅ 기존 V1 그대로 + 헤더 통일 (변경점 없음)

### PC (전체)
- ✅ 기존 V1 그대로 + 헤더 통일 (변경점 없음)
- ⏭ 봉사 로그 (관리자) — 새 화면
- ⏭ 알림 설정 — 새 화면 (모바일과 동일 형태)

### 새로 만들 화면 (전 사용자)
- ⏭ PWA 설치 안내 모달 (와이어프레임은 V1_ENHANCEMENT.md 9 섹션에 있음)
- ⏭ 봉사 로그 화면
- ⏭ 알림 설정 화면

---

## 부록 B. 결정 변경 이력

| 일자 | 항목 | 변경 내용 |
|---|---|---|
| 2026-05-05 | 헤더 + 날짜 분리 | → 통합 (184px → 64px) |
| 2026-05-05 | 시간슬롯 항상 표시 | → 등록된 일정만 동적 표시 |
| 2026-05-05 | 봉사 통계 홈에 표시 | → 빼고 나의봉사 탭 + 봉사 종료 화면 |
| 2026-05-05 | 채팅 미리보기 표시 | → 빼기 (사생활 + 깔끔) |
| 2026-05-05 | 신청 → 참여 용어 변경 | OK |
| 2026-05-05 | 일정 등록 시 알림 | → 안 함 (변경 잦음) |
| 2026-05-05 | 봉사 시작/종료 자동화 | → 명시적 버튼 둘 다 유지 |
| 2026-05-05 | 채팅방 = 모든 일정 | → "신청 받음" 체크된 일정만 |
| 2026-05-05 | 반복 일정 통합 채팅 | → 회차마다 따로 |
| 2026-05-11 | 캘린더 | 기존 월뷰 그대로 + 헤더만 추가 |
| 2026-05-11 | 캘린더 [+ 일정 추가] | 날짜 옆 + 헤더 ⋮ 양쪽 |
| 2026-05-11 | 시간슬롯 이모지 | 안 넣음 (시간만 표시) |
| 2026-05-11 | 과거 일정 회색 + 통계 | 안 함 (기본 카드 그대로) |
| 2026-05-11 | 목록 뷰 탭 | 첫 버전 X (나중) |
| 2026-05-11 | 봉사자 화면 | 자기 카드만 보임 (다른 카드 X) |
| 2026-05-11 | 봉사자 하단 nav | 5탭 → 4탭 (홈/캘린더/나의봉사/설정) |
| 2026-05-11 | 봉사자 지도 진입 | 홈 / 나의봉사 → 자기 카드만 |
| 2026-05-11 | 봉사 종료 권한 | 누구나 전체 종료 가능 (확인 모달) |
| 2026-05-11 | 봉사 종료 후 재개 | 5분 이내 [봉사 재개] |
| 2026-05-11 | 봉사 추가 기록 | 24시간 이내 동일 세션에 추가 (시간 변경 X) |
| 2026-05-11 | 봉사 시작 시각 | T_start 절대 변경 X |
| 2026-05-11 | 봉사 진행 화면 | V1 옵션 A 유지 (지도 + 시트) + 헤더 강화 |
| 2026-05-11 | 봉사 진행 헤더 | "참여자 이름들 · 슬롯 · 진행시간 · 진행률" |
| 2026-05-11 | [나만 끝내기] 옵션 | 안 만듦 (통계 살짝 부정확해도 OK) |
| 2026-05-11 | 봉사 종료 요약 | 단순 (격려 + 이번 봉사 통계 + 함께한 봉사자) |
| 2026-05-11 | 봉사 종료 요약 — 누적 통계 | 표시 안 함 (필요 시 나의봉사에서) |
| 2026-05-11 | 종료 취소 카운트다운 | 같은 화면 하단 (5분) |
| 2026-05-11 | **인도자 권한** | **기존 V1 그대로 (변경 X)** |
| 2026-05-11 | **관리자 권한** | **기존 V1 그대로 (변경 X)** |
| 2026-05-11 | **로그인 방식** | **기존 V1 그대로 (모두 PIN)** |
| 2026-05-11 | **사용자 관리** | **기존 V1 그대로** |
| 2026-05-11 | **가입 승인** | **기존 V1 그대로** |
| 2026-05-11 | V1 → V1+ 변경 핵심 | 새 기능 추가 + 봉사자 카드 제한 (이게 전부) |
| 2026-05-11 | 봉사자 카드 제한 구현 | 클라이언트 필터링 (RLS는 추후, 코덱스 리뷰 반영) |
| 2026-05-11 | 헤더 🔍 검색 | 안 만듦 (헤더는 🔔 💬 ⋮ 만) |
| 2026-05-11 | 알림 발송 메커니즘 | PostgreSQL 트리거 + Edge Function |
| 2026-05-11 | 채팅방 1주 잠금 | 조회 시 계산 (별도 컬럼·Cron X) |
| 2026-05-11 | PWA 라이브러리 | vite-plugin-pwa |
| 2026-05-11 | @멘션 UX | 자동완성 드롭다운 + [@] 버튼 |
| 2026-05-11 | 봉사자/인도자 모드 토글 | 기존 V1 그대로 유지 |
| 2026-05-11 | 호수 기록 시간슬롯 | 봉사 시작 시각 기준 (한 봉사 = 한 슬롯) |
| 2026-05-11 | 알림 디폴트 | 모든 종류 켜짐 (사용자가 끌 수 있음) |
| 2026-05-11 | 인도자 봉사자 모드 시 | 카드 제한 적용 (모드 따라 다르게) |
| 2026-05-11 | 시스템 메시지 5종 | 합류, 시작, 종료, 인도자 변경, 일정 시간/장소 변경 |
| 2026-05-11 | 헤더 참여자 5명+ | "이름1, 이름2, 이름3 외 N명" |
| 2026-05-11 | 시간 표시 | 12시간제 통일 ("오후 5:02") |
| 2026-05-11 | 채팅 읽음 처리 | 진입 + 이탈 양쪽 (+ 새 메시지 활성 시) |
| 2026-05-11 | 알림 묶음 동작 | 첫 알림 즉시 / 5분 내 추가는 silent push |
| 2026-05-11 | 본인 알림 제외 | 본인 게시물에 본인 댓글/멘션 → 알림 X |
| 2026-05-11 | 봉사 시작 버튼 위치 | 홈 위젯 + 일정 상세 양쪽 |
| 2026-05-11 | PWA 아이콘 | 임시 텍스트 아이콘으로 시작 (192/512 PNG) |
| 2026-05-11 | RLS 보안 수준 | 클라이언트 필터링 (실용적, 80명 내부) |
| 2026-05-11 | RLS 마이그레이션 | 추후 (Supabase Auth 마이그레이션 시) |
| 2026-05-11 | **DB 식별 패턴** | **user_id FK + name snapshot (모든 신규 테이블)** |
| 2026-05-11 | 사용자 삭제 | author_id NULL, name snapshot 보존 |
| 2026-05-11 | 사진 만료 처리 | Storage 삭제 + image_expired = TRUE 메시지 업데이트 |
| 2026-05-11 | 새 일정 알림 | 안 함 (notification_preferences에서도 컬럼 제거) |
| 2026-05-11 | notification_preferences | push_new_event 삭제, push_event_change만 |
| 2026-05-11 | 채팅방 1주 잠금 Cron | 안 함 (조회 시 계산으로 통일) |
| 2026-05-11 | 댓글/메시지 삭제 | soft delete (deleted_at) — 감사 로그 보존 |
| 2026-05-11 | 인도자 채팅 모니터링 | 조용히 (사용자에게 표시 X) |
| 2026-05-11 | 메시지 삭제 알림 | "[메시지 삭제됨]" 표시 + 봉사 로그에 원문 |
| 2026-05-11 | 비용 표현 | "초기 무료 범위 예상, 증가 시 재검토" |
| 2026-05-11 | 권한 테스트 매트릭스 | Day 20-21에 10개 테스트 추가 |
| 2026-05-11 | 알림 SQL 트리거 예시 | 새 스키마(mention_ids, author_name) 반영 |
| 2026-05-11 | 민감 로그 보안 | RPC로 조회·INSERT 감싸기 (anon 직접 차단) |
| 2026-05-11 | Storage 정책 | V1: anon + 앱단 제한 / 안정화 후: 서명된 URL |
| 2026-05-11 | 사용자 식별 표현 | "작성자·행위자 정보 테이블에 적용" (상태 테이블 제외 명시) |
| 2026-05-11 | 비참여자 일정 댓글 | 작성 가능 (공개, 공지와 동일) |
| 2026-05-11 | 참여 취소 후 채팅 | 즉시 차단 (24h read-only X) |
| 2026-05-11 | 채팅 잠금 기준 | service_sessions.ended_at 통일 (calendar_events 아님) |
| 2026-05-11 | 권한 매트릭스 | 개발자/특수상태/참여취소/일정삭제 케이스 추가 |
| 2026-05-11 | 봉사 안 시작한 일정 | 채팅방 항상 활성 (잠금 X) |
| 2026-05-11 | **RPC 보안** | **세션 토큰 시스템 도입 (auth_sessions 테이블)** |
| 2026-05-11 | auth_login RPC | 토큰 발급 + last_used_at 갱신 |
| 2026-05-11 | 모든 민감 RPC | p_token 받아 verify_session() 검증 |
| 2026-05-11 | 토큰 만료 | 30일, Cron으로 만료 후 7일 지난 것 삭제 |
| 2026-05-11 | 일정 삭제 | A: 단순 (CASCADE로 채팅도 함께 삭제, 보존 옵션 X) |
| 2026-05-11 | 댓글 수정/삭제 시간 | 제한 없음 (본인만) |
| 2026-05-11 | 채팅 메시지 삭제 시간 | 5분 이내 (본인만) |
| 2026-05-11 | service_logs.card_id | 컬럼 추가 (필터 정확성) |
| 2026-05-11 | 알림 type 목록 | service_started, service_ended 추가 |
| 2026-05-11 | 댓글 알림 링크 | target_type 따라 분기 (notice / calendar_event) |
| 2026-05-11 | 채팅 잠금 다중 세션 | 모든 세션 종료 + 마지막 ended_at + 7일 |
| 2026-05-11 | user_id 표현 통일 | 알림 묶음/읽음 처리 코드 모두 user_id 사용 |
| 2026-05-11 | 작업 단계 Day 1 | Day 1~2로 확장 (세션 토큰 시스템 추가로) |
| 2026-05-11 | get_service_logs RPC | p_user_id → p_token, target_id 필터 → card_id 필터 |
| 2026-05-11 | log_service_action RPC | p_actor_id → p_token, verify_session으로 actor 추출 |
| 2026-05-11 | 댓글 알림 DB insert link | target_type 분기 (Edge Function뿐만 아니라 insert_notifications에도) |
| 2026-05-11 | send_chat_message 중복 예시 | 토큰 + 다중 세션 버전으로 통일, 옛 예시 제거 |
| 2026-05-11 | 본인 알림 제외 코드 | recipient_id <> NEW.author_id 사용 |
| 2026-05-11 | auth_login | 승인 상태 + 비활성화 체크 추가 (특수 상태 정책 반영) |

---

*이 문서는 작업 진행하면서 계속 업데이트.*
*디테일 결정 시 부록 B에 기록.*
