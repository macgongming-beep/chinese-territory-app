import type { Unit, VisitHistory } from '../types'

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
      detail: '중국인',
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
