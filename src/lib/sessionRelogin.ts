// 자동 로그인 때 세션이 무효라 **다시 로그인시켜야 하는가**.
//
// ⚠ 여기를 대충 하면 사람을 봉사 중에 쫓아낸다. 두 방향으로 틀릴 수 있다:
//
//   ① 너무 좁으면 — 토큰이 만료됐는데 로그인 상태로 둔다.
//      2026-08-30 에 이것 때문에 62명 중 38명이 저장을 못 했다.
//   ② 너무 넓으면 — **서버 쪽 문제로 전원을 로그아웃시킨다.**
//      함수 이름을 바꿨거나(PGRST202), 스키마 캐시가 안 돌았거나,
//      실행권한을 잘못 건드렸거나(42501), DB 가 잠깐 아플 때
//      62명이 한꺼번에 로그인 화면을 보게 된다.
//
// 그래서 **`verify_session` 이 스스로 던지는 인증 오류만** 재로그인으로 친다.
// 그 함수는 실패를 전부 `raise exception` 으로 내고, PostgreSQL 은 그것을
// **P0001(raise_exception)** 로 준다. 다른 코드는 우리 문제이지 사용자 문제가 아니다.

/** `verify_session` 이 인증 실패로 던질 때의 코드 */
const AUTH_REJECTED = 'P0001'

export type RpcErrorLike = { code?: string | null; message?: string | null } | null | undefined

export function shouldForceRelogin(error: RpcErrorLike): boolean {
  if (!error) return false                    // 성공 — 토큰이 살아 있다
  // ⚠ 코드가 **정확히 P0001 일 때만** 참이다. 이 한 줄이 셋을 동시에 막는다:
  //   · 코드가 없음(전송 실패) → 거짓. 신호 끊긴 곳에서 쫓아내지 않는다
  //   · 다른 코드(PGRST202·42501·57P03 …) → 거짓. 서버 문제로 전원을 쫓아내지 않는다
  //   · P0001 → 참. verify_session 이 인증을 거부한 것이다
  //
  //   `if (!error.code) return false` 를 따로 두었었는데, 이 비교가 이미 그걸
  //   덮어서 **변형 검사로 구분이 안 되는 죽은 줄**이었다. 지웠다 —
  //   일하는 것처럼 보이는 장식은 다음 사람을 속인다.
  return error.code === AUTH_REJECTED
}
