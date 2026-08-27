// 골라둔 것 중 **지금 화면에 보이는 것만** 남긴다.
//
// 왜: 필터를 바꿔도 선택은 그대로 남는데, 전체선택은 '보이는 것' 만 더하고 빼면서
// 실제 삭제는 **고른 것 전부**를 지웠다. 그래서 확인창의 "카드 3개를 삭제할까요" 안에
// 화면에 없는 카드가 섞일 수 있었고, 사용자는 그걸 볼 방법이 없었다.
// 카드를 지우면 그 안의 건물이 딸려 죽는다.
//
// 정책: **일괄 작업은 보이는 것만.** (사용자 확인 — 필터를 오가며 고르는 업무는 없다)
// 경고 문구로 막지 않는다. 경고는 방어선이 아니다.

export function visibleSelection<T extends { id: number }>(
  chosen: ReadonlySet<number>,
  visible: readonly T[],
): number[] {
  return visible.filter((item) => chosen.has(item.id)).map((item) => item.id)
}

/** 안 보이게 된 선택이 있나 (선택을 정리해야 하는지 판단용) */
export function hasHiddenSelection<T extends { id: number }>(
  chosen: ReadonlySet<number>,
  visible: readonly T[],
): boolean {
  if (chosen.size === 0) return false
  const visibleIds = new Set(visible.map((item) => item.id))
  for (const id of chosen) if (!visibleIds.has(id)) return true
  return false
}
