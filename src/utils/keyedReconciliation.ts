export type KeyedEntry<T> = { value: T; signature: string }

export function upsertKeyedEntry<T>(
  entries: Map<string, KeyedEntry<T>>,
  key: string,
  signature: string,
  create: () => T,
  remove: (value: T) => void,
): void {
  const current = entries.get(key)
  if (current?.signature === signature) return
  if (current) remove(current.value)
  entries.set(key, { value: create(), signature })
}

export function removeStaleKeyedEntries<T>(
  entries: Map<string, KeyedEntry<T>>,
  activeKeys: ReadonlySet<string>,
  remove: (value: T) => void,
): void {
  for (const [key, entry] of entries) {
    if (activeKeys.has(key)) continue
    remove(entry.value)
    entries.delete(key)
  }
}
