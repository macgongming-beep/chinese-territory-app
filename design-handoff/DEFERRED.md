# 디자인 리디자인 — 미루기 / 잡일 리스트

다음 라운드에 잊지 않게 모아두는 목록.

## 캘린더 (Phase 3c)

- [ ] **시간 범위 (시작~종료)** — DB `calendar_events.end_time` 컬럼 추가 + 타입/transform/UI 업데이트
- [ ] 일정 상세 시트 댓글/채팅 실제 연동 (현재 placeholder)
- [ ] 일정 상세 시트 ⋮ 메뉴 — 편집 옵션 추가 (현재는 삭제만)
- [ ] 일정 상세 시트 지도 썸네일 실제 지도로 (현재 grid placeholder)

## 홈 (Phase 3a)

- [ ] (없음 — 일단 완성)

## 배정 (Phase 3e)

- [ ] 인도자 카드에 "마지막 활동" 우측 표시 — visit_histories 또는
  service_sessions 의 latest 계산 필요 (현재 데이터 prop 으로 안 받음)
- [ ] Step 2 에서 이미 배정된 카드도 "배정됨 (by 김휘민)" 으로 보이게
  (디자인 08 의 taken 상태) — 현재는 미배정만 필터링됨

## 일반

- [ ] 글로벌 `button { min-height: 40px }` 제거 검토 — 모든 작은 버튼이 영향받음. 현재는 컴포넌트별 `minHeight` override 로 대응 중.
- [ ] leader / user 디자인 핸드오프 받으면 토큰/셸은 자동 적용. 화면별 적용은 별도 작업.
