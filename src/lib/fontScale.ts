// 글씨 크기 — **원하는 사람만** 키운다. 기본은 지금과 픽셀 단위로 같다.
//
// 왜 이 방식인가 (2026-08-28, 브라우저에서 실측하고 정했다):
//   글씨 크기를 정하는 곳이 2,515곳이고 전부 px 이다. 그걸 다 바꾸는 대신
//   `#root` 에 `zoom` 을 준다 — 글씨·간격·높이가 **같이** 커져서 잘리지 않는다.
//
//   ⚠ 실측에서 걸린 것: `zoom` 안에서 `calc(100svh / var(--app-zoom, 1))` 가 화면보다 커진다
//     (812 → 1015 = ×1.25). 그래서 화면높이 단위 42곳을
//     `calc(100svh / var(--app-zoom, 1))` 로 나눠 보정했다. 확인: 812px 로 정확히 맞는다.
//
//   ⚠ 안 켠 사람에게는 `zoom` 속성 자체를 **안 붙인다** (html 에 속성이 없으면
//     CSS 규칙이 안 걸린다). `zoom: 1` 도 stacking context 를 만들 수 있어서,
//     "기본은 아무것도 안 바뀐다" 를 보장하려면 아예 안 거는 편이 맞다.

export const FONT_SCALES = ['normal', 'large', 'x-large'] as const
export type FontScale = (typeof FONT_SCALES)[number]

export const DEFAULT_FONT_SCALE: FontScale = 'normal'

/** 사용자별로 저장한다 (언어와 같은 방식). 폰은 크게, PC 는 보통이 자연스럽다 */
export const fontScaleKey = (userId?: number) => `chsFontScale:${userId ?? 'guest'}`

export function isFontScale(v: unknown): v is FontScale {
  return typeof v === 'string' && (FONT_SCALES as readonly string[]).includes(v)
}

export function loadFontScale(userId?: number): FontScale {
  try {
    const v = localStorage.getItem(fontScaleKey(userId))
    return isFontScale(v) ? v : DEFAULT_FONT_SCALE
  } catch {
    return DEFAULT_FONT_SCALE   // localStorage 를 못 쓰면 기본
  }
}

export function saveFontScale(userId: number | undefined, scale: FontScale): void {
  try { localStorage.setItem(fontScaleKey(userId), scale) } catch { /* 무시 */ }
}

/**
 * html 에 표시를 남긴다. CSS 가 그걸 보고 `#root` 에 zoom 을 건다.
 * ⚠ 'normal' 이면 **속성을 지운다** — 안 켠 사람에게 zoom 을 안 걸기 위해서다.
 */
export function applyFontScale(scale: FontScale, root: HTMLElement = document.documentElement): void {
  if (scale === DEFAULT_FONT_SCALE) root.removeAttribute('data-font-scale')
  else root.setAttribute('data-font-scale', scale)
}
