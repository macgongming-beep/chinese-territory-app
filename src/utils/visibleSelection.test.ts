import { describe, test, expect } from 'vitest'
import { visibleSelection, hasHiddenSelection } from './visibleSelection'

const items = (...ids: number[]) => ids.map((id) => ({ id }))

describe('visibleSelection', () => {
  test('보이는 것만 남는다', () => {
    expect(visibleSelection(new Set([1, 2, 3]), items(2, 3, 4))).toEqual([2, 3])
  })

  test('⚠ 안 보이는 선택은 빠진다 — 이게 핵심이다', () => {
    // 필터를 바꾸기 전에 고른 1번이 삭제 대상에 섞이면 안 된다
    expect(visibleSelection(new Set([1]), items(2, 3))).toEqual([])
  })

  test('보이는 순서를 따른다', () => {
    expect(visibleSelection(new Set([3, 1]), items(3, 2, 1))).toEqual([3, 1])
  })

  test('빈 선택·빈 목록', () => {
    expect(visibleSelection(new Set(), items(1, 2))).toEqual([])
    expect(visibleSelection(new Set([1]), [])).toEqual([])
  })
})

describe('hasHiddenSelection', () => {
  test('안 보이는 선택이 있으면 참', () => {
    expect(hasHiddenSelection(new Set([1, 2]), items(2))).toBe(true)
  })
  test('전부 보이면 거짓', () => {
    expect(hasHiddenSelection(new Set([2]), items(1, 2, 3))).toBe(false)
  })
  test('아무것도 안 골랐으면 거짓', () => {
    expect(hasHiddenSelection(new Set(), items(1))).toBe(false)
  })
})
