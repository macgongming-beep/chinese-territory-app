# 데이터 페치 최적화 계획서 v2

> **v1 → v2**: Gemini + Codex 리뷰 반영.
> 주요 변경: (1) API 이름·단위 = `fetchSlices(domain)`, (2) useUserChats 분리를 우선순위 격상, (3) Phase 0 측정 단순화, (4) Retention·Projection·Realtime 다이어트 추가.
> 작성일: 2026-05-28

---

## 0. 한 줄 요약

> "20개 테이블 풀세트 로딩을 **도메인 slice 단위 fetch**로 바꾸되, **useUserChats의 전역 fetch 증폭**을 가장 먼저 제거한다. 그 다음 mutation별 정밀 refetch, projection, retention 순으로 페이로드를 깎는다."

---

## 1. 컨텍스트 (v1과 동일)

- 한 회중 80명 내부 PWA. React 19 + Supabase 무료 + Vercel.
- 미배포 상태 → 곧 30-40명 동시 운영 예정.
- 무료 한도: **Bandwidth 5GB/월, Realtime 동시연결 200, DB 500MB**.
- 추정 부하: 현 구조로 40명 운영 시 **7일차에 5GB 초과**.

---

## 2. 현재 구조 진단 (v1 + 리뷰 반영 보강)

### 2.1 핵심 증폭 메커니즘 (Codex 지적 강조)

```
유저 A가 일정 1개 생성
  ↓
calendar_events 변경
  ↓
useUserChats 채널이 모든 동시 접속자에게 신호 발사
  ↓
40명 전원 fetchAll({ force: true }) 호출
  ↓
40명 × 20테이블 = 800 SELECT
```

→ **useUserChats가 자기 도메인(채팅) 외에 calendar_events·event_card_assignments·event_card_assignment_cards까지 구독하고, 신호 받으면 전역 fetchAll을 호출하는 것이 최대 증폭점.** 

### 2.2 fetchAll 트리거 (v1과 동일, 6개)
[v1 표 그대로 — Mutation 83곳, visibility, focus, PullToRefresh, useUserChats 강제, 초기로드]

### 2.3 Realtime 채널 수 (Codex 신규 지적)

```
사용자당 평균 4채널
40명 × 4 = 160 동시연결
Free 한도: 200
→ 50명 넘으면 한계
```

### 2.4 신규 문제 의식 (리뷰에서 발굴)

| 문제 | 출처 | 영향 |
|---|---|---|
| `select('*')` 다용 → 페이로드 큼 | Codex | 부분 refetch해도 크기 안 줄어듦 |
| 기간 제한 없음 (visit_histories, return_visit_logs 등 무한 누적) | Gemini, Codex | 시간 갈수록 페이로드 증가 |
| Realtime 채널 백그라운드에서도 살아있음 | Codex | 한도 임박 |
| `notifications`, `chat_images`, `service_logs` retention 미정의 | Codex | DB 500MB 위협 |
| 역할별 초기 로드 동일 (봉사자도 관리자 데이터 다 받음) | Codex | 불필요 페이로드 |
| `units`는 독립 테이블이 아니라 `buildings.units(*)` nested | Codex | Phase 설계 영향 |

---

## 3. 전환 전략 v2 — 도메인 Slice 단위 + useUserChats 우선

### 핵심 원칙
1. **`fetchSlices(domain)`** 도메인 단위 (테이블 단위 아님)
2. **useUserChats 분리를 최우선** (Phase 1과 병행)
3. Phase 0 측정은 **Supabase Dashboard 우선**, 앱 내 측정기는 최소화
4. 기존 동작 100% 보존 — 신 동작은 옵트인
5. Phase 3 (Realtime payload 머지)는 **사실상 제외/보류**

### 도메인 Slice 정의

| Slice | 포함 테이블 | 변경 빈도 |
|---|---|---|
| `territory` | buildings(+units nested), cards, card_boundaries, regular_visits | 낮음 |
| `visits` | visit_histories, service_sessions | 매우 높음 |
| `calendar` | calendar_events, event_participants | 중간 |
| `assignments` | event_card_assignments, event_card_assignment_cards, event_informal_assignments, event_restaurant_assignments | 중간 |
| `communication` | notices, chat 관련 (※ 채팅은 별도 hook이 이미 담당) | 중간 |
| `returnVisits` | return_visits, return_visit_logs | 낮음 |
| `specialPeriods` | special_periods | 거의 변경없음 |
| `resources` | informal_assets, informal_groups, restaurant_requests | 낮음 |
| `system` | review_tasks, app_settings | 낮음 |

→ 호출자는 `fetchSlices(['visits'])` 만 알면 됨. 내부에서 의존성 (예: visits에는 buildings.units 의존) 자동 처리.

---

## 4. Phase 계획 v2

### Phase 0 — 간소 측정 (반나절, 단순화됨)
**v1 변경점**: 복잡한 perfTracker 신규 개발 → 최소 카운터 + Supabase Dashboard 우선

**구현**:
- `fetchAll` 시작/끝에 `console.log` 한 줄 추가 (`[fetchAll] triggeredBy=... ms=... bytes=...`)
- `localStorage`에 카운터만 (호출 횟수, 트리거별 분포)
- 개발자 계정에서 console로 확인
- **Supabase Dashboard → Reports → API Logs / Bandwidth** 1주 관찰 병행

**산출물**: "어느 mutation/이벤트가 가장 많이 fetchAll 트리거하는지" 대략 파악

### Phase 1 — `fetchSlices()` API 도입 (1일)
**v1 변경점**: 이름 `fetchAll({ only })` → `fetchSlices(slices)`, 단위 = 테이블 → 도메인

```ts
type Slice = 'territory' | 'visits' | 'calendar' | 'assignments'
            | 'communication' | 'returnVisits' | 'specialPeriods'
            | 'resources' | 'system'

const fetchSlices = useCallback(async (
  slices: Slice[],
  options?: { force?: boolean }
) => {
  // slice별로 필요한 테이블 SELECT + setter 호출
  // territory → buildings(+units nested) + cards + card_boundaries + regular_visits
  // visits → visit_histories + service_sessions (+ 의존 transform용 buildings/cards는 캐시 유지)
}, [...])

// 기존 fetchAll()은 alias로 유지 (전체 slice)
const fetchAll = useCallback(() => fetchSlices(ALL_SLICES), [fetchSlices])
```

**Slice 간 의존성 매핑 (Codex Q6 반영)**:
```ts
// 주석으로 명시
const SLICE_DEPENDENCIES: Record<Slice, Slice[]> = {
  visits: ['territory'],       // visit transform이 buildings.units 참조
  calendar: ['assignments'],   // event transform이 카드 배정 참조
  assignments: [],
  territory: [],
  // ...
}
```
호출자가 `fetchSlices(['visits'])` 하면 내부에서 territory state가 비어있는 경우에만 같이 fetch.

### Phase 2 — useUserChats 책임 분리 (긴급, 1일) ⭐ 신규 격상
**v1 Phase 5에서 격상**. Codex/Gemini 둘 다 "최대 증폭점, 우선 처리" 만장일치.

**현재 (문제)**:
```ts
// useUserChats.ts
.on('postgres_changes', { table: 'calendar_events' }, trigger)
.on('postgres_changes', { table: 'event_card_assignments' }, trigger)
// trigger 함수가 fetchAll({ force: true }) 호출
```

**개선**:
1. `useUserChats`는 **chat_message_signals, chat_read_status, event_participants** (채팅 도메인 한정) 만 구독
2. calendar/assignments 신호는 별도 hook (`useCalendarSync`, `useAssignmentSync`) 으로 이전
3. 이 hook들이 받으면 → 해당 slice만 refetch: `fetchSlices(['calendar'])`

**이 단계만 해도 N×20 폭발의 80% 해소.**

### Phase 3 — Mutation별 부분 refetch (2-3일, 점진)
**v1 Phase 2 그대로, 우선순위 측정 결과 따름**

가설 우선순위 (Phase 0 확정 후 조정):
1. `addVisitHistory` / `quickLogVisit` / `updateUnitStatus` → `fetchSlices(['visits'])`
2. `createBuilding` / `updateBuilding` → `fetchSlices(['territory'])`
3. `joined` / `left` (이벤트 참여) → `fetchSlices(['calendar', 'assignments'])`
4. `createNotice` → `fetchSlices(['communication'])`
5. `createCard` / `assignLeaderToCard` → `fetchSlices(['territory'])`

한 번에 1-2개씩 변경 → 배포 → 1일 모니터 → 다음.

### Phase 4 — Visibility/Focus + Realtime 디바운스 (반나절)
**v1 Phase 4 + Gemini 제안 (Realtime 디바운스) 통합**

- visibility/focus 디바운스: 10초 → **2분**
- Realtime trigger 함수에 **3초 디바운스** (연속 이벤트 다발 시 묶어서 1번만 refetch)
- "마지막 업데이트 N분 전" 표시 UI 추가 (Codex 제안)
- PullToRefresh는 강제 새로고침으로 유지

### Phase 5 — Projection + Retention (1일, 신규)
**Codex/Gemini 둘 다 강조한 페이로드 다이어트**

#### 5a. select projection
- `select('*')` → 명시 컬럼만
- 예: `visit_histories` 는 `id, unit_id, result, time_slot, visited_at, memo, visitor_name, service_session_id, special_period_id, invitation_left` 만 (created_at·updated_at 등 메타 제외)

#### 5b. 기간 필터링
- `visit_histories`: 최근 **6개월**만 기본 로드, 통계 페이지는 별도 RPC
- `return_visit_logs`: 최근 **3개월**만
- `service_sessions`: 이미 `limit(100)` — OK
- `notices`: 이미 `limit(50)` — OK

#### 5c. Retention 정책 (DB 500MB 보호)
- `notifications`: 60일 이후 자동 삭제 (SQL cron)
- `service_logs`: 30일 (현재 90일 → 단축)
- 채팅 이미지: 30일 후 storage 정리
- SQL 추가: `supabase/v1plus_retention_policies.sql`

### Phase 6 — Realtime 채널 다이어트 (반나절, 신규)
**Codex 지적: 40명 × 4채널 = 160, Free 200 한계 임박**

- 백그라운드 탭/PWA에서 채널 일시 해제 (visibilitychange로 unsubscribe)
- 포어그라운드 복귀 시 재구독
- 효과: 활성 사용자만 채널 점유 → 실질 동시연결 30-50% 감소

### Phase 7 — 역할별 초기 로드 분리 (선택, 1일)
**Codex 제안: 봉사자는 관리자 데이터 안 받음**

- `fetchSlices(['territory', 'visits', 'calendar'])` — 봉사자
- `fetchSlices(ALL_SLICES)` — 관리자/개발자
- 인도자: 관리자와 비슷하되 자기 카드 범위 한정

### Phase 8 — Realtime payload 머지 (제외 권장)
**v1 Phase 3. 두 리뷰 모두 정합성 리스크로 제외/보류 권장.**

→ Phase 2-6으로 5GB 문제 해결되면 **이 단계는 안 함**.

---

## 5. 일정 v2

| Phase | 작업 | 모니터링 | 누적 |
|---|---|---|---|
| 0 (간소화) | 0.5일 | 2일 | 2.5일 |
| 1 | 1일 | 즉시 | 3.5일 |
| 2 (긴급 격상) | 1일 | 1-2일 | 5-6일 |
| 3 (TOP 5) | 2일 | 2-3일 | 9-11일 |
| 4 | 0.5일 | 1일 | 10-12일 |
| 5 | 1일 | 2일 | 13-15일 |
| 6 | 0.5일 | 1일 | 14-16일 |
| 7 (선택) | 1일 | 2일 | 17-19일 |
| 8 | 제외 | - | - |

→ **Phase 0~5만 해도 (10일+모니터링) 무료 티어 안정 운영 예상**.

---

## 6. 안전 장치 (v1 + 보강)

### 6.1 Git 전략
- 브랜치: `optimize/phase-N-{설명}`
- 각 Phase는 단일 머지 커밋 (1회 revert 롤백)
- Phase 2 (useUserChats 분리)는 특히 1-1 커밋 분리 (chat-only / sync-hook-separation / fetchSlices-wiring)

### 6.2 Feature flag (보강)
**Codex 지적 반영**: localStorage flag만 신뢰 X, **기본 구동은 항상 안전**.
- 신 동작은 기본 OFF, `localStorage.feat_slice_refetch='1'` 켜야 활성
- 어떤 에러든 자동으로 구 동작 fallback (`try/catch` 후 `fetchAll()`)

### 6.3 Slice 의존성 문서 (Codex Q6 필수)
- `useStore.ts` 상단에 `SLICE_DEPENDENCIES` 주석 + 코드 동시 명시
- 각 mutation 위에 주석으로 "이 mutation은 어느 slice를 흔드는가" 명시

### 6.4 측정 비교
- Phase 0 카운터 + Supabase Dashboard egress를 매주 비교
- Phase 후 줄지 않으면 해당 Phase 보류·롤백

### 6.5 데이터 정합성
- Phase 8 (payload 머지) 제외했으므로 정합성 리스크 최소
- 그래도 PullToRefresh는 항상 강제 새로고침 유지 (사용자 마지막 수단)

---

## 7. v1에서 변경된 결정사항

| 항목 | v1 | v2 |
|---|---|---|
| API 단위 | 테이블 단위 `only: [...]` | 도메인 slice 단위 `slices: [...]` |
| useUserChats 분리 | Phase 5 (안정성 보고) | Phase 2 (긴급 격상) |
| Phase 0 측정기 | 커스텀 perfTracker 신규 개발 | 최소 console.log + Supabase Dashboard |
| Realtime payload 머지 | Phase 3 (선택적) | **제외 권장** |
| 신규 Phase 5 (Projection+Retention) | 없음 | 추가 |
| 신규 Phase 6 (Realtime 채널 다이어트) | 없음 | 추가 |
| 신규 Phase 7 (역할별 로드) | 없음 | 선택 추가 |
| Feature flag | localStorage 단순 | 에러시 자동 fallback 보강 |

---

## 8. 추가 고려사항 (구현 시 주의)

### 8.1 `units`는 nested
- `buildings` SELECT 시 `units(*, regular_visits(*))` 로 함께 옴
- → `units`를 독립 slice로 두지 않음. `territory` slice 안에 포함.

### 8.2 transform 함수 의존성
- `toCard(raw, buildings)` — cards는 buildings 필요
- `toCalendarEvent(raw, eventCardAssignments)` — events는 assignments 필요
- → `SLICE_DEPENDENCIES`로 자동 처리 (calendar fetch 시 assignments도 fresh 여부 확인)

### 8.3 미배포 상태의 장점
- 현재 사용자 0명 → **부담 없이 실험 가능**
- 운영 시작 전 Phase 0~5 모두 끝내는 것 권장

---

## 9. 최종 결정 사항 (v2)

- ✅ Phase 0 + 1 동시 시작 (반나절 + 1일)
- ✅ **Phase 2 (useUserChats 분리)를 즉시 이어서** — 최대 증폭점 해소
- ✅ Phase 3 mutation별 부분 refetch는 측정 결과 본 후 TOP 5만
- ✅ Phase 4 visibility 완화 + Realtime 디바운스 — 함께 처리
- ✅ Phase 5 projection + retention — 페이로드/DB 동시 다이어트
- ✅ Phase 6 Realtime 채널 다이어트 — Free 200 한계 대비
- ⚠️ Phase 7 역할별 로드 — 효과 보고 결정
- ❌ Phase 8 (payload merge) — 제외
- ❌ React Query — 본 작업 완료 후 별도 과제

---

## 10. 시작 체크리스트

작업 시작 전 확정:
- [ ] 작업 브랜치 생성: `optimize/phase-0-and-1`
- [ ] Supabase Dashboard 접근 권한 확인 (egress 모니터링용)
- [ ] 백업 1회 실행 (`npm run backup`)
- [ ] feature flag 키 결정: `feat_slice_refetch`
- [ ] 시작일 합의

---

**v2 작성 완료. 추가 의견 있으면 v3로 갱신 가능. 합의되면 Phase 0+1부터 시작.**
