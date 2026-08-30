import { describe, test, expect } from 'vitest'
import { shouldForceRelogin } from './sessionRelogin'

describe('다시 로그인시켜야 하나', () => {
  test('오류가 없으면 그대로 둔다 (토큰이 살아 있다)', () => {
    expect(shouldForceRelogin(null)).toBe(false)
    expect(shouldForceRelogin(undefined)).toBe(false)
  })

  test('서버가 거부하면 다시 로그인시킨다', () => {
    expect(shouldForceRelogin({ code: 'P0001', message: '세션 만료. 다시 로그인해주세요' })).toBe(true)
    expect(shouldForceRelogin({ code: 'P0001', message: '비활성화된 계정입니다' })).toBe(true)
    expect(shouldForceRelogin({ code: '42501', message: 'permission denied' })).toBe(true)
  })

  test('⚠ 서버에 못 닿았으면 **그대로 둔다** — 봉사 중에 쫓아내면 안 된다', () => {
    // supabase 는 전송 실패도 { error } 로 준다. code 가 없다.
    expect(shouldForceRelogin({ message: 'Failed to fetch' })).toBe(false)
    expect(shouldForceRelogin({ message: 'NetworkError when attempting to fetch resource.' })).toBe(false)
    expect(shouldForceRelogin({ code: null, message: 'Load failed' })).toBe(false)
  })
})
