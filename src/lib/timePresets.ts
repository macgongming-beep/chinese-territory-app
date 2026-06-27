// 캘린더 "자주 쓰는 시간" 프리셋 — PC/모바일 공용
// localStorage 키를 공유하므로 같은 브라우저에서 PC↔모바일 화면 전환 시 동기화됨.

export const TIME_PRESET_STORAGE_KEY = 'chs-admin-calendar-time-presets-v1'
export const TIME_PRESETS_MAX = 5

export type TimePreset = {
  label: string
  time: string
  durationMinutes: number
  title: string
}

export const DEFAULT_TIME_PRESETS: TimePreset[] = [
  { label: '오전', time: '10:00', durationMinutes: 120, title: '传道' },
  { label: '오후', time: '13:00', durationMinutes: 120, title: '传道' },
  { label: '늦은 오후', time: '15:00', durationMinutes: 120, title: '传道' },
  { label: '저녁', time: '19:00', durationMinutes: 120, title: '传道' },
]

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

export function addMinutesToTime(time: string, minutes: number): string {
  const match = time.match(/^(\d{2}):(\d{2})$/)
  if (!match) return ''
  const hour = Number(match[1])
  const minute = Number(match[2])
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return ''
  const total = (hour * 60 + minute + minutes) % (24 * 60)
  return `${pad2(Math.floor(total / 60))}:${pad2(total % 60)}`
}

export function normalizeTimePresets(input: unknown): TimePreset[] {
  if (!Array.isArray(input)) return DEFAULT_TIME_PRESETS
  const normalized = input
    .slice(0, TIME_PRESETS_MAX)
    .map((item) => {
      const row = item as Partial<TimePreset>
      const time = typeof row.time === 'string' && /^\d{2}:\d{2}$/.test(row.time) ? row.time : ''
      if (!time) return null
      const duration = Number(row.durationMinutes)
      return {
        label: typeof row.label === 'string' && row.label.trim() ? row.label.trim().slice(0, 8) : '봉사',
        time,
        durationMinutes: Number.isFinite(duration) && duration > 0 ? Math.min(480, Math.max(15, Math.round(duration))) : 120,
        title: typeof row.title === 'string' && row.title.trim() ? row.title.trim().slice(0, 20) : '방문',
      }
    })
    .filter((item): item is TimePreset => Boolean(item))
  return normalized.length > 0 ? normalized : DEFAULT_TIME_PRESETS
}

export function loadTimePresets(): TimePreset[] {
  if (typeof window === 'undefined') return DEFAULT_TIME_PRESETS
  try {
    return normalizeTimePresets(JSON.parse(window.localStorage.getItem(TIME_PRESET_STORAGE_KEY) ?? 'null'))
  } catch {
    return DEFAULT_TIME_PRESETS
  }
}

export function saveTimePresets(presets: TimePreset[]) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(TIME_PRESET_STORAGE_KEY, JSON.stringify(normalizeTimePresets(presets)))
}
