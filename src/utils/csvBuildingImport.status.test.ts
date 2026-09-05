// CSV 상태 정규화 — **여기서 조용히 틀리면 건물 하나가 통째로 안 올라간다.**
//
// 2026-09-05 실측: 원룸 자료의 명지베스트빌(세대 112)이 '거절' 한 줄 때문에
// 거부됐다. normalizeUnitStatus 에 '거절' 이 없어 '미방문' 으로 떨어졌고,
// visit_histories.result 는 '미방문' 을 CHECK 로 막는다.
import { describe, test, expect } from 'vitest'
import { normalizeUnitStatus } from './csvBuildingImport'

describe('CSV 상태 정규화', () => {
  test('⚠ 거절은 거절이다 — 미방문으로 떨어지면 방문금지가 사라진다', () => {
    expect(normalizeUnitStatus('거절')).toBe('거절')
    expect(normalizeUnitStatus('중국인, 시간없다고 거절')).toBe('거절')
  })

  test('확인필요도 그대로 산다', () => {
    expect(normalizeUnitStatus('확인필요')).toBe('확인필요')
  })

  test('DB 가 허용하는 값만 나온다 (visit_histories.result 의 CHECK)', () => {
    const allowed = new Set(['만남', '부재', '대상외', '거절', '확인필요', '미방문'])
    for (const v of ['만남', '부재', '대상외', '거절', '확인필요', '초대장 남김',
                     '한국인', '정기방문', '재방', '', '알 수 없는 값']) {
      expect(allowed.has(normalizeUnitStatus(v))).toBe(true)
    }
  })

  test('기존 규칙은 그대로다', () => {
    expect(normalizeUnitStatus('만남')).toBe('만남')
    expect(normalizeUnitStatus('초대장 남김')).toBe('만남')
    expect(normalizeUnitStatus('부재')).toBe('부재')
    expect(normalizeUnitStatus('한국인')).toBe('대상외')
    expect(normalizeUnitStatus('재방')).toBe('만남')
    expect(normalizeUnitStatus('')).toBe('미방문')
  })
})

// ── 방문기록을 만들지 말아야 할 때 ──────────────────────────
import { parseBuildingCsv } from './csvBuildingImport'
import type { CardBoundary, TerritoryCard } from '../types'

const cards = [{ id: 1, name: '테스트 카드', area: '남동', region: '처인구' }] as TerritoryCard[]
const boundaries = [{
  cardId: 1,
  points: [{ lat: 37.0, lng: 127.0 }, { lat: 38.0, lng: 127.0 },
           { lat: 38.0, lng: 128.0 }, { lat: 37.0, lng: 128.0 }],
}] as CardBoundary[]
const run = (csv: string) => parseBuildingCsv(csv, {
  cards, cardBoundaries: boundaries, unassignedCardId: 1, regionNames: ['처인구'],
  geocodeAddress: async () => ({ lat: 37.5, lng: 127.5 }),
})

const HEAD = '카드명,주소,건물명,유형,호수,상태,방문일자,방문결과,시간대\n'

describe('방문기록은 DB 가 받는 값일 때만 만든다', () => {
  test('⚠ 결과를 알 수 없으면 방문기록을 안 만든다 — 만들면 건물이 통째로 거부된다', async () => {
    const { rows } = await run(HEAD + '테스트 카드,언동로 1,집,주택,101,미방문,2025-05-16,알 수 없는 값,오후')
    expect(rows[0].units[0].visitHistories).toHaveLength(0)
  })

  test('거절은 기록으로 남는다', async () => {
    const { rows } = await run(HEAD + '테스트 카드,언동로 1,집,주택,101,거절,2025-05-16,거절,오후')
    expect(rows[0].units[0].status).toBe('거절')
    expect(rows[0].units[0].visitHistories.map((v) => v.result)).toEqual(['거절'])
  })

  test('만남도 그대로', async () => {
    const { rows } = await run(HEAD + '테스트 카드,언동로 1,집,주택,101,만남,2025-05-16,만남,오후')
    expect(rows[0].units[0].visitHistories.map((v) => v.result)).toEqual(['만남'])
  })
})
