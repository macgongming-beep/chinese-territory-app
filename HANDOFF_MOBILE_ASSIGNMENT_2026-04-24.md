# CHS-Yongin Hand-off

작성일: 2026-04-24  
프로젝트 경로: `/Users/gm/Documents/New project/chinese-territory-app`

## 이번 턴 핵심 요약

이번 작업에서는 `배정` 기능을 **인도자 중심 팀 편성 흐름**으로 확장했고,  
특히 아래 3가지를 진행했다.

1. **PC 배정 탭 재설계**
2. **배정 저장 구조 확장**
3. **모바일 배정 탭 신규 구현**

다만 마지막 확인 결과, **모바일 배정 화면이 “코드는 들어가 있지만 현재 사용자 화면에서는 안 보일 수 있는 상태”**다.  
이유는 앱이 폭 980px 이상일 때 `DesktopApp` 경로를 타고, 980px 미만에서만 `MobileHome -> MobileLeaderAssignment`를 타기 때문이다.

즉:
- 모바일 배정 컴포넌트는 작성 완료
- 라우트도 연결 완료
- 빌드도 통과
- 하지만 실제로 사용자가 보고 있는 환경이 desktop width 면 새 모바일 배정 화면이 노출되지 않음

---

## 이번에 수정한 파일

### 배정 탭 / 저장 구조
- `/Users/gm/Documents/New project/chinese-territory-app/src/components/DesktopLeaderAssignment.tsx`
- `/Users/gm/Documents/New project/chinese-territory-app/src/components/DesktopApp.tsx`
- `/Users/gm/Documents/New project/chinese-territory-app/src/hooks/useStore.ts`
- `/Users/gm/Documents/New project/chinese-territory-app/src/types.ts`

### 모바일 배정 탭
- `/Users/gm/Documents/New project/chinese-territory-app/src/components/MobileLeaderAssignment.tsx`  **(신규)**
- `/Users/gm/Documents/New project/chinese-territory-app/src/components/MobileHome.tsx`
- `/Users/gm/Documents/New project/chinese-territory-app/src/App.tsx`

### UI 스타일
- `/Users/gm/Documents/New project/chinese-territory-app/src/App.css`

### SQL
- `/Users/gm/Documents/New project/chinese-territory-app/supabase/add_event_card_assignment_cards.sql` **(신규)**

### 참가자 앱 노출 보정
- `/Users/gm/Documents/New project/chinese-territory-app/src/components/DesktopHome.tsx`
- `/Users/gm/Documents/New project/chinese-territory-app/src/components/MobileHome.tsx`

---

## 1. PC 배정 탭 현재 상태

`DesktopLeaderAssignment.tsx`는 현재 다음 구조로 재작성되어 있다.

### 상단
- 제목: `인도자 배정`
- 부제: `팀 구성 & 카드 배정`
- 상태 박스:
  - 임시 저장
  - 배정 확정
  - 배정 공유
  - 자동 저장 시각 표시
- 액션 버튼:
  - `임시 저장`
  - `배정 확정`
  - `배정 공유`

### 상단 정보 영역
- 오늘 봉사 일정 선택 드롭다운
- 참가자 수 / 팀 수 / 사용 카드 수 / 미배정 수 요약
- `사람 기준 배정` / `카드 기준 배정` 토글

### 본문 3열
- 왼쪽: 사용할 카드 선택
- 가운데: 팀 구성
- 오른쪽: 참가자

### 하단
- 요약 정보
- 배정 진행 흐름

### 동작
- 카드 선택 -> 팀 생성 가능
- 한 팀에 카드 여러 개 추가 가능
- 참가자 선택 -> 팀 카드 클릭으로 배정 가능
- 게스트 추가 가능
- 미배정 인원 남았을 때 확정/공유 전에 확인 모달 표시

---

## 2. PC 배정 탭에서 추가로 반영한 UX

### A. 브라우저 기본 confirm 제거
기존에는 `window.confirm`으로 미배정 경고를 띄웠는데,  
지금은 작은 커스텀 모달로 바꿨다.

구분:
- `배정 확정`: 아직 참가자 앱에는 공개 안 됨
- `배정 공유`: 참가자 앱에 공개됨

### B. 참가자 배정 흐름 개선
지금은 아래 흐름으로 가능:

- 참가자 여러 명 선택
- 팀 카드 클릭
- 바로 해당 팀에 배정

추가로:
- 선택된 참가자 수 배너 표시
- 팀 카드 내부 버튼 클릭 충돌 방지 (`stopPropagation`) 처리

### C. “공유 전 비공개” 흐름 정리
현재 의도는 다음과 같다:

- `임시 저장`: 로컬 초안 저장
- `배정 확정`: 확정 상태 저장만 함
- `배정 공유`: 실제 참가자별 카드 배정을 DB에 반영

즉 **참가자 앱 노출은 공유 시점 기준**으로 맞추는 방향으로 구현되어 있음.

---

## 3. 저장 구조 확장 내용

기존 테이블:
- `event_card_assignments`
  - `event_id + user_name` 당 대표 카드 1개

문제:
- 한 팀에 여러 카드를 넣을 수 있는데, 기존 구조는 사용자당 카드 1개만 저장 가능

이번 확장:
- 신규 테이블 도입:
  - `event_card_assignment_cards`

파일:
- `/Users/gm/Documents/New project/chinese-territory-app/supabase/add_event_card_assignment_cards.sql`

역할:
- 대표 카드 1개는 기존 `event_card_assignments` 유지
- 추가 카드들은 `event_card_assignment_cards`에 여러 행으로 저장

`useStore.ts`에서 한 일:
- `RawEventCardAssignmentCard` 타입 추가
- `mergeEventCardAssignments(...)` 추가
- `fetchAll()`에서 `event_card_assignment_cards` 함께 조회
- `assignCardsToEventParticipantsBulk(...)`가
  - 기존 대표 카드 저장
  - 다중 카드 행도 별도로 저장

### 현재 상태의 의미
- SQL을 실행하지 않아도 대표 카드 기준으로 기본 기능은 돌아갈 수 있음
- SQL을 실행하면 여러 카드 팀 구조까지 완전 동기화 가능

---

## 4. 타입 변경

파일:
- `/Users/gm/Documents/New project/chinese-territory-app/src/types.ts`

변경:
- `EventCardAssignment`에 아래 필드 추가

```ts
assignedCardIds?: number[]
```

이걸 통해:
- 기존 `assignedCardId` 단일 카드 구조는 유지
- 필요 시 여러 카드도 같이 읽을 수 있게 확장

---

## 5. 홈 화면 연동 보정

다중 카드 지원과 관련해서 아래 파일도 수정했다.

- `/Users/gm/Documents/New project/chinese-territory-app/src/components/DesktopHome.tsx`
- `/Users/gm/Documents/New project/chinese-territory-app/src/components/MobileHome.tsx`

추가 함수:

```ts
function assignmentCardIds(assignment?: CalendarEvent['cardAssignments'][number]) {
  if (!assignment) return []
  return assignment.assignedCardIds && assignment.assignedCardIds.length > 0
    ? assignment.assignedCardIds
    : [assignment.assignedCardId]
}
```

적용 내용:
- 오늘 일정에서 배정 카드가 여러 개인 경우
  - `배정 카드 n개`
  - 혹은 첫 카드 기준 문구 표시
- 시작 카드 선택 시에도 `assignedCardIds` 우선 사용

---

## 6. 모바일 배정 탭 현재 상태

### 신규 컴포넌트
- `/Users/gm/Documents/New project/chinese-territory-app/src/components/MobileLeaderAssignment.tsx`

### 목적
데스크톱 배정 화면을 그대로 축소한 것이 아니라,  
모바일 손가락 흐름에 맞춰 **세로 섹션형 배정 화면**으로 새로 만들었다.

### 현재 구조

#### 상단
- 뒤로가기 버튼
- 제목: `인도자 배정`
- 부제: `팀 구성 & 카드 배정`
- 점점점 메뉴:
  - 게스트 추가
  - 참가자 새로고침

#### 오늘 봉사 카드
- 일정명
- 시간
- 참가자/팀/카드/미배정 요약
- 일정 선택 드롭다운

#### 상태 카드
- 현재 상태
- 자동 저장 시각

#### 배정 방식 토글
- 카드 기준 배정
- 사람 기준 배정

#### 섹션들
1. 사용할 카드 선택
2. 팀 구성
3. 참가자
4. 요약 정보
5. 저장/확정/공유 버튼
6. 배정 진행 흐름

### 동작
- 카드 선택 -> 팀 생성
- 팀에 카드 추가
- 참가자 선택 -> 팀 탭으로 배정
- 게스트 추가
- 미배정 경고 모달
- 공유 시 DB 저장

---

## 7. 모바일 배정 탭이 “안 보이는” 현재 이슈

사용자가 “모바일은 하나도 안 바뀌었다”고 느낀 핵심 원인:

### 원인
`App.tsx`에서 다음 조건으로 분기 중:

```ts
const DESKTOP_MEDIA_QUERY = '(min-width: 980px)'
```

즉:
- 980px 이상 -> `DesktopApp`
- 980px 미만 -> `MobileHome`

그리고 모바일 배정 탭은:
- `MobileHome` 안의 `/assignment`
- 거기서 `MobileLeaderAssignment`를 렌더링

따라서 **현재 사용 중인 브라우저/IAB 폭이 넓으면 모바일 컴포넌트는 아예 안 뜬다.**

### 확인된 점
아래는 이미 연결돼 있음:
- `MobileHome.tsx` import 추가
- `/assignment` route 가 `MobileLeaderAssignment` 사용
- `App.tsx`에서 `onAssignCardsToEventParticipantsBulk` 전달

즉, 코드상 연결은 끝났고 **실제 노출만 desktop width 조건 때문에 안 될 가능성이 높다.**

### 다음 AI가 바로 확인할 것
1. 실제 사용 환경이 desktop width 인지 확인
2. 필요하면 아래 중 하나 적용
   - 관리자용 `모바일 미리보기 토글` 추가
   - 임시로 breakpoint 낮추기
   - `/assignment?mobile=1` 같은 강제 모바일 프리뷰 분기 추가

추천:
- **강제 모바일 미리보기 토글** 추가

이게 있으면 앞으로 모바일 화면 작업 확인이 훨씬 쉬움.

---

## 8. App.css 상태

`App.css`에 아래 스타일이 추가되어 있음:

### PC 배정 탭 관련
- `.leader-assignment-*`

### 모바일 배정 탭 관련
- `.mobile-assignment-*`

현재 모바일 배정 탭 스타일은 기본 구조는 갖췄지만,  
실제 기기 화면에서 spacing / overflow / summary 배치 같은 미세 조정은 아직 필요할 수 있음.

---

## 9. 빌드 상태

최근 빌드 결과:
- `npm run build` 통과

즉 현재 코드베이스는 적어도 타입/번들 기준으로는 깨지지 않은 상태.

---

## 10. 다음 AI가 바로 하면 좋은 일

### 우선순위 1
**모바일 배정 화면이 실제로 보이게 확인 가능 상태 만들기**

추천 작업:
1. `App.tsx`에 모바일 강제 보기 토글 추가
2. 또는 관리자 전용 미리보기 토글 추가

### 우선순위 2
**모바일 배정 화면 실제 렌더링 점검**

확인 포인트:
- 헤더 간격
- 카드 리스트 스크롤
- 팀 카드 높이
- 참가자 버튼 정렬
- 하단 버튼 sticky 여부

### 우선순위 3
**SQL 실행 유도**

파일:
- `/Users/gm/Documents/New project/chinese-territory-app/supabase/add_event_card_assignment_cards.sql`

이 SQL 실행해야:
- 여러 카드 팀이 DB에도 완전히 반영됨

---

## 11. 사용자에게 바로 설명할 수 있는 한 줄 요약

“모바일 배정 탭 코드는 이미 들어갔고 라우트도 연결돼 있는데, 지금 보시는 환경이 desktop 폭이라 모바일 분기가 안 타서 새 화면이 안 보이는 상태일 가능성이 큽니다.”

