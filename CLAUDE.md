# Chinese Territory App — 프로젝트 컨텍스트

> AI 에이전트 인수인계용. 작업 전 반드시 이 파일을 읽을 것.
> 더 상세한 도메인/기능 설명은 `AGENT_HANDOFF.md` 참고.

---

## 기본 정보

- **스택**: React 19 + TypeScript + Vite + Supabase + 네이버 지도 API + React Router
- **실행**: `npm run dev` → http://localhost:5173
- **빌드 확인**: `npm run build`
- **환경변수**: `.env.local`
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
  - `VITE_NAVER_MAP_CLIENT_ID`

---

## 역할(Role) 구조

```
관리자(admin)   → 전체 관리, 주로 PC
인도자(leader)  → 카드/사용자 관리, PC+모바일
일반사용자(user) → 방문 기록, 일정 신청, 주로 모바일
```

현재는 UI에서 역할 수동 전환 (실제 인증 미구현).

---

## 아키텍처

### 데이터 흐름

```
Supabase DB
    ↓ fetchAll() (useStore.ts)
useStore (cards, buildings, calendarEvents, notices, ...)
    ↓ props
App.tsx
    ↓ props
DesktopApp (PC) / MobileHome (모바일)
    ↓ 콜백 (onCreateXxx, onDeleteXxx)
useStore mutate → Supabase write → fetchAll() 재호출
```

### PC 라우팅 (React Router)

`DesktopApp.tsx`가 `react-router-dom`의 `Routes/Route/useNavigate` 사용.

| 경로 | 탭 | 컴포넌트 |
|---|---|---|
| `/` | 홈 | `DesktopHome` |
| `/notices` | 공지 | `DesktopNotices` |
| `/calendar` | 캘린더 | `DesktopCalendar` |
| `/territory` | 구역 | `DesktopTerritory` |
| `/map` | 지도 | `DesktopMap` |
| `/assignment` | 배정 | `DesktopLeaderAssignment` |
| `/users` | 사용자 | `DesktopUsers` |
| `/settings` | 설정 | `DesktopSettings` |

`main.tsx`에 `<BrowserRouter>` 래핑됨.

### 모바일 탭 구조 (MobileHome.tsx)

역할별 탭:
```
user   : 홈 / 캘린더 / 내 카드 / 공지 / 설정
leader : 홈 / 캘린더 / 구역   / 공지 / 설정
admin  : 홈 / 캘린더 / 구역   / 공지 / 설정
```

---

## 핵심 파일 맵

```
src/
├── App.tsx                  # 최상위 wiring (useStore → Desktop+Mobile에 props 전달)
├── App.css                  # 전체 스타일 (모바일 → 760px → 980px 순)
├── main.tsx                 # BrowserRouter 래핑
├── types.ts                 # 공유 타입
├── hooks/
│   └── useStore.ts          # 모든 상태 + Supabase fetch/mutate
├── lib/
│   ├── supabase.ts          # Supabase 클라이언트
│   └── toast.ts             # 전역 토스트 이벤트 버스
├── utils/
│   └── visitStrategy.ts     # 방문 전략 파생 로직 (재시도/정기방문 등)
└── components/
    ├── DesktopApp.tsx        # PC 레이아웃 + React Router Routes
    ├── DesktopHome.tsx       # PC 홈 (공지/봉사/구역 요약)
    ├── DesktopCalendar.tsx   # PC 캘린더 (반복일정, 배정 포함)
    ├── DesktopTerritory.tsx  # PC 구역 관리 (카드 CRUD)
    ├── DesktopMap.tsx        # PC 지도 (건물/구역선/방문 전체)
    ├── DesktopNotices.tsx    # PC 공지사항
    ├── DesktopLeaderAssignment.tsx
    ├── DesktopUsers.tsx
    ├── DesktopSettings.tsx
    ├── MapCanvas.tsx         # 네이버/Mock 지도 캔버스
    ├── MobileHome.tsx        # 모바일 메인 (탭 라우팅 포함)
    ├── MobileCalendar.tsx    # 모바일 캘린더
    ├── MobileTerritory.tsx   # 모바일 구역
    ├── MobileNotices.tsx     # 모바일 공지
    ├── MobileMap.tsx         # 모바일 지도 (바텀시트)
    └── Toast.tsx             # 전역 토스트 렌더러
```

---

## Supabase 테이블

```sql
cards           id, name, area, region, type, status, leader_name
card_assignments  card_id, user_name
card_boundaries   card_id, points (GeoJSON), updated_at

buildings       id, card_id, name, address, type, lat, lng, warning, memo
units           id, building_id, number, status, is_chinese, memo
regular_visits  id, unit_id, visitor_name

visit_histories id, unit_id, visitor_name, result, time_slot, memo, visited_at

calendar_events id, event_date, time, title, type, place, leader_name,
                card_name, has_meeting, memo, series_id
event_participants  event_id, user_name, role

notices         id, title, content, priority, author, created_at

special_periods id, label, start_date, end_date, color
```

**주의사항**:
- DB는 snake_case, TS 타입은 camelCase → `useStore.ts` transform 함수에서 변환
- `calendar_events.event_date` → TS에서 `.date`
- `notices.priority`: DB에 영어(`normal`)로 들어와도 `PRIORITY_MAP`으로 자동 한국어 변환
- RLS: 현재 개발용 전체 허용 (`using (true)`), 프로덕션 전 변경 필요

---

## CSS 구조 (App.css)

```
[모바일 공통]   0px~
@media 760px   탭 레이아웃 조정
@media 980px   PC 전용 (.desktop-*, .home-*, .cal-*)
```

- 모바일 바텀시트: `.mobile-sheet`, `.mobile-sheet-backdrop`, `.mobile-form-field`
- PC 모달: `.cal-modal-backdrop`, `.cal-modal`
- 모바일 하단탭: `.bottom-nav` (grid `repeat(5, 1fr)`)

---

## 구현 완료 기능

### PC
- 캘린더: 월뷰, 일정 추가/수정/삭제, 반복일정, 참가자 배정
- 구역: 카드 목록/필터, 카드 생성, 인도자 배정, 지도 연동
- 지도: 건물 마커, 구역선 그리기/수정/삭제, 방문 기록, 정기방문, 운영 필터
- 공지: 목록/상세/작성/삭제
- 홈: 공지 요약, 오늘 봉사, 나의 구역

### 모바일
- 홈: 역할별 요약 화면
- 캘린더: admin 일정 추가/편집/삭제 (바텀시트)
- 구역: 카드 목록 (admin: 전체, user: 내 카드, leader: 담당 카드)
- 공지: admin 작성/삭제 (바텀시트)
- 지도: 방문 기록, 바텀시트, 정기방문

### 방문 전략 파생 (`visitStrategy.ts`)
- 최근 `부재` → `재시도 필요`
- 오후 부재 2회+ 저녁 없음 → `저녁 재시도`
- 저녁 부재 2회+ 주말 없음 → `주말 재시도`
- 최근 `확인필요` → `재확인 필요`
- 정기방문 → `정기방문`

---

## 해결된 주요 버그

| 버그 | 원인 | 해결 |
|---|---|---|
| 캘린더 안 뜸 | `useState(selectedDateStr)` TDZ | lazy 초기화로 변경 |
| 공지 404 | notices 테이블 미존재 | SQL로 생성 |
| 공지 안 보임 | DB priority 영어, 코드 한국어 기대 | `PRIORITY_MAP` 변환 추가 |
| 구역 탭 crash | selectedCard undefined 접근 | null 초기값으로 변경 |
| 모바일 탭 5개인데 4칸 | CSS repeat(4,1fr) | repeat(5,1fr) 수정 |

---

## 미완료 / 향후 과제

- [ ] 역할별 기능 제한 세분화 (현재 admin 기준 전체 구현)
- [ ] 모바일 구역 탭 카드 추가 기능
- [ ] 실제 사용자 인증 (현재 이름 직접 입력)
- [ ] CSV import (카드/건물/세대)
- [ ] 프로덕션 RLS 정책

---

## 협업 규칙 (AI 에이전트 간)

1. 이 파일 먼저 읽기
2. `git status --short` 확인
3. 수정 전 해당 파일 반드시 Read
4. 다른 에이전트 변경사항 덮어쓰지 말 것
5. 주요 방향/데이터 구조 변경 시 이 파일 업데이트
