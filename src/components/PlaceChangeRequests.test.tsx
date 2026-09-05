import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PlaceChangeRequest } from '../types'
import { PlaceChangeRequests } from './PlaceChangeRequests'

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  review: vi.fn(),
  execute: vi.fn(),
  confirm: vi.fn(),
}))

vi.mock('../hooks/storeMutations/placeChangeRequests', () => ({
  fetchPlaceChangeRequests: mocks.fetch,
  reviewPlaceChangeRequest: mocks.review,
  executePlaceDeletionRequest: mocks.execute,
}))
vi.mock('../lib/confirm', () => ({ confirmDialog: mocks.confirm }))

const request: PlaceChangeRequest = {
  id: 4,
  requestType: 'remove_place',
  buildingId: 1230,
  unitId: 2194,
  returnVisitId: null,
  buildingName: '고진로 45',
  address: '고진로 45',
  unitNumber: '아빌라301호',
  note: '현장에서 없어짐을 확인했습니다.',
  requestedByName: '张雄장웅',
  status: 'pending',
  reviewedByName: '',
  reviewNote: '',
  createdAt: '2026-09-06T00:00:00Z',
  reviewedAt: null,
  impact: {
    unitCount: 1,
    visitHistoryCount: 3,
    regularVisitCount: 0,
    returnVisitCount: 0,
    phoneSurveyCount: 0,
    assignmentCount: 0,
  },
}

function LocationProbe() {
  const location = useLocation()
  return <output aria-label="location">{location.pathname}{location.search}</output>
}

beforeEach(() => {
  mocks.fetch.mockReset().mockResolvedValue([request])
  mocks.review.mockReset().mockResolvedValue(true)
  mocks.execute.mockReset().mockResolvedValue(true)
  mocks.confirm.mockReset().mockResolvedValue(true)
})

describe('자료 수정 요청 목록', () => {
  it('작은 행을 펼쳐 삭제 영향과 영구 삭제를 확인한다', async () => {
    const user = userEvent.setup()
    const applyDeletion = vi.fn()
    render(<MemoryRouter><PlaceChangeRequests onPlaceDeleted={applyDeletion} /></MemoryRouter>)
    await screen.findByText('고진로 45 아빌라301호')
    expect(screen.queryByText('방문 기록')).toBeNull()

    await user.click(screen.getByRole('button', { name: /장소 삭제 요청/ }))
    expect(screen.getByText('방문 기록')).not.toBeNull()
    expect(screen.getByText('3')).not.toBeNull()

    await user.click(screen.getByRole('button', { name: '영구 삭제' }))
    await waitFor(() => expect(mocks.execute).toHaveBeenCalledWith(4))
    await waitFor(() => expect(applyDeletion).toHaveBeenCalledWith(expect.objectContaining({
      targetType: 'unit',
      buildingId: 1230,
      unitId: 2194,
    })))
    expect(mocks.confirm).toHaveBeenCalledWith(expect.objectContaining({ confirmLabel: '영구 삭제' }))
  })

  it('장소 열기는 건물과 세대를 URL에 함께 보낸다', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/place-change-requests']}>
        <PlaceChangeRequests />
        <LocationProbe />
      </MemoryRouter>,
    )
    await user.click(await screen.findByRole('button', { name: /장소 삭제 요청/ }))
    await user.click(screen.getByRole('button', { name: '장소 열기' }))
    expect(screen.getByLabelText('location').textContent).toBe('/map?buildingId=1230&unitId=2194')
  })
})
