// 구역선 복구는 **덮어쓰기**다. 잘못 들어가면 카드마다 수십 개 꼭짓점을 다시 찍어야 한다.
// 그래서 여기서 못 박는 것은 "언제 복구하지 않는가" 다.
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useCardBoundaryBackup } from './useCardBoundaryBackup'
import type { CardBoundary } from '../types'

const confirmMock = vi.hoisted(() => vi.fn())
const toastMock = vi.hoisted(() => vi.fn())
vi.mock('../lib/confirm', () => ({ confirmDialog: confirmMock, alertDialog: vi.fn() }))
vi.mock('../lib/toast', () => ({ showToast: toastMock }))

const square = [
  { lat: 37, lng: 127 }, { lat: 37, lng: 127.1 },
  { lat: 37.1, lng: 127.1 }, { lat: 37.1, lng: 127 },
]

/** input change 이벤트를 흉내낸다 */
function fileEvent(content: string) {
  const target = { files: [{ text: async () => content }], value: 'x' }
  return { target } as never
}

function setup(onRestore = vi.fn()) {
  const { result } = renderHook(() => useCardBoundaryBackup([], [], onRestore))
  return { restore: onRestore, hook: result }
}

beforeEach(() => {
  confirmMock.mockReset().mockResolvedValue(true)
  toastMock.mockReset()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

const backup = (cards: unknown[]) => JSON.stringify({ cards })

describe('구역선 복구', () => {
  test('확인을 누르면 복구한다', async () => {
    const { restore, hook } = setup()
    await hook.current.importBackup(fileEvent(backup([{ cardId: 5, boundary: square }])))

    expect(confirmMock).toHaveBeenCalled()
    expect(restore).toHaveBeenCalledWith([{ cardId: 5, points: square }])
  })

  test('확인을 취소하면 아무것도 안 한다', async () => {
    confirmMock.mockResolvedValue(false)
    const { restore, hook } = setup()
    await hook.current.importBackup(fileEvent(backup([{ cardId: 5, boundary: square }])))

    expect(restore).not.toHaveBeenCalled()
  })

  test('파일이 깨졌으면 복구하지 않는다 — 일부만 넣으면 더 위험하다', async () => {
    const { restore, hook } = setup()
    await hook.current.importBackup(fileEvent('이건 JSON 이 아니다'))

    expect(restore).not.toHaveBeenCalled()
    expect(confirmMock).not.toHaveBeenCalled()
    expect(toastMock).toHaveBeenCalledWith(expect.stringContaining('읽지 못했'), 'error')
  })

  test('좌표 하나만 깨져도 통째로 안 넣는다', async () => {
    const { restore, hook } = setup()
    await hook.current.importBackup(fileEvent(backup([
      { cardId: 1, boundary: square },
      { cardId: 2, boundary: [{ lat: 'x', lng: 1 }, { lat: 1, lng: 1 }, { lat: 2, lng: 2 }] },
    ])))

    expect(restore).not.toHaveBeenCalled()
  })

  test('쓸 만한 구역선이 없으면 확인조차 묻지 않는다', async () => {
    const { restore, hook } = setup()
    // 꼭짓점 2개짜리는 면이 안 된다 → 걸러지면 빈 목록
    await hook.current.importBackup(fileEvent(backup([
      { cardId: 1, boundary: [{ lat: 1, lng: 1 }, { lat: 2, lng: 2 }] },
    ])))

    expect(confirmMock).not.toHaveBeenCalled()
    expect(restore).not.toHaveBeenCalled()
    expect(toastMock).toHaveBeenCalledWith(expect.stringContaining('가져올 구역선이 없'), 'error')
  })

  test('복구 콜백이 없으면 아무것도 안 한다', async () => {
    const { result } = renderHook(() => useCardBoundaryBackup([], [] as CardBoundary[], undefined))
    await result.current.importBackup(fileEvent(backup([{ cardId: 1, boundary: square }])))

    expect(confirmMock).not.toHaveBeenCalled()
  })

  test('같은 파일을 다시 골라도 열리게 input 을 비운다', async () => {
    const { hook } = setup()
    const ev = fileEvent(backup([{ cardId: 1, boundary: square }]))
    await hook.current.importBackup(ev)

    expect((ev as unknown as { target: { value: string } }).target.value).toBe('')
  })
})
