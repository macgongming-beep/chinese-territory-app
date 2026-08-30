// 자동 로그인 때 세션이 무효라 **다시 로그인시켜야 하는가**.
//
// ⚠ 여기를 대충 하면 사람을 봉사 중에 쫓아낸다.
//   `verify_session` 이 오류를 주는 경우는 두 가지고, 대응이 정반대다:
//     · 서버가 **거부**했다 (만료·비활성·미승인) → 다시 로그인시켜야 한다
//     · 서버에 **닿지 못했다** (지하·엘리베이터·데이터 끊김) → 그대로 둬야 한다
//   둘을 뭉뚱그리면, 신호가 나쁜 곳에서 앱을 열 때마다 로그아웃된다.
//
// 구분: PostgREST 가 응답했으면 `code` 가 있다(P0001 등). 전송 자체가 실패하면 없다.

export type RpcErrorLike = { code?: string | null; message?: string | null } | null | undefined

export function shouldForceRelogin(error: RpcErrorLike): boolean {
  if (!error) return false            // 성공 — 토큰이 살아 있다
  if (!error.code) return false       // ⚠ 서버에 못 닿았다. 쫓아내지 않는다
  return true                         // 서버가 거부했다
}
