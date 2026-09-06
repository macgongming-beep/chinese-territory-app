/* eslint-disable @typescript-eslint/no-explicit-any -- MapCanvas 대신 PC 지도의 단계 전환 계약만 시험한다 */
import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, test, vi } from 'vitest'
import { testBuilding, testCard, territoryProps } from '../test/territoryFixture'
import { DesktopMap } from './DesktopMap'

vi.mock('./MapCanvas', () => ({
  MapCanvas: (props: any) => (
    <div>
      <button type="button" onClick={() => props.onZoomChange?.(14)}>zoom middle</button>
      <button type="button" onClick={() => props.onZoomChange?.(16)}>zoom close</button>
      <button type="button" onClick={() => props.onZoomChange?.(10)}>zoom far</button>
      {(props.aggregateMarkers ?? []).map((marker: { id: string; label: string }) => (
        <button key={marker.id} type="button" onClick={() => props.onSelectAggregate?.(marker.id)}>
          지도 집계 {marker.label}
        </button>
      ))}
      {(props.aggregateMarkers ?? []).length === 0 && <span>건물 포인트 {props.buildings.length}개</span>}
    </div>
  ),
}))

function mapProps() {
  return territoryProps({
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
    informalAssets: [],
    visitHistories: [],
    specialPeriods: [],
    eventRestaurantAssignments: [],
    calendarEvents: [],
  })
}

describe('PC 지도 확대 단계', () => {
  test('긴 구역 목록은 평소에 지도 폭을 차지하지 않고 필요할 때만 연다', () => {
    render(<MemoryRouter><DesktopMap {...(mapProps() as never)} /></MemoryRouter>)

    expect(screen.queryByLabelText('지도 카드 목록')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '구역 목록' }))
    expect(screen.getByLabelText('지도 카드 목록')).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: '구역 목록 닫기' }))
    expect(screen.queryByLabelText('지도 카드 목록')).not.toBeInTheDocument()
  })

  test('확대 수준에 따라 구에서 동, 건물 포인트 순서로 상세화한다', () => {
    render(<MemoryRouter><DesktopMap {...(mapProps() as never)} /></MemoryRouter>)

    expect(screen.getByText('지도 집계 기흥구')).toBeVisible()
    expect(screen.queryByText('지도 집계 영덕동')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'zoom middle' }))
    expect(screen.getByText('지도 집계 영덕동')).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: 'zoom close' }))
    expect(screen.getByText('건물 포인트 2개')).toBeVisible()
  })

  test('직접 고른 구와 동은 줌을 바꿔도 상위 단계로 돌아가지 않는다', () => {
    render(<MemoryRouter><DesktopMap {...(mapProps() as never)} /></MemoryRouter>)

    fireEvent.click(screen.getByRole('button', { name: '지도 집계 기흥구' }))
    expect(screen.getByRole('button', { name: '지도 집계 영덕동' })).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: 'zoom far' }))
    expect(screen.getByRole('button', { name: '지도 집계 영덕동' })).toBeVisible()
    expect(screen.queryByRole('button', { name: '지도 집계 기흥구' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '지도 집계 영덕동' }))
    expect(screen.getByText('건물 포인트 1개')).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: 'zoom far' }))
    expect(screen.getByText('건물 포인트 1개')).toBeVisible()
  })
})
