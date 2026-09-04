import { describe, expect, test } from 'vitest'
import { readFileSync } from 'node:fs'
import { INFORMAL_KINDS } from '../types'
import { INFORMAL_KIND_STYLE, informalKindSvgPath } from './informalKind'
import { BUILDING_STATUS_COLORS } from './buildingPin'

describe('비공식 종류 표시', () => {
  test('모든 종류에 색이 있다', () => {
    for (const kind of INFORMAL_KINDS) {
      expect(INFORMAL_KIND_STYLE[kind]?.color).toMatch(/^#[0-9A-Fa-f]{6}$/)
    }
  })

  test('종류끼리 색이 겹치지 않는다', () => {
    const colors = INFORMAL_KINDS.map((k) => INFORMAL_KIND_STYLE[k].color)
    expect(new Set(colors).size).toBe(colors.length)
  })

  test('건물 핀이 쓰는 색과 겹치지 않는다', () => {
    // 같은 색이 두 뜻을 가지면 지도에서 반드시 헷갈린다
    const building = new Set(Object.values(BUILDING_STATUS_COLORS).map((c) => c.toUpperCase()))
    for (const kind of INFORMAL_KINDS) {
      expect(building.has(INFORMAL_KIND_STYLE[kind].color.toUpperCase())).toBe(false)
    }
  })

  test('종류마다 도형이 다르다 — 색만으로 나누지 않는다', () => {
    const paths = INFORMAL_KINDS.map(informalKindSvgPath)
    expect(new Set(paths).size).toBe(paths.length)
  })

  test('아이콘에 이모지를 쓰지 않는다', () => {
    // 이모지는 폰마다 다르게 그려져 앱의 선(stroke) 아이콘들과 따로 논다
    const source = readFileSync('src/utils/informalKind.ts', 'utf-8')
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')
    expect(source).not.toMatch(/\p{Extended_Pictographic}/u)
  })
})
