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

## 권장 진행 순서

1. **운영 SQL 확인** (_VERIFY_production.sql 실행) — 지금 바로
2. **수동 QA** 한 바퀴 — 운영에서 핵심 흐름
3. **'김민준' 폴백 수정** — 30분
4. **파이썬 잔재 + 미사용 컴포넌트 삭제** — 정리
5. (장기) 거대 파일 분할 / lint 정리

---

**작성:** 큰 기능 완료 후 1차 점검. 운영 SQL과 수동 QA가 가장 시급.
