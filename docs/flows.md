# Chinese Territory App — 사용자 흐름 맵

> Mobbin 스타일 분류: **그룹 → 하위 흐름 → 화면 시퀀스 → 마찰 포인트**.
> 코드 베이스(2026-05-16) 기준. 라우트는 모바일 기준이며 PC는 동일 라우트 + 별도 컴포넌트.

---

## 0. 역할별 접근 가능 흐름 요약

| 흐름 그룹 | user (봉사자) | leader (인도자) | admin (관리자) | developer |
|---|:---:|:---:|:---:|:---:|
| 온보딩 / 인증 | ✓ | ✓ | ✓ | ✓ |
| 일정 | ✓ (신청만) | ✓ + 인도 | ✓ 전체 관리 | ✓ |
| 활동 (방문 기록) | ✓ | ✓ | — (구역 탭) | ✓ |
| 채팅 | ✓ | ✓ | ✓ | ✓ |
| 알림 | ✓ | ✓ | ✓ | ✓ |
| 배정 (카드↔사람) | — | ✓ (일정→봉사자) | ✓ (인도자→카드) | ✓ |
| 구역 관리 | — | ✓ (담당만) | ✓ 전체 | ✓ |
| 지도 | ✓ (본인 배정 카드만) | ✓ | ✓ | ✓ |
| 공지 | ✓ (읽기) | ✓ (쓰기) | ✓ | ✓ |
| 사용자 관리 | — | — | ✓ | ✓ |
| 가입 신청 승인 | — | — | ✓ | ✓ |
| 로그인 기록 조회 (타인) | — | — | — | ✓ |

---

## 1. 온보딩 / 인증

### 1.1 회원가입
- **트리거**: 로그인 화면 → "회원가입"
- **시퀀스**:
  1. `Login` → 회원가입 모드 전환
  2. login_id + 이름 + PIN 입력
  3. `useAuth.signup()` → `app_users` INSERT (approval_status='pending')
  4. "관리자 승인 대기 중" 메시지
- **백엔드**: bcrypt 트리거가 PIN 자동 해싱
- **마찰**: 관리자가 별도로 승인해야 로그인 가능 → 가입자가 안내 없으면 혼란

### 1.2 로그인
- **트리거**: 앱 진입 (세션 없음)
- **시퀀스**:
  1. login_id + PIN 입력 + (rememberMe)
  2. `useAuth.login()` → `auth_login` RPC (bcrypt 검증)
  3. 세션 토큰 발급 → localStorage 또는 sessionStorage 저장
  4. `app_users.last_login_at` 갱신, `login_logs` INSERT
  5. 역할에 따라 모바일/PC 자동 분기
- **마찰**: pending 사용자는 PIN 맞아도 거부됨

### 1.3 PWA 설치
- **트리거**: 홈 화면 또는 설정 → PwaInstallSection
- **시퀀스**: 브라우저 install prompt (Chrome/Edge) 또는 iOS Safari 가이드
- **마찰**: iOS는 자동 prompt 없음 → 수동 안내

### 1.4 알림 권한 켜기
- **트리거**: 설정 → NotificationSettings
- **시퀀스**:
  1. "알림 권한 허용" 클릭
  2. 브라우저 권한 prompt
  3. 허용 → VAPID 키로 push_subscription 등록 → `upsert_push_subscription` RPC
- **마찰**: iOS PWA 는 홈 화면 설치 + iOS 16.4+ 필요

---

## 2. 일정 (캘린더)

### 2.1 일정 만들기 (admin/leader)
- **트리거**: 캘린더 → "+ 일정 추가"
- **시퀀스**:
  1. `MobileCalendar` 일정 모달
  2. 날짜/시간/제목/장소/지도링크/인도자/메모/반복 입력
  3. `createCalendarEvent()` 또는 `createRepeatCalendarEvents()` (반복)
  4. `calendar_events` INSERT
- **자동 효과**: 헤더 채팅 목록에 채팅방 즉시 생성 (realtime 구독)

### 2.2 일정 신청 (user/leader)
- **트리거**: 캘린더 → 일정 카드 → "신청"
- **시퀀스**:
  1. `applyToEvent()` → `event_participants` INSERT/DELETE 토글
- **마찰**: 신청 후 채팅방 접근 권한 자동 부여되는데, 인도자/관리자가 봐도 같은 버튼 UI

### 2.3 일정 수정 (admin/leader)
- **트리거**: 일정 카드 → 편집 모드
- **시퀀스**: 수정 → `updateCalendarEvent()` 또는 `updateCalendarEventSeries()` (반복 시리즈 전체)
- **자동 알림**: `notify_on_calendar_event_change()` 트리거 → 참가자에게 푸시

### 2.4 일정 삭제
- **트리거**: 편집 모드 → 삭제
- **시퀀스**: `deleteCalendarEvent()` 단일 / `deleteCalendarEventSeries()` 시리즈
- **마찰**: 삭제 확인 다이얼로그 외에 채팅방/배정 같이 cascade 삭제됨

### 2.5 일정 댓글
- **트리거**: 일정 상세 → 댓글 영역
- **시퀀스**: textarea 입력 → 등록 → `comments` INSERT
- **자동 알림**: `notify_on_comment()` 트리거 → 멘션/원 작성자에게 푸시

---

## 3. 활동 / 봉사 (방문 기록)

### 3.1 배정 받기
- **트리거 A**: 푸시 알림 클릭 (`/territory?assignmentEvent={id}`)
- **트리거 B**: 활동 탭 진입
- **시퀀스**:
  1. `MobileTerritory` → 배정된 봉사 카드 목록
  2. 활성(오늘+미래) 자동 노출, 지난 30일은 토글로 펼침
  3. 토글 → 인도자/팀원 + 카드 리스트 + [지도] 버튼

### 3.2 본인 배정 카드 지도 진입
- **트리거**: 활동 → 카드 [지도]
- **시퀀스**:
  1. `/map?cardId={cardId}` (focusedCardId)
  2. `MobileMap` → 인도자 뷰처럼 표시 (카드 이름 + 전체/주택/상가 세그먼트)
  3. 즉시 방문 기록 가능 (봉사 시작 없이도 OK)
- **권한**: `userVisibleMapCardIds` 가 본인 배정 카드만 통과시킴

### 3.3 방문 기록 (만남/부재/한국인 토글)
- **트리거**: 지도 → 건물 → 세대
- **시퀀스**:
  1. 세대 행의 체크 버튼 클릭
  2. `quickLogVisit()` 또는 `updateUnitStatus()`
  3. `visit_histories` INSERT + `units.status` 업데이트
- **마찰**: 같은 세대 여러 번 기록 가능 (시점별 히스토리)

### 3.4 봉사 세션 시작/종료 (인도자/관리자)
- **트리거**: 활동 → "+ 새 봉사" (user 는 숨김)
- **시퀀스**:
  1. 카드 검색 + 시간대 선택
  2. `startServiceSession()` → `service_sessions` INSERT (status='active')
  3. 지도 자동 진입
  4. 종료 → `endServiceSession()` → status='ended', `ended_at` 기록
- **자동 알림**: `notify_on_service_started/ended` → 참가자에게 푸시 (`useNotifications` type=service_started/service_ended)

### 3.5 정기 방문 관리
- **트리거 A**: 활동 → 정기방문 섹션
- **트리거 B**: 지도 → 세대 → 정기방문 토글
- **시퀀스**: `toggleRegularVisit()` / `addReturnVisitLog()` / `updateReturnVisitNickname()`
- **테이블**: `regular_visits`, `return_visits`, `return_visit_logs`

### 3.6 수동 재방문 추가
- **트리거**: 활동 → 정기방문 → "+ 추가"
- **시퀀스**: 이름/주소 입력 (네이버 지오코딩 자동) → 건물 매칭 → `createManualReturnVisit()`

---

## 4. 배정 (인도자)

### 4.1 인도자 → 카드 배정 (관리자)
- **트리거**: 배정 탭 (admin)
- **시퀀스**:
  1. `MobileAdminAssignment` → 인도자 선택 → 전체 구역 목록
  2. 카드 선택/해제
  3. `setMultipleCardLeaders()` → `card_leader_assignments` 동기화
- **결과**: 카드 `assignedLeader`/`assignedLeaders` 갱신

### 4.2 인도자가 봉사자에게 카드 배정 (leader)
- **트리거**: 배정 탭 (leader)
- **시퀀스**:
  1. `MobileLeaderAssignment` → 오늘/예정 봉사 일정 선택
  2. 1단계: 사용할 카드 선택
  3. 2단계: 팀 구성 (드래그/배치)
  4. 3단계: 참가자 추가
  5. "배정 공유" 또는 "배정 확정"
  6. `assignCardsToEventParticipantsBulk()` → `event_card_assignments` INSERT
- **자동 알림**: `notify_on_card_assignment()` 트리거 → 배정 받은 봉사자에게 인앱+푸시 (`type=assignment`, link=`/territory?assignmentEvent={id}`)
- **마찰**: "공유" vs "확정" 차이가 사용자 입장에서 불명확

---

## 5. 구역 관리 (admin/leader)

### 5.1 구역 둘러보기
- **트리거**: 구역 탭
- **시퀀스**:
  1. `MobileZoneView` → 담당(mine) / 전체(all) 토글
  2. 담당: 지역별 아코디언, 카드 리스트
  3. 전체: 지역 → 동 → 카드 드릴다운
- **빠른 진입**: 상단 "지도" 버튼 → `/map` 전체 지도

### 5.2 카드 생성 (admin)
- **트리거**: 구역 → 카드 추가
- **시퀀스**: `createCard()` → `cards` INSERT (지역/동/이름/타입)

### 5.3 건물 추가
- **트리거**: 지도 → "+ 건물 추가" 또는 카드 상세
- **시퀀스**:
  1. 지도에서 좌표 찍기 → 주소 자동 입력 (네이버 reverseGeocode)
  2. 이름/타입(주택/상가) 입력
  3. `createBuilding()` → `buildings` INSERT
  4. 자동으로 세대 1개 생성

### 5.4 건물 편집/삭제/이동
- **트리거**: 지도 → 건물 카드 → `⋯` 메뉴
- **시퀀스**:
  - 설정 → 편집 모달 (이름/주소/위치) → `updateBuilding()` / `deleteBuilding()`
  - 길찾기 → 네이버지도 새 탭 (GPS 출발지 자동)

### 5.5 구역선 그리기
- **트리거**: 지도 → 구역선 그리기 모드
- **시퀀스**: 점 찍어 폴리곤 생성 → `saveCardBoundary()` → `card_boundaries` upsert

---

## 6. 지도

### 6.1 지도 진입 경로
- A. 구역 → "지도 보기" → `/map` (전체)
- B. 활동 → 카드 [지도] → `/map?cardId={id}` (focused, 본인 배정만)
- C. 인도자/관리자 구역 카드 → 카드 클릭 → drill 후 지도
- D. 봉사자 하단탭에 지도 없음 (B 경로만)

### 6.2 GPS 내 위치
- **트리거**: 지도 우측 GPS 버튼
- **시퀀스**: `navigator.geolocation` → 네이버지도 스타일 파란 점 + 펄스 마커 + 지도 중심 이동

### 6.3 위성 지도 토글 / 줌
- 우측 툴바: 위성/평면, +/-, GPS, 작업 메뉴

---

## 7. 채팅

### 7.1 일정별 채팅방
- **참여 권한**: 일정 신청자 / 참가자 / 인도자 / admin / developer / leader
- **트리거 A**: 캘린더 → 일정 → "채팅방 열기"
- **트리거 B**: 헤더 💬 → 채팅방 목록 → 선택
- **트리거 C**: 푸시/인앱 알림 → `/calendar?openChat={eventId}`

### 7.2 메시지 전송
- **시퀀스**:
  1. 텍스트 입력 (@ 멘션 자동완성)
  2. 전송 → `send_chat_message` RPC
  3. `chat_message_signals` 트리거 → realtime subscribers 갱신
  4. 다른 참가자에게 자동 알림 (`notify_on_chat_message`, type=chat 또는 mention)
- **자동 스크롤**: 본인 메시지거나 맨 아래 근처면 자동 스크롤

### 7.3 사진 전송
- **시퀀스**: 사진 선택 → Supabase Storage 업로드 → URL을 `send_chat_image` RPC 로 메시지화

### 7.4 채팅방 진입 시 자동 읽음
- **시퀀스**: `update_chat_read` RPC → `chat_read_status.last_read_at` 갱신
- **효과**: 헤더 안 읽음 카운트 감소, 활성 화면일 땐 새 메시지 알림 자동 무음 처리

### 7.5 메시지 선택/삭제 (leader/admin)
- **시퀀스**: 선택 모드 → 여러 메시지 선택 → 삭제 → `chat_messages.deleted_at` 채움

---

## 8. 알림 (헤더 🔔)

### 8.1 알림 수신
- **자동**: realtime postgres_changes INSERT 구독
- **마스킹**: 현재 열린 채팅방의 메시지 알림은 자동 읽음 처리 (시끄럽지 않음)

### 8.2 알림 그룹화 (채팅 카톡 스타일)
- **시퀀스**: 채팅/멘션 알림을 event_id별 묶음
- **표시**: [방 이름] [N명] [최신 메시지] [안 읽음 카운트 뱃지]
- **클릭**: 그룹 내 모두 읽음 처리 + 해당 채팅방으로 이동

### 8.3 푸시 알림 (백그라운드)
- **조건**: 알림 권한 허용 + push_subscription 등록됨 + iOS면 PWA 설치 필요
- **트리거**: 채팅/배정/일정 변경/공지/봉사 시작 종료/언급/댓글
- **흐름**: DB 트리거 → `dispatch_push_notification()` → pg_net → Supabase Edge Function → FCM/APNs → SW push 이벤트 → `showNotification`
- **클릭**: `notificationclick` → 클라이언트 navigate (`postMessage(NAVIGATE)`) 또는 새 창

---

## 9. 공지

### 9.1 공지 작성 (leader/admin)
- **트리거**: 공지 탭 → 새 글
- **시퀀스**: 제목/내용/우선순위 → `createNotice()` → `notices` INSERT
- **자동 알림**: `notify_on_notice_insert()` → 모든 active 사용자에게 푸시 (작성자 제외)

### 9.2 공지 읽기
- **트리거**: 공지 탭 또는 푸시 알림 (`/notices?noticeId={id}`)
- **시퀀스**: 목록 → 상세 펼침 → 댓글

### 9.3 공지 삭제 (작성자/admin)
- `deleteNotice()` → `notices` DELETE

---

## 10. 관리 (admin/developer 전용)

### 10.1 사용자 관리
- **트리거**: 사용자 탭
- **시퀀스**: 사용자 목록 → 정렬/필터 → 사용자 카드
- **가능 액션**:
  - 권한 변경 (`updateUserRole`)
  - 비밀번호 초기화 (`resetUserPin`)
  - 가입 승인/보류 (`updateUserApprovalStatus`)
  - 이름/login_id 수정 (`updateUserIdentity`)
  - 삭제 (`deleteUser`)
- **개발자 전용**: 다른 사용자 로그인 기록 조회 (`fetchUserLoginLogs`)

### 10.2 가입 신청 승인
- **트리거**: 사용자 → 가입 신청 (pending 카운트 뱃지)
- **시퀀스**: pending 목록 → 승인/거부 → `updateUserApprovalStatus()`

### 10.3 특별 봉사 시즌 관리
- **트리거**: 설정 → 특별 봉사 시즌
- **시퀀스**: 라벨/기간/색상 → `createSpecialPeriod()` → 홈에 배너 자동 표시

---

## 11. 설정

### 11.1 알림 설정
- 항목: 채팅 / 멘션 / 일정 변경 / 공지 / 봉사 / 댓글 ON/OFF
- 방해 금지 시간대 (시작-종료)
- `useNotificationPrefs.update()` → `notification_preferences` upsert

### 11.2 PWA 업데이트
- 자동 30분 + visibility 체크
- 새 SW 감지 → "🆕 새 버전이 준비됐어요" 카드 표시
- "🔄 지금 새로고침" → `window.location.reload()`

### 11.3 내 로그인 기록
- 최근 7일 본인 기록 (`fetchMyLoginLogs` → `get_login_logs` RPC)

### 11.4 프로필 수정
- 이름/전화번호 → `updateMyProfile`
- PIN 변경 → `changePin`

### 11.5 언어 변경
- `chsLanguage:{userId}` localStorage

### 11.6 보기 모드 전환 (PC ↔ 모바일)
- `chsViewMode:{userId}` localStorage (강제 모바일/PC 토글)

---

## 12. 백그라운드 / 시스템

### 12.1 데이터 자동 갱신
- visibilitychange / focus 시 `fetchAll()` (10초 쿨다운)
- Pull-to-Refresh 70px (5초 디바운스, 스크롤 컨테이너 가드)
- Realtime postgres_changes: chat_messages / notifications / event_participants / calendar_events / event_card_assignments / event_card_assignment_cards / chat_read_status

### 12.2 PWA 서비스 워커
- workbox precache (1.5MB)
- SPA 라우팅 폴백 (NavigationRoute)
- push / notificationclick / message(SKIP_WAITING/NAVIGATE)

### 12.3 Sentry (선택)
- VITE_SENTRY_DSN 설정 시 자동 로드, 사용자 ID 컨텍스트

### 12.4 Vercel Analytics
- 페이지 뷰 자동 트래킹

---

## 🎯 디자인 우선순위 (흐름 기준)

매일 가장 많이 보는 화면 순서로 디자인 투자:

1. **헤더 + 하단탭** — 모든 페이지 공통, 통일 효과 최대 ✅ (방금 슬림화 완료)
2. **활동 화면 / 카드 행** — 봉사자 매일 진입 ✅ (방금 정리 완료)
3. **캘린더 일정 카드** — admin/leader 매일 진입 ✅ (방금 패딩 정리)
4. **지도 + 건물 행** — 방문 기록의 핵심
5. **채팅방 메시지 + 알림 센터** — 일상 사용 빈도 높음
6. **배정 흐름 (1→2→3)** — leader 주간 사용, 마찰 포인트 있음 (공유/확정 구분 모호)
7. **사용자 관리 / 공지** — admin 주간 사용
8. **설정** — 가끔 진입, 자체 카드들이 통일되면 OK

---

## ⚠️ 알려진 마찰 포인트 (개선 후보)

| # | 흐름 | 마찰 | 개선 아이디어 |
|---|---|---|---|
| 1 | 가입 신청 | 신청자가 승인 대기 상태 인지 어려움 | 가입 직후 안내 모달 + "신청 완료" 토스트 |
| 2 | 배정 (공유 vs 확정) | 사용자가 차이 모름 | UI 라벨/툴팁 명확화 또는 단일 액션으로 통합 |
| 3 | 일정 삭제 | cascade 삭제 (채팅/배정) 인지 어려움 | 삭제 확인 모달에 영향 범위 표시 |
| 4 | 정기방문 추가 | 주소 → 건물 매칭 결과 안 보임 | 매칭 후 미리보기 |
| 5 | 채팅 첨부 사진 | 만료 처리 (image_expired) 노출 | 만료 안내 + 재업로드 버튼 |
| 6 | 알림 권한 | iOS PWA 권한 요청 시점 불분명 | 첫 방문 시 가이드 또는 설정 강조 |

---

## 📌 활용

- **신규 기능 추가** 전에 이 문서에서 어디에 끼울지 위치 확인
- **AI 인수인계** 시 "이 흐름 개선해줘" 식으로 정확히 지칭 가능
- **디자인 시각 작업** 시 우선순위 섹션 참고
- **버그 리포트** 시 "흐름 X.Y 에서 ..." 식으로 명확히 위치 표기

