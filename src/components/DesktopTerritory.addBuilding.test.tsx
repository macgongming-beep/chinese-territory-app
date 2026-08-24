// 건물 추가 흐름을 못 박는다. **추출 전에** 쓴 것이다.
//
// 여기서 중요한 건 화면이 아니라 **자동 카드 배정**이다. 세 갈래로 갈리는데
// 어느 쪽으로 갔는지 사람 눈에 안 보인다 — 조용히 엉뚱한 카드에 들어간다.
//   ① 좌표가 구역선 안에 들어가면 그 카드
//   ② 아니면 주소의 동 이름으로 찾은 카드
//   ③ 그것도 없으면 첫 번째 카드
import { describe, test, expect, beforeEach, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { DesktopTerritory } from './DesktopTerritory'
import { territoryProps, testBoundary, testCard } from '../test/territoryFixture'
import { setRegions } from '../lib/regions'

// 지오코딩은 네트워크다. 테스트에서 나가지 않게 막고, 좌표를 우리가 정한다.
const geocode = vi.hoisted(() => vi.fn())
vi.mock('../lib/naverGeocode', () => ({
  geocodeFirstMatch: geocode,
  geocodeQuery: geocode,
  isNaverMapsReady: () => true,
}))

beforeEach(() => {
  setRegions([{ id: 1, name: '수지구', city: '용인시', sortOrder: 1, nameZh: '', nameEn: '' }])
  geocode.mockReset()
})

function open(overrides: Record<string, unknown> = {}) {
  const props = territoryProps({ onCreateBuilding: vi.fn(async () => true), ...overrides })
  render(<MemoryRouter><DesktopTerritory {...(props as never)} /></MemoryRouter>)
  return props
}

/** 건물 추가 버튼은 '건물 관리' 탭 안에 있다. 실제 동선 그대로 간다. */
async function openAddBuilding(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: '건물 관리' }))
  await user.click(screen.getByRole('button', { name: '+ 건물 추가' }))
  return screen.getByText('건물 추가', { selector: 'h2' }).closest('.cal-modal') as HTMLElement
}

async function fillAndSubmit(user: ReturnType<typeof userEvent.setup>, address: string, name = '언동로빌라') {
  await openAddBuilding(user)
  const modal = screen.getByText('건물 추가', { selector: 'h2' }).closest('.cal-modal') as HTMLElement
  await user.type(within(modal).getByPlaceholderText(/경기도 용인시/), address)
  await user.type(within(modal).getByPlaceholderText(/언동로빌라/), name)
  await user.click(within(modal).getByRole('button', { name: '건물 추가' }))
  return modal
}

describe('건물 추가 — 자동 카드 배정', () => {
  test('좌표가 구역선 안이면 그 카드에 넣는다', async () => {
    const user = userEvent.setup()
    geocode.mockResolvedValue({ lat: 37.5, lng: 127.1 })
    const props = open({
      cards: [testCard(1, '수지구 죽전동 1'), testCard(2, '수지구 상현동 1')],
      cardBoundaries: [testBoundary(2, [37.4, 127.0, 37.6, 127.2])],
    })

    await fillAndSubmit(user, '경기도 용인시 수지구 어딘가 1')

    expect(props.onCreateBuilding).toHaveBeenCalledWith(
      expect.objectContaining({ cardId: 2, lat: 37.5, lng: 127.1 }),
    )
  })

  test('구역선에 안 들어가면 주소의 동 이름으로 찾는다', async () => {
    const user = userEvent.setup()
    geocode.mockResolvedValue({ lat: 99, lng: 99 })   // 어느 구역선에도 안 들어감
    const props = open({
      cards: [testCard(1, '수지구 죽전동 1'), testCard(2, '수지구 상현동 1')],
      cardBoundaries: [testBoundary(1, [37.4, 127.0, 37.6, 127.2])],
    })

    await fillAndSubmit(user, '경기도 용인시 수지구 상현동 12')

    expect(props.onCreateBuilding).toHaveBeenCalledWith(expect.objectContaining({ cardId: 2 }))
  })

  test('좌표를 못 찾아도 건물은 만들어진다 (좌표 0)', async () => {
    const user = userEvent.setup()
    geocode.mockResolvedValue(null)
    const props = open({ cards: [testCard(7, '수지구 죽전동 1')] })

    await fillAndSubmit(user, '없는 주소')

    expect(props.onCreateBuilding).toHaveBeenCalledWith(
      expect.objectContaining({ cardId: 7, lat: 0, lng: 0 }),
    )
  })

  test('주소가 비면 만들지 않는다', async () => {
    const user = userEvent.setup()
    const props = open({ cards: [testCard(1, '수지구 죽전동 1')] })

    const modal = await openAddBuilding(user)
    await user.click(within(modal).getByRole('button', { name: '건물 추가' }))

    expect(props.onCreateBuilding).not.toHaveBeenCalled()
  })

  test('저장이 실패하면 모달을 닫지 않는다 — 입력을 잃지 않게', async () => {
    const user = userEvent.setup()
    geocode.mockResolvedValue({ lat: 37.5, lng: 127.1 })
    open({ cards: [testCard(1, '수지구 죽전동 1')], onCreateBuilding: vi.fn(async () => false) })

    await fillAndSubmit(user, '경기도 용인시 수지구 죽전동 1')

    expect(screen.queryByText('건물 추가', { selector: 'h2' })).not.toBeNull()
  })

  test('성공하면 모달이 닫힌다', async () => {
    const user = userEvent.setup()
    geocode.mockResolvedValue({ lat: 37.5, lng: 127.1 })
    open({ cards: [testCard(1, '수지구 죽전동 1')] })

    await fillAndSubmit(user, '경기도 용인시 수지구 죽전동 1')

    expect(screen.queryByText('건물 추가', { selector: 'h2' })).toBeNull()
  })
})
