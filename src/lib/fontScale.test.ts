import { describe, test, expect, beforeEach } from 'vitest'
import { loadFontScale, saveFontScale, applyFontScale, fontScaleKey, isFontScale, FONT_SCALES } from './fontScale'

beforeEach(() => { localStorage.clear(); document.documentElement.removeAttribute('data-font-scale') })

describe('글씨 크기 저장', () => {
  test('처음에는 보통이다 — 아무도 화면이 안 바뀐다', () => {
    expect(loadFontScale(7)).toBe('normal')
  })

  test('사용자별로 따로 기억한다', () => {
    saveFontScale(7, 'large')
    expect(loadFontScale(7)).toBe('large')
    expect(loadFontScale(8)).toBe('normal')   // 다른 사람은 영향 없다
  })

  test('로그인 안 한 상태도 자리가 있다', () => {
    expect(fontScaleKey(undefined)).toBe('chsFontScale:guest')
  })

  test('⚠ 이상한 값이 저장돼 있으면 보통으로 떨어진다', () => {
    localStorage.setItem(fontScaleKey(7), 'gigantic')
    expect(loadFontScale(7)).toBe('normal')
  })

  test('허용하는 값은 셋뿐이다', () => {
    expect([...FONT_SCALES]).toEqual(['normal', 'large', 'x-large'])
    expect(isFontScale('large')).toBe(true)
    expect(isFontScale('huge')).toBe(false)
  })
})

describe('화면에 적용', () => {
  test('키우면 html 에 표시가 남는다', () => {
    applyFontScale('large')
    expect(document.documentElement.getAttribute('data-font-scale')).toBe('large')
  })

  test('⚠ 보통이면 표시를 **지운다** — 안 켠 사람에게 zoom 을 걸지 않기 위해서다', () => {
    applyFontScale('x-large')
    applyFontScale('normal')
    expect(document.documentElement.hasAttribute('data-font-scale')).toBe(false)
  })
})
