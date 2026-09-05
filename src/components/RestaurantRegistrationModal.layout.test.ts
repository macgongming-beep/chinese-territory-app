import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('RestaurantRegistrationModal mobile layout', () => {
  const css = readFileSync('src/components/RestaurantRegistrationModal.css', 'utf8')

  it('긴 검색 결과는 바텀시트 본문 안에서 스크롤한다', () => {
    expect(css).toMatch(/\.restaurant-registration fieldset[^}]*overflow-y:\s*auto/)
    expect(css).toMatch(/\.restaurant-registration fieldset[^}]*grid-auto-rows:\s*max-content/)
  })

  it('후보 카드는 내용 높이를 확보해 범위 배지가 다음 카드와 겹치지 않는다', () => {
    expect(css).toMatch(/\.restaurant-registration-place-results\s*\{[^}]*grid-auto-rows:\s*max-content/)
    expect(css).toMatch(/\.restaurant-registration-place-results\s*>\s*button[^}]*height:\s*auto/)
    expect(css).toMatch(/\.restaurant-registration-place-results\s*>\s*button[^}]*min-height:\s*94px/)
  })
})
