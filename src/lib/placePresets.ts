export const PLACE_PRESET_STORAGE_KEY = 'chs-admin-calendar-place-presets-v1'
export const PLACE_PRESETS_MAX = 10

export type PlacePreset = {
  name: string
  mapLink: string
}

export const DEFAULT_PLACE_PRESETS: PlacePreset[] = [
  { name: '스타벅스', mapLink: '' },
  { name: '맥도날드', mapLink: '' },
]

export function normalizePlacePresets(input: unknown): PlacePreset[] {
  if (!Array.isArray(input)) return DEFAULT_PLACE_PRESETS
  const normalized = input
    .slice(0, PLACE_PRESETS_MAX)
    .map((item) => {
      const row = item as Partial<PlacePreset>
      if (!row.name || typeof row.name !== 'string' || !row.name.trim()) return null
      return {
        name: row.name.trim().slice(0, 30),
        mapLink: typeof row.mapLink === 'string' ? row.mapLink.trim() : '',
      }
    })
    .filter((item): item is PlacePreset => Boolean(item))
  return normalized.length > 0 ? normalized : DEFAULT_PLACE_PRESETS
}

export function loadPlacePresets(): PlacePreset[] {
  if (typeof window === 'undefined') return DEFAULT_PLACE_PRESETS
  try {
    return normalizePlacePresets(JSON.parse(window.localStorage.getItem(PLACE_PRESET_STORAGE_KEY) ?? 'null'))
  } catch {
    return DEFAULT_PLACE_PRESETS
  }
}

export function savePlacePresets(presets: PlacePreset[]) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(PLACE_PRESET_STORAGE_KEY, JSON.stringify(normalizePlacePresets(presets)))
}
