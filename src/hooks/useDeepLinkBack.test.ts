import { describe, test, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useDeepLinkBack } from './useDeepLinkBack'

function setup() {
  const goBack = vi.fn()
  const r = renderHook(({ id }: { id: number | null }) => useDeepLinkBack(id, goBack), {
    initialProps: { id: null as number | null },
  })
  return { goBack, r }
}

describe('useDeepLinkBack', () => {
  test('딥링크로 열었다 닫으면 한 발짝 물러난다', () => {
    const { goBack, r } = setup()
    act(() => r.result.current.markDeepLink())
    r.rerender({ id: 7 })
    expect(goBack).not.toHaveBeenCalled()
    r.rerender({ id: null })
    expect(goBack).toHaveBeenCalledTimes(1)
  })

  test('여는 그 순간에는 물러나지 않는다', () => {
    // 이걸 놓쳐서 상세가 아예 안 열렸다.
    // 진짜 상황은 **한 커밋 안에서** 표시가 먼저 서는 것이다 —
    // 딥링크 effect 가 표시를 세우고 열기를 걸어도, 이 훅의 effect 가
    // 도는 시점엔 열린 값이 아직 null 이다. 그래서 렌더 중에 표시를 세워
    // 그 순서를 그대로 재현한다.
    const goBack = vi.fn()
    const pending = { current: true }
    const r = renderHook(
      ({ id }: { id: number | null }) => {
        const h = useDeepLinkBack(id, goBack)
        if (pending.current) { pending.current = false; h.markDeepLink() }
        return h
      },
      { initialProps: { id: null as number | null } },
    )
    expect(goBack).not.toHaveBeenCalled()   // 여기서 물러나면 상세가 안 열린다
    r.rerender({ id: 7 })
    expect(goBack).not.toHaveBeenCalled()
    r.rerender({ id: null })
    expect(goBack).toHaveBeenCalledTimes(1) // 닫을 때 비로소 물러난다
  })

  test('딥링크가 아니면 물러나지 않는다', () => {
    const { goBack, r } = setup()
    r.rerender({ id: 7 })
    r.rerender({ id: null })
    expect(goBack).not.toHaveBeenCalled()
  })

  test('한 번만 물러난다 — 다음에 직접 열고 닫으면 안 물러난다', () => {
    const { goBack, r } = setup()
    act(() => r.result.current.markDeepLink())
    r.rerender({ id: 7 })
    r.rerender({ id: null })
    r.rerender({ id: 9 })
    r.rerender({ id: null })
    expect(goBack).toHaveBeenCalledTimes(1)
  })

  test('상세를 바꿔 열어도 닫힐 때 한 번만', () => {
    const { goBack, r } = setup()
    act(() => r.result.current.markDeepLink())
    r.rerender({ id: 7 })
    r.rerender({ id: 8 })
    r.rerender({ id: null })
    expect(goBack).toHaveBeenCalledTimes(1)
  })
})
