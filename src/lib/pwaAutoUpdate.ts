// 새 버전을 **언제 저절로 적용해도 되는가**.
//
// 왜 필요한가: 지금은 사용자가 설정에서 버튼을 눌러야 새 버전이 적용된다.
// 62명 중 어른이 많아 그 단계가 실제 장벽이다 (anon 쓰기 차단 전환 때
// 옛 앱은 쓰기가 전부 실패하는데, 화면은 멀쩡해 보여 "저장이 안 된다" 로만 보인다).
//
// ⚠ 그렇다고 아무 때나 새로고침하면 **쓰던 것이 날아간다.**
//   방문 기록을 적다가, 공지를 쓰다가 사라지면 그게 더 나쁘다.
//   그래서 **막 켠 직후에만** 저절로 적용한다 — 그 순간엔 날아갈 입력이 없다.
//   그 창을 놓치면 예전처럼 설정의 버튼으로 한다.

/** 켠 직후로 치는 시간. 이 안에 새 버전을 발견하면 저절로 적용한다 */
export const COLD_START_MS = 20_000

export type AutoUpdateInput = {
  /** 앱이 뜬 뒤 지난 시간(ms) */
  msSinceStart: number
  /** 이 탭에서 이미 자동 적용했나 (새로고침해도 남는 값으로 센다) */
  alreadyApplied: boolean
  /** 사용자가 무언가 입력 중인가 */
  userIsTyping: boolean
}

/**
 * ⚠ `alreadyApplied` 를 반드시 봐야 한다. 안 보면 새 버전이 계속
 *   'needRefresh' 로 잡힐 때 **새로고침 무한 반복**에 빠진다.
 */
export function shouldAutoApply({ msSinceStart, alreadyApplied, userIsTyping }: AutoUpdateInput): boolean {
  if (alreadyApplied) return false
  if (userIsTyping) return false
  return msSinceStart <= COLD_START_MS
}
