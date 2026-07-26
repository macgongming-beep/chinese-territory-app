// 사용자 집단(처인/신갈/동백/동탄 등) — app_settings.user_groups 에 JSON 배열로 저장.
// 한 사용자 = 한 집단 (app_users.group_name), 빈 값 = 미지정.
export const USER_GROUPS_SETTING_KEY = 'user_groups'
export const USER_GROUPS_MAX = 20
export const DEFAULT_USER_GROUPS = ['처인', '신갈', '동백', '동탄']

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
  return out.length > 0 ? out : DEFAULT_USER_GROUPS
}

export function serializeUserGroups(groups: string[]): string {
  return JSON.stringify(normalizeUserGroups(groups))
}
