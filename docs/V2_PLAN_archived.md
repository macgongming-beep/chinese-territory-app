# V2 — 새 시스템 설계 문서

> 기존 chinese-territory-app 을 동결하고 새로 만드는 사이트의 설계서.
> 작성일: 2026-05-05

---

## 1. 핵심 컨셉

**역할 분리:**
```
밴드 (Naver Band)              웹앱 (V2)
─────────────────              ─────────────────
회원 명단 / 친목                구역 카드 / 건물 / 호수
봉사 일정 공지                  방문 기록 (만남/부재/시간슬롯)
참여 RSVP                      지도 + 구역선
채팅 / 사진                     통계 / 분석
공지사항                        인도자 카드 배정
                              비공식·식당 봉사
```

**사용자 동선:**
```
[밴드에서 봉사 일정 보고 참여 표시]
            ↓
[봉사 당일 인도자가 웹앱에서 카드 배정]
            ↓
[봉사자가 웹앱 진입 → 자동 인식 → 자기 배정 확인]
            ↓
[봉사 시작 → 호수별 기록 → 종료]
            ↓
[통계 자동 누적]
```

---

## 2. 사용자 역할 / 권한

| 역할 | 진입 방식 | 할 수 있는 것 |
|---|---|---|
| **봉사자** (60~70명) | 이름 선택 (PIN 없음) | 자기 배정 확인 / 봉사 기록 |
| **인도자** (10명) | PIN 로그인 | 봉사 배정 / 카드 관리 / 통계 조회 |
| **관리자** (2~3명) | PIN 로그인 | 전체 시스템 관리 / 사용자 명단 |

**보안 원칙:**
- 봉사자는 **자기 배정된 카드만** 진입 가능
- "임의로 새 봉사 시작" 버튼 없음 → 데이터 오염 방지
- 외부인이 URL 알아도 할 수 있는 게 없음 (배정이 없으면 빈 화면)

---

## 3. 사용자 시나리오

### 3-1. 봉사자 (모바일)

```
밴드에서 일정 확인 + 참여 체크
            ↓
봉사 당일, 웹앱 URL 클릭
            ↓
[첫 방문]                     [두 번째부터]
명단에서 이름 선택            "김철수님 환영합니다"
이름 → localStorage 저장      바로 자기 배정 표시
            ↓
─────────────────────────────────
오늘의 배정:
┌──────────────────────────┐
│ 마평동 2 카드             │
│ 박영희·이민수·정수진과 함께 │
│ [봉사 시작]               │
└──────────────────────────┘
─────────────────────────────────
            ↓
[봉사 시작] 누르면 → 카드 상세 화면
(건물 목록, 호수별 만남/부재/한국 기록)
            ↓
2시간 봉사 후 → [봉사 종료]
            ↓
완료. 통계에 반영.
```

**배정이 없을 때:**
```
"오늘 배정된 봉사가 없습니다"
"인도자에게 문의해주세요"
```

### 3-2. 인도자 (PC 또는 모바일)

```
웹앱 진입 → PIN 로그인
            ↓
오늘 봉사 시작 전:
[봉사 배정] 화면
   - 봉사 일시 선택 (오늘/이번 주)
   - 카드 선택 (마평동 2)
   - 봉사 모드 (호별 / 비공식 / 식당)
   - 참여자 체크 (4명)
   - [배정 완료]
            ↓
이제 봉사자 4명이 앱 들어가면
   "오늘의 배정: 마평동 2 카드" 자동 표시됨
            ↓
봉사 후:
- 통계 확인
- 다음 봉사 계획
```

### 3-3. 관리자 (PC)

기존과 거의 동일:
- 카드 / 건물 / 호수 관리
- 사용자 명단 관리 (이름만, PIN 없이)
- 인도자 권한 부여
- 시스템 설정

---

## 4. 이관 전략

### 4-1. 그대로 가져갈 것 (90%)

**관리자/인도자 화면 (PC)**
- `DesktopMap.tsx` — 지도 (네이버 + 마커 + 구역선)
- `DesktopTerritory.tsx` — 카드/건물/호수 관리
- `DesktopStats.tsx` — 통계 (재설계 후)
- `DesktopAdminAssignment.tsx` / `DesktopLeaderAssignment.tsx`
- `DesktopUsers.tsx` — 사용자 명단 (PIN 부분 단순화)
- `DesktopHome.tsx` — 약간 단순화

**모바일 일부**
- `MobileMap.tsx` — 지도 + 호수 기록
- `MobileTerritory.tsx` 핵심 부분

**공통 자산**
- `MapCanvas.tsx` — 네이버 지도 래퍼
- `UnitSlotGrid.tsx` — 6슬롯 방문 그리드
- `index.css` — 디자인 토큰
- `App.css` — 전체 스타일
- `utils/mapUtils.ts`, `utils/visitStrategy.ts`, `utils/cardSearch.ts`
- `lib/supabase.ts`, `lib/toast.ts`
- `data/territoryStructure.ts`, `data/territoryBoundary.ts`
- `scripts/backup.js`

**DB 스키마**
- `cards`, `buildings`, `units`, `visit_histories`, `card_boundaries`
- `regular_visits`
- `app_users` (PIN 없는 행 허용)
- `service_sessions` (확장됨)
- `special_periods`

### 4-2. 안 가져갈 것 (제거)

| 항목 | 이유 |
|---|---|
| `DesktopCalendar.tsx`, `MobileCalendar.tsx` | 캘린더 → 밴드 |
| `DesktopNotices.tsx`, `MobileNotices.tsx` | 공지 → 밴드 |
| `Login.tsx` | 일반 사용자 PIN 제거 |
| 가입 승인 시스템 | 관리자가 명단 직접 등록 |
| `calendar_events`, `event_participants` 테이블 | 캘린더 제거 |
| `event_card_assignments` 등 | 캘린더 기반 배정 → 단순 배정으로 |
| `notices` 테이블 | 공지 제거 |
| `useStore.ts` 의 캘린더·공지 관련 절반 | 코드 1/3 줄어듦 |

### 4-3. 새로 만들 것 (10%)

**컴포넌트:**
- `ServiceEntry.tsx` — 봉사자 진입 화면 (이름 선택)
- `MyAssignment.tsx` — 봉사자의 "오늘 배정" 화면
- `ServiceSession.tsx` — 봉사 진행 중 화면 (모바일 메인)
- `LeaderDailyAssign.tsx` — 인도자의 일일 배정 화면
- `InformalCardList.tsx` — 가두 봉사 카드 목록 (Phase 2)
- `RestaurantList.tsx` — 식당 목록 (Phase 2)

**DB 신규 테이블:**
```sql
-- 봉사 세션 참여자 (다중)
session_participants (
  id,
  session_id references service_sessions(id),
  user_name,
  is_recorder boolean default false,  -- 입력 담당자
  joined_at
)

-- 일일 배정 (인도자 → 카드 + 팀)
daily_assignments (
  id,
  service_date,
  service_time_slot,  -- 오전/오후/저녁
  card_id references cards(id),
  mode text,  -- '호별' | '비공식' | '식당'
  informal_card_id,  -- 비공식 봉사 시
  restaurant_id,     -- 식당 봉사 시
  assigned_by,       -- 인도자 이름
  team_members text[],  -- 봉사자 이름 배열
  status text,       -- 'pending' | 'started' | 'completed'
  created_at
)

-- 가두 봉사 카드 (Phase 2)
informal_cards (
  id,
  number int,
  title text,
  region, area,
  image_url,        -- Supabase Storage
  description,
  steps jsonb,      -- [{ label: 'a', color, text }, ...]
  is_active boolean,
  created_at
)

-- 식당 (Phase 2)
restaurants (
  id,
  name,
  address, lat, lng,
  category text,    -- '중국인 사장' | '중국인 직원' | '중국인 손님 多'
  memo, hours, contact,
  created_at
)
```

**DB 변경:**
```sql
-- app_users: PIN nullable
ALTER TABLE app_users ALTER COLUMN pin DROP NOT NULL;

-- service_sessions: 모드 추가
ALTER TABLE service_sessions
  ADD COLUMN mode text DEFAULT '호별',
  ADD COLUMN daily_assignment_id int REFERENCES daily_assignments(id);
```

---

## 5. 기술 스택

기존과 동일 (검증됨):
- React 19 + TypeScript + Vite
- Supabase (PostgreSQL + REST + RPC)
- 네이버 지도 API
- react-router-dom 7
- Vercel 호스팅

추가:
- **Supabase Storage** (가두 봉사 카드 이미지 업로드)

---

## 6. 인증 방식 결정

**옵션 A 채택: localStorage 기반 이름 선택**

```
첫 진입:
1. 명단에서 자기 이름 선택
2. localStorage 저장 ("currentUser": "김철수")
3. (선택) "홈 화면에 추가" 안내 → ITP 7일 룰 회피

다음부터:
1. localStorage 자동 인식
2. "김철수님 환영합니다" → 바로 진입
3. 작게 "다른 사람으로 입력" 링크
```

**iOS Safari 7일 룰 대비:**
- "홈 화면에 추가" 안내 (PWA)
- 그래도 사라지면 5초 안에 이름 선택 가능 (검색 + 최근 사용자 우선)

**보안 모델:**
- 봉사자: 이름 선택만으로 충분 (외부 위협 거의 0)
- 봉사자가 할 수 있는 것: **자기 배정된 카드만** 보고 기록
- 임의 조작 불가능 (배정 없이 못 들어감)

---

## 7. 통계 재설계

기존: 입력자 1명 기준 → **부정확** (4명 봉사인데 1명만 카운트)

새로: **세션 참여자 모두 카운트**

```
지표:
─ 참여 봉사 횟수    (팀원 모두에게 +1)
─ 직접 입력 횟수    (입력자만 +1)
─ 봉사 시간         (참여자 모두에게 합산)
─ 카드별 진행률     (세션 단위 누적)
─ 모드별 시간 분배  (호별/비공식/식당)
```

---

## 8. 구축 단계

### Phase 0: 셋업 (Day 1, ~2시간)
- [ ] 새 GitHub repo 생성
- [ ] 새 Supabase 프로젝트 생성
- [ ] 새 Vite 프로젝트 초기화
- [ ] 기존 Vercel 일시중지
- [ ] 기존 → 새 데이터 이전 스크립트 작성 + 실행
  - cards, buildings, units, card_boundaries, regular_visits
  - app_users (이름만, PIN 비움)
  - visit_histories (선택 — 결정 필요)

### Phase 1: 코어 복사 + 봉사자 진입 (Day 2~4)
- [ ] 디자인 토큰, 유틸, lib 복사
- [ ] 타입 정의 복사 + 단순화 (캘린더/공지 타입 제거)
- [ ] `useStore` 단순화 버전 작성 (캘린더 제거, 작은 훅으로 분리)
- [ ] 라우팅 구조 재정리:
  - `/` — 봉사자 진입
  - `/admin` — 인도자/관리자 로그인
  - `/admin/*` — 관리 화면들
- [ ] `ServiceEntry.tsx` (이름 선택 화면)
- [ ] `MyAssignment.tsx` (오늘 배정 표시)
- [ ] `MapCanvas`, `UnitSlotGrid` 복사 (그대로)
- [ ] 모바일 봉사 진행 화면 (기존 MobileMap 일부 재활용)

### Phase 2: 인도자 화면 (Day 5~7)
- [ ] `DesktopMap`, `DesktopTerritory` 복사
- [ ] `LeaderDailyAssign.tsx` 새로 작성 (오늘 봉사 배정)
- [ ] 인도자 PIN 로그인 (기존 useAuth 단순화 버전)
- [ ] 인도자가 배정 → 봉사자 화면에 반영되는지 확인

### Phase 3: 관리자 + 통계 (Day 8~10)
- [ ] `DesktopUsers` 단순화 (PIN 부여 옵션만)
- [ ] `DesktopStats` 재설계 (참여/입력 분리)
- [ ] 사용자 명단 일괄 등록 기능

### Phase 4: 비공식 / 식당 (이후)
- [ ] `informal_cards` 테이블 + Supabase Storage
- [ ] 가두 봉사 카드 그리드 + 상세
- [ ] `restaurants` 테이블 + 목록 화면
- [ ] 인도자 배정 시 모드 선택

### Phase 5: 출시
- [ ] Vercel 새 배포
- [ ] 도메인 연결 (또는 vercel.app URL)
- [ ] 밴드에 새 URL 공지
- [ ] 인도자들 PIN 발급
- [ ] 봉사자 한 팀에서 시범 사용

---

## 9. 결정된 것 / 미결정

### ✅ 결정됨
- 새 프로젝트로 시작 (병행 운영 X, 기존 동결)
- 새 Supabase 프로젝트 (DB 분리)
- 일반 사용자 PIN 없음 (이름 선택만)
- 인도자/관리자만 PIN
- 캘린더 / 공지 제거 (밴드로 이전)
- 봉사자는 임의 시작 불가 (배정만 진입)
- 통계는 세션 참여자 모두 카운트
- 봉사 단위 = 세션 (보통 2시간)

### ⚠️ 미결정
1. **새 프로젝트 이름**
   - `chinese-territory-app-v2` (안전)
   - `service-tracker` (포괄적)
   - 기타?
2. **방문 이력 데이터 (visit_histories) 가져갈지**
   - 가져감 → 통계 연속성, 정기방문 정보 유지
   - 안 가져감 → 깔끔한 새 시작
   - **잠정 추천**: 가져감 (필요 시 truncate 가능)
3. **모바일에서 인도자도 PIN 로그인?**
   - 모바일 인도자 진입 흐름 결정 필요
4. **배정 단위 (날짜만 / 날짜+시간슬롯)**
   - 같은 날 오전/오후 다른 카드 배정 가능?
5. **봉사자 명단 자동 추가**
   - 새 사람이 처음 들어오면: 자동 추가 / 관리자 승인 / 막음

---

## 10. 기존 시스템 처리

```
chinese-territory-app (기존)
├── GitHub repo → 영구 보존 (참고/백업)
├── Supabase   → 그대로 (read-only 가능)
├── Vercel     → 일시중지 또는 그대로
└── 마지막 git tag: v1-final
```

새 사이트 안정화 (3개월?) 후:
- Supabase 프로젝트 삭제 가능
- Vercel 배포 삭제 가능
- GitHub repo는 그대로 보존

---

## 11. 비용

| 서비스 | 비용 | 비고 |
|---|---|---|
| GitHub repo (2개) | $0 | 무제한 무료 |
| Supabase (2개 프로젝트) | $0 | 각 500MB DB 무료 |
| Vercel (2개 배포) | $0 | 100GB 대역폭 무료 |
| Supabase Storage | $0 | 1GB 무료 (가두 카드 이미지 충분) |
| 네이버 지도 API | $0 | 일정 quota 무료 |
| **합계** | **$0/월** | |

---

## 12. 다음 액션 (이 문서 다 읽은 후)

1. **위 미결정 항목 확정** (3분이면 됨)
2. **기존 프로젝트 git tag + 백업**
   ```bash
   git tag v1-final
   git push origin v1-final
   npm run backup
   ```
3. **새 프로젝트 셋업** (Phase 0 시작)

---

*이 문서는 새 프로젝트가 안정화되면 그쪽으로 이동.*
