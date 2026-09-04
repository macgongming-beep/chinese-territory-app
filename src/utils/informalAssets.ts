import type { InformalAsset } from '../types'

/** 자식 포인트를 제외하고 비공식 구역 카드만 센다. */
export function countInformalCards(assets: InformalAsset[]): number {
  return assets.filter((asset) => !asset.parentId).length
}
