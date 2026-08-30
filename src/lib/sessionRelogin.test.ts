import { describe, test, expect } from 'vitest'
import { shouldForceRelogin } from './sessionRelogin'

describe('다시 로그인시켜야 하나', () => {
  test('오류가 없으면 그대로 둔다 (토큰이 살아 있다)', () => {
    expect(shouldForceRelogin(null)).toBe(false)
    expect(shouldForceRelogin(undefined)).toBe(false)
  })

  test('verify_session 이 인증을 거부하면 다시 로그인시킨다', () => {
    for (const m of ['세션 만료. 다시 로그인해주세요', '비활성화된 계정입니다',
                     '승인되지 않은 계정입니다', '세션 토큰이 없습니다']) {
      expect(shouldForceRelogin({ code: 'P0001', message: m }), m).toBe(true)
    }
  })

  test('⚠ 서버에 못 닿았으면 **그대로 둔다** — 봉사 중에 쫓아내면 안 된다', () => {
    // supabase 는 전송 실패도 { error } 로 준다. code 가 없다.
    expect(shouldForceRelogin({ message: 'Failed to fetch' })).toBe(false)
    expect(shouldForceRelogin({ code: null, message: 'Load failed' })).toBe(false)
  })

  test('⚠ **서버 쪽 문제로 전원을 쫓아내지 않는다**', () => {
    // 이게 제일 무섭다. 함수 이름을 바꾸거나 권한을 잘못 건드리면
    // 62명이 한꺼번에 로그인 화면을 보게 된다 — 그건 사용자 잘못이 아니다.
    expect(shouldForceRelogin({ code: 'PGRST202', message: 'Could not find the function' })).toBe(false)
    expect(shouldForceRelogin({ code: '42501', message: 'permission denied for function' })).toBe(false)
    expect(shouldForceRelogin({ code: 'PGRST301', message: 'JWT expired' })).toBe(false)
    expect(shouldForceRelogin({ code: '57P03', message: 'the database system is starting up' })).toBe(false)
  })
})
