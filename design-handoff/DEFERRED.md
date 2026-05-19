# 디자인 리디자인 — 미루기 / 잡일 리스트

다음 라운드에 잊지 않게 모아두는 목록.

## 알림 클릭 동선

- [x] event_change 알림 → 일정 상세 시트 (openEvent)
- [ ] assignment / service_started / service_ended 알림 → 현재 /territory
  로만 보내고 있음. leader/user 활동 화면이 새 디자인으로 리뉴얼되면:
  - assignment → /territory#assignments 같은 anchor 로 deep-link
  - service_started/ended → 그 봉사 세션 카드로 스크롤
  - 또는 토스트만 띄우고 navigate 안 할 수도

## 일정 상세 — 지도 임베드 (방법 B)

- [ ] 일정 상세 시트 위치 카드에 **실제 지도 미리보기** 렌더링
  - 현재: 카드 클릭 → 네이버 외부 페이지 열림 (방법 A)
  - 향후: Naver Maps JS API 로 카드 안에 작은 지도 표시
  - 필요 작업:
    1. 일정 추가 폼에 "지도에서 위치 선택" 버튼 (좌표 캡처)
    2. DB `calendar_events.lat`, `lng` 컬럼 추가
    3. 일정 상세에서 그 좌표로 작은 지도 렌더링
  - 예상 시간: 1~2시간

## 캘린더 (Phase 3c)

- [ ] **시간 범위 (시작~종료)** — DB `calendar_events.end_time` 컬럼 추가 + 타입/transform/UI 업데이트
- [x] 일정 상세 시트 댓글/채팅 실제 연동 (custom event `app:open-event-chat`)
- [x] 일정 상세 시트 ⋮ 메뉴 — 편집 옵션 추가
- [ ] 일정 상세 시트 지도 썸네일 실제 지도로 (현재 grid placeholder)

## 홈 (Phase 3a)

- [ ] (없음 — 일단 완성)

## 배정 (Phase 3e)

- [ ] 인도자 카드에 "마지막 활동" 우측 표시 — visit_histories 또는
  service_sessions 의 latest 계산 필요 (현재 데이터 prop 으로 안 받음)
- [ ] Step 2 에서 이미 배정된 카드도 "배정됨 (by 김휘민)" 으로 보이게
  (디자인 08 의 taken 상태) — 현재는 미배정만 필터링됨

## 설정 하위 화면

- [ ] 특별봉사 시즌 생성 모달 (지속 칩 3/5/7/10/14, 시작일 picker,
  종료일 summary, 50/50 취소+생성 버튼) — 디자인 18 정밀 매칭
  현재는 활성 시즌 카드만 토큰 정리, 모달은 그대로
- [ ] 가입 신청 빈 상태의 ✓ 아이콘을 큰 체크 SVG 로

## 일반

- [ ] 글로벌 `button { min-height: 40px }` 제거 검토 — 모든 작은 버튼이 영향받음. 현재는 컴포넌트별 `minHeight` override 로 대응 중.
- [ ] leader / user 디자인 핸드오프 받으면 토큰/셸은 자동 적용. 화면별 적용은 별도 작업.
