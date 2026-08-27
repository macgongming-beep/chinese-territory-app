// 앱을 켰을 때 무엇을 그릴지.
//
// 네 갈래인데 **순서가 미묘하다.** 한 번 어긋나서
// 앱을 켤 때마다 로그인 화면이 번쩍였다가 홈으로 바뀌었다
// (세션을 되살리는 중에도 user 는 아직 null 이기 때문).

export type AppScreen = 'login' | 'loading' | 'error' | 'app'

export function chooseAppScreen(s: {
  /** 로그인한 사람. 복원 중에는 아직 null 이다 */
  user: unknown
  /** 세션 복원 중 */
  authLoading: boolean
  /** 자료 불러오는 중 */
  loading: boolean
  error?: unknown
}): AppScreen {
  // 복원 중에는 아직 판단하지 않는다. 여기서 login 을 그리면 번쩍인다.
  if (s.authLoading) return 'loading'
  // 로그아웃 직후는 스피너 없이 곧장 로그인 화면 (복원이 이미 끝나 authLoading 은 false)
  if (!s.user) return 'login'
  if (s.loading) return 'loading'
  if (s.error) return 'error'
  return 'app'
}
