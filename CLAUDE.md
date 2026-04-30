# Chinese Territory App — 프로젝트 컨텍스트

> **AI 에이전트 인수인계용. 작업 전 반드시 이 파일을 읽을 것.**
> 마지막 업데이트: 2026-04-30 — Phase 1 보안 강화 + 백업 시스템 완료

---

## 0. 프로젝트 개요

- **목적**: 80명 규모 한 회중의 중국인 봉사 구역 관리 (PC + 모바일)
- **사용자**: 단일 회중 내부 사용 (외부 배포 X)
- **배포 주소**: https://chinese-territory-app-rwb7.vercel.app/
- **GitHub**: https://github.com/macgongming-beep/chinese-territory-app

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
npm run dev      # 개발 서버 (Vite, --host 로 LAN 접근 가능)
npm run build    # 빌드 검증
npm run lint     # ESLint
npm run backup   # Supabase 전체 백업 (scripts/backup.js)
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
├── utils/
│   ├── visitStrategy.ts     # 방문 전략 파생 (재시도/정기방문)
│   ├── cardSearch.ts        # 카드 검색/정렬
│   └── mapUtils.ts          # 지도 좌표 유틸
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

### SQL 파일 위치
- `supabase/schema.sql` — 초기 스키마
- `supabase/auth_hash_pins.sql` — bcrypt 트리거 + auth_login RPC
- `supabase/auth_lockdown.sql` — PIN 컬럼 차단 + login_logs RPC
- `supabase/migrate_*.sql`, `add_*.sql` — 점진적 마이그레이션

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
- [ ] 자동화 테스트 (vitest)

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
