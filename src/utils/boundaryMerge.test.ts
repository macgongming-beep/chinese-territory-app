// 구역선 백업 파서. **이게 틀리면 진짜 구역선 위에 엉뚱한 게 덮인다.**
// 되돌리려면 다시 그리는 수밖에 없다 — 카드 하나에 수십 개 꼭짓점이다.
import { describe, test, expect } from 'vitest'
import { downloadCardBoundaryBackup, mergeCardBoundaryPoints, parseCardBoundaryBackup, planBoundaryRestore } from './boundaryMerge'
import type { CardBoundary } from '../types'

const square = (o = 0) => [
  { lat: 37 + o, lng: 127 + o }, { lat: 37 + o, lng: 127.1 + o },
  { lat: 37.1 + o, lng: 127.1 + o }, { lat: 37.1 + o, lng: 127 + o },
]

const backup = (cards: unknown[], type = 'chs-yongin-card-boundaries') =>
  JSON.stringify({ type, version: 1, cards })
const entry = (cardId: number, cardName: string, boundary = square()) =>
  ({ cardId, cardName, region: '수지구', area: '죽전동', boundary })

describe('parseCardBoundaryBackup', () => {
  test('정상 백업을 읽는다 — 이름·지역·동까지 살린다', () => {
    const out = parseCardBoundaryBackup(backup([entry(7, '수지구 죽전동 1')]))
    expect(out).toEqual([{ cardId: 7, cardName: '수지구 죽전동 1', region: '수지구', area: '죽전동', points: square() }])
  })

  test('모르는 version 은 거절한다', () => {
    expect(() => parseCardBoundaryBackup(
      JSON.stringify({ type: 'chs-yongin-card-boundaries', version: 2, cards: [] }),
    )).toThrow()
  })

  test('구역선 백업이 아닌 JSON 은 거절한다', () => {
    // 아무 JSON 이나 받으면 엉뚱한 파일로 구역선을 덮는다
    expect(() => parseCardBoundaryBackup(JSON.stringify({ cards: [] }))).toThrow()
    expect(() => parseCardBoundaryBackup(backup([], '다른 앱 백업'))).toThrow()
  })

  test('지구 밖 좌표는 거절한다', () => {
    expect(() => parseCardBoundaryBackup(backup([
      entry(1, 'A', [{ lat: 999, lng: 127 }, { lat: 37, lng: 127 }, { lat: 37.1, lng: 127.1 }]),
    ]))).toThrow()
  })

  test('면이 안 되는 도형은 버린다 (같은 점 · 일직선)', () => {
    const same = [{ lat: 37, lng: 127 }, { lat: 37, lng: 127 }, { lat: 37, lng: 127 }]
    const line = [{ lat: 37, lng: 127 }, { lat: 37.1, lng: 127.1 }, { lat: 37.2, lng: 127.2 }]
    expect(parseCardBoundaryBackup(backup([entry(1, 'A', same)]))).toEqual([])
    expect(parseCardBoundaryBackup(backup([entry(2, 'B', line)]))).toEqual([])
  })

  test('꼭짓점이 3개 미만이면 버린다 — 면이 안 되는 도형이다', () => {
    const out = parseCardBoundaryBackup(backup([
      entry(1, 'A'),
      entry(2, 'B', [{ lat: 37, lng: 127 }, { lat: 37.1, lng: 127.1 }]),
    ]))
    expect(out.map((b) => b.cardId)).toEqual([1])
  })

  test('cards 가 배열이 아니면 던진다', () => {
    expect(() => parseCardBoundaryBackup(backup('아님' as never))).toThrow()
  })

  test('좌표가 숫자가 아니면 통째로 던진다 — 일부만 복구하면 더 위험하다', () => {
    expect(() => parseCardBoundaryBackup(backup([
      entry(1, 'A', [{ lat: 37, lng: 127 }, { lat: 'x', lng: 127 }, { lat: 37.1, lng: 127.1 }] as never),
    ]))).toThrow()
  })

  test('cardId 가 숫자가 아니면 던진다', () => {
    expect(() => parseCardBoundaryBackup(backup([{ cardId: '없음', cardName: 'A', boundary: square() }]))).toThrow()
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
    expect(parseCardBoundaryBackup(captured)).toEqual([
      { cardId: 3, cardName: '수지구 죽전동 1', region: '수지구', area: '죽전동', points: square() },
    ])
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

describe('planBoundaryRestore — 엉뚱한 카드를 덮지 않는다', () => {
  const now = [{ id: 1, name: '수지구 죽전동 1' }, { id: 2, name: '수지구 상현동 1' }]
  const e = (cardId: number, cardName: string) =>
    ({ cardId, cardName, region: '', area: '', points: square() })

  test('id 와 이름이 맞으면 넣는다', () => {
    const plan = planBoundaryRestore([e(1, '수지구 죽전동 1')], now)
    expect(plan.apply).toEqual([{ cardId: 1, points: square() }])
    expect(plan.refused).toEqual([])
  })

  test('id 는 같은데 이름이 다르면 거절한다 — 다른 회중 백업이 여기로 온다', () => {
    const plan = planBoundaryRestore([e(1, '안성시 공도읍 3')], now)
    expect(plan.apply).toEqual([])
    expect(plan.refused).toEqual([{ cardId: 1, cardName: '안성시 공도읍 3', reason: '다른 카드' }])
  })

  test('없는 카드는 거절한다', () => {
    const plan = planBoundaryRestore([e(99, '어디 카드')], now)
    expect(plan.refused[0].reason).toBe('없는 카드')
  })

  test('맞는 것만 넣고 나머지는 건너뛴다', () => {
    const plan = planBoundaryRestore([e(1, '수지구 죽전동 1'), e(2, '틀린 이름'), e(99, '없음')], now)
    expect(plan.apply.map((b) => b.cardId)).toEqual([1])
    expect(plan.refused).toHaveLength(2)
  })

  test('이름이 없으면 거절한다 — id 만으로는 신원을 못 믿는다', () => {
    // 이 형식은 최초 커밋(2026-05-22)부터 이름을 적었다.
    // 이름 없는 파일은 우리 백업이 아니거나 손을 댄 것이다.
    const plan = planBoundaryRestore([e(1, '')], now)
    expect(plan.apply).toEqual([])
    expect(plan.refused[0].reason).toBe('이름 없음')
  })

  test('지역이나 동이 다르면 거절한다', () => {
    const cards = [{ id: 1, name: '수지구 죽전동 1', region: '수지구', area: '죽전동' }]
    const same = { cardId: 1, cardName: '수지구 죽전동 1', points: square() }
    expect(planBoundaryRestore([{ ...same, region: '처인구', area: '죽전동' }], cards).refused).toHaveLength(1)
    expect(planBoundaryRestore([{ ...same, region: '수지구', area: '상현동' }], cards).refused).toHaveLength(1)
    expect(planBoundaryRestore([{ ...same, region: '수지구', area: '죽전동' }], cards).apply).toHaveLength(1)
  })
})
