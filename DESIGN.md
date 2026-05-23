---
version: current
name: chinese-territory-app-design
updated: 2026-05-24
description: "80명 회중 내부용 봉사 구역 관리 PWA. 따뜻한 회색(Notion warm gray) 위에 잉크 블랙을 1순위 액션 컬러로. 브랜드 블루 없음. 라이트 모드 전용."
---

## 핵심 원칙

- **모노톤 잉크 기반** — 브랜드 블루 없음. 검정(ink)이 버튼·액션·강조의 유일한 색
- 따뜻한 회색(Notion warm gray) — 차분하고 친근한 데이터 화면
- 라이트 모드 전용
- 모바일 first, 동일 컴포넌트 PC 재사용
- 상태색(danger/warn/ok/info)은 데이터 의미 전달용 — 액센트 장식 아님
- 그림자 최소화 — hairline + 배경 톤 차이로 깊이 표현

---

## 색상 토큰 (`src/index.css`)

### 배경 / 표면

| 토큰 | 값 | 용도 |
|---|---|---|
| `--bg` | `#F8F8F7` | 앱 전체 배경 |
| `--surface` | `#FFFFFF` | 카드·입력·패널 |
| `--paper` | `#F1F1EF` | 채팅방 등 보조 배경 |
| `--tint` | `#EFEFED` | pill·비활성·hover 배경 |

### 경계선

| 토큰 | 값 | 용도 |
|---|---|---|
| `--line` | `#E5E5E2` | 기본 1px 구분선 |
| `--line-2` | `#D4D4D0` | 보조 경계·토글 트랙 |

### 텍스트

| 토큰 | 값 | 용도 |
|---|---|---|
| `--ink` | `#1A1A18` | 최강조 텍스트·1순위 버튼·액션 |
| `--text` | `#3A3A36` | 기본 본문 |
| `--muted` | `#7A7A75` | 메타·보조 텍스트 |
| `--muted-2` | `#A8A8A2` | 더 약한 보조·chevron |
| `--muted-3` | `#C8C8C3` | 비활성·disabled |

### 상태색 (데이터 의미 전달용, 장식 아님)

| 토큰 | 값 | 용도 |
|---|---|---|
| `--status-danger` | `#C44536` | 위험·삭제·미사용 |
| `--status-danger-bg` | `#FBEDEA` | danger 배경 |
| `--status-warn` | `#B8862A` | 경고·정기방문 |
| `--status-warn-bg` | `#FBF3DF` | warn 배경 |
| `--status-ok` | `#4F7A4B` | 완료·사용완료 |
| `--status-ok-bg` | `#ECF1EA` | ok 배경 |
| `--status-info` | `#5B6B7C` | 정보·진행중 (slate) |
| `--status-info-bg` | `#EAEEF2` | info 배경 |

> 상태색은 작은 dot(6px), 배지, 보더 포인트에만 사용. 버튼·큰 영역 fill 금지.

---

## 타이포그래피

- 기본 폰트: **Pretendard Variable**
- 기본 body 크기: 15px / `--text` 색

| 용도 | 크기 | 굵기 |
|---|---|---|
| 페이지 제목 (드물게) | 24px | 800 |
| 섹션 제목 | 20px | 800 |
| 카드 제목·헤더 | 17px | 700 |
| 강조 본문·서브헤더 | 15px | 700 |
| 기본 본문 | 14px | 500 |
| 강조 본문·버튼 | 14px | 700 |
| 보조 텍스트·칩 | 12px | 600 |
| 뱃지·메타 | 11px | 600 |

**원칙**
- 한 화면에 폰트 사이즈 3개 이내
- 굵기로 위계 → 색으로 한 번 더 위계
- 11px은 카운트·시간·뱃지에만

---

## Radius

| 토큰 | 값 | 용도 |
|---|---|---|
| `--radius-sm` | `6px` | 작은 칩·뱃지·인라인 버튼 |
| `--radius-md` | `8px` | 버튼·입력 |
| `--radius-lg` | `12px` | 카드·컨테이너 |
| `--radius-xl` | `16px` | 바텀시트·모달 |
| `--radius-2xl` | `20px` | 큰 시트 |
| `--radius-full` | `9999px` | pill 칩·토글 |

---

## Spacing (4pt grid)

4 / 8 / 12 / 16 / 20 / 24 / 32px

- 카드 내부 패딩: 12~16px
- 카드 간격: 8~12px
- 섹션 간격: 20~24px
- 페이지 좌우 패딩: 16px (모바일) / 24~32px (PC)

---

## Elevation (그림자)

거의 없거나 매우 미세. 깊이는 hairline + 배경 톤 차이로.

```
--shadow-xs: 0 1px 2px rgba(16,24,40,0.04)   — 카드 기본
--shadow-sm: 0 1px 3px rgba(16,24,40,0.06)   — 약간 떠있는 카드
--shadow-md: 0 4px 12px rgba(16,24,40,0.08)  — 팝오버·시트
--shadow-lg: 0 12px 32px rgba(16,24,40,0.12) — 모달
```

---

## 컴포넌트 스펙

### 버튼

| 종류 | 배경 | 텍스트 | 보더 | 용도 |
|---|---|---|---|---|
| **solid** (primary) | `--ink` | `#FFFFFF` | 없음 | 페이지당 1~2개, 주요 CTA |
| **secondary** | `--surface` | `--text` | `1px --line-2` | 일반 액션 |
| **ghost** | 투명 | `--muted` | 없음 | 보조 액션·텍스트 링크 대체 |
| **danger** | `--status-danger` | `#FFFFFF` | 없음 | 삭제 등 비가역 액션 |

- 높이: `36~40px` (인라인 소형은 28~32px)
- 패딩: `10px 16px`
- Radius: `--radius-md` (8px)
- 폰트: 14px / 700
- 전환: `background 0.15s`

### 카드

| 종류 | 배경 | Radius | 패딩 | 보더 |
|---|---|---|---|---|
| container card | `--surface` | 12px | 16px | `1px --line` |
| row (리스트 행) | `--surface` | 8~10px | 12px 16px | `1px --line` (하단만) |

### 입력 (Input)

- 배경: `--surface`
- 보더: `1px --line` → focus `1px --ink`
- Radius: `--radius-md` (8px)
- 패딩: `10px 12px`
- 폰트: 14px / `--text`
- placeholder: `--muted-3`

### 칩 (Chip)

- 기본: 배경 `--tint`, 텍스트 `--muted`, radius pill, 패딩 `5px 12px`, 12px/600
- 활성: 배경 `--ink`, 텍스트 `#FFFFFF`

### 토글 (Toggle)

- 크기: 40×24px
- 트랙 off: `--line-2`, on: `--ink`
- 썸: `#FFFFFF`

---

## Do / Don't

### Do ✅
- 버튼 1순위 액션은 **ink solid** (검정 배경 흰 텍스트)
- 본문은 `--text` (#3A3A36), 보조는 `--muted`
- 카드 = `--surface` 흰 배경 + `--line` 1px 보더
- 상태 표시는 status 토큰 (작은 dot·배지·보더만)
- hairline으로 영역 구분, 그림자 최소화
- spacing은 4pt grid

### Don't ❌
- 브랜드 블루(`#1E5BD0`, `--primary-*`) 신규 UI에 사용
- 순수 검정(`#000000`) 직접 사용 — `--ink` 사용
- 차가운 회색 직접 하드코딩
- 상태색을 버튼 fill·큰 배경에 사용
- 두 가지 이상 액센트 컬러 혼용
- 큰 그림자·glow·네온
- `#f59e0b`, `#B8862A` 등 골드 계열을 UI 색으로 사용 (status-warn 데이터 표시 전용)

---

## 토큰 마이그레이션 현황

신규 컴포넌트는 `--ink/--text/--muted/--surface/--tint/--line` 만 사용.
기존 코드에 남아있는 `--primary-*`, `--brand-*`, `--gray-*` 는 점진적으로 교체 중.
하드코딩된 `#B8862A`, `#f59e0b` 계열도 점진 교체 대상.
