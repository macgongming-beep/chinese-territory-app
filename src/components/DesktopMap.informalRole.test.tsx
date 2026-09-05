import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, test, vi } from 'vitest'
import type { InformalAsset } from '../types'
import { DesktopMap } from './DesktopMap'

// 비공식 장소는 관리자·개발자만 고친다. DB 가 이미 막지만(role_admin_informal_assets_*)
// /map 은 누구나 들어오는 화면이라, 화면이 안 막으면 버튼이 보이고 눌러야 실패한다.
const place: InformalAsset = {
  id: 1,
  name: '경희대(홈플러스)',
  kind: '비공식구역',
  imageUrl: '',
  imagePath: '',
  uploadedBy: '관리자',
  createdAt: '2026-09-05T00:00:00Z',
  archived: false,
  groupId: null,
}

function renderMap(actualRole: string) {
  const props = {
    language: 'ko',
    buildings: [],
    cardBoundaries: [],
    cards: [],
    currentVisitor: '홍길동',
    actualRole,
    serviceSessions: [],
    informalAssets: [place],
    focusedInformalId: 1,
    focusedCardIds: [],
    visitHistories: [],
    specialPeriods: [],
    eventRestaurantAssignments: [],
    calendarEvents: [],
    // 세 통로를 **전부** 넘긴다 — 화면이 스스로 거르는지 보는 것이 목적이라
    // 부모가 안 넘겨 줘서 사라진 것과 구별되어야 한다.
    onCreateInformalPlace: vi.fn(),
    onUpdateInformalPlace: vi.fn(),
    onSaveInformalShape: vi.fn(),
  }
  render(<MemoryRouter><DesktopMap {...(props as never)} /></MemoryRouter>)
}

describe('PC 지도의 비공식 장소 편집 권한', () => {
  test('관리자에게는 종류·이름 바꾸기가 보인다', () => {
    renderMap('admin')

    expect(screen.getByText(/의 종류/)).toBeVisible()
    expect(screen.getByRole('button', { name: '이름 변경' })).toBeVisible()
  })

  test('인도자에게는 보이지 않는다 — 콜백을 넘겨줘도', () => {
    renderMap('leader')

    expect(screen.queryByText(/의 종류/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '이름 변경' })).not.toBeInTheDocument()
  })

  test('전도인에게도 보이지 않는다', () => {
    renderMap('user')

    expect(screen.queryByText(/의 종류/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '이름 변경' })).not.toBeInTheDocument()
  })
})
