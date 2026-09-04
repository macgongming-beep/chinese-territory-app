import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import type { InformalAsset } from '../../types'
import { AdminMobileZone } from './AdminMobileZone'

function LocationProbe() {
  const location = useLocation()
  return <output data-testid="location">{location.pathname}{location.search}</output>
}

const props = {
  language: 'ko' as const,
  cards: [],
  buildings: [],
  currentVisitor: '관리자',
  role: 'admin' as const,
  informalAssets: [],
  informalGroups: [],
  onOpenMap: vi.fn(),
  onOpenAssignedMap: vi.fn(),
  onShowMapView: vi.fn(),
}

const informalAsset: InformalAsset = {
  id: 10,
  name: '우정원',
  kind: '비공식구역',
  imageUrl: '',
  imagePath: '',
  uploadedBy: '관리자',
  createdAt: '2026-09-04T00:00:00Z',
  archived: false,
  groupId: 1,
}

describe('모바일 비공식 탭 복원', () => {
  beforeEach(() => sessionStorage.clear())

  test('URL의 비공식 탭으로 다시 열리고 탭 변경도 URL에 남는다', () => {
    render(
      <MemoryRouter initialEntries={['/zone?tab=informal']}>
        <LocationProbe />
        <AdminMobileZone {...props} />
      </MemoryRouter>,
    )

    expect(screen.getByRole('tab', { name: /비공식/ })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByTestId('location')).toHaveTextContent('/zone?tab=informal')

    fireEvent.click(screen.getByRole('tab', { name: /구역 카드/ }))
    expect(screen.getByRole('tab', { name: /구역 카드/ })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByTestId('location')).toHaveTextContent('/zone')
  })

  test('지도 화면을 다녀와 다시 마운트돼도 펼친 그룹을 유지한다', () => {
    const screenProps = {
      ...props,
      informalAssets: [informalAsset],
      informalGroups: [{ id: 1, name: '경희대', position: 0, createdBy: '관리자', createdAt: '2026-09-04T00:00:00Z' }],
    }
    const first = render(
      <MemoryRouter initialEntries={['/zone?tab=informal']}>
        <AdminMobileZone {...screenProps} />
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByText('경희대'))
    expect(screen.getByText('우정원')).toBeVisible()
    first.unmount()

    render(
      <MemoryRouter initialEntries={['/zone?tab=informal']}>
        <AdminMobileZone {...screenProps} />
      </MemoryRouter>,
    )
    expect(screen.getByText('우정원')).toBeVisible()
  })
})
