// 병합 계획. **여기가 "무엇을 지울지" 를 정한다.**
// 틀리면 방문 기록이 cascade 로 사라지고 되돌릴 수 없다.
import { describe, test, expect } from 'vitest'
import { normalizeAddress, planDuplicateBuildingMerge } from './duplicateBuildingMerge'
import { testBuilding, testUnit } from '../test/territoryFixture'
import type { Building } from '../types'

/** 같은 주소를 쓰는 건물을 만든다 */
const at = (id: number, address: string, units: string[], cardId = 1): Building => ({
  ...testBuilding(id, cardId, `건물${id}`, units.map((n, i) => testUnit(id * 100 + i, n))),
  address,
})

describe('planDuplicateBuildingMerge', () => {
  test('중복이 없으면 아무것도 안 한다', () => {
    const plan = planDuplicateBuildingMerge([at(1, '언동로 1', ['101호']), at(2, '언동로 2', ['101호'])])
    expect(plan.merge).toEqual([])
    expect(plan.conflicts).toEqual([])
  })

  test('호수가 안 겹치면 합친다 — id 가 작은 쪽을 남긴다', () => {
    const plan = planDuplicateBuildingMerge([
      at(5, '언동로 1', ['101호', '102호']),
      at(2, '언동로 1', ['201호']),
    ])
    expect(plan.merge).toHaveLength(1)
    expect(plan.merge[0].primary.id).toBe(2)
    expect(plan.merge[0].absorbed.map((b) => b.id)).toEqual([5])
    expect(plan.merge[0].movingUnits).toBe(2)
  })

  test('호수가 하나라도 겹치면 통째로 제외한다', () => {
    // 예전 코드는 겹치는 호수를 건너뛰고 원본을 지웠다.
    // 그러면 그 호수의 방문 기록이 cascade 로 사라진다.
    const plan = planDuplicateBuildingMerge([
      at(1, '언동로 1', ['101호', '102호']),
      at(2, '언동로 1', ['102호', '103호']),
    ])
    expect(plan.merge).toEqual([])
    expect(plan.conflicts).toHaveLength(1)
    expect(plan.conflicts[0].conflictingNumbers).toEqual(['102호'])
    expect(plan.conflicts[0].primary.id).toBe(1)
  })

  test('겹치는 묶음만 빼고 나머지는 합친다', () => {
    const plan = planDuplicateBuildingMerge([
      at(1, '가로 1', ['101호']), at(2, '가로 1', ['202호']),      // 안 겹침
      at(3, '나로 2', ['101호']), at(4, '나로 2', ['101호']),      // 겹침
    ])
    expect(plan.merge.map((g) => g.primary.id)).toEqual([1])
    expect(plan.conflicts.map((c) => c.primary.id)).toEqual([3])
  })

  test('셋 이상이어도 하나라도 겹치면 제외한다', () => {
    const plan = planDuplicateBuildingMerge([
      at(1, '언동로 1', ['101호']),
      at(2, '언동로 1', ['201호']),
      at(3, '언동로 1', ['101호']),   // 1번과 겹친다
    ])
    expect(plan.merge).toEqual([])
    expect(plan.conflicts[0].conflictingNumbers).toEqual(['101호'])
  })

  test('겹치는 호수를 여러 개면 모두 알려 준다 (중복 없이)', () => {
    const plan = planDuplicateBuildingMerge([
      at(1, '언동로 1', ['101호', '102호']),
      at(2, '언동로 1', ['102호', '101호']),
    ])
    expect(plan.conflicts[0].conflictingNumbers).toEqual(['101호', '102호'])
  })

  test('카드가 다르면 주소가 같아도 남남이다', () => {
    const plan = planDuplicateBuildingMerge([
      at(1, '언동로 1', ['101호'], 1),
      at(2, '언동로 1', ['201호'], 2),
    ])
    expect(plan.merge).toEqual([])
  })

  test('공백과 하이픈 차이는 같은 주소로 본다', () => {
    expect(normalizeAddress(' 언동로 1-2 ')).toBe(normalizeAddress('언동로1-2'))
    const plan = planDuplicateBuildingMerge([
      at(1, '언동로 1-2', ['101호']),
      at(2, '언동로1-2', ['201호']),
    ])
    expect(plan.merge).toHaveLength(1)
  })

  test('카드를 지정하면 그 카드만 본다', () => {
    const plan = planDuplicateBuildingMerge([
      at(1, '언동로 1', ['101호'], 1), at(2, '언동로 1', ['201호'], 1),
      at(3, '가로 9', ['101호'], 2), at(4, '가로 9', ['201호'], 2),
    ], { scopeCardId: 2 })
    expect(plan.merge.map((g) => g.primary.id)).toEqual([3])
  })

  test('고른 묶음만 합친다', () => {
    const plan = planDuplicateBuildingMerge([
      at(1, '가로 1', ['101호']), at(2, '가로 1', ['201호']),
      at(3, '나로 2', ['101호']), at(4, '나로 2', ['201호']),
    ], { selectedPrimaryIds: [3] })
    expect(plan.merge.map((g) => g.primary.id)).toEqual([3])
  })
})
