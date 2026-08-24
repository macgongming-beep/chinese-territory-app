// 같은 주소로 두 번 등록된 건물을 하나로 합칠 계획을 세운다.
//
// **왜 순수 함수인가:** 여기가 "무엇을 지울지" 를 정하는 곳이다. DB 를 붙인 채로는
// 확인할 수 없고, 잘못되면 방문 기록이 사라진다. 판단만 떼어내 테스트로 못 박는다.
//
// ⚠ 정책 (2026-08-24, 사용자가 정함)
//   같은 호수 번호가 양쪽에 있으면 **그 주소 묶음은 통째로 병합하지 않는다.**
//
//   왜: 예전 코드는 겹치는 호수를 "이동 건너뛰기" 하고 원본 건물을 지웠다.
//   units 는 visit_histories · regular_visits 에서 on delete cascade 로 물려 있어서,
//   건너뛴 호수의 **방문 기록이 조용히 사라졌다.** 화면에는 '병합했습니다' 만 떴다.
//   무엇을 남길지는 사람이 봐야 하는 판단이라, 자동으로 정하지 않는다.
import type { Building } from '../types'

export type MergeGroup = {
  /** 남길 건물 (id 가 가장 작은 것) */
  primary: Building
  /** 지울 건물들. 호수는 primary 로 옮긴다 */
  absorbed: Building[]
  /** 옮길 호수 수 */
  movingUnits: number
}

export type ConflictGroup = {
  primary: Building
  /** 양쪽에 다 있는 호수 번호. 이게 있으면 병합하지 않는다 */
  conflictingNumbers: string[]
}

export type MergePlan = {
  merge: MergeGroup[]
  /** 호수가 겹쳐 제외한 묶음. 화면이 사용자에게 알려야 한다 */
  conflicts: ConflictGroup[]
}

/** 주소 비교용 정규화 — 공백과 하이픈 차이로 중복을 놓치지 않게 */
export function normalizeAddress(address: string): string {
  return address.trim().toLowerCase().replace(/\s+/g, '').replace(/[-‐]/g, '-')
}

export function planDuplicateBuildingMerge(
  buildings: Building[],
  options: { scopeCardId?: number; selectedPrimaryIds?: number[] } = {},
): MergePlan {
  const scope = options.scopeCardId
    ? buildings.filter((b) => b.cardId === options.scopeCardId)
    : buildings

  // 같은 카드 · 같은 주소끼리 묶는다
  const groups = new Map<string, Building[]>()
  for (const b of scope) {
    const key = `${b.cardId}::${normalizeAddress(b.address)}`
    const list = groups.get(key)
    if (list) list.push(b)
    else groups.set(key, [b])
  }

  const selected = options.selectedPrimaryIds ? new Set(options.selectedPrimaryIds) : null
  const merge: MergeGroup[] = []
  const conflicts: ConflictGroup[] = []

  for (const group of groups.values()) {
    if (group.length <= 1) continue
    const sorted = [...group].sort((a, b) => a.id - b.id)
    const [primary, ...absorbed] = sorted
    if (selected && !selected.has(primary.id)) continue

    // 호수 번호가 하나라도 겹치면 손대지 않는다
    const seen = new Set(primary.units.map((u) => u.number))
    const conflicting: string[] = []
    let movingUnits = 0
    for (const dup of absorbed) {
      for (const unit of dup.units) {
        if (seen.has(unit.number)) conflicting.push(unit.number)
        else { seen.add(unit.number); movingUnits++ }
      }
    }

    if (conflicting.length > 0) {
      conflicts.push({ primary, conflictingNumbers: [...new Set(conflicting)].sort() })
      continue
    }
    merge.push({ primary, absorbed, movingUnits })
  }

  return { merge, conflicts }
}
