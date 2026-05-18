# Codex 인수인계 — admin 리디자인 진행 상황 (2026-05-18)

## 작업 컨텍스트

`design-handoff/design_handoff_admin_redesign/` 안에 디자이너가 만든 23화면 디자인 핸드오프 (README + screens-a~f.jsx + phone.css). 그 디자인을 실제 코드베이스에 적용 중. **관리자(admin) 역할의 모바일 화면만** 1차 대상.

`design-handoff/DEFERRED.md` 에 미완 항목 누적.

## 적용된 Phase (모두 main 에 머지됨)

### Phase 1 — 토큰 + atom 8개
- `src/index.css` 에 신규 토큰 추가 (--ink/--text/--muted-*/--surface/--paper/--tint/--line/--line-2/--status-*). 기존 --gray-*/--primary-*/--brand-* 와 공존.
- `src/components/ui/` 폴더에 atom: Button / Card / Pill / Input / Segmented / Toggle / RoleBadge / StatePill
- 모든 atom 은 신규 토큰만 사용. 브랜드 파랑 없음, ink 기반 모노톤.

### Phase 2 — 모바일 셸 (헤더 + 탭바)
- `App.css` 의 `.app-header--mobile`, `.bottom-nav` 를 신규 토큰으로
- 모바일 헤더: 56px, 타이틀 20/700 ink, 서브 12.5/500 muted (세로 스택)
- 탭바: 라벨 11/500 muted-2 → active ink 600, backdrop blur 제거

### Phase 3a — admin 모바일 홈
- `src/components/admin/AdminMobileHome.tsx` 신규
- 공지 / 오늘의 봉사 / 운영 현황 (2×2 grid)
- 라우팅: `role === 'admin'` 일 때 사용
- 옛 admin 인라인 운영 현황 블록 삭제

### Phase 3c — admin 모바일 캘린더 + 일정 상세 시트
- `src/components/admin/AdminMobileCalendar.tsx` 신규
- 월 카드 + 그 날 일정 + **다가오는 일정 3개**
- "+ 일정 추가" / "수정" → `EventAddSheet` 바텀시트 (editing 모드 지원)
- `AdminEventDetailSheet.tsx`: Hero + 위치 (mapLink 있을 때만 지도 카드, 없으면 plain row) + 신청자 칩 strip + 댓글 placeholder + sticky composer
- 일정 시트 ⋮ 메뉴: [수정, 삭제]
- "채팅 열기" 클릭 → `window.dispatchEvent('app:open-event-chat', {eventId, eventTitle, eventDate, eventTime})` → AppHeader 가 리스닝하고 GlobalChatModal 오픈
- **시간 범위 (시작~종료)** 지원 — DB end_time 컬럼 + types + UI

### Phase 3d — admin 모바일 구역
- `src/components/admin/AdminMobileZone.tsx` 신규
- 인라인 탭: 구역 카드 / 비공식 / 식당
- 비공식/식당은 기존 InformalCardsTab / RestaurantsTab 재사용 (시각 톤만 정리)
- 담당/전체 segmented + 목록/지도 toggle
- 시·구 → 동 → 카드 drill-down (breadcrumb + 백 버튼)
- 카드 행: StatePill + 진행률 바
- **비공식 카드 탭**: 그룹 ⋮ 메뉴 → [선택, 이름 변경, 그룹 삭제]
  - 선택 모드: 자료 체크박스 → 하단 sticky [그룹 이동] / [삭제] / 그룹 이동 시트

### Phase 3e — admin 모바일 배정
- `src/components/MobileAdminAssignment.tsx` 전면 재작성
- Stepper [1 인도자 선택] → [2 구역 배정]
- Step 1: 필터 pills (전체/활성/신규) + 섹션 분리 (활성/신규/나 + divider)
- 인도자 카드: avatar + 이름 + 담당/진행/완료 메타
- 본인은 1.5px ink 테두리 강조
- Step 2: 검색 + 지도 ghost 버튼 + 지역 compact pills
- **다중 배정 (option A)**: "미배정만" 토글
- 이미 배정된 카드: 관리 ghost → action sheet [추가 배정 / 변경 / 해제]
- 본인 담당 카드 "배정됨" pill 클릭 → 즉시 해제 (confirm X)
- "전체 배정" 버튼 = 그룹 모두 본인 담당이면 "전체 해제" 로 토글
- Promise.all 병렬 처리 (이전: 순차 await)

### Phase 3f — admin 모바일 설정
- `App.css` 의 `.mobile-settings-*` 일제 재토큰화
- 카드 radius 18→12, shadow 제거, 아이콘 38→32 tint
- 가입 신청 배지 → status-danger pill
- 언어/역할 segmented 정렬
- 헤더 subtitle "장웅 · 관리자"
- "계정마다 다르게 저장됩니다" 헬퍼 텍스트 제거

### Phase 4 — 설정 하위 5화면
- 내 정보 (15): 카드 토큰, 저장=ink solid, 비밀번호 변경=ghost
- 알림 설정 (16): Toggle 40×24 ink, group dot ink/muted, paper DnD 인풋
  - **방해금지 시간 서버 적용**: `supabase/functions/send-push/index.ts` 에 quiet_hours 체크 추가 (KST 기준)
- 가입 신청 (17): 3-segment 큰 카운트, 액션 버튼 approve=ink/그외=ghost
- 특별봉사 (18): 활성 시즌 카드만 토큰, **시즌 생성 모달 정밀 매칭은 DEFERRED**
- 공지 (19): priority status-* pill, 헤더 sub "N개 · 관리자 작성",
  - **인라인 댓글 박스 paper bg** (CommentSection compact 모드 override)
  - 등록 버튼 ink solid 34h
  - placeholder "댓글 입력 · @로 멘션"
  - 삭제 버튼 ghost 텍스트만

### 공통 오버레이 — 10/11/12
- NotificationCenter (10): 우측 슬라이드 풀스크린 → top floating 카드
  (top 8 / radius 14 / shadow), 백드롭 rgba(26,26,24,0.28)
  - 카운트 status-danger pill, "모두 읽음" ghost, ✕ SVG
  - 그룹 라벨 12/600 muted (대문자 X)
  - ChatGroupItem / NotificationItem: 32×32 ink/tint 아이콘 박스
  - unread bg = rgba(26,26,24,0.04)
- GlobalChatModal (11): 동일 floating 패턴
  - 헤더 "채팅 · 일정별 대화방"
  - ChatRow: 36×36 ink avatar / 지난 대화 32×32 muted
- ChatRoom (12): 내 버블 brand blue → **ink + 흰**
  - 상대 버블 surface + line, 시스템 메시지 surface pill
  - composer 입력 line/10 radius, **전송/등록 = ink solid 36h**
  - placeholder "메시지 · @로 멘션"
- 두 패널 슬라이드 애니메이션 제거 (즉시 표시)
- 패널 오른쪽 잘림 수정: `left: 50% + transform translateX(-50%) + width calc(100% - 16px)`

### 레이아웃 정리
- 하위 페이지 wrapper 안의 헤더가 viewport 16px 안쪽 들어가던 문제
  → margin -30 (= wrapper 14 + app-shell 16) 으로 풀-bleed 통일

### PWA 설치 카드 — "이 기기" 섹션
- 1개 큰 카드 (3가지 행 + iOS 안내) → 디자인 09 의 2개 단순 카드
  - 홈 화면에 설치 / sub / [안내] ghost or "설치됨" ok pill
  - 푸시 알림 / sub / [켜기] ink solid or [끄기] ghost
- iPhone 노란 경고박스 + 설치 완료 초록 박스 제거
- AppUpdateCard: updateAvailable=false 면 렌더 X

## DB / Edge Function 변경 (사용자가 적용해야 함)

### 1. 시간 범위 컬럼 (필수)
```sql
-- supabase/add_calendar_event_end_time.sql
alter table public.calendar_events
  add column if not exists end_time text;
```
이거 안 돌리면 새 일정 저장 시 컬럼 없음 에러.

### 2. 채팅/알림 RPC 권한 (이미 사용자가 일부 적용)
사용자가 라이브에서 채팅이 안 보이는 문제로 다음 grant 실행했음:
```sql
grant execute on function public.get_chat_messages(uuid, integer) to anon, authenticated;
```
다른 RPC 들 권한도 점검 필요 (시그니처 정확하게):
```sql
select proname, pg_get_function_identity_arguments(oid)
from pg_proc
where proname in (
  'get_chat_messages', 'get_chat_message_meta', 'get_chat_message_previews',
  'send_chat_image', 'create_system_chat_message',
  'update_chat_read', 'get_my_chat_reads',
  'get_my_notifications', 'mark_notification_read', 'mark_all_notifications_read',
  'get_my_notification_prefs', 'update_my_notification_prefs',
  'upsert_push_subscription', 'delete_push_subscription'
);
```
시그니처 확인 후 각각에 `grant execute on function public.<name>(<args>) to anon, authenticated;`

### 3. send-push Edge Function 재배포
사용자가 이미 `supabase functions deploy send-push` 실행함.
방해금지 시간 (quiet_hours) 체크 로직이 추가됨 — KST(UTC+9) 기준.

## 아직 안 한 것 / DEFERRED

`design-handoff/DEFERRED.md` 의 항목들 + 추가:

### 디자인 핸드오프 — admin 미완
- **13 사용자 목록** + **14 사용자 편집** (screens-d.jsx) — 토큰만 정리하고 본격 매칭 안 함
- **18 특별봉사 시즌 생성 모달** — 활성 카드만 토큰 정리, 생성 모달 (지속 칩 3/5/7/10/14 등) 정밀 매칭 미완
- **일정 상세 시트의 지도 썸네일** — 현재 grid placeholder, 실제 지도 임베드 필요
- **알림 패널의 "다음 봉사까지 D일"** 등 추가 메타 미구현
- **20~23 구역 drill-down 정밀 매칭** — 기본 구조는 있지만 디자인 spec 의 미세 디테일은 미완

### 디자인 핸드오프 — 다음 라운드 예정
- **leader / user 화면** 디자인 (디자이너가 내일 핸드오프 예정 — 사용자 안내)
- 토큰/atom/셸은 공유되므로 화면별 작업만 남음

### 기능 미완
- 일정 상세 댓글 thread (현재 placeholder + sticky composer 가 채팅 열기로 이동)
- 인도자 카드의 "마지막 활동" 표시 (visit_histories prop 필요)
- 배정 Step 2 의 "배정됨 (by 김휘민)" 다른 사람한테 배정된 카드 표시는 됨

### 잡일
- 글로벌 `button { min-height: 40px }` 가 작은 버튼들 망가뜨림 →
  현재 컴포넌트별 `minHeight` 인라인 override 로 대응. 글로벌 자체 제거 검토 필요.

## 사용량 / 코드 위생

- 작업이 컴포넌트별로 잘 격리되어 있어 추가 작업도 patch 형태로 가능
- 새 디자인 화면은 모두 `src/components/admin/` 에 모여 있음
- 기존 leader/user 화면은 건드리지 않음 (역할별 분기)
- `src/components/ui/` atom 은 design 토큰만 사용 — 신규 화면에 재사용 권장

## 다음 작업 추천 순서

1. **사용자에게 시간 범위 SQL 실행 안내**
   `supabase/add_calendar_event_end_time.sql` 한 줄짜리. 안 돌리면 일정 저장 깨짐.

2. **leader / user 디자인 도착하면**:
   - 토큰/atom 그대로 재사용
   - 화면별로 `src/components/leader/` `src/components/user/` 같은 폴더에 신규 컴포넌트 추가
   - 라우팅에서 `role === 'leader'` / `role === 'user'` 분기

3. **13/14 사용자 관리 화면 정밀 매칭** — screens-d.jsx 참조

4. **DEFERRED.md 누적된 잡일 처리**

5. **마지막 라운드**: 글로벌 button min-height 제거 + 누락된 부분 수정

## 핵심 파일 위치

```
src/index.css                 — 토큰
src/App.css                   — 전역 CSS (대량 수정됨)
src/components/ui/            — atom 컴포넌트 (Phase 1)
src/components/admin/         — admin 신규 화면 (Phase 3+)
src/components/MobileHome.tsx — 라우팅 + 라우트별 본문
design-handoff/               — 디자이너 핸드오프 + DEFERRED.md
```
