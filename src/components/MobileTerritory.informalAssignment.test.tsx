import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, test, vi } from 'vitest'
import type { CalendarEvent, EventInformalAssignment, InformalAsset } from '../types'
import { MobileTerritory } from './MobileTerritory'

function localToday(): string {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

const event = {
  id: 394,
  date: localToday(),
  time: '15:00',
  title: '전도',
  applicants: ['나', '같은팀', '다른팀'],
  assigned: [],
  leaders: [],
  cardAssignments: [
    { id: 1, eventId: 394, userName: '나', assignedCardId: null, assignedCardIds: [], teamKey: 'team-1' },
    { id: 2, eventId: 394, userName: '같은팀', assignedCardId: null, assignedCardIds: [], teamKey: 'team-1' },
    { id: 3, eventId: 394, userName: '다른팀', assignedCardId: null, assignedCardIds: [], teamKey: 'team-2' },
  ],
} as CalendarEvent

const asset = {
  id: 32,
  name: '경희대(홈플러스)',
  kind: '비공식구역',
  lat: 37.1,
  lng: 127.1,
} as InformalAsset

const informalAssignment = {
  id: 1,
  eventId: 394,
  userName: '나',
  assetId: 32,
} as EventInformalAssignment

describe('나의 봉사 비공식 배정', () => {
  test('같은 팀원만 보여 주고 배정된 비공식 구역을 연다', () => {
    const openInformal = vi.fn()
    render(
      <MemoryRouter>
        <MobileTerritory
          {...({
            language: 'ko',
            buildings: [],
            cards: [],
            calendarEvents: [event],
            currentVisitor: '나',
            role: 'user',
            serviceSessions: [],
            onOpenMap: vi.fn(),
            onOpenInformalMap: openInformal,
            onEndServiceSession: vi.fn(),
            informalAssets: [asset],
            eventInformalAssignments: [informalAssignment],
          } as never)}
        />
      </MemoryRouter>,
    )

    const eventButton = screen.getByRole('button', { name: /15:00 전도/ })
    if (!screen.queryByText(/팀원 나, 같은팀/)) fireEvent.click(eventButton)

    expect(screen.getByText(/팀원 나, 같은팀/)).toBeVisible()
    expect(screen.queryByText(/다른팀/)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '구역 보기' }))
    expect(openInformal).toHaveBeenCalledWith(32)
  })
})
