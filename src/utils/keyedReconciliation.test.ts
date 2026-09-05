import { describe, expect, it, vi } from 'vitest'
import { removeStaleKeyedEntries, upsertKeyedEntry, type KeyedEntry } from './keyedReconciliation'

describe('keyed reconciliation', () => {
  it('같은 키와 모양은 기존 객체를 재사용한다', () => {
    const original = { id: 1 }
    const entries = new Map<string, KeyedEntry<{ id: number }>>([
      ['building:1', { value: original, signature: 'same' }],
    ])
    const create = vi.fn(() => ({ id: 2 }))
    const remove = vi.fn()

    upsertKeyedEntry(entries, 'building:1', 'same', create, remove)

    expect(entries.get('building:1')?.value).toBe(original)
    expect(create).not.toHaveBeenCalled()
    expect(remove).not.toHaveBeenCalled()
  })

  it('모양이 바뀐 객체만 제거하고 다시 만든다', () => {
    const original = { id: 1 }
    const replacement = { id: 2 }
    const entries = new Map<string, KeyedEntry<{ id: number }>>([
      ['building:1', { value: original, signature: 'old' }],
    ])
    const remove = vi.fn()

    upsertKeyedEntry(entries, 'building:1', 'new', () => replacement, remove)

    expect(remove).toHaveBeenCalledWith(original)
    expect(entries.get('building:1')?.value).toBe(replacement)
  })

  it('화면에서 사라진 객체만 정리한다', () => {
    const keep = { id: 1 }
    const stale = { id: 2 }
    const entries = new Map<string, KeyedEntry<{ id: number }>>([
      ['building:1', { value: keep, signature: 'a' }],
      ['building:2', { value: stale, signature: 'b' }],
    ])
    const remove = vi.fn()

    removeStaleKeyedEntries(entries, new Set(['building:1']), remove)

    expect([...entries.keys()]).toEqual(['building:1'])
    expect(remove).toHaveBeenCalledTimes(1)
    expect(remove).toHaveBeenCalledWith(stale)
  })
})
