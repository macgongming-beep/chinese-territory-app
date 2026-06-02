# 앱 전체 검토 리포트 (2026-06)

> 큰 기능(인도자 배정 통합, fetchSlices 최적화, 구글시트 백업) 완료 후 점검.
> 4개 영역: 운영 SQL / 안정성·버그 / 성능 / 코드 정리.

---

## 0. 건강 상태 요약

| 항목 | 상태 |
|---|---|
| 빌드 (tsc + vite) | ✅ 통과 (TS 에러 0) |
| lint | ⚠️ 191 에러 (대부분 `react-hooks/purity` 등 기존 패턴, 배포 무관) |
| 거대 파일 | ⚠️ DesktopTerritory 3190 / MobileMap 2504 / MapCanvas 1697 |
| 루트 잔재 | ⚠️ 파이썬 스크립트 122개 (i18n 작업 잔재) |

---

## 1. 운영 SQL 적용 확인 🔴 최우선

**조치:** `supabase/_VERIFY_production.sql` 를 운영 Supabase에서 1회 실행 → ❌ MISSING 항목 확인 후 해당 SQL 실행.

특히 최근 기능이 의존하는 것:
- `calendar_events.assignment_status / assignment_shared_at` — 배정 공유
- `event_card_assignment_cards` — 다중 카드 배정
- `on_event_card_assignment_insert` 트리거 — 배정 알림
- `mark_all_chats_read` RPC — 채팅 모두읽음
- `notify_on_chat_message`의 system 스킵 — 시스템 채팅 알림 제거
- units 상태 `대상외` 허용

→ 이게 안 맞으면 배정 공유/알림/채팅이 **조용히 실패**할 수 있음.

---

## 2. 안정성 · 버그

### 발견된 것
| 위험 | 내용 | 우선순위 |
|---|---|---|
| **'김민준' 하드코딩 폴백** | visitor가 localStorage에 없으면 방문기록이 '김민준'으로 잘못 기록. 로그인 시 항상 set되지만, 캐시 클리어/새기기 중간 상태에서 위험 | 중 |
| **구역 0개 팀 공유 손실** | 멤버만 있고 카드 없는 팀은 공유 시 저장 안 됨 (B안 경고로 완화 완료) | 낮음(완화됨) |
| **localStorage draft 다기기 충돌** | 진입 시 서버 shared 로드 + 3선택지로 완화 완료 | 낮음(완화됨) |

### 권장 조치
- `'김민준'` 폴백 → 빈 문자열 또는 "기록 실패" 처리로 변경 (오기록 방지)
- 나머지는 이미 완화됨

### 미점검 (수동 QA 필요)
실제 흐름은 코드만으론 다 못 봄. 운영에서 한 바퀴:
- 로그인 → 방문기록 → 일정신청 → 배정 → 채팅 → 알림
- 인도자 배정 공유 후 봉사자에게 알림 오는지
- 오프라인(지하) 상태에서 방문기록 시 동작

---

## 3. 성능 / 데이터 사용량

### 잘 된 것 (fetchSlices 최적화 효과)
- mutation별 부분 refetch (visits→5 SELECT, 공지→1)
- useUserChats 캘린더 구독 분리 (N×6 증폭 제거)
- visibility 디바운스 2분
- 배정/구글시트 기능 모두 기존 slice 재사용 → 추가 부하 거의 0

### 예상 무료 티어 사용량
- 주 2-3일 활성 패턴 기준 **~0.6 GB/월** (Free 5GB의 12%)
- 50명까지 늘어도 안전

### 추가 여지 (필요 시)
- visit_histories 12개월 필터 → 운영 1년 후 통계 별도 RPC 고려
- 이미지(비공식 카드) WebP 변환 (현재 JPEG) — 필요해지면

---

## 4. 코드 정리 / 유지보수

### 즉시 가능 (낮은 위험)
- **루트 파이썬 스크립트 122개 삭제** — i18n 작업 잔재, 더 이상 불필요
  - `rm *.py __pycache__` (단, 혹시 쓰는 게 있나 확인 후)
- 미사용 컴포넌트: `MobileLeaderAssignment.tsx`, `MobileCalendar.tsx` (legacy, 이제 미사용) → 삭제 검토

### 중기 (큰 작업, 별도 진행)
- 거대 파일 분할: DesktopTerritory(3190), MobileMap(2504)
- lint 에러 191개 정리 (react-hooks/purity 패턴)

---

## 권장 진행 순서 (v1 — 1차)

1. 운영 SQL 확인 → ✅ **완료 (22개 전부 OK)**
2. 수동 QA 한 바퀴
3. '김민준' 폴백 수정
4. 파이썬 잔재 + 미사용 컴포넌트 삭제 → ✅ **완료**
5. (장기) 거대 파일 분할 / lint 정리

---

# v2 — 코덱스·제미나이 2차 리뷰 반영 (재조정)

> 두 리뷰가 내가 "완화됨"으로 과소평가한 **배정 공유 정합성**과
> **김민준 데이터 오염**을 정확히 지적. 우선순위 전면 재조정.

## 🔴 P0 — 데이터 오염/정합성 (운영 데이터 손상 위험)

### P0-1. '김민준' 폴백 → 데이터 영구 오염 (제미나이 1순위)
- 위험: visitor 없을 때 방문기록이 전부 '김민준'으로 → 누가 남겼는지 영영 모름
- 어르신들 캐시 클리어/새 기기 빈번 → 실제 터질 확률 높음
- **조치:** `getCurrentVisitor()` 폴백 '김민준' 제거.
  - 이름 없으면 → 방문기록 **차단 + "다시 로그인" 안내** (조용히 오기록 금지)
  - `shared.ts`, `visits.ts`, `regularVisits.ts` 전부

### P0-2. 배정 공유 정합성 — delete→insert→status 비원자적 (코덱스 High)
- `eventAssignments.ts`: 다중카드 delete → 대표 insert → 다중 insert → status update 가 따로
- 다중카드 insert 실패해도 warn/toast만 하고 **공유 상태는 올라감** → "대표만 저장됐는데 공유됨"
- **조치:** 단일 RPC 트랜잭션으로 묶기. 한 단계라도 실패하면 status='shared' 안 올림
  - SQL: `assign_cards_bulk_tx(p_token, p_event_id, p_assignments jsonb, p_status, p_expected_shared_at)`

### P0-3. stale draft가 최신 공유본 덮어쓰기 (코덱스 High)
- 충돌 감지가 진입 시점만 (resolveDraftEntry). 공유 시점 재검증 없음
- A가 편집 중 B가 먼저 공유 → A의 오래된 draft가 덮어씀
- **조치:** onShare에 "편집 시작 때 본 assignment_shared_at" 동봉 → 서버 compare-and-set.
  P0-2의 RPC에 `p_expected_shared_at` 파라미터로 통합 (서버 값과 다르면 거부 → 사용자에 재선택)

## 🟡 P1 — Silent failure / 정합성 (조용한 실패)

### P1-1. 방문기록 상태/히스토리 비원자 (코덱스 Medium)
- `visits.ts`: units.status 먼저 변경 → 히스토리 저장 실패 시 "상태O 기록X"
- `regularVisits.ts`: 로그 insert 후 return_visits.last_* 갱신 에러 미체크 → 요약 stale
- **조치:** 최소 에러 체크 강화, 가능하면 핵심 경로 RPC화 (P0 이후)

### P1-2. localStorage draft 저장 실패 조용히 무시 (코덱스+제미나이)
- save/load/clear catch 후 무알림 → "임시저장 된 줄 알았는데 사라짐"
- **조치:** 저장 실패 toast + malformed draft validation

### P1-3. 참가자 sanitize 조용한 멤버 제거 (코덱스 Medium)
- participants 데이터 늦거나 누락 시 팀원이 조용히 빠짐
- **조치:** sanitize로 제거된 인원 있으면 토스트로 알림 ("○○님이 신청 취소로 제외됨")

### P1-4. 기타 silent failure (코덱스)
- 다중카드 delete 결과 미확인 / serviceLog 실패 스킵 / chatSystem warn-only
  / CSV 방문기록 insert 미노출 / 식당명 일괄 업데이트 미확인
- **조치:** 사용자 영향 있는 것만 에러 노출 (로그성은 둬도 됨)

## 🟢 P2 — UX / 정책

### P2-1. 미배정 인원 검색 (제미나이 — 40명 환경)
- 실참 30~40명이면 미배정 칩 수십 개 → 스크롤 피로
- **조치:** 팀짓기 화면에 미배정 인원 **검색/초성 필터** 추가

### P2-2. 팀 삭제 시 구역 카드 고아 경고 (제미나이)
- 팀 삭제하면 배분했던 구역이 경고 없이 미배정으로 풀림
- **조치:** 구역 배분된 팀 삭제 시 "구역 N개도 해제됩니다" 확인

### P2-3. PC leader 권한이 모바일보다 넓음 (코덱스 Medium)
- `DesktopCalendar`: leader면 모든 일정 편집/참가자 관리 가능
- 모바일은 "관리자/개발자 또는 해당 일정 인도자"로 좁음
- **조치:** PC도 모바일 정책에 맞춤 (본인 인도 아닌 일정은 보기만)

### P2-4. 채팅 알림 공해 (제미나이)
- 40명 한 방 → 이모티콘 하나에 40명 알림
- **조치:** 채팅방 음소거(mute) — 일부는 chat_room_mutes 테이블 이미 있음, UI 연결 확인

## 🔵 P3 — 무료 티어 장기 (제미나이)

### P3-1. DB 용량 500MB retention
- 채팅/방문기록/메모 누적 → 진짜 병목은 트래픽 아닌 DB 용량
- **조치:** 오래된 채팅(60-90일)·service_logs(30일) 정리 cron + 백업

### P3-2. Realtime 200 동시연결 / 웹소켓 drop fallback
- 주말 40명 동시 → 한도 근접 가능
- **조치:** Phase 6(백그라운드 채널 해제) 재검토 + drop 시 재연결/폴링 fallback

### P3-3. 교차기기 draft 연동 (제미나이) — 선택
- 폰↔PC draft 안 이어짐 → 서버사이드 draft (큰 작업, V2+)

---

## 재조정된 진행 순서 (확정)

1. ✅ 운영 SQL 확인 (완료)
2. ✅ 파이썬/legacy 정리 (완료)
3. **P0-1 김민준 폴백 제거** (즉시, 작음)
4. **P0-2 + P0-3 배정 공유 RPC 트랜잭션 + version check** (SQL + 클라)
5. **P1 silent failure / draft UX 보강**
6. **P2-1 미배정 검색 + P2-2 팀삭제 경고 + P2-3 PC 권한** (UX)
7. P2-4 채팅 mute UI
8. (장기) P3 retention / realtime / 거대파일 / lint

**핵심 변경:** "김민준 폴백"과 "배정 공유 정합성"이 최우선(P0)으로 격상.
배정 공유 delete-all→insert는 운영 데이터 꼬이면 아프므로 RPC 트랜잭션화 필수.

---

**작성:** 1차 자체점검 → 코덱스·제미나이 2차 리뷰 반영 v2.
