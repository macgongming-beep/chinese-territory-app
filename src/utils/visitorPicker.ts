// 방문 기록의 '방문자' 를 누가 고칠 수 있고, 무엇을 고를 수 있나.
//
// PC(DesktopTerritory)와 모바일(MobileMap)이 **같은 판단**을 쓴다.
// 화면마다 따로 쓰면 한쪽만 고쳐져서 조용히 어긋난다 — 이 앱에서 여러 번 겪었다.

/** 관리자·개발자·인도자만. 일반 사용자에게는 칸 자체를 안 보여준다 */
export function canEditVisitor(role: string | null | undefined): boolean {
  return role === 'admin' || role === 'developer' || role === 'leader'
}

/**
 * 고를 수 있는 이름. 승인된 사람만, 이름순.
 * ⚠ 승인 상태가 없는 자료(옛 행)는 승인된 것으로 본다 — 빼 버리면 목록이 비어
 *   아무도 못 고르게 된다.
 */
export function visitorOptionsFrom(
  users: Array<{ name?: string | null; approvalStatus?: string | null }>,
): string[] {
  return Array.from(
    new Set(
      users
        .filter((u) => (u.approvalStatus ?? 'approved') === 'approved')
        .map((u) => (u.name ?? '').trim())
        .filter(Boolean),
    ),
  ).sort((a, b) => a.localeCompare(b, 'ko'))
}

/**
 * 실제로 `<select>` 에 그릴 목록.
 *
 * ⚠ **지금 적힌 이름이 목록에 없으면 앞에 끼워 넣는다.** 탈퇴했거나 이름을 바꾼
 *   사람의 기록이 있는데, 목록에 없다고 빠지면 `<select>` 가 첫 항목을 고른 것처럼
 *   보이고 **창을 열었다 닫기만 해도 남의 기록이 된다.**
 */
export function visitorOptionsWithCurrent(options: string[], current: string | null | undefined): string[] {
  const c = (current ?? '').trim()
  if (!c || options.includes(c)) return options
  return [c, ...options]
}
