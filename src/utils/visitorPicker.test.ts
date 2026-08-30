import { describe, test, expect } from 'vitest'
import { canEditVisitor, visitorOptionsFrom, visitorOptionsWithCurrent } from './visitorPicker'

describe('누가 방문자를 고칠 수 있나', () => {
  test('관리자·개발자·인도자만', () => {
    expect(canEditVisitor('admin')).toBe(true)
    expect(canEditVisitor('developer')).toBe(true)
    expect(canEditVisitor('leader')).toBe(true)
  })
  test('⚠ 일반 사용자는 못 고친다', () => {
    expect(canEditVisitor('user')).toBe(false)
    expect(canEditVisitor(null)).toBe(false)
    expect(canEditVisitor(undefined)).toBe(false)
  })
})

describe('고를 수 있는 이름', () => {
  const users = [
    { name: '박진호', approvalStatus: 'approved' },
    { name: '김휘민', approvalStatus: 'approved' },
    { name: '대기자', approvalStatus: 'pending' },
    { name: '차단자', approvalStatus: 'blocked' },
    { name: '  ', approvalStatus: 'approved' },
    { name: '박진호', approvalStatus: 'approved' },
  ]

  test('승인된 사람만, 이름순, 중복 없이', () => {
    expect(visitorOptionsFrom(users)).toEqual(['김휘민', '박진호'])
  })

  test('⚠ 승인 상태가 없는 옛 자료는 승인으로 본다 — 빼면 목록이 빈다', () => {
    expect(visitorOptionsFrom([{ name: '옛사람' }])).toEqual(['옛사람'])
  })
})

describe('지금 적힌 이름 지키기', () => {
  const opts = ['김휘민', '박진호']

  test('목록에 있으면 그대로', () => {
    expect(visitorOptionsWithCurrent(opts, '박진호')).toEqual(opts)
  })

  test('⚠ 목록에 없으면 **앞에 끼워 넣는다** — 창만 열었다 닫아도 남의 기록이 되면 안 된다', () => {
    expect(visitorOptionsWithCurrent(opts, '위팅')).toEqual(['위팅', '김휘민', '박진호'])
  })

  test('비어 있으면 그대로', () => {
    expect(visitorOptionsWithCurrent(opts, '')).toEqual(opts)
    expect(visitorOptionsWithCurrent(opts, null)).toEqual(opts)
  })
})
