import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ReturnVisit } from '../types'
import { RegularVisitManagement } from './RegularVisitManagement'

const orphanedVisit: ReturnVisit = {
  id: 19,
  unitId: 101,
  buildingId: 10,
  displayName: '김량장동 26 1층 첫집',
  nickname: '',
  address: '김량장동 26',
  unitNumber: '1층 첫집',
  assignedUserName: '',
  createdBy: '김무혁',
  lastVisitedAt: '2026-05-23T00:00:00Z',
  lastResult: '만남',
  createdAt: '2026-05-23T00:00:00Z',
}

const users = [
  { name: '새 담당자', role: 'user', approvalStatus: 'approved' as const },
  { name: '승인 대기', role: 'user', approvalStatus: 'pending' as const },
  { name: '비활성 사용자', role: 'user', approvalStatus: 'approved' as const, isActive: false },
]

describe('RegularVisitManagement', () => {
  it('삭제된 계정의 이전 기록 이름과 재지정 필요 상태를 보여준다', () => {
    render(<RegularVisitManagement returnVisits={[orphanedVisit]} activeUsers={users} isDeveloper={false} onReassign={vi.fn()} />)

    expect(screen.getByText('담당자 재지정 필요 1건')).toBeTruthy()
    expect(screen.getByText('기존 기록 이름: 김무혁')).toBeTruthy()
    expect(screen.getByText('최근 결과: 만남')).toBeTruthy()
  })

  it('승인된 사용자만 후보로 보여주고 저장 실패 시 피커를 유지한다', async () => {
    const onReassign = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true)
    render(<RegularVisitManagement returnVisits={[orphanedVisit]} activeUsers={users} isDeveloper={false} onReassign={onReassign} />)

    fireEvent.click(screen.getByRole('button', { name: '담당자 재배정' }))
    expect(screen.queryByRole('button', { name: '승인 대기' })).toBeNull()
    expect(screen.queryByRole('button', { name: '비활성 사용자' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '새 담당자' }))
    await waitFor(() => expect(onReassign).toHaveBeenCalledTimes(1))
    expect(screen.getByPlaceholderText('이름 검색 (초성 가능)')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: '새 담당자' }))
    await waitFor(() => expect(screen.queryByPlaceholderText('이름 검색 (초성 가능)')).toBeNull())
  })
})
