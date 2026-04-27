# CHS-Yongin 통합 브리프 (ChatGPT 전달용)

작성일: 2026-04-23  
프로젝트 경로: `/Users/gm/Documents/New project/chinese-territory-app`  
로컬 실행 URL: `http://localhost:5173/`

---

## 1) 프로젝트 목적 (왜 만드는가)

이 시스템은 단순 지도 앱이 아니라, 중국어 구역 봉사 운영을 하나로 통합한 플랫폼이다.

- 기존 운영: 네이버지도 핀 + 구글시트 + 밴드식 일정 신청이 분리됨
- 문제: 현장(모바일) 기록이 느리고, 지도/기록/배정/통계가 끊겨 있음
- 목표: 아래 흐름을 한 화면 체계로 연결
  - 일정 생성/신청 -> 카드 배정 -> 지도 방문 -> 건물/세대 기록 -> 통계 반영

핵심 운영 단위는 주소가 아니라 `카드`다.

---

## 2) 현재 제품 구성 (IA)

### PC 상단 탭
- 홈
- 공지
- 캘린더
- 구역
- 지도
- 배정
- 사용자
- 설정

### 모바일 하단 탭
- 홈
- 캘린더
- 구역
- 지도
- 설정

### 역할
- `admin`(관리자): 전체 관리 + 권한/사용자/삭제 등
- `leader`(인도자): 운영/배정/현장 리딩
- `user`(봉사자): 신청/봉사 시작/현장 기록

관리자는 헤더 토글로 관리자/인도자/봉사자 UI 프리뷰 가능하게 구성됨.

---

## 3) 핵심 도메인 모델

### 카드 구조
- 대권역: 처인구/기흥구/수지구/영통구/화성시
- 동
- 카드 번호: 예) `처인구 고림동 1`
- 건물 유형(상가/주택/전체)은 카드 그리기 단위가 아니라 필터/운영 분류로 사용

### 상태/시간대
- 세대 상태: `미방문/만남/부재/한국인/거절/확인필요`
- 봉사 시간대: `오전/오후/저녁`
- 건물 상태 집계: `방문필요/방문완료/방문금지/정기방문`

### 정기방문 개념
- 봉사자가 호의적인 중국인을 만나면 `정기방문` 등록
- 포인트에서 담당 정기방문자 확인 가능
- 중복 방문 방지 목적

---

## 4) 현재까지 구현 완료 사항 (요약)

## 4-1. 지도/구역
- 네이버 지도 기반 건물 핀 표시
- 카드 구역선 표시/수정/저장/삭제
- 카드 클릭 시 지도 포커스 및 경계선 하이라이트
- 모바일 핀 선택 -> 하단 시트 상세 연동
- 핀 기반 건물 추가 + 우측 패널 기반 추가 UX 정리
- 핀 위치 수정 모드 도입(+ 버튼에서 액션 선택)

## 4-2. 캘린더
- 일정 CRUD
- 반복 일정(시리즈) 편집/삭제
- `봉사 모임 있음` 필드 반영
- `봉사 신청 가능 여부(allowApplications)` 반영
- 신청 불가 일정은 신청 UI 비활성/숨김 처리 흐름 반영

## 4-3. 봉사 세션(핵심)
- `봉사 시작/종료` 세션 모델 추가
- 세션에 시간대/카드/source 저장
- source:
  - `assigned`
  - `manual`
  - `manual_override`
- 일반 봉사자는 active session 없으면 지도 기록 제한
- 인도자/관리자는 기록 제한 완화
- 캘린더 신청자별 카드 배정 + 홈에서 카드 검색 시작 모두 지원

## 4-4. 사용자/권한
- 사용자 제거 기능 추가(관리자)
- 과거 방문 기록 때문에 이름이 남는 경우:
  - 기존 `미가입` -> `삭제됨` 텍스트로 변경
  - 회색 톤으로 구분 표시

## 4-5. CSV 업로드
- 건물 CSV 업로드 모달/검증/요약/삽입 구현
- 카드 직접 지정 또는 좌표/주소 기반 처리
- 중복/실패 행 제외 사유 표시
- 업로드 후 카드 재배정 기능(좌표 기반 재매칭) 방향 포함

## 4-6. 성능/번들
- 기존 단일 번들(약 692KB) -> 코드 분할 적용
- `App.tsx`에서 Desktop/Mobile 동시 import 제거
- `React.lazy + Suspense`로 지연 로드
- `vite manualChunks`로 `vendor/map/desktop/mobile` 분리
- 현재 빌드 경고(500KB 초과)는 해소됨

---

## 5) 업로드(CSV) 현행 규칙 정리

### 5-1. 권장 헤더
`카드명,주소,건물명,유형,호수,위도,경도`

### 5-2. 동작 원칙
- `카드명` 있으면 우선 해당 카드로 매핑
- 카드가 없거나 틀린 경우:
  - 주소 -> geocoding -> 좌표
  - 좌표가 카드 경계선 안에 포함되면 자동 재배정 가능
- 위경도 있으면 geocode 생략하고 좌표 우선

### 5-3. 제외 사유 대표
- 카드 매칭 불가
- 주소 geocode 실패
- 필수값 누락
- 중복(building 기준)으로 판단

### 5-4. 운영 팁
- 주소는 도/시/구/동 + 도로명 + 번지까지 구체적으로 입력할수록 성공률 상승
- 네이버 콘솔에서 `Geocoding`과 `Reverse Geocoding` 모두 활성화 필요

---

## 6) 데이터베이스 핵심 테이블(요약)

`cards`, `buildings`, `units`, `visit_histories`, `calendar_events`, `event_card_assignments`, `service_sessions`, `notices`, `card_boundaries`

특히 최근 추가:
- `service_sessions`
- `event_card_assignments`
- `visit_histories.service_session_id`

SQL 참고:
- `/Users/gm/Documents/New project/chinese-territory-app/supabase/add_service_sessions.sql`

---

## 7) 현재 남은 주요 과제

1. 봉사 세션 통계 대시보드 고도화
- 세션별 기록수
- 시간대별 만남/부재/한국인/중국인/정기방문/방문금지
- 사용자별 봉사 시간

2. 지도/구역 UX 미세 조정
- 필터 축소/확장
- 상세패널/경계선 토글 정합성 유지
- 모바일 드래그/새로고침 충돌 추가 점검

3. 인증/권한 구조 실제화
- 현재 일부 관리자 프리뷰 토글 기반 동작이 있어 실제 계정 권한과 완전 결합 필요

4. 업로드 품질 보강
- 제외 사유를 더 세분화해서 사용자 친화적으로 표기
- 주소 정규화 규칙(동 중복, 텍스트 잡음) 강화

---

## 8) ChatGPT에게 물어보면 좋은 질문(바로 사용 가능)

1. 서비스 세션 기반 통계 설계를 어떻게 하면 현장 실사용과 관리지표를 동시에 만족시키는가?
2. 카드 경계선 기반 자동 재배정 정확도를 높이는 주소 정규화/좌표 보정 전략은?
3. 인도자-봉사자 배정 혼합 운영(사전 배정 + 현장 수동 시작)의 충돌 없는 UX 설계안은?
4. 대규모(1000+ 건물, 60+ 사용자)에서 지도 성능/쿼리/캐시 구조를 어떻게 가져가야 하는가?
5. 모바일 봉사 화면에서 입력 실수(오클릭) 복구를 빠르게 만드는 UX 패턴은?

---

## 9) 이번 업데이트 핵심 파일 (참고)

- `/Users/gm/Documents/New project/chinese-territory-app/src/App.tsx`
- `/Users/gm/Documents/New project/chinese-territory-app/vite.config.ts`
- `/Users/gm/Documents/New project/chinese-territory-app/src/components/DesktopUsers.tsx`
- `/Users/gm/Documents/New project/chinese-territory-app/src/hooks/useAuth.ts`
- `/Users/gm/Documents/New project/chinese-territory-app/src/hooks/useStore.ts`
- `/Users/gm/Documents/New project/chinese-territory-app/src/components/DesktopMap.tsx`
- `/Users/gm/Documents/New project/chinese-territory-app/src/components/MobileMap.tsx`
- `/Users/gm/Documents/New project/chinese-territory-app/src/components/DesktopCalendar.tsx`
- `/Users/gm/Documents/New project/chinese-territory-app/src/components/DesktopHome.tsx`
- `/Users/gm/Documents/New project/chinese-territory-app/src/components/MobileHome.tsx`
- `/Users/gm/Documents/New project/chinese-territory-app/supabase/add_service_sessions.sql`

---

## 10) 한 줄 요약

현재 시스템은 `지도 + 카드 + 캘린더 + 봉사세션 + 기록 + 업로드`를 이미 연결한 MVP+ 단계이며, 다음 단계는 통계 정교화와 운영 UX 고도화다.
