/**
 * 쉼표로 이어붙인 이름 목록 ("가, 나, 다") 안에서 이름 하나를 갈아끼운다.
 *
 * 일정의 인도자는 표가 아니라 한 칸에 목록으로 들어 있다.
 * 그래서 닉네임을 바꿀 때 '이름 = 옛이름' 으로는 안 걸리고 옛 이름이 남았다.
 * 옛 이름과 새 이름이 같은 줄에 나란히 있으면 하나로 접는다.
 */
export function renameInNameList(list: string | null | undefined, oldName: string, newName: string): string {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of (list ?? '').split(',')) {
    const name = raw.trim()
    if (!name) continue
    const next = name === oldName ? newName : name
    if (seen.has(next)) continue
    seen.add(next)
    out.push(next)
  }
  return out.join(', ')
}
