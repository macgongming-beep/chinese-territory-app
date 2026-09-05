import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { usePlaceDeletionRealtime } from './usePlaceDeletionRealtime'

const mocks = vi.hoisted(() => {
  const handlers: Array<(payload: { new: unknown }) => void> = []
  const channel = {
    topic: 'place-deletion-test',
    on: vi.fn((_type, _filter, handler: (payload: { new: unknown }) => void) => {
      handlers.push(handler)
      return channel
    }),
    subscribe: vi.fn(() => channel),
  }
  return {
    handlers,
    channel,
    removeChannel: vi.fn(),
    subscribeWithRecovery: vi.fn(),
  }
})

vi.mock('../lib/supabase', () => ({
  supabase: {
    channel: vi.fn(() => mocks.channel),
    removeChannel: mocks.removeChannel,
  },
}))

vi.mock('../lib/realtimeRecovery', () => ({
  subscribeWithRecovery: mocks.subscribeWithRecovery,
}))

beforeEach(() => {
  vi.useFakeTimers()
  mocks.handlers.length = 0
  mocks.channel.on.mockClear()
  mocks.removeChannel.mockClear()
  mocks.subscribeWithRecovery.mockClear()
})

afterEach(() => vi.useRealTimers())

describe('장소 삭제 Realtime 동기화', () => {
  it('신호 한 건을 재조회 없이 삭제 정보로 전달한다', () => {
    const onDelete = vi.fn()
    renderHook(() => usePlaceDeletionRealtime(onDelete))

    expect(mocks.handlers).toHaveLength(1)
    act(() => {
      mocks.handlers[0]({ new: {
        id: 7,
        target_type: 'building',
        building_id: 12,
        unit_id: null,
        unit_ids: [21, 22],
        return_visit_ids: [31],
      } })
    })
    expect(onDelete).toHaveBeenCalledWith({
      id: 7,
      targetType: 'building',
      buildingId: 12,
      unitId: null,
      unitIds: [21, 22],
      returnVisitIds: [31],
    })
  })

  it('로그인 전에는 채널을 열지 않는다', () => {
    renderHook(() => usePlaceDeletionRealtime(vi.fn(), { enabled: false }))
    expect(mocks.channel.on).not.toHaveBeenCalled()
  })

  it('화면을 떠날 때 채널을 닫는다', () => {
    const { unmount } = renderHook(() => usePlaceDeletionRealtime(vi.fn()))
    unmount()
    expect(mocks.removeChannel).toHaveBeenCalledWith(mocks.channel)
  })
})
