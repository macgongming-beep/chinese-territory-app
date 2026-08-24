// 구역선 백업 파서. **이게 틀리면 진짜 구역선 위에 엉뚱한 게 덮인다.**
// 되돌리려면 다시 그리는 수밖에 없다 — 카드 하나에 수십 개 꼭짓점이다.
import { describe, test, expect } from 'vitest'
import { downloadCardBoundaryBackup, mergeCardBoundaryPoints, parseCardBoundaryBackup } from './boundaryMerge'
import type { CardBoundary } from '../types'

const square = (o = 0) => [
  { lat: 37 + o, lng: 127 + o }, { lat: 37 + o, lng: 127.1 + o },
  { lat: 37.1 + o, lng: 127.1 + o }, { lat: 37.1 + o, lng: 127 + o },
]

const backup = (cards: unknown[]) => JSON.stringify({ type: 'chs-yongin-card-boundaries', version: 1, cards })

describe('parseCardBoundaryBackup', () => {
  test('정상 백업을 읽는다', () => {
    const out = parseCardBoundaryBackup(backup([{ cardId: 7, boundary: square() }]))
    expect(out).toEqual([{ cardId: 7, points: square() }])
  })

  test('꼭짓점이 3개 미만이면 버린다 — 면이 안 되는 도형이다', () => {
    const out = parseCardBoundaryBackup(backup([
      { cardId: 1, boundary: square() },
      { cardId: 2, boundary: [{ lat: 37, lng: 127 }, { lat: 37.1, lng: 127.1 }] },
    ]))
    expect(out.map((b) => b.cardId)).toEqual([1])
  })

  test('cards 가 배열이 아니면 던진다', () => {
    expect(() => parseCardBoundaryBackup(JSON.stringify({ cards: '아님' }))).toThrow()
    expect(() => parseCardBoundaryBackup(JSON.stringify({}))).toThrow()
  })

  test('좌표가 숫자가 아니면 통째로 던진다 — 일부만 복구하면 더 위험하다', () => {
    expect(() => parseCardBoundaryBackup(backup([
      { cardId: 1, boundary: [{ lat: 37, lng: 127 }, { lat: 'x', lng: 127 }, { lat: 37.1, lng: 127.1 }] },
    ]))).toThrow()
  })

  test('cardId 가 숫자가 아니면 던진다', () => {
    expect(() => parseCardBoundaryBackup(backup([{ cardId: '없음', boundary: square() }]))).toThrow()
  })

  test('JSON 이 아니면 던진다', () => {
    expect(() => parseCardBoundaryBackup('그냥 글자')).toThrow()
  })

  test('내보낸 것을 그대로 다시 읽을 수 있다', () => {
    // 왕복이 깨지면 백업이 백업 구실을 못 한다
    const boundaries: CardBoundary[] = [{ cardId: 3, points: square() }]
    let captured = ''
    const origBlob = globalThis.Blob
    class FakeBlob { constructor(parts: string[]) { captured = parts.join('') } }
    globalThis.Blob = FakeBlob as never
    globalThis.URL.createObjectURL = () => 'blob:x'
    globalThis.URL.revokeObjectURL = () => {}
    try {
      downloadCardBoundaryBackup(
        [{ id: 3, name: '수지구 죽전동 1', region: '수지구', area: '죽전동' }],
        boundaries,
      )
    } finally {
      globalThis.Blob = origBlob
    }
    expect(parseCardBoundaryBackup(captured)).toEqual(boundaries)
  })

  test('구역선이 없는 카드는 백업에 안 들어간다', () => {
    let captured = ''
    const origBlob = globalThis.Blob
    class FakeBlob { constructor(parts: string[]) { captured = parts.join('') } }
    globalThis.Blob = FakeBlob as never
    globalThis.URL.createObjectURL = () => 'blob:x'
    globalThis.URL.revokeObjectURL = () => {}
    try {
      downloadCardBoundaryBackup(
        [{ id: 1, name: 'A', region: 'r', area: 'a' }, { id: 2, name: 'B', region: 'r', area: 'a' }],
        [{ cardId: 2, points: square() }],
      )
    } finally {
      globalThis.Blob = origBlob
    }
    expect(JSON.parse(captured).cards.map((c: { cardId: number }) => c.cardId)).toEqual([2])
  })
})

describe('mergeCardBoundaryPoints', () => {
  test('구역선이 없으면 null', () => {
    expect(mergeCardBoundaryPoints([])).toBeNull()
  })

  test('면이 안 되는 도형(꼭짓점 3개 미만)은 병합에서 뺀다', () => {
    // 점 두 개짜리가 섞여 들어오면 넓이 계산이 망가진다.
    // 정상 하나 + 쓰레기 하나 = 정상 하나만 넣은 것과 같아야 한다
    const onlyGood = mergeCardBoundaryPoints([{ cardId: 1, points: square() }])
    const withJunk = mergeCardBoundaryPoints([
      { cardId: 1, points: square() },
      { cardId: 2, points: [{ lat: 37, lng: 127 }, { lat: 37.1, lng: 127.1 }] },
    ])
    expect(withJunk?.points).toEqual(onlyGood?.points)
  })

  test('쓰레기만 있으면 null', () => {
    expect(mergeCardBoundaryPoints([
      { cardId: 1, points: [{ lat: 37, lng: 127 }, { lat: 37.1, lng: 127.1 }] },
    ])).toBeNull()
  })

  test('붙어 있는 둘을 하나로 합친다', () => {
    const merged = mergeCardBoundaryPoints([
      { cardId: 1, points: square() },
      { cardId: 2, points: square(0.05) },
    ])
    expect(merged).not.toBeNull()
    expect(merged!.points.length).toBeGreaterThanOrEqual(3)
  })
})
