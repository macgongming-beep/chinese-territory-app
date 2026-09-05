import { describe, expect, it } from 'vitest'
import type { ReturnVisit } from '../types'
import { countBrokenReturnVisits } from './adminAttention'

function returnVisit(id: number, assignedUserName: string): ReturnVisit {
  return {
    id,
    unitId: id,
    buildingId: 1,
    displayName: `${id}호`,
    nickname: '',
    address: '테스트로 1',
    unitNumber: `${id}호`,
    assignedUserName,
    createdBy: '관리자',
    lastVisitedAt: null,
    lastResult: null,
    createdAt: '2026-09-06T00:00:00Z',
  }
}

describe('관리자 확인 필요 숫자', () => {
  it('비어 있거나 승인·활성 사용자에게 이어지지 않은 정기방문만 센다', () => {
    const visits = [
      returnVisit(1, '활성 사용자'),
      returnVisit(2, ''),
      returnVisit(3, '탈퇴 사용자'),
      returnVisit(4, '승인 대기'),
      returnVisit(5, '비활성 사용자'),
    ]
    const users = [
      { name: '활성 사용자', approvalStatus: 'approved' as const, isActive: true },
      { name: '승인 대기', approvalStatus: 'pending' as const, isActive: true },
      { name: '비활성 사용자', approvalStatus: 'approved' as const, isActive: false },
    ]

    expect(countBrokenReturnVisits(visits, users)).toBe(4)
  })

  it('옛 데이터처럼 승인 상태가 비어 있는 활성 사용자는 정상 담당자로 본다', () => {
    expect(countBrokenReturnVisits([returnVisit(1, '기존 사용자')], [{ name: '기존 사용자' }])).toBe(0)
  })
})
