import type { TimeSlot, Unit, VisitHistory } from '../types'

// ── 슬롯 매트릭스 ─────────────────────────────────────────────

export type DayType = '평일' | '주말'
export type SlotCell = {
  dayType: DayType
  slot: TimeSlot
  total: number       // 전체 방문 횟수
  absences: number    // 부재 횟수
  meetings: number    // 만남 횟수
  lastDate: string | null  // 마지막 방문 날짜 (YYYY-MM-DD)
}
export type SlotMatrix = SlotCell[][]  // [평일, 주말][오전, 오후, 저녁]

function isWeekend(dateStr: string): boolean {
  const dow = new Date(dateStr).getDay()
  return dow === 0 || dow === 6
}

const DAY_TYPES: DayType[] = ['평일', '주말']
const TIME_SLOTS: TimeSlot[] = ['오전', '오후', '저녁']

export function getSlotMatrix(histories: VisitHistory[]): SlotMatrix {
  const map: Record<DayType, Record<TimeSlot, SlotCell>> = {
    평일: {
      오전: { dayType: '평일', slot: '오전', total: 0, absences: 0, meetings: 0, lastDate: null },
      오후: { dayType: '평일', slot: '오후', total: 0, absences: 0, meetings: 0, lastDate: null },
      저녁: { dayType: '평일', slot: '저녁', total: 0, absences: 0, meetings: 0, lastDate: null },
    },
    주말: {
      오전: { dayType: '주말', slot: '오전', total: 0, absences: 0, meetings: 0, lastDate: null },
      오후: { dayType: '주말', slot: '오후', total: 0, absences: 0, meetings: 0, lastDate: null },
      저녁: { dayType: '주말', slot: '저녁', total: 0, absences: 0, meetings: 0, lastDate: null },
    },
  }

  for (const h of histories) {
    if (!h.timeSlot || !h.visitedAt) continue
    const dayType: DayType = isWeekend(h.visitedAt) ? '주말' : '평일'
    const cell = map[dayType][h.timeSlot]
    if (!cell) continue
    cell.total++
    if (h.result === '부재') cell.absences++
    if (h.result === '만남') cell.meetings++
    if (!cell.lastDate || h.visitedAt > cell.lastDate) cell.lastDate = h.visitedAt
  }

  return DAY_TYPES.map((dayType) =>
    TIME_SLOTS.map((slot) => map[dayType][slot]),
  )
}

/** 6칸 중 모두 부재(만남 없음, 1번 이상 시도)인지 */
export function isAllSlotsAbsent(matrix: SlotMatrix): boolean {
  const allCells = matrix.flat()
  const triedCells = allCells.filter((c) => c.total > 0)
  if (triedCells.length < 3) return false  // 최소 3슬롯은 시도해야
  return triedCells.every((c) => c.meetings === 0 && c.absences > 0)
}

export type VisitStrategyChip = {
  label: string
  detail?: string
  tone: 'retry' | 'warning' | 'regular' | 'chinese'
}


function getAttemptKey(history: VisitHistory) {
  return `${history.visitedAt}:${history.timeSlot}`
}

function uniqueVisitAttempts(histories: VisitHistory[]) {
  const seen = new Set<string>()
  return histories.filter((history) => {
    const key = getAttemptKey(history)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function getVisitStrategyChips(unit: Unit, histories: VisitHistory[]): VisitStrategyChip[] {
  const chips: VisitStrategyChip[] = []
  const absenceHistories = uniqueVisitAttempts(histories.filter((history) => history.result === '부재'))

  if (unit.isChinese) {
    chips.push({
      label: '발견됨',
      detail: '중국어',
      tone: 'chinese',
    })
  }

  if (unit.isRegularVisit) {
    chips.push({
      label: '정기방문',
      detail: unit.regularVisitor,
      tone: 'regular',
    })
  }

  if (unit.status === '확인필요') {
    chips.push({
      label: '재확인 필요',
      detail: '메모/상황 확인',
      tone: 'warning',
    })
  }

  if (unit.status === '부재') {
    const morningAbsences = absenceHistories.filter((h) => h.timeSlot === '오전').length
    const afternoonAbsences = absenceHistories.filter((h) => h.timeSlot === '오후').length
    const eveningAbsences = absenceHistories.filter((h) => h.timeSlot === '저녁').length

    if (morningAbsences > 0) {
      chips.push({
        label: `오전 ${morningAbsences}`,
        tone: 'retry',
      })
    }
    if (afternoonAbsences > 0) {
      chips.push({
        label: `오후 ${afternoonAbsences}`,
        tone: 'retry',
      })
    }
    if (eveningAbsences > 0) {
      chips.push({
        label: `저녁 ${eveningAbsences}`,
        tone: 'retry',
      })
    }
    
    // 만약 부재 이력은 있는데 위 타임슬롯에 해당되지 않는 경우(드문 경우)를 위한 대비
    if (absenceHistories.length > 0 && morningAbsences === 0 && afternoonAbsences === 0 && eveningAbsences === 0) {
      chips.push({
        label: `부재 ${absenceHistories.length}`,
        tone: 'retry',
      })
    }
  }

  return chips
}
