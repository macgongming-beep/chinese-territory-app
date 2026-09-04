import { describe, expect, test } from 'vitest'
import type { InformalAsset } from '../types'
import { countInformalCards } from './informalAssets'

const asset = (id: number, parentId: number | null = null): InformalAsset => ({
  id,
  parentId,
  name: `place-${id}`,
  kind: '비공식구역',
  imageUrl: '',
  imagePath: '',
  uploadedBy: 'tester',
  createdAt: '2026-09-04T00:00:00Z',
  archived: false,
  groupId: null,
})

describe('비공식 구역 카드 수', () => {
  test('상위 카드만 세고 그 안의 포인트는 제외한다', () => {
    expect(countInformalCards([
      asset(1),
      asset(2),
      asset(3, 1),
      asset(4, 1),
      asset(5, 2),
    ])).toBe(2)
  })
})
