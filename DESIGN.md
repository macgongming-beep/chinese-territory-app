---
version: alpha
name: chinese-territory-app-design
description: "80명 회중 내부용 봉사 구역 관리 PWA. Notion 의 따뜻한 회색 톤(warm grays)을 기반으로 우리 브랜드 블루를 포인트 컬러로 사용. 라이트 모드 전용. 데이터/리스트 중심 화면에서 눈 피로 적고 친근한 분위기를 목표."

colors:
  # ── 브랜드 (기존 유지) ──
  primary: "#1E5BD0"           # --primary-600
  primary-hover: "#2D6CDF"     # --primary-500
  primary-pressed: "#1848A8"   # --primary-700
  primary-tint: "#EFF4FE"      # --primary-50 (배경 강조용)
  on-primary: "#FFFFFF"

  # ── 표면 (Notion warm) ──
  canvas: "#FFFFFF"            # 카드 흰 배경
  surface: "#FAFAF9"           # 앱 전체 배경 (surface-soft)
  surface-muted: "#F6F5F4"     # 비활성/채워진 영역

  # ── 보더 (Notion warm hairlines) ──
  hairline-soft: "#EDE9E4"
  hairline: "#E5E3DF"
  hairline-strong: "#C8C4BE"

  # ── 텍스트 (Notion warm grays) ──
  ink: "#1A1A1A"               # 가장 진한 본문
  charcoal: "#37352F"          # 강한 본문/제목
  slate: "#5D5B54"             # 일반 보조
  steel: "#787671"             # 약한 보조
  stone: "#A4A097"             # placeholder, disabled

  # ── 의미 컬러 ──
  semantic-success: "#059669"  # 진행/완료
  semantic-warning: "#D97706"  # 경고
  semantic-danger: "#DC2626"   # 위험/삭제

  # ── 종류 태그 (배정 종류 구분) ──
  tag-territory: "#2563EB"     # 구역 카드 (파랑)
  tag-informal: "#A855F7"      # 비공식 자료 (보라)
  tag-restaurant: "#EA580C"    # 식당 (주황)

typography:
  display-lg:
    fontFamily: Pretendard Variable
    fontSize: 24px
    fontWeight: 800
  display:
    fontFamily: Pretendard Variable
    fontSize: 20px
    fontWeight: 800
  heading:
    fontFamily: Pretendard Variable
    fontSize: 17px
    fontWeight: 700
  subhead:
    fontFamily: Pretendard Variable
    fontSize: 15px
    fontWeight: 700
  body:
    fontFamily: Pretendard Variable
    fontSize: 14px
    fontWeight: 500
  body-strong:
    fontFamily: Pretendard Variable
    fontSize: 14px
    fontWeight: 700
  small:
    fontFamily: Pretendard Variable
    fontSize: 12px
    fontWeight: 600
  micro:
    fontFamily: Pretendard Variable
    fontSize: 11px
    fontWeight: 600

rounded:
  xs: 6px
  sm: 8px
  md: 10px
  lg: 12px
  xl: 16px
  pill: 9999px

spacing:
  xxs: 4px
  xs: 8px
  sm: 12px
  md: 16px
  lg: 20px
  xl: 24px
  xxl: 32px

components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.body-strong}"
    rounded: "{rounded.md}"
    padding: "10px 16px"
  button-secondary:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.charcoal}"
    typography: "{typography.body-strong}"
    rounded: "{rounded.md}"
    padding: "10px 16px"
    border: "1px solid {colors.hairline}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.slate}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: "8px 12px"
  card:
    backgroundColor: "{colors.canvas}"
    rounded: "{rounded.lg}"
    padding: "{spacing.md}"
    border: "1px solid {colors.hairline}"
    shadow: "0 1px 2px rgba(16, 24, 40, 0.04)"
  card-row:
    backgroundColor: "{colors.canvas}"
    rounded: "{rounded.md}"
    padding: "{spacing.sm} {spacing.md}"
    border: "1px solid {colors.hairline-soft}"
  input:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "10px 12px"
    border: "1px solid {colors.hairline}"
  chip:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.steel}"
    typography: "{typography.small}"
    rounded: "{rounded.pill}"
    padding: "5px 12px"
    border: "1px solid {colors.hairline}"
  chip-active:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.small}"
    rounded: "{rounded.pill}"
    padding: "5px 12px"
---

## Overview

이 앱은 80명 회중의 내부 봉사 구역 관리 PWA. 매일 보는 화면이라 **눈 피로 적고 친근한 톤**이 중요.

**핵심 원칙**
- 라이트 모드 전용 (다크모드 미지원)
- 한국어 1순위 (Pretendard Variable)
- 모바일 first, PC 동일 컴포넌트 재사용
- 따뜻한 회색 (Notion 차용) — 차분한 데이터 표시
- 브랜드 블루 1색 — 절제해서 사용 (CTA, 활성 상태, focus ring 만)
- 데이터/리스트 중심 — 카드 + hairline 패턴

## Colors

### 브랜드
- `primary` (#1E5BD0): 주요 CTA, 활성 칩, 강조 텍스트, 링크
- `primary-tint`: 부드러운 배경 강조 (선택된 행 등)

### 표면
- `canvas` (#FFFFFF): 카드 흰 배경
- `surface` (#FAFAF9): 앱 전체 배경, 빈 공간
- `surface-muted` (#F6F5F4): 비활성 칩, 헤더, 보조 영역

### 텍스트 위계
| 토큰 | 색 | 용도 |
|---|---|---|
| `ink` | #1A1A1A | 가장 강조되는 본문 (사실상 잘 안 씀) |
| `charcoal` | #37352F | 제목, 본문 (기본) |
| `slate` | #5D5B54 | 보조 텍스트, 부가 설명 |
| `steel` | #787671 | 약한 보조, 메타 정보 |
| `stone` | #A4A097 | placeholder, disabled |

### 종류 태그 (배정 화면 등)
- `tag-territory` (#2563EB): 구역 카드
- `tag-informal` (#A855F7): 비공식 증거 카드
- `tag-restaurant` (#EA580C): 식당 봉사

색 점(dot 6px) 또는 미니 라벨로만 사용. 카드 배경/큰 영역에 쓰지 말 것.

### 의미
- success (#059669): 완료, 진행 OK
- warning (#D97706): 경고, 미배정
- danger (#DC2626): 삭제, 위험

## Typography

- 한국어 첫 번째: **Pretendard Variable**
- 영문 fallback: `-apple-system, BlinkMacSystemFont, system-ui, Apple SD Gothic Neo, Noto Sans KR`
- 영문 mono: `JetBrains Mono, SFMono-Regular, Consolas`

**위계**
- 24px / 800 — 페이지 큰 제목 (드물게)
- 20px / 800 — 섹션 제목
- 17px / 700 — 카드 제목, 헤더
- 15px / 700 — 서브헤더, 강조 본문
- 14px / 500 — 기본 본문
- 14px / 700 — 강조 본문, 버튼
- 12px / 600 — 보조 텍스트, 카운트, 칩
- 11px / 600 — 마이크로 (뱃지, 메타)

**원칙**
- 한 화면에 폰트 사이즈 3개 이내
- 굵기로 위계 → 색으로 한 번 더 위계
- 마이크로(11px) 는 카운트, 시간, 뱃지에만

## Spacing

4pt grid: 4 / 8 / 12 / 16 / 20 / 24 / 32

**카드 내부**: 12~16px 패딩
**카드 간격**: 8~12px
**섹션 간격**: 20~24px
**페이지 좌우 패딩**: 16px (모바일), 24~32px (PC)

## Shapes (Radius)

- `xs` 6px — 작은 칩, 뱃지
- `sm` 8px — 버튼, 입력, 작은 카드
- `md` 10px — 일반 카드 행
- `lg` 12px — 컨테이너 카드
- `xl` 16px — 큰 모달/시트
- `pill` 9999px — 칩, 토글

## Elevation

그림자는 **거의 없거나 매우 미세**.
- `0 1px 2px rgba(16, 24, 40, 0.04)` — 카드 기본
- `0 4px 12px rgba(16, 24, 40, 0.08)` — 떠 있는 시트/팝오버
- 그 이상은 모달만

깊이는 주로 **hairline border + surface 톤 차이**로 표현. 그림자 의존 X.

## Components

### 버튼
- **primary**: 브랜드 블루 fill — 페이지당 1~2개만
- **secondary**: 흰 배경 + hairline + charcoal 텍스트 — 일반 액션
- **ghost**: 투명 + slate 텍스트 — 보조 액션, 텍스트 링크 대체

### 카드
- **card**: 컨테이너용 (radius lg, padding 16, border)
- **card-row**: 리스트 행 (radius md, padding 12 16, soft border)

### 칩
- 기본: 흰 배경 + hairline border + small typography
- 활성: 브랜드 fill + 흰 텍스트
- 펄스 같은 애니메이션 X

## Do / Don't

### Do
- 본문은 `charcoal` (#37352F), 보조는 `slate`/`steel`
- 카드 = `canvas` 흰 배경 + `hairline` 1px 보더
- 액션 컬러는 **brand-primary 한 가지만**
- 종류 구분은 작은 컬러 dot (6px) 으로
- hairline 으로 영역 구분, 그림자 X
- spacing 은 4pt grid 따라

### Don't
- 검정 (`#000000`) 본문 — 너무 강함
- 차가운 회색 (`#9CA3AF`) — 우리 톤과 안 맞음
- 두 가지 이상의 액센트 컬러 (파랑 + 보라 등)
- 큰 카드를 컬러 fill 로 칠하기 (Notion 마케팅처럼)
- 큰 그림자, glow, 네온 효과
- 1색만 쓰는 한 화면에서 다른 액센트 끼워넣기

## 추후 작업

- 글로벌 토큰은 `src/index.css` 에 반영됨 (warm gray scale)
- 점진적으로 hard-coded 색을 토큰으로 교체
- 새 컴포넌트는 위 components 정의 따를 것
