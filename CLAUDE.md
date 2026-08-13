# Chinese Territory App — 프로젝트 컨텍스트

> **AI 에이전트 인수인계용. 작업 전 반드시 이 파일을 읽을 것.**
> 마지막 업데이트: 2026-06-03 — 안정화 라운드 완료 (P0~P3, 전역 Confirm, lint 0)

---

## 🆕 최근 변경 사항 (2026-06-03) — 안정화 라운드

코덱스+제미나이 리뷰 기반 전체 점검 + 수정. 다음 작업 전 우선 확인.

### 새 SQL 패치 (Supabase SQL Editor 에 이미 적용됨)
1. `supabase/v3_assign_cards_bulk_tx.sql` — 인도자 배정 **트랜잭션 RPC**
   `assign_cards_bulk_tx(p_token, p_event_id, p_assignments, p_status, p_expected_shared_at)`
   - 기존 카드배정 delete→insert→status를 한 트랜잭션으로 (원자성)
   - `assignment_shared_at` 비교로 **동시 공유 충돌 감지** (jsonb {ok, conflict, ...} 반환)
   - 클라: `eventAssignments.ts` 가 RPC 우선, 함수 없으면 레거시 폴백
2. `supabase/v3_data_retention.sql` — **DB 용량 자동 정리** (무료 500MB 대비)
   - `app_settings` 보존기간 (채팅90/읽은알림30/운영로그60/로그인180일, 조정 가능)
   - `cleanup_old_data()` 삭제+건수 반환 / `preview_data_cleanup()` 미리보기
   - pg_cron `cleanup-old-data` 매일 KST 04:00 (UTC 19:00) 자동
   - ⚠️ 기존 `cleanup_service_logs_daily` cron 은 unschedule 함 (이 함수가 흡수)

### 주요 클라이언트 변경
- **전역 Confirm/Alert 다이얼로그** (`src/lib/confirm.ts` + `components/ConfirmDialog.tsx`)
  - `confirmDialog({message, danger, confirmLabel})` → Promise<boolean>, `alertDialog()`
  - App.tsx 에 `<ConfirmDialog />` 마운트 (Toast 옆). 다크 글래스모피즘 (App.css `.cdlg-*`)
  - `window.confirm` 40곳 + `window.alert` 9곳 전부 교체. **새 확인창은 이거 재사용할 것**
- **P0 데이터 무결성**: `getCurrentVisitor()` 의 `'김민준'` fallback 제거 → `requireVisitor()`
  가드 (로그인 정보 없으면 토스트+중단). `storeMutations/{visits,regularVisits}.ts`
- **P1 조용한 실패 노출**: 방문요약/다중카드/draft 저장실패/sanitize 제거를 토스트로 알림
- **P2 정책/UX**:
  - PC 일정 편집 권한을 모바일과 통일 (관리자·개발자 또는 **본인 인도 일정만**, 삭제는 관리자·개발자만)
    → `DesktopCalendar` canEdit, `AdminEventDetailSheet` canEditEvent/canDeleteEvent
  - 팀짓기 미배정 인원 **검색/초성** (`utils/koreanSearch.ts` matchesName)
  - 팀 삭제 시 "구역 N개도 풀림" 경고, 채팅방 **음소거 토글** (chat_room_mutes upsert/delete)
- **P3-2 Realtime 복원력**: `src/lib/realtimeRecovery.ts` `subscribeWithRecovery()`
  - 웹소켓 재연결 시 끊긴 동안 놓친 변경 **catch-up refetch** (재구독 순간 1회)
  - useCalendarRealtime / useNotifications / useUserChats 3개 영구채널에 적용
- **lint 162 → 0** (eslint.config.js 에 `_`접두사 무시 추가, 네이버 SDK any 파일레벨 disable,
  의도적 react-hooks 패턴은 사유 명시 disable). `npm run lint` 깨끗하게 유지할 것.
  (scratch/, supabase/functions 는 eslint globalIgnores 처리 — 앱 소스 아님)
- **자동화 테스트 (vitest 4) 도입** — `npm test` (vitest run) / `npm run test:watch`
  - `vitest.config.ts` (jsdom 환경, 별도 설정 — 빌드용 vite.config 와 분리)
  - `tsconfig.app.json` 에서 `*.test.ts` exclude (프로덕션 빌드와 테스트 분리)
  - 현재 49개: koreanSearch(초성검색) / assignmentDraft reducer·persistence /
    cardSearch / visitStrategy. **순수 로직 위주. 리팩토링 전 안전망으로 활용/확장할 것.**

### 남은 과제 (큰 작업 — 별도 세션 권장)
- 거대 파일 분할 (진행 중): ✅ `useStore.ts` 784줄로 축소(이전 분할),
  ✅ `i18n.ts` 1909→134줄 (`src/locales/{ko,zh,en}.ts` 분리),
  ✅ `getLocalDateString` 4중복 → `utils/dateUtils.ts` 통합.
  남은 모놀리스(고결합·고위험): `DesktopTerritory.tsx` 3196줄,
  `DesktopMap.tsx` 2488줄, `MobileMap.tsx` 2258줄 — 컴포넌트 분해는 별도 신중 작업
- P3-3 교차기기 draft 연동 (서버사이드 draft 필요, V2+)
- visit_histories/buildings/cards 의 RLS (현재 anon 전체 접근)

---

## 이전 변경 사항 (2026-05-14)

이번 라운드에서 작업한 내용. 코덱스 인수인계 시 우선 확인.

### 새 SQL 패치 (Supabase SQL Editor 에 이미 적용됨)
1. `supabase/v1plus_realtime_assignment_patch.sql`
   - `supabase_realtime` publication 에 채팅/일정/배정 관련 7개 테이블 추가
     (`chat_messages`, `chat_read_status`, `notifications`,
      `event_participants`, `calendar_events`,
      `event_card_assignments`, `event_card_assignment_cards`)
   - `event_card_assignments` INSERT 트리거 → `notify_on_card_assignment()`
     → `insert_notifications` + `dispatch_push_notification`
     ('assignment' 타입). 본인이 본인에게 배정 시 skip.
2. `supabase/v1plus_realtime_fixes.sql`
   - `notifications_type_check` 에 `'assignment'` 추가
   - 7개 테이블에 `replica identity full` (postgres_changes 필터링용)
   - `chat_messages` / `chat_read_status` / `notifications` 에 SELECT 권한
     anon, authenticated 부여 + open SELECT policy
     (Realtime이 RLS+grant 검사하므로 필요. INSERT/UPDATE/DELETE 는
      여전히 REVOKE 되어 RPC 로만 가능)

### 클라이언트 변경
- **PWA 자동 갱신 + 풀-투-리프레시** (commit `35db918`)
  - `useStore.ts`: visibilitychange/focus 시 fetchAll (10초 디바운스)
  - `src/components/PullToRefresh.tsx` (모바일 풀투리프레시)
  - `App.tsx`: `<PullToRefresh onRefresh={refetchAll} />`
- **Realtime 구독 보강** (commit `b6503b1`)
  - `useUserChats.ts`: chat_messages + chat_read_status + event_participants
    에 더해 calendar_events / event_card_assignments / event_card_assignment_cards
    도 구독 → 일정 만들거나 배정 받으면 헤더 채팅 목록 즉시 반영
- **채팅 자동 스크롤 + 카톡 스타일 알림 그룹화** (commit `b871f34`)
  - `ChatRoom.tsx`: `messagesContainerRef` + `atBottomRef` + `requestAnimationFrame` 스크롤.
    사용자가 맨 아래 근처거나 본인 메시지일 때만 자동으로 맨 아래
  - `NotificationCenter.tsx`: 채팅/멘션 알림을 `event_id` 별 그룹으로 묶어
    [방 이름] [N명] [최신 메시지] [안 읽음 카운트 뱃지] 형태 표시
    (event 제목/인원수는 `useUserChats` 로 enrich)
  - `useNotifications.ts`: NotificationType 에 `'assignment'` 추가
  - `AppHeader.tsx`: NotificationCenter 에 `userName` prop 전달
- **PWA 업데이트 버튼** (commit `cb2d741`)
  - `src/lib/pwa.ts`: 자동 적용 제거. `checkForUpdate()`, `applyUpdate()` 노출.
    30분 주기 + visibilitychange/focus(10분 쿨다운) 자동 확인.
  - `src/hooks/useAppUpdate.ts`
  - `src/components/AppUpdateCard.tsx` (desktop/mobile variant)
  - `DesktopSettings.tsx`, `MobileHome.tsx` 설정 탭에 카드 추가
  - 사용자가 홈화면 PWA 삭제 없이 버튼 한 번으로 새 버전 적용 가능

### 알려진 운영 메모
- 배정 푸시 알림 정상 동작 확인됨 (사용자가 알림 권한 켜면 옴).
- 채팅 실시간/배정 알림/일정 즉시 반영 — 위 SQL 두 개가 적용돼 있어야 동작.
- Vercel 프로젝트: `chinese-territory-app` ⚠️ **이름·주소를 바꾸지 말 것**
  현재 배포: https://chinese-territory-app.vercel.app/
  (이전 `-rwb7` 도메인은 사용 안 함)
  주소가 바뀌면 80명의 홈화면 PWA 가 옛 주소를 가리킨 채 남고, 로그인 세션과
  **푸시 구독이 전부 무효가 된다** (둘 다 origin 에 묶여 있다). 회복하려면
  전원에게 다시 설치·알림 허용을 부탁해야 한다. 저장소·패키지 이름만 바꿨다.

---

---

## 0. 프로젝트 개요

- **목적**: 80명 규모 한 회중의 중국인 봉사 구역 관리 (PC + 모바일)
- **사용자**: 단일 회중 내부 사용 (외부 배포 X)
- **앱 이름**: 필드맵 (Field Map) — 사용자에게 보이는 이름 (PWA manifest)
- **배포 주소**: https://chinese-territory-app.vercel.app/ (바꾸지 말 것 — 위 메모 참고)
- **GitHub**: https://github.com/macgongming-beep/field-map

---

## 1. 스택 / 빌드 / 배포

| | |
|---|---|
| 프론트엔드 | React 19 + TypeScript + Vite |
| 백엔드 | Supabase (PostgreSQL + REST + RPC) |
| 지도 | 네이버 지도 API |
| 라우팅 | react-router-dom 7 |
| 호스팅 | Vercel (GitHub `main` 브랜치 자동 배포) |

```bash
npm run dev        # 개발 서버 (Vite, --host 로 LAN 접근 가능)
npm run build      # 빌드 검증 (tsc -b && vite build)
npm run lint       # ESLint (0 유지)
npm test           # vitest run (순수 로직 단위 테스트 49개)
npm run test:watch # vitest watch 모드
npm run backup     # Supabase 전체 백업 (scripts/backup.js)
```

**환경변수 (`.env.local`, gitignore 됨)**:
```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
VITE_NAVER_MAP_CLIENT_ID=...
SUPABASE_SERVICE_ROLE_KEY=...   # 백업 스크립트용 (RLS 우회)
```

배포 흐름: `git push origin main` → Vercel 자동 빌드 → 라이브.

---

## 2. 인증 / 보안 (현재 상태)

### 자체 인증 (Supabase Auth 사용 안 함)
- 사용자가 `app_users` 테이블에 저장됨 (`login_id`, `name`, `pin`, `role`, `phone`)
- 로그인은 **`auth_login` RPC** 호출 (서버 측 bcrypt 검증)
- 세션은 `localStorage.auth_session` 에 저장 (단순 사용자 정보)
- `useAuth.ts` 훅이 모든 인증 로직 담당

### 비밀번호 보호 ✅ 완료
- `app_users.pin` 은 **bcrypt 해시**로 저장 (cost=10)
- 트리거 `hash_pin_if_plain` 이 INSERT/UPDATE 시 평문 → 해시 자동 변환
- 클라이언트는 PIN 컬럼을 **SELECT 할 수 없음** (REVOKE)
- 로그인 검증은 `auth_login(login_id, pin)` RPC 에서만 가능

### 로그인 기록 보호 ✅ 완료
- `login_logs` 테이블: 로그인 시각 (초단위) 기록
- 직접 SELECT 차단, **`get_login_logs` RPC** 로만 조회 가능
- 본인 기록은 누구나, 다른 사람 기록은 developer 만 (클라이언트 측 체크)

### RLS 현 상태 (⚠️ 미완료 영역)
- `app_users`: 컬럼별 권한 (PIN 차단)  ✅
- `login_logs`: 직접 SELECT 차단 ✅
- 그 외 테이블 (`visit_histories`, `buildings`, `cards` 등): `using (true)` 상태 ⚠️
  - **위험**: anon 키로 직접 REST 호출 시 모든 데이터 읽기/수정 가능
  - **완화 요인**: URL 비공개 + 80명 내부 사용 + 의도적 공격 가능성 낮음
  - **다음 단계**: 세션 토큰 또는 Supabase Auth 마이그레이션 검토

### 백업 ✅ 완료
- `npm run backup` → `backups/YYYY-MM-DD/*.json` 18개 테이블 저장
- `backups/` 는 gitignore 됨 (민감 정보 보호)
- macOS launchd 자동 실행 가이드는 `scripts/README.md` 참고

---

## 3. 역할(Role) 구조

```
developer → admin 의 모든 권한 + 다른 사용자의 로그인 기록/방문 통계 조회
admin     → 전체 관리, 사용자 추가/삭제, 카드 인도자 배정
leader    → 담당 카드 관리, 봉사 인도
user      → 방문 기록, 일정 신청
```

- DB `role` 컬럼: `'user' | 'leader' | 'admin' | 'developer'`
- 다른 사용자에게 developer 는 admin 으로 표시됨 (`fetchAllUsers` 에서 마스킹)
- 권한 체크 함수: `isAdminLike(role)` (admin OR developer)

---

## 4. 아키텍처

### 데이터 흐름
```
Supabase DB
    ↓ fetchAll() (useStore.ts)
useStore (cards, buildings, calendarEvents, notices, ...)
    ↓ props (App.tsx 에서 분기)
DesktopApp (PC)  /  MobileHome (모바일)
    ↓ 콜백 (onCreateXxx, onDeleteXxx)
useStore mutate → Supabase write → fetchAll() 재호출
```

### PC 라우팅 (React Router)

| 경로 | 탭 | 컴포넌트 |
|---|---|---|
| `/` | 홈 | `DesktopHome` |
| `/notices` | 공지 | `DesktopNotices` |
| `/calendar` | 캘린더 | `DesktopCalendar` |
| `/zone` | 구역 | `DesktopTerritory` (관리자/인도자) |
| `/territory` | 나의봉사 | `DesktopTerritory` (개인 시점) |
| `/map` | 지도 | `DesktopMap` |
| `/assignment` | 배정 | `DesktopLeaderAssignment` / `DesktopAdminAssignment` |
| `/users` | 사용자 | `DesktopUsers` |
| `/stats` | 통계 | `DesktopStats` |
| `/settings` | 설정 | `DesktopSettings` |

### 모바일 탭 (`MobileHome.tsx`)
역할별 5탭: 홈 / 캘린더 / 구역(또는 내 카드) / 공지 / 설정

---

## 5. 핵심 파일 맵

```
src/
├── App.tsx                  # 최상위 wiring (useStore → Desktop+Mobile 분기)
├── App.css                  # 전체 스타일 (모바일 → 760px → 980px PC)
├── index.css                # 디자인 토큰 (CSS 변수)
├── main.tsx                 # BrowserRouter 래핑
├── types.ts                 # 공유 타입 + Role/PERIOD_COLORS 등 상수
├── i18n.ts                  # 다국어 (현재 한국어만)
├── hooks/
│   ├── useStore.ts          # ⚠️ 2300+ 줄 — 모든 상태 + Supabase fetch/mutate
│   └── useAuth.ts           # 인증 + 사용자 관리 + 로그인 기록
├── lib/
│   ├── supabase.ts          # Supabase 클라이언트
│   └── toast.ts             # 전역 토스트 이벤트 버스
├── utils/                   # ⚠️ 중복 정의 금지 — 아래 공용 유틸 재사용할 것
│   ├── visitStrategy.ts     # 방문 전략 파생 (재시도/정기방문)
│   ├── cardSearch.ts        # 카드 검색/정렬
│   ├── koreanSearch.ts      # matchesName (이름 부분일치 + 초성 검색)
│   ├── dateUtils.ts         # getLocalDateString (로컬 YYYY-MM-DD)
│   ├── specialPeriod.ts     # findActivePeriod / findActivePeriodId (특별봉사 기간 판정)
│   └── mapUtils.ts          # 지도 좌표 유틸 + getBuildingStatus
├── locales/                 # i18n 번역 사전 (ko/zh/en, i18n.ts 에서 분리)
│   ├── ko.ts / zh.ts / en.ts          # 화면 문구 (키 기반: t(lang, 'map.save'))
│   ├── messages.zh.ts / messages.en.ts # 토스트·오류 문구 (한국어 원문이 열쇠)
├── data/
│   ├── territoryStructure.ts  # 지역/동 데이터
│   ├── territoryBoundary.ts   # 행정구역 폴리곤
│   └── sampleData.ts          # 샘플 데이터 (개발용)
└── components/
    ├── DesktopApp.tsx          # PC 레이아웃 + Routes
    ├── DesktopHome.tsx         # PC 홈
    ├── DesktopCalendar.tsx     # PC 캘린더
    ├── DesktopTerritory.tsx    # ⚠️ 2200+ 줄 — PC 구역 관리
    ├── DesktopMap.tsx          # PC 지도
    ├── DesktopNotices.tsx      # PC 공지
    ├── DesktopUsers.tsx        # PC 사용자 관리 (개발자 전용 기능 포함)
    ├── DesktopSettings.tsx     # PC 설정 (나의 로그인 기록 포함)
    ├── DesktopStats.tsx        # PC 통계
    ├── DesktopLeaderAssignment.tsx
    ├── DesktopAdminAssignment.tsx
    ├── MobileHome.tsx          # 모바일 메인 (탭 라우팅)
    ├── MobileCalendar.tsx
    ├── MobileTerritory.tsx
    ├── MobileMap.tsx
    ├── MobileNotices.tsx
    ├── MobileUsers.tsx
    ├── MobileProfileSettings.tsx
    ├── MobileLeaderAssignment.tsx
    ├── MobileAdminAssignment.tsx
    ├── MapCanvas.tsx           # ⚠️ 1400+ 줄 — 네이버/Mock 지도
    ├── SpecialPeriodBanner.tsx # 특별봉사 배너 (card/compact/inline 3 변형)
    ├── SpecialPeriodSettings.tsx
    ├── Login.tsx + Login.css
    └── Toast.tsx               # 전역 토스트 렌더러
```

**거대 파일 주의** (점진적 분할 권장):
- `useStore.ts` 2300줄 — 다음 리팩토링 1순위
- `DesktopTerritory.tsx` 2200줄
- `MapCanvas.tsx` 1400줄

---

## 6. Supabase 테이블

```sql
-- 사용자/인증
app_users           id, login_id, name, pin (bcrypt), role, phone, last_login_at, created_at
login_logs          id, user_id, logged_in_at

-- 구역/카드
cards               id, name, area, region, type, status, leader_name
card_assignments    card_id, user_name
card_leader_assignments  card_id, leader_name
card_boundaries     card_id, points (GeoJSON), updated_at

-- 건물/세대
buildings           id, card_id, name, address, type, lat, lng, warning, memo
units               id, building_id, number, status, is_chinese, memo

-- 방문/봉사
visit_histories     id, unit_id, visitor, result, time_slot, memo, visited_at,
                    special_period_id, invitation_left
regular_visits      id, unit_id, visitor_name
service_sessions    id, user_name, role, calendar_event_id, primary_card_id, ...

-- 캘린더/일정
calendar_events     id, event_date, time, title, type, place, leader_name,
                    card_name, has_meeting, memo, series_id, allow_applications
event_participants  event_id, user_name, role
event_card_assignments  event_id, user_name, ...
event_card_assignment_cards  assignment_id, card_id

-- 기타
notices             id, title, content, priority, author, created_at
special_periods     id, label, start_date, end_date, color
review_tasks        id, title, content, status, completed_at, created_at
```

### 명명 규칙
- DB 는 **snake_case**, TS 타입은 **camelCase** → `useStore.ts` transform 함수에서 변환
- 예: `calendar_events.event_date` → TS `.date`
- `notices.priority`: DB 영어 (`normal`) → `PRIORITY_MAP` 으로 한국어 변환

### RPC 함수 (Supabase)
- `auth_login(p_login_id, p_pin)` — bcrypt 검증 + last_login_at 갱신 + login_logs 기록
- `get_login_logs(p_user_id, p_since, p_limit)` — 로그인 기록 조회
- `hash_pin_if_plain` — 트리거 함수 (자동 호출, 직접 호출 X)

### SQL 파일 위치 → 규칙은 `supabase/README.md`
- `supabase/schema.sql` — 초기 스키마
- `supabase/*.sql` — **아직 적용 안 했거나 방금 적용한 것.** 새 SQL 은 여기 만든다
- `supabase/applied/` — 적용이 끝난 마이그레이션 (기록용, 고치지 말 것)
- `supabase/tools/` — 읽기 전용 점검 (`_VERIFY_production.sql` 로 적용 여부 확인)

⚠️ 사용자가 실행했다고 확인해 주면 **그 자리에서 `applied/` 로 옮길 것.**
미루면 루트가 다시 60개가 된다.

---

## 7. CSS 구조 (App.css + index.css)

```
index.css        디자인 토큰 (CSS 변수: --primary-*, --gray-*, --radius-*, --shadow-*)
App.css          [모바일 공통] 0px~
                 @media 760px   탭 레이아웃
                 @media 980px   PC (.desktop-*, .home-*, .cal-*, .map-*)
```

- 모바일 바텀시트: `.mobile-sheet`, `.mobile-sheet-backdrop`, `.mobile-form-field`
- PC 모달: `.cal-modal-backdrop`, `.cal-modal`
- 모바일 하단탭: `.bottom-nav` (grid `repeat(5, 1fr)`)
- 구역 테이블: `.tbl`, `.tbl-seg-tab`, `.tbl-chip`, `.tbl-filter-layer`
- 지도: `.map-toolbar`, `.map-panel-head`, `.map-card-item`, `.map-legend-card`

---

## 8. 구현 완료 / 미완료

### PC ✅
- 홈: 공지/봉사/구역 요약 + 검토 항목
- 캘린더: 월뷰, 일정 추가/수정/삭제, 반복일정, 참가자 배정
- 구역: 카드 목록/필터 (지역/동/배정), KPI, 인도자 배정, 지도 연동
- 지도: 건물 마커, 구역선 그리기/수정/삭제, 방문 기록, 정기방문, 운영 필터
- 공지: 목록/상세/작성/삭제
- 사용자 관리: 정렬, 사용자 추가 모달, 비밀번호 초기화/재설정, 권한 변경, 개발자 전용 로그인 기록 조회
- 설정: 특별봉사 시즌 관리, 나의 로그인 기록 (최근 7일)

### 모바일 ✅
- 홈, 캘린더, 구역, 공지, 지도 — 모두 동작
- 역할별 탭/기능 분기

### 미완료 / 향후 과제
- [ ] visit_histories / buildings / cards 의 RLS (현재 anon 전체 접근)
- [ ] 세션 토큰 또는 Supabase Auth 마이그레이션 검토
- [ ] CSV import (카드/건물/세대)
- [ ] `useStore.ts`, `DesktopTerritory.tsx` 분할 리팩토링
- [x] 자동화 테스트 (vitest) — 순수 로직 49개 도입 완료. 리팩토링 시 확장할 것
- [ ] chat_messages SELECT 를 anon/authenticated 에 다시 부여한 것을 더 좁은
      RLS policy 로 좁히기 (현재 `using (deleted_at is null)` open).
      예: 본인이 참가자인 일정만, 또는 token 기반 view.

---

## 9. 협업 규칙 (Claude / Codex / 기타 AI)

1. **이 파일을 먼저 읽기**
2. `git status --short` 로 다른 에이전트 변경사항 확인
3. 파일 수정 전 **반드시 Read** 후 Edit
4. 빌드 검증: `npm run build` (TS 에러 0 유지)
5. 작업 단위마다 commit + push (Vercel 자동 배포)
6. **DB 스키마 변경** 시: `supabase/*.sql` 파일 추가 + 사용자가 SQL Editor 에서 실행
7. **민감 작업** (PIN/RLS/마이그레이션): 사용자에게 백업 안내 후 진행
8. **거대 파일 수정** 시 부분 Read (offset/limit 사용)

### 문구 다국어 규칙
- **화면 문구**: `t(language, 'key')` — 컴포넌트는 `language` prop 을 받아 쓴다.
  props 로 못 받는 곳(이벤트 핸들러·모듈 상수)은 `t(currentLang(), 'key')`.
  ⚠️ `currentLang()` 은 i18n 모듈이 들고 있는 값이다. localStorage 를 직접 읽지 말 것
  (언어는 사용자별 키 `chsLanguage:<userId>` 에 저장된다).
- **토스트·오류 문구**: `showToast(msg('저장했습니다'))` — 한국어 원문이 그대로 열쇠다.
  번역은 `locales/messages.{zh,en}.ts` 에 추가한다. 사전에 없으면 한국어로 표시되므로
  번역을 빠뜨려도 화면이 깨지지 않는다. 값 끼워넣기는 `msg('{n}개 삭제', { n })`.
- **감시 테스트**: `src/locales/mobileKorean.test.ts` 가 모바일 화면에 번역 안 된
  한국어가 남아 있으면 실패한다. 새 문구는 `msg()` 로 감싸고, 번역하면 안 되는
  값은 그 파일의 `VALUE_WORDS` 에 추가한다. (`npm test` 로 확인)
- ⚠️ **번역된 문자열을 값 비교에 쓰지 말 것.** 라벨은 표시 전용이고, 판단은 코드 내부
  값(행 번호·상태 코드)으로 한다. (요일 라벨을 '주말' 과 비교해 생긴 버그 있었음)

### 절대 하지 말 것
- ❌ `.env.local` 커밋
- ❌ `backups/` 커밋
- ❌ Service Role Key 를 클라이언트 코드에 포함
- ❌ PIN 평문 저장 (트리거가 있지만 명시적으로도 해싱 의도 표현)

---

## 10. 디버깅 / 운영 메모

### 자주 만나는 문제
- **로그인 안 됨**: 브라우저 Console 에서 `[login] auth_login RPC failed` 확인. RPC 미등록 또는 `extensions.crypt` 권한 문제일 수 있음
- **사용자 목록 빈 화면**: anon 키로 PIN 컬럼 SELECT 시도 → REVOKE 됐는지 확인
- **백업 실패**: `.env.local` 의 `SUPABASE_SERVICE_ROLE_KEY` 누락
- **빌드 에러 (Role 타입)**: developer 추가 후 `Record<Role, ...>` 객체에 `developer` 키 누락 가능

### 모니터링
- Supabase Dashboard → Logs (에러 발생 시각/메시지)
- 사용자 관리 → 로그인 기록 (개발자 계정으로 봐야 보임)
- Vercel Dashboard → Deployments (배포 로그)
