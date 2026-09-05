import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { usePlaceDeletionRealtime } from './usePlaceDeletionRealtime'

const mocks = vi.hoisted(() => {
  const handlers: Array<() => void> = []
  const channel = {
    topic: 'place-deletion-test',
    on: vi.fn((_type, _filter, handler: () => void) => {
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

afterEach(() => {
  vi.useRealTimers()
})

describe('장소 삭제 Realtime 동기화', () => {
  it('건물과 하위 세대 삭제 이벤트를 한 번의 백그라운드 동기화로 묶는다', () => {
    const onDelete = vi.fn()
    renderHook(() => usePlaceDeletionRealtime(onDelete, { debounceMs: 500 }))

    expect(mocks.handlers).toHaveLength(2)
    act(() => {
      mocks.handlers[0]()
      mocks.handlers[1]()
      vi.advanceTimersByTime(499)
    })
    expect(onDelete).not.toHaveBeenCalled()

    act(() => vi.advanceTimersByTime(1))
    expect(onDelete).toHaveBeenCalledOnce()
  })

  it('로그인 전에는 채널을 열지 않는다', () => {
    renderHook(() => usePlaceDeletionRealtime(vi.fn(), { enabled: false }))
    expect(mocks.channel.on).not.toHaveBeenCalled()
  })

  it('화면을 떠날 때 예약 동기화를 취소하고 채널을 닫는다', () => {
    const onDelete = vi.fn()
    const { unmount } = renderHook(() => usePlaceDeletionRealtime(onDelete, { debounceMs: 500 }))
    act(() => mocks.handlers[0]())
    unmount()
    act(() => vi.advanceTimersByTime(500))

    expect(onDelete).not.toHaveBeenCalled()
    expect(mocks.removeChannel).toHaveBeenCalledWith(mocks.channel)
  })
})
