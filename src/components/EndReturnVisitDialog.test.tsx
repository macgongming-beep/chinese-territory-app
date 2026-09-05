import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ReturnVisit } from '../types'
import { EndReturnVisitDialog } from './EndReturnVisitDialog'

const visit: ReturnVisit = {
  id: 7,
  unitId: 20,
  buildingId: 10,
  displayName: '진미식당 201호',
  nickname: '반응 좋은 분',
  address: '명지로 10',
  unitNumber: '201',
  assignedUserName: '현재 담당자',
  createdBy: '현재 담당자',
  lastVisitedAt: null,
  lastResult: null,
  createdAt: '2026-09-06T00:00:00Z',
}

describe('EndReturnVisitDialog', () => {
  it('기본 종료는 장소 삭제 요청 없이 담당 종료 사유만 보낸다', async () => {
    const onSubmit = vi.fn().mockResolvedValue(true)
    const onClose = vi.fn()
    render(<EndReturnVisitDialog visit={visit} onSubmit={onSubmit} onClose={onClose} />)

    fireEvent.click(screen.getByRole('button', { name: '정기방문 종료' }))

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({
      reason: 'no_longer_assigned',
      issueType: null,
      issueNote: '',
    }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('장소 문제를 선택하면 설명과 함께 관리자 요청을 보낸다', async () => {
    const onSubmit = vi.fn().mockResolvedValue(true)
    render(<EndReturnVisitDialog visit={visit} onSubmit={onSubmit} onClose={vi.fn()} />)

    fireEvent.change(screen.getByLabelText(/장소 정보에도 문제가 있나요/), { target: { value: 'details_wrong' } })
    fireEvent.change(screen.getByPlaceholderText('올바른 주소·이름·호수를 적어 주세요.'), {
      target: { value: '주소는 명지로 12입니다.' },
    })
    fireEvent.click(screen.getByRole('button', { name: '종료하고 요청 보내기' }))

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({
      reason: 'no_longer_assigned',
      issueType: 'details_wrong',
      issueNote: '주소는 명지로 12입니다.',
    }))
  })

  it('저장에 실패하면 입력한 내용을 유지하고 창을 닫지 않는다', async () => {
    const onSubmit = vi.fn().mockResolvedValue(false)
    const onClose = vi.fn()
    render(<EndReturnVisitDialog visit={visit} onSubmit={onSubmit} onClose={onClose} />)

    fireEvent.click(screen.getByLabelText('다른 사람이 이어서 방문해야 합니다'))
    fireEvent.change(screen.getByLabelText(/장소 정보에도 문제가 있나요/), { target: { value: 'unit_missing' } })
    fireEvent.change(screen.getByPlaceholderText('관리자가 확인할 내용을 적어 주세요.'), {
      target: { value: '201호가 없어졌습니다.' },
    })
    fireEvent.click(screen.getByRole('button', { name: '종료하고 요청 보내기' }))

    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce())
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByDisplayValue('201호가 없어졌습니다.')).toBeTruthy()
  })
})
