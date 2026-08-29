// 확대를 다시 막지 않게 지키는 감시 시험.
//
// 왜: 예전에 viewport 와 main.tsx 두 곳에서 핀치 확대를 막고 있었다.
// 그래서 "너무 작아서 안 보인다" 는 분들에게 **키울 방법이 아예 없었다.**
// 되돌리기 쉬운 종류의 변경이라(한 줄이면 다시 막힌다) 시험으로 못을 박는다.
import { describe, test, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const html = readFileSync('index.html', 'utf8')
const main = readFileSync('src/main.tsx', 'utf8')
const css = readFileSync('src/App.css', 'utf8')

describe('확대(접근성)를 막지 않는다', () => {
  test('viewport 에 user-scalable=no 가 없다', () => {
    expect(html).not.toMatch(/user-scalable\s*=\s*no/)
  })

  test('viewport 에 maximum-scale 제한이 없다', () => {
    // maximum-scale=1 이면 user-scalable 을 안 써도 확대가 막힌다
    expect(html).not.toMatch(/maximum-scale\s*=\s*1/)
  })

  test('전역으로 gesture 이벤트를 막지 않는다', () => {
    // ⚠ 지도 컨테이너 안에서 막는 것은 괜찮다. 전역(document)이 문제다.
    expect(main).not.toMatch(/addEventListener\(\s*'gesture(start|change|end)'/)
  })

  test('두 손가락 touchmove 를 전역으로 막지 않는다', () => {
    expect(main).not.toMatch(/touches\.length\s*>\s*1[\s\S]{0,120}preventDefault/)
  })
})

describe('iOS 입력 자동확대 방지', () => {
  test('모바일 입력칸을 16px 로 보장하는 규칙이 있다', () => {
    // 이게 없으면 확대를 허용한 순간, 입력칸을 누를 때마다 화면이 확대된 채 남는다
    expect(css).toMatch(/@media \(max-width: 979px\)[\s\S]{0,400}font-size: 16px !important/)
  })

  test('체크박스·라디오는 건드리지 않는다 (글씨가 없고 크기만 흔들린다)', () => {
    const rule = css.slice(css.indexOf('iOS 입력 자동확대 방지'))
    expect(rule).toMatch(/not\(\[type='checkbox'\]\)/)
    expect(rule).toMatch(/not\(\[type='radio'\]\)/)
  })
})
