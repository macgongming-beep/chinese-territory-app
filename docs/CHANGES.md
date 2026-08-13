# 변경 내역 요약 (Claude Code 세션)

## 1. 인도자 캘린더 — 인도자 이름 자동완성

**파일:** `src/hooks/useAuth.ts`, `src/App.tsx`, `src/components/DesktopCalendar.tsx`, `src/components/MobileCalendar.tsx`

- `useAuth.ts`: `fetchAllUsers()` 역할 조건 제거 → 로그인한 모든 사용자가 로드 가능, `useEffect([user?.id])`로 자동 호출
- `App.tsx`: `leaderNames` = role이 leader/admin인 사용자 목록 파생 → `DesktopApp`, `MobileHome`에 전달
- `DesktopCalendar`, `MobileCalendar`: 인도자 입력 필드에 `<datalist>` 자동완성 적용

---

## 2. 나의봉사 탭 — 오늘 배정된 카드 표시

**파일:** `src/components/MobileTerritory.tsx`, `src/components/MobileHome.tsx`

- `MobileTerritory`: `calendarEvents` prop 추가, `myTodayAssignedCards` useMemo로 오늘 배정 카드 계산
- "지금 봉사" 섹션 하단에 이벤트별 테두리 그룹 표시:
  - 이벤트 헤더: 시간, 제목, 인도자명, 팀원명
  - 카드 목록: 진행률 + 지도 버튼

---

## 3. 역할별 탭 구조 개편

### 모바일 (`src/components/MobileHome.tsx`)

| 역할 | 탭 |
|---|---|
| 봉사자 | 홈 · 캘린더 · 나의봉사 · 지도 · 설정 (5탭) |
| 인도자 | 홈 · 캘린더 · 나의봉사 · 배정 · 구역 · 설정 (6탭) |
| 관리자 | 홈 · 캘린더 · 나의봉사 · 구역 · 배정 · 설정 (6탭) |

- `MobileTab` 타입에 `'나의봉사'` 추가
- `tabToPath`: `'나의봉사'` → `/territory`, `'구역'` → `/zone`
- `pathToTab`: `/territory` → `'나의봉사'`, `/zone` → `'구역'`, `/map` → `'지도'`
- 인도자가 `/map`에 있을 때 `'구역'` 탭 하이라이트 유지 (activeTab override)
- `/map` onBack: 인도자는 `/zone`으로, 나머지는 `/territory`로 복귀

### PC (`src/components/DesktopApp.tsx`)

| 역할 | 탭 |
|---|---|
| 봉사자 | 홈 · 캘린더 · 나의봉사 · 지도 · 설정 |
| 인도자 | 홈 · 캘린더 · 나의봉사 · 배정 · 구역 · 설정 |
| 관리자 | 홈 · 공지 · 캘린더 · 구역 · 지도 · 배정 · 사용자 · 설정 |

- `pageToPath`: `'나의봉사'` → `/territory`, `'구역'` → `/zone`
- `pathToPage`: `/territory` → `'나의봉사'`, `/zone` → `'구역'`

---

## 4. 구역 탭 (인도자) — 목록↔지도 토글

**파일:** `src/components/MobileHome.tsx`, `src/components/DesktopApp.tsx`

### 모바일
- 새 라우트 `/zone` → `MobileZoneView` 컴포넌트 (MobileHome.tsx 내부 정의)
- 헤더에 **[목록 | 지도]** 세그먼트 토글
  - 목록: 담당 카드 리스트 (진행률, 상태 표시)
  - 지도: `/map`으로 navigate → 뒤로가기 시 `/zone` 복귀

### PC
- `/zone` 라우트: `showZoneMapView` 플래그 (`/zone?view=map`)
- 인도자에게만 상단 우측 반투명 **[구역목록 | 지도]** pill 토글 표시
- 전환 시 `DesktopTerritory` ↔ `DesktopMap` 인플레이스 렌더링

---

## 5. 라우트 정리

| 경로 | 내용 |
|---|---|
| `/territory` | 나의봉사 (개인 봉사 현황, MobileTerritory / DesktopTerritory) |
| `/zone` | 구역 관리 (인도자·관리자, 목록↔지도 토글) |
| `/map` | 전체 지도 (봉사자·관리자 직접 접근, 인도자는 /zone 경유) |

---

## 6. 타입 변경

**파일:** `src/types.ts`

```ts
export type DesktopPage = '홈' | '공지' | '캘린더' | '구역' | '나의봉사' | '지도' | '배정' | '사용자' | '설정'
```

---

## 미완료 / 주의사항

- Supabase `event_card_assignment_cards` 테이블: `supabase/add_event_card_assignment_cards.sql` 실행 필요 (다중 카드 배정 저장용)
- 실제 사용자 인증 미구현 (현재 이름 직접 입력)
- 프로덕션 RLS 정책 미설정
