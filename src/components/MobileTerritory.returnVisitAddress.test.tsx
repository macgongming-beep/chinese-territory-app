import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, test, vi, beforeEach } from 'vitest'
import { MobileTerritory } from './MobileTerritory'

// 봉사자 여러 명이 신고했다: 주소를 치는 도중 엉뚱한 지방 주소로 칸이 바뀐다.
// 원인은 타이핑 800ms 뒤 첫 지오코딩 결과로 **입력칸을 덮어쓰던 것**이었다.
const geocode = vi.hoisted(() => vi.fn())
beforeEach(() => {
  geocode.mockReset()
  ;(window as unknown as { naver: unknown }).naver = {
    maps: { Service: { Status: { ERROR: 'ERROR', OK: 'OK' }, geocode } },
  }
  localStorage.setItem('currentVisitor', '홍길동')
  localStorage.setItem('feat_returnVisit', '1')   // 정기방문 화면 자체가 이 스위치로 켜진다
})

const props = (over: Record<string, unknown> = {}) => ({
  language: 'ko', role: 'user', currentVisitor: '홍길동',
  buildings: [], cards: [], calendarEvents: [], visitHistories: [],
  returnVisits: [], returnVisitLogs: [], serviceSessions: [],
  eventInformalAssignments: [], eventRestaurantAssignments: [], informalAssets: [],
  onOpenMap: vi.fn(), onEndServiceSession: vi.fn(),
  ...over,
})
const renderIt = (over = {}) =>
  render(<MemoryRouter><MobileTerritory {...(props(over) as never)} /></MemoryRouter>)

const openAddSheet = () => {
  fireEvent.click(screen.getByRole('button', { name: '더보기' }))          // ⋯ 메뉴
  fireEvent.click(screen.getByRole('button', { name: /정기 ?방문 추가/ }))
}

describe('정기방문 주소 입력', () => {
  test('⚠ 타이핑만으로는 지오코딩을 부르지 않는다 — 칸이 멋대로 바뀌면 안 된다', async () => {
    renderIt()
    openAddSheet()
    const addr = screen.getByPlaceholderText('예: 언동로 213')
    fireEvent.change(addr, { target: { value: '명지로 116' } })
    await new Promise((r) => setTimeout(r, 1200))   // 옛 debounce(800ms)보다 길게 기다린다
    expect(geocode).not.toHaveBeenCalled()
    expect((addr as HTMLInputElement).value).toBe('명지로 116')
  })

  test('검색을 눌러야 부르고, 후보를 골라야 칸이 바뀐다', async () => {
    geocode.mockImplementation((_q: unknown, cb: (s: string, r: unknown) => void) => {
      cb('OK', { v2: { addresses: [
        { roadAddress: '경기도 용인시 처인구 명지로 116', x: '127.18', y: '37.22' },
        { roadAddress: '전라남도 어딘가 명지로 116', x: '126.5', y: '34.8' },
      ] } })
    })
    renderIt()
    openAddSheet()
    const addr = screen.getByPlaceholderText('예: 언동로 213')
    fireEvent.change(addr, { target: { value: '명지로 116' } })
    fireEvent.click(screen.getByRole('button', { name: '검색' }))

    await waitFor(() => expect(screen.getByText('경기도 용인시 처인구 명지로 116')).toBeVisible())
    // 후보만 떴을 뿐 칸은 그대로다
    expect((addr as HTMLInputElement).value).toBe('명지로 116')

    fireEvent.click(screen.getByText('경기도 용인시 처인구 명지로 116'))
    await waitFor(() => expect((addr as HTMLInputElement).value).toBe('경기도 용인시 처인구 명지로 116'))
  })
})

describe('정기방문 저장', () => {
  test('⚠ 실패하면 시트를 닫지 않는다 — 입력이 날아가면 안 된다', async () => {
    const create = vi.fn().mockResolvedValue(false)
    renderIt({ onCreateManualReturnVisit: create })
    openAddSheet()
    fireEvent.change(screen.getByPlaceholderText('예: 고림동 할머니'), { target: { value: '김씨' } })
    fireEvent.click(screen.getByRole('button', { name: '저장' }))
    await waitFor(() => expect(create).toHaveBeenCalled())
    expect(screen.getByPlaceholderText('예: 고림동 할머니')).toBeVisible()
  })

  test('성공하면 닫는다', async () => {
    const create = vi.fn().mockResolvedValue(true)
    renderIt({ onCreateManualReturnVisit: create })
    openAddSheet()
    fireEvent.change(screen.getByPlaceholderText('예: 고림동 할머니'), { target: { value: '김씨' } })
    fireEvent.click(screen.getByRole('button', { name: '저장' }))
    await waitFor(() => expect(screen.queryByPlaceholderText('예: 고림동 할머니')).not.toBeInTheDocument())
  })
})
