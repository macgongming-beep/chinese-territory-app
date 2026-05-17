# Handoff: 구역관리 · 관리자 화면 리디자인

## Overview
한 회중(약 80명) 내부에서 쓰는 봉사 구역 관리 PWA의 **관리자(admin) 역할 모바일 화면 23개** 디자인.

배경:
- 사용자: 한 회중 80명, 20대~70대 혼재
- 모바일 PWA (홈 화면 설치 후 풀스크린 사용)
- 라이트 모드 only
- 다국어: 한국어(주) / 简体中文 / English
- 미니멀 · 정보 중심 · 내부용

기존 앱에 브랜드 파랑(#1F6FEB)을 들쑥날쑥하게 쓰던 문제 + 탭 간 시스템 통일성 결여 + 헤더가 휑한 문제를 해결합니다.

## About the Design Files
이 번들의 HTML/JSX 파일들은 **디자인 참조용 프로토타입**입니다 — 의도하는 외관과 동작을 보여주는 mock-up이며, 그대로 복사해서 production에 넣기 위한 코드는 아닙니다.

해야 할 일은 이 디자인을 **타깃 코드베이스(React 19 + TypeScript + Vite + Supabase + Pretendard Variable)에 그 코드베이스의 기존 패턴과 라이브러리를 사용해서 재구성**하는 것입니다. 컴포넌트 분리, 라우팅, 상태 관리, 데이터 페칭은 모두 기존 코드베이스 컨벤션을 따르세요. 이 핸드오프 파일들의 React 코드는 디자인 시스템 토큰과 컴포넌트 형태의 정확한 사양을 보여주기 위한 도구일 뿐입니다.

## Fidelity
**High-fidelity (hifi)**. 모든 색·간격·타입·경계·반경 값은 최종 결정된 값입니다. 픽셀 단위로 재현해주세요.

단, 캔버스 안에서 보이는 화면 크기는 **360 × 780**의 디자인 baseline입니다. 실제 디바이스에서는 너비가 더 클 수도, 작을 수도 있으니 컴포넌트 자체가 fluid해야 합니다.

---

## Design System

### 색 토큰 (Tone B · "살짝만 따뜻한 회색")
모든 색은 CSS 커스텀 프로퍼티로 정의해주세요. **브랜드 파랑(#1F6FEB) 사용 안 함**.

```css
--bg:        #F8F8F7;   /* 화면 배경 */
--surface:   #FFFFFF;   /* 카드 / 입력 */
--paper:     #F1F1EF;   /* 채팅방 등 보조 배경 */
--tint:      #EFEFED;   /* pill / 비활성 배경 */
--line:      #E5E5E2;   /* 경계 1px */
--line-2:    #D4D4D0;   /* 보조 경계 / 토글 트랙 */
--ink:       #1A1A18;   /* 최고 강조 텍스트 / 1순위 액션 */
--text:      #3A3A36;   /* 본문 */
--muted:     #7A7A75;   /* 메타 / 보조 텍스트 */
--muted-2:   #A8A8A2;   /* 더 약함 / chevron */
--muted-3:   #C8C8C3;   /* 디스에이블 */

/* 상태색 — 데이터 의미 */
--danger:    #C44536;   /* 위험·미사용·방문필요 */
--danger-bg: #FBEDEA;
--warn:      #B8862A;   /* 정기방문 */
--warn-bg:   #FBF3DF;
--ok:        #4F7A4B;   /* 완료·사용완료 */
--ok-bg:     #ECF1EA;
--info:      #5B6B7C;   /* slate · 사용중 — 브랜드 블루 대용 */
--info-bg:   #EAEEF2;
```

**컬러 사용 규칙:**
1. 액센트는 한 화면에 한 곳만 — `--ink`만 사용.
2. 상태색(danger·warn·ok·info)은 데이터 의미용이지 액센트가 아님.
3. 링크는 색이 아니라 무게로 (chevron + `--muted` + 500).
4. + 추가 버튼은 색 통일: 모두 `--ink` 솔리드.

### 타이포 스케일 (5단계)
폰트: **Pretendard Variable**, letter-spacing `-0.005em` 기본.

| Token | Size | Weight | 사용처 |
|---|---|---|---|
| Display | 24-26px | 700 | 화면 타이틀 (일정 상세) |
| H1      | 20px | 700 | 헤더 타이틀 |
| H2      | 17px | 600 | 섹션 헤딩 |
| Body    | 15px | 400 | 본문 |
| Card    | 15-16px | 600 | 카드 타이틀 |
| Meta    | 13px | 500 | 보조 텍스트 |
| Small   | 12px | 500 | 카운트 / 배지 |

**weight 점프**: 400 → 500 → 600 → 700. 그 외 금지.

### 간격 / 반경 / 그림자
- **반경**: 6, 8, 10, 12, 14px
- **카드 패딩**: 12-16px
- **카드 반경**: 12px
- **카드 경계**: 1px `--line`, 그림자 없음
- **헤더 높이**: 56px
- **탭바 높이**: 60px (icon 24px + label 11px)
- **탭바 내부 패딩**: 6/6
- **터치 영역 최소**: 44 × 44px

### 컴포넌트

#### Header
- 양 옆 패딩 20/16
- 좌: 타이틀(20/700) + 서브타이틀(12.5/500/muted) 한 줄씩
- 우: 36×36 아이콘 버튼 (🔔 알림 + 💬 채팅 + ⋮ 더보기). 배지는 ph-h-btn 우상단 빨강 dot+숫자
- 모든 화면에 서브타이틀 1줄 추가 (예: "2026년 5월 17일 일요일", "구역 카드 608 · 미배정 486")

#### TabBar (하단 5탭)
- 홈 / 캘린더 / 구역 / 배정 / 설정
- 활성: ink색 + 600
- 비활성: muted-2 + 500
- 아이콘 24px (lucide-style stroke 1.75)

#### Card
- `--surface` 배경 + `--line` 1px 경계 + 12px 반경 + 16px 패딩
- 그림자 없음 (모달/sticky만 그림자)

#### Pill
- 11.5px 500 · 3/9 패딩 · 999px radius · `--tint` 기본
- 상태 variant: `danger / warn / ok / info` — 600 weight

#### Button
- Solid: `--ink` bg + white text + 6-8px gap 아이콘
- Ghost: `--surface` bg + 1px `--line-2` border + `--text`
- Subtle: `--tint` bg + `--text`
- Disabled: `--tint` bg + `--muted-2` text
- Heights: 28 / 32 / 36 / 40 / 48 (lg)

#### Segmented Control
- `--tint` 트랙 + 3px 패딩 + 10px 반경
- Active: white surface + 600 weight + 살짝 그림자
- **목록/지도 toggle 순서**: 목록 (list svg) LEFT, 지도 (map icon) RIGHT

#### Toggle
- 40×24 트랙, 18px 노브
- Off: `--line` bg. On: `--ink` bg.
- 노브 흰색, 0.18s transition

#### Input
- `--surface` + 1px `--line` + 10px 반경 + 11/14 패딩
- 14px 텍스트 · placeholder는 `--muted-2`

#### Avatar
- 36×36 원형 (lg: 44px, sm: 22-28px)
- 이니셜 1글자 · `--ink` bg · white text 14/700
- "muted" variant: `--tint` bg + `--muted` text (담당 없음 표시)

#### Status Bar (mock)
- 32px 높이 · 시간 좌 / 신호·와이파이·배터리 우 (실제 PWA에서는 OS가 제공)

---

## Screens

### 화면 그룹 1 — 관리자 메인 (9 화면)

#### 01 · 홈
- **목적**: 진입 후 오늘의 봉사 / 공지 / 운영 현황 한눈에 보기
- **레이아웃**: 헤더(서브: "2026년 5월 17일 일요일") + 본문 스크롤 + 탭바
- **섹션**:
  1. 공지 — 카드 1개 미리보기 + "전체보기 ›" 링크. 일반 pill + 제목 + "4/30 읽음" 카운트
  2. 오늘의 봉사 — 시간 ink 블록(54×54, 큰 "13" + 작은 "오후") + 제목 + 위치/인도자 메타
  3. 운영 현황 — 2×2 그리드, 각 카드: 큰 숫자(26/700) + 라벨(12/muted). 셀들: 전체 608 / 진행중 122 / 미배정 486 (danger 색) / 완료 세대 2.4% (보조 분수)

#### 02 · 캘린더
- **목적**: 월간 일정 보기 + 그날 일정 선택
- **레이아웃**: 헤더(서브: "2026년 5월 · 일정 4개")
- **섹션**:
  1. 월 그리드 (7열) — 일요일만 빨강(`--danger`), 토요일 본문색. 오늘(17일)은 ink 원 + white. 일정 있는 날은 dot 아래 표시.
  2. 그 날 일정 — 압축 카드 (시간 col 48px + 제목 + 메타 + chevron). 우상단 "+ 일정 추가" ghost 버튼.
  3. 다가오는 일정 — 3개 미리보기 카드 (date+dow / 제목 / 시간·장소 / chevron)

#### 02b · 일정 상세
- **목적**: 한 일정의 모든 컨텍스트 (참석·댓글·위치)
- **레이아웃**: 백 + 제목/날짜 헤더, 본문 스크롤, sticky 댓글 composer 하단
- **섹션**:
  1. Hero: 22/700 "13:00 — 15:00" + 봉사 모임 pill / 26/700 "봉사" 제목 / 인도자 아바타+이름
  2. **신청하기 풀폭 솔리드 버튼 (지도 버튼 없음)**
  3. 상세 설명 텍스트
  4. 위치 카드 — map thumbnail + 주소 + "네이버" ghost 버튼
  5. 신청자 — 가로 스크롤 칩 strip (24명 + "+18" 오버플로우 + 추가 점선 칩), "전체보기 ›" 링크
  6. 댓글 — sec-head에 "채팅 열기" 링크 (헤더 💬 채팅과 별개로 인라인 진입), 활동 thread (avatar + 이름 + 시간 + 본문)
  7. Sticky 하단: 본인 아바타 + 댓글 입력 input

#### 03 · 일정 추가 (바텀시트)
- **레이아웃**: 백 화면(흐림 + 어두운 오버레이) + 하단 시트
- **시트 안 필드**:
  - 일정 제목 *(필수)
  - 상세 설명 (선택, 64px min textarea)
  - 날짜 + 시간 2열
  - 모임 장소 + 네이버 지도 링크 2단
  - 인도자 (기본 본인)
  - "이 일정에 봉사 신청을 받습니다" 체크
- **저장 풀폭 솔리드 버튼 (lg, 48px)**

#### 04 · 구역 (시·구 단위)
- **헤더 서브**: "구역 카드 608 · 미배정 486"
- 인라인 탭: 구역 카드 608 / 비공식 13 / 식당 1
- 담당/전체 segmented + 목록/지도 segmented (목록 left, 지도 right)
- 카운트 row: 전체 608 / 배정 122 / 미배정 486 (danger)
- 검색 input
- 시·구 카드 리스트 (이름 / 주택·상가 / 진행률% pill / chevron)

#### 05 · 구역 / 비공식
- 동일 인라인 탭 (비공식 active)
- 카운트 + "+ 자료 추가" 솔리드 버튼
- 그룹 expand: 경희대 4 — 2×2 map thumb 그리드 (각 카드 라벨)
- 그룹 collapsed: 미분류 9
- "+ 그룹 추가" 점선 ghost

#### 06 · 구역 / 식당
- 동일 인라인 탭 (식당 active)
- "+ 식당 추가" 솔리드
- 검색 input
- 그룹 expand: 처인구 1 — 식당 카드 (식당 아이콘 + 이름 + 주소 trunc + 지도 버튼 + ⋮)
- 빈 자리 안내 카드 (점선)

#### 07 · 배정 · Step 1 (인도자 선택)
- 헤더 서브: "인도자 8명 · 미배정 486개"
- Stepper: [1 인도자 선택 active] → [2 구역 배정]
- 필터 pills: 전체 8 / 활성 5 / 신규 3
- 검색 input
- 인도자 카드 (avatar + 이름 + 마지막 활동 우측 + 담당/진행/완료 메타. **정체 stat 없음.**)
- 섹션 분리: "신규 인도자 (담당 없음) 3" — muted avatar
- 섹션: "나" — 본인 카드는 1.5px ink 테두리로 선택 강조
- Sticky 하단: "○○ 담당 구역 배정하기 →" 솔리드 lg 풀폭

#### 08 · 배정 · Step 2 (구역 배정)
- 헤더: "장웅에게 배정 · 미배정 486"
- Stepper: [1] → [2 구역 배정 active]
- 검색 + 지도 ghost 버튼
- 필터 pills: 전체 486 / 처인구 312 / 기흥구 89 / 수지구 39 / +2
- 그룹 expand 카드: "처인구 · 김량장동 / 전체 18 · 미배정 12" + "전체 배정" subtle 버튼
  - 카드 내부: 김량장동 001~005, 각 카드 우측 "배정" solid (free) 또는 "배정됨" pill (taken, by 김휘민) + 사용자 이름 sub
  - "7개 더 보기" 링크
- 그룹 collapsed: 처인구·포곡읍 / 처인구·고림동 / 기흥구·기흥동 / 수지구·고기동
- Sticky 하단: 이번 세션 배정 3개 + "완료" 솔리드 버튼

#### 09 · 설정
- 헤더 서브: "장웅 · 관리자"
- 언어 sec: 한국어 / 简体中文 / English segmented + sub 메타
- 관리 sec: 메뉴 리스트 (아이콘 + 제목 + 설명)
  - 공지
  - 알림 설정
  - 사용자 (전체 80명 · 관리 권한 3명)
  - 가입 신청 (danger pill 카운트 — 승인 대기 N명)
  - 특별 봉사 시즌
- 이 기기 sec: 홈 화면 설치 / 푸시 알림 (off일 때 "켜기" solid)
- 푸터: 버전 dot + 최신 / 로그아웃 / 고급 설정

### 화면 그룹 2 — 공통 오버레이 (3 화면, 헤더 진입)

#### 10 · 알림 패널
- 어두운 dim 오버레이 + 상단 8px 모든 방향 띄운 패널
- 헤더: "알림 13" pill + 모두 읽음 ghost + X
- 그룹: "새 알림" (unread는 살짝 ink 4% 배경 + 빨강 dot + 600 weight)
- 각 행: 32×32 icon block (`Chat`=ink+white / `Bell`=tint+text) + 제목 + 본문 + 시간 + 우측 참여자 수 + 빨강 unread 배지
- 그룹: "이전 알림" (낮은 강조, weight 500)

#### 11 · 채팅 목록 패널
- 동일 패널 형태
- 헤더: "채팅 / 일정별 대화방"
- 그룹: "활성" (unread는 ink 4% bg) — avatar + 제목 / 일자·인원 / 마지막 시간 / 마지막 메시지 / 빨강 unread
- 그룹: "지난 대화" — muted avatar + 약화된 텍스트 + 날짜만

#### 12 · 채팅방 (전체화면)
- 커스텀 헤더 (제목 + 일자·시간·인원 + "닫기" ghost). 탭바 없음.
- 본문 배경: `--paper`
- 일자 divider (얇은 선 사이에 메타 텍스트)
- 시스템 메시지: surface pill 중앙
- Bubble:
  - 상대: avatar + 이름(작은 semi) + bubble (surface, 14/14/14/4 radius)
  - 본인: 우측 정렬, ink bg + white + 14/14/4/14 radius, "12:46 · 읽음" 메타
- Composer 하단 sticky: + 버튼 tint 36×36 + input + "전송" solid

### 화면 그룹 3 — 사용자 관리 (2 화면)

#### 13 · 사용자 목록
- 헤더 서브: "회중 12명 · 관리자 7"
- 탭바 숨김 (설정 sub-page)
- 검색 + 역할 필터 dropdown (전체 / 관리자 / 인도자 / 봉사자)
- "+ 사용자 추가" 점선 ghost 풀폭
- 사용자 목록 12명 — 각 카드:
  - avatar (관리자 = ink / 인도자 = muted / 봉사자 = muted-2)
  - 이름 + "@아이디"
  - **RoleBadge** = tint pill + 컬러 dot + 역할명 (●는 ink/muted/muted-2 위계)
  - chevron

#### 14 · 사용자 편집
- 헤더: 백 + "사용자 편집" + "관리자 · 마지막 로그인 5/17"
- 프로필 카드 (lg avatar + 이름 + @ID + RoleBadge)
- 계정 관리: 아이디 input / 닉네임 input / "저장" solid
- **사용자 권한**: 3-segment (관리자 / 인도자 / 봉사자) — 여기서 권한 변경
- 비밀번호: "0000으로 초기화" ghost 풀폭
- 위험 zone: 사용자 제거 카드 (danger 텍스트 + 설명 + danger solid "제거")

### 화면 그룹 4 — 설정 하위 (5 화면)

#### 15 · 내 정보
- 백 헤더 + 프로필 카드 (avatar + 이름 + @ID + RoleBadge)
- 개인 정보: 닉네임 / 핸드폰 번호 + "저장" solid
- 비밀번호: 새 비밀번호 / 확인 + "비밀번호 변경" ghost
- 하단 "로그아웃" 13/600/danger 텍스트 링크 + 아이콘

#### 16 · 알림 설정
- 받을 알림 카드: 3 토글 행
  - 봉사 활동 (일정 변경·카드 배정·봉사 시작/종료) — toggle on
  - 소통 (채팅·멘션·댓글) — toggle on
  - 공지 (관리자가 새 공지를 올릴 때) — toggle on
  - 각 행: 6×6 dot (on=ink) + 제목 + sub + chevron + toggle
- 헬퍼 텍스트
- 방해금지 시간 카드: Moon 아이콘 + 제목 + sub + toggle off
- 알림 미리보기 카드: 잠금화면 미리보기 toggle on

#### 17 · 가입 신청
- 3-segment: 승인대기 0 / 승인됨 12 (active) / 차단됨 0 — 각 칸에 라벨 + 큰 카운트
- 사용자 카드 리스트:
  - avatar + 이름 + RoleBadge 우상단
  - @ID + "신청 일자 · 마지막 로그인"
  - 액션 row: [대기로] [차단 danger 텍스트] ... [삭제]

#### 18 · 특별봉사 시즌
- 지난 시즌 sec: 카드 (Star + 라벨 + 기간 + ⋮)
- 새 시즌 만들기:
  - 라벨 input *
  - 시작일 picker
  - 기간 (일) input + 5 칩 (3/5/7/10/14, 7 active ink)
  - Summary chip: 종료일 + "오늘부터 활성화" ok pill
  - 취소 ghost / 시즌 생성 solid (50/50)

#### 19 · 공지
- 헤더 + "+ 공지 작성" solid 우측 상단
- 공지 카드 (중요 = danger pill / 일반 = tint pill):
  - 제목 (15/600) + 본문 (13, whiteSpace pre-line)
  - 작성자 · 날짜 / 삭제 ghost 우측
  - 인라인 댓글 박스 (`--paper` 배경, 12px radius, 12px 패딩):
    - "댓글 N개" 헤더
    - 댓글 thread (24×24 avatar + 이름 + 시간 + 본문)
    - 입력 + "등록" solid

### 화면 그룹 5 — 구역 드릴다운 (4 화면)

#### 20 · 구역 · 동 (처인구)
- 인라인 탭 (구역 카드 active)
- 백 chevron + breadcrumb "전체 구역 › 처인구" + ViewToggle 우측
- **Stats inline**: `전체 375 · 주택 134 · 상가 255` (압축)
- 검색 input
- 동 카드 리스트 — 각 카드: 동 이름 + "주택 H · 상가 S" + 카운트 pill + chevron. "미배정" 동은 muted 컬러.

#### 21 · 구역 · 카드 (고림동)
- 인라인 탭 (구역 카드 active)
- 백 + breadcrumb "전체 구역 › 처인구 › 고림동" + ViewToggle
- Stats inline: `전체 12 · 주택 7 · 상가 2`
- 카드 리스트 — 각 카드:
  - 카드명 + StatePill (방문필요 / 정기방문 등 4상태 vocab)
  - "담당 장웅 · 주택 H · 상가 S"
  - 진행률 바 + % (우측 32px)
  - 지도 ghost 버튼 우상단

#### 22 · 구역 · 담당
- 인라인 탭
- 담당/전체 segmented (담당 active) + ViewToggle (목록 active)
- **State totals 압축 row**: 미사용 12 (danger) / 사용중 1 (info) / 사용완료 0 (ok) — 7px dot + 13px 숫자 + 12px 라벨, padding 8/12
- 처인구 그룹 expand 카드:
  - 헤더: 처인구 + "12개" pill + **지도 아이콘 버튼 30×30 tint** (이 그룹의 담당 지도 = 그 구의 본인 담당 구역만 지도로)
  - 서브그룹 "미사용 11개" StatePill + 카드 3개 + "8개 더 보기"
  - 서브그룹 "사용중 1개" StatePill + 고림동 6 (50%)
- 수지구 그룹 collapsed

#### 23 · 구역 · 지도
- 풀스크린 지도 (탭바 유지)
- 상단 floating 헤더: 백 chevron + "구역 · 지도" + "전체 866 · 주택 351 · 상가 515" + 검색(카드/주소) + ⋮
- **좌측 세로 legend** (top 90, left 8, 압축 padding 6/9):
  - 방문필요 803 (danger)
  - 완료 9 (ok)
  - 방문금지 1 (ink)
  - 정기방문 53 (warn)
- 지도 위 구별 bubble 라벨 (5개, 처인구 active ink)
- 색상 핀 마커 (4 상태별)
- 우측 floating 컨트롤 스택:
  - Layers (레이어)
  - **PinPlus** ink 솔리드 + 좌측 popover [+ 건물 추가 active / ✎ 핀 위치 수정]
  - Crosshair (내 위치)
  - Zoom +/- combined
- 하단 peek 카드: 선택된 카드 + StatePill + "기록" solid

---

## State Logic / Vocab 분리

**중요**: 같은 데이터를 view에 따라 다른 어휘로 부릅니다.

| Internal data state | 전체/지도 view 어휘 | 담당 view 어휘 | 색 |
|---|---|---|---|
| not_visited | 방문필요 | 미사용 | danger |
| in_progress / regular | 정기방문 | 사용중 | warn / info |
| done | 완료 | 사용완료 | ok |
| do_not_visit | 방문금지 | (숨김) | ink |

`StatePill` 컴포넌트는 이 8개 한글 라벨을 모두 인식해서 같은 색 그룹에 매핑합니다.

---

## Interactions & Behavior

### 네비게이션
- 탭바 5개: 홈 / 캘린더 / 구역 / 배정 / 설정
- 헤더 우측 3 버튼: 🔔 알림 / 💬 채팅 / ⋮ 더보기 — 알림·채팅은 dim overlay + 상단 패널, ⋮ 메뉴(역할 보기/검색/피드백/도움말)
- 설정 → 하위 페이지: 백 chevron으로 복귀
- 구역 drill-down: 시·구 → 동 → 카드 (breadcrumb으로 1단계씩 백)

### 권한 변경 위치
- 자신의 화면 보기 전환 (관리자 ↔ 인도자 ↔ 봉사자 view): **헤더 ⋮ → 역할 보기**
- 다른 사용자의 권한 변경 (관리자만): **설정 → 사용자 → [사용자] → 사용자 권한 segmented**

### 채팅 구조
- **일정별 채팅방만 존재** — 팀 채팅 / 회중 전체 채팅 없음
- 일정 상세 (02b)에서 헤더 💬 또는 댓글 sec "채팅 열기" → 채팅방 (12)
- 헤더 💬 드롭다운 (11)에서 일정별 방 목록 전체 탐색

### 애니메이션
- Toggle: 0.18s ease
- Segmented active: instant
- Modal / Bottom sheet: 0.24s ease-out 슬라이드 업, opacity 0→1
- Card hover: 안 함 (모바일 PWA)

### 상태 처리
- Disabled solid: tint bg + muted-2 text (활성과 모양은 같되 색만 다름)
- Empty states: 점선 카드 + muted 텍스트 (예: "두 번째 식당 추가하기")
- Loading: 미정 — 기존 코드베이스 패턴 따름
- Error: 미정 — 기존 코드베이스 패턴 따름

### 위험 액션
- 사용자 제거 / 일정 삭제 / 구역 해제 — **확인 다이얼로그 필수**
- 자주 누르지 않게 점 3개 메뉴 안으로 (단일 탭으로 데이터 손상 가능한 위치 금지)

### 다국어 대응
- 모든 텍스트는 i18n key. 영문은 한국어 대비 80% 길어진다 가정.
- 카드 라벨 — ellipsis 적용
- Segmented control — 라벨 너무 길면 dropdown으로 fallback

---

## Files in This Bundle

```
design_handoff_admin_redesign/
├── README.md                    ← 이 문서
├── Redesign.html                ← 23 화면이 모두 들어간 메인 디자인 캔버스
├── assets/
│   ├── phone.css                ← 모든 토큰 + 컴포넌트 CSS
│   ├── phone-shell.jsx          ← StatusBar + Header + TabBar + Phone wrapper
│   ├── icons.jsx                ← 아이콘 세트 (Bell, Chat, Dots, ChevR/L/U/D, Map, Pin, ...)
│   ├── screens-a.jsx            ← 홈 / 캘린더 / 일정상세 / 일정추가
│   ├── screens-b.jsx            ← 구역 (시·구) / 비공식 / 식당
│   ├── screens-c.jsx            ← 배정 Step1·2 / 설정
│   ├── screens-d.jsx            ← 알림 패널 / 채팅 패널 / 채팅방 / 사용자 목록·편집
│   ├── screens-e.jsx            ← 내정보 / 알림설정 / 가입신청 / 특별봉사 / 공지
│   └── screens-f.jsx            ← 구역 동·카드·담당·지도
└── design-canvas.jsx            ← 캔버스 wrapper (handoff용 의존성)
```

`Redesign.html`을 그냥 브라우저로 열면 모든 화면이 디자인 캔버스 안에 보입니다.

---

## Recommended Implementation Order

Phase별로 나눠서 PR을 작은 단위로 가져가시는 것을 권장합니다:

1. **Phase 1 — 토큰 + 기본 컴포넌트 (1-2일)**: phone.css의 모든 토큰을 코드베이스의 theme/tokens 파일로 옮김. Button / Card / Pill / Input / Segmented / Toggle / RoleBadge / StatePill 8개 atom 컴포넌트 구현.
2. **Phase 2 — 셸 (1일)**: Header / TabBar / SubPhone (subpage wrapper) / Breadcrumb / Crumb. 라우팅 연결.
3. **Phase 3 — 메인 5탭 (3-5일)**: 홈, 캘린더, 구역(시·구), 배정 Step1·2, 설정 메인 — 9 화면.
4. **Phase 4 — 헤더 오버레이 (2일)**: 알림 / 채팅 패널 / 채팅방.
5. **Phase 5 — 사용자 관리 (1일)**: 목록 / 편집.
6. **Phase 6 — 설정 하위 (2-3일)**: 내정보 / 알림설정 / 가입신청 / 특별봉사 / 공지.
7. **Phase 7 — 구역 드릴다운 (2-3일)**: 동 / 카드 / 담당 / 지도.

각 phase 끝나면 80명에게 배포 → 피드백 → 다음 단계.

---

## Notes for the Developer

- **이 핸드오프는 관리자(admin) 역할만 다룹니다.** 인도자(leader) / 봉사자(user) 화면은 다음 라운드에 핸드오프됩니다. 단, 토큰·셸·컴포넌트는 공통이므로 이번에 잘 만들어두시면 다음 라운드는 빠릅니다.
- **개발자(developer) 권한은 admin과 동일**합니다 — 동일한 화면 라우트 사용.
- **배정 탭은 역할별로 화면이 다름**: admin은 wizard 2단계 (07-08). leader/user는 단계 디자인 별도.
- **데이터 모델**: 4개 카드 상태 (방문필요/완료/방문금지/정기방문) + 담당 view의 어휘 매핑 분리.
- 헤더의 알림(🔔) 카운트와 채팅(💬) 카운트는 unread 데이터에서 계산.
- PWA 설치 안내 카드는 dismissible — 설치 완료 후 사라지게.

질문 있으시면 디자이너에게 컨택 부탁드립니다.
