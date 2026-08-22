// 사용자 집단(회중이 정하는 이름) — app_settings.user_groups 에 JSON 배열로 저장.
// 한 사용자 = 한 집단 (app_users.group_name), 빈 값 = 미지정.
export const USER_GROUPS_SETTING_KEY = 'user_groups'
export const USER_GROUPS_MAX = 20
/**
 * 기본 집단은 **없음**이다.
 *
 * 예전에는 ['처인','신갈','동백','동탄'] 이 박혀 있었다. 용인 회중의 동네
 * 이름이라, 다른 회중이 설치하면 첫 화면부터 남의 동네가 떠 있게 된다.
 * 지역 목록이 코드에 박혀 있던 것과 같은 문제다.
 *
 * 비어 있으면 집단을 안 쓰는 회중은 그대로 두면 되고, 쓰는 회중은
 * 사용자 관리에서 자기 것을 넣으면 된다.
 */
export const DEFAULT_USER_GROUPS: string[] = []

/** 저장값(JSON 문자열) → 집단 목록. 깨졌거나 비어 있으면 기본값 */
export function parseUserGroups(value: string | undefined | null): string[] {
  if (!value) return DEFAULT_USER_GROUPS
  try {
    const parsed = JSON.parse(value)
    if (!Array.isArray(parsed)) return DEFAULT_USER_GROUPS
    return normalizeUserGroups(parsed)
  } catch {
    return DEFAULT_USER_GROUPS
  }
}

/** 공백 제거·빈 값 제거·중복 제거·최대 개수 제한 */
export function normalizeUserGroups(input: unknown[]): string[] {
  const out: string[] = []
  for (const item of input) {
    if (typeof item !== 'string') continue
    const name = item.trim().slice(0, 12)
    if (!name || out.includes(name)) continue
    out.push(name)
    if (out.length >= USER_GROUPS_MAX) break
  }
  // 빈 목록도 뜻이 있는 값이다 ('집단을 쓰지 않음'). 기본값으로 되돌리지 않는다.
  return out
}

export function serializeUserGroups(groups: string[]): string {
  return JSON.stringify(normalizeUserGroups(groups))
}
