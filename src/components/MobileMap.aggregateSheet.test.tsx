/* eslint-disable @typescript-eslint/no-explicit-any -- MapCanvas 전체 대신 집계 핀 선택 계약만 시험한다 */
import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, test, vi } from 'vitest'
import { testBuilding, testCard, territoryProps } from '../test/territoryFixture'
import { MobileMap } from './MobileMap'

vi.mock('./MapCanvas', () => ({
  MapCanvas: (props: any) => (
    <div>
      <button type="button" onClick={() => props.onZoomChange?.(14)}>zoom middle</button>
      <button type="button" onClick={() => props.onZoomChange?.(16)}>zoom close</button>
      {(props.aggregateMarkers ?? []).map((marker: { id: string; label: string }) => (
        <button key={marker.id} type="button" onClick={() => props.onSelectAggregate(marker.id)}>
          지도 집계 {marker.label}
        </button>
      ))}
      {(props.aggregateMarkers ?? []).length === 0 && <output>건물 포인트 {props.buildings.length}개</output>}
    </div>
  ),
}))

describe('모바일 지도 하단 시트', () => {
  const mapProps = () => territoryProps({
    actualRole: 'admin',
    currentVisitor: '관리자',
    cards: [
      testCard(1, '기흥구 영덕동 1'),
      testCard(2, '수지구 죽전동 1'),
    ],
    buildings: [
      testBuilding(1, 1, '영덕빌라'),
      testBuilding(2, 2, '죽전빌라'),
    ],
    focusedCardIds: [],
    serviceSessions: [],
    specialPeriods: [],
    eventRestaurantAssignments: [],
    calendarEvents: [],
    onBack: vi.fn(),
  })

  test('확대 수준에 따라 구에서 동, 건물 포인트 순서로 상세화한다', async () => {
    render(<MemoryRouter><MobileMap {...(mapProps() as never)} /></MemoryRouter>)
    expect(screen.getByRole('button', { name: '지도 집계 기흥구' })).toBeVisible()
    expect(screen.queryByRole('button', { name: '지도 집계 영덕동' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'zoom middle' }))
    expect(await screen.findByRole('button', { name: '지도 집계 영덕동' })).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: 'zoom close' }))
    expect(await screen.findByText('건물 포인트 2개')).toBeVisible()
  })

  test('사용자가 내려둔 시트 높이를 구와 동 집계 핀 선택이 바꾸지 않는다', async () => {
    const props = mapProps()

    const { container } = render(<MemoryRouter><MobileMap {...(props as never)} /></MemoryRouter>)
    const sheet = container.querySelector('.mobile-bottom-sheet') as HTMLElement
    const handle = container.querySelector('.sheet-handle') as HTMLElement
    const now = vi.spyOn(Date, 'now')
      .mockReturnValueOnce(1_000)
      .mockReturnValueOnce(1_100)

    fireEvent.click(handle)
    fireEvent.click(handle)
    await waitFor(() => expect(sheet.style.height).toBe('65px'))

    fireEvent.click(await screen.findByRole('button', { name: '지도 집계 기흥구' }))
    await waitFor(() => expect(screen.getByRole('button', { name: '지도 집계 영덕동' })).toBeVisible())
    expect(sheet.style.height).toBe('65px')

    fireEvent.click(screen.getByRole('button', { name: '지도 집계 영덕동' }))
    expect(sheet.style.height).toBe('65px')
    now.mockRestore()
  })
})
