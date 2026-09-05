import { describe, expect, it } from 'vitest'
import { getFloatingMenuPosition } from './floatingMenu'

describe('getFloatingMenuPosition', () => {
  it('opens below the button when enough space remains', () => {
    expect(getFloatingMenuPosition(
      { top: 100, right: 380, bottom: 140 },
      { width: 390, height: 844 },
      190,
    )).toEqual({ right: 12, top: 144 })
  })

  it('opens above a button near the bottom edge', () => {
    expect(getFloatingMenuPosition(
      { top: 760, right: 360, bottom: 800 },
      { width: 390, height: 844 },
      190,
    )).toEqual({ right: 30, bottom: 88 })
  })
})
