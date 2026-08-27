import { describe, test, expect } from 'vitest'
import { chooseAppScreen } from './appScreen'

const S = (over: Partial<Parameters<typeof chooseAppScreen>[0]>) =>
  chooseAppScreen({ user: null, authLoading: false, loading: false, ...over })

describe('chooseAppScreen', () => {
  test('세션 되살리는 중에는 로그인 화면을 그리지 않는다', () => {
    // 이걸 놓쳐서 앱을 켤 때마다 로그인 화면이 번쩍였다
    expect(S({ user: null, authLoading: true })).toBe('loading')
  })

  test('로그아웃 직후는 곧장 로그인 화면 (스피너 없이)', () => {
    // 로그아웃은 authLoading 을 건드리지 않는다 — 복원은 이미 끝났다
    expect(S({ user: null, authLoading: false })).toBe('login')
  })

  test('로그인했고 자료 불러오는 중이면 스피너', () => {
    expect(S({ user: { id: 1 }, loading: true })).toBe('loading')
  })

  test('오류가 있으면 오류 화면', () => {
    expect(S({ user: { id: 1 }, error: new Error('x') })).toBe('error')
  })

  test('다 되면 앱', () => {
    expect(S({ user: { id: 1 } })).toBe('app')
  })

  test('오류보다 불러오는 중이 먼저다', () => {
    // 아직 불러오는 중인데 옛 오류로 화면을 덮으면 안 된다
    expect(S({ user: { id: 1 }, loading: true, error: new Error('x') })).toBe('loading')
  })
})
