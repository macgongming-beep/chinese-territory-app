import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, test, vi } from 'vitest'
import type { InformalAsset } from '../types'
import { MobileMap } from './MobileMap'

const parent: InformalAsset = {
  id: 1,
  name: '경희대',
  kind: '비공식구역',
  imageUrl: '',
  imagePath: '',
  uploadedBy: '관리자',
  createdAt: '2026-09-04T00:00:00Z',
  archived: false,
  groupId: null,
}

const child: InformalAsset = {
  ...parent,
  id: 2,
  parentId: 1,
  name: '정자',
  kind: '대화장소',
  memo: '점심시간에 학생들이 많이 지납니다.',
}

function renderMap(onUpdateInformalPlace?: ReturnType<typeof vi.fn>) {
  const props = {
    language: 'ko',
    buildings: [],
    cardBoundaries: [],
    cards: [],
    currentVisitor: '관리자',
    actualRole: onUpdateInformalPlace ? 'admin' : 'leader',
    serviceSessions: [],
    informalAssets: [parent, child],
    focusedInformalId: 1,
    onUpdateInformalPlace,
    focusedCardIds: [],
    onBack: vi.fn(),
    visitHistories: [],
    specialPeriods: [],
    eventRestaurantAssignments: [],
    calendarEvents: [],
  }
  render(<MemoryRouter><MobileMap {...(props as never)} /></MemoryRouter>)
}

describe('모바일 비공식 포인트', () => {
  test('빈 상위 메모 안내는 숨기고 포인트 메모는 크게 읽을 수 있게 보여 준다', () => {
    renderMap()

    expect(screen.queryByText(/메모가 없습니다/)).not.toBeInTheDocument()
    expect(screen.getByText('정자')).toBeVisible()
    expect(screen.getByText('점심시간에 학생들이 많이 지납니다.')).toBeVisible()
  })

  test('관리자는 포인트 이름과 메모를 모바일에서 함께 고친다', async () => {
    const update = vi.fn().mockResolvedValue(true)
    renderMap(update)

    fireEvent.click(screen.getByRole('button', { name: '정자 수정' }))
    fireEvent.change(screen.getByLabelText('메모'), { target: { value: '저녁에는 조용합니다.' } })
    fireEvent.click(screen.getByRole('button', { name: '저장' }))

    await waitFor(() => expect(update).toHaveBeenCalledWith(2, {
      name: '정자',
      memo: '저녁에는 조용합니다.',
    }))
  })
})
