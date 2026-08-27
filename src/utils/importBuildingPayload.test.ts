import { describe, test, expect } from 'vitest'
import { buildImportPayload, DEFAULT_UNIT_NUMBER } from './importBuildingPayload'
import type { CsvBuildingImport } from './csvBuildingImport'

const row = (over: Partial<CsvBuildingImport> = {}): CsvBuildingImport => ({
  rowNumber: 2, cardId: 1, cardName: '처인구 유방동 1',
  name: '가나빌라', address: '유방동 1', type: '주택',
  lat: 37.25, lng: 127.19, units: [], ...over,
} as CsvBuildingImport)

const unit = (over: Record<string, unknown> = {}) => ({
  number: '101', status: '미방문', isChinese: false, isRestaurant: false,
  isRegularVisit: false, visitHistories: [], ...over,
} as never)

describe('buildImportPayload', () => {
  test('건물 칸을 DB 이름으로 바꾼다', () => {
    const p = buildImportPayload(row())
    expect(p.building).toMatchObject({ card_id: 1, name: '가나빌라', address: '유방동 1', lat: 37.25 })
  })

  test('경고가 없으면 그 칸을 안 보낸다', () => {
    expect('warning' in buildImportPayload(row()).building).toBe(false)
    expect(buildImportPayload(row({ warning: '방문금지' })).building.warning).toBe('방문금지')
  })

  test('세대가 없으면 101호 하나를 만든다', () => {
    const p = buildImportPayload(row())
    expect(p.units).toHaveLength(1)
    expect(p.units[0].number).toBe(DEFAULT_UNIT_NUMBER)
  })

  test('세대를 그대로 옮긴다', () => {
    const p = buildImportPayload(row({ units: [unit({ number: '201', isChinese: true })] }))
    expect(p.units[0]).toMatchObject({ number: '201', is_chinese: true })
  })

  test('정기방문은 **이름이 있을 때만** 만든다', () => {
    const off = buildImportPayload(row({ units: [unit({ isRegularVisit: true })] }))
    expect('regular_visitor' in off.units[0]).toBe(false)   // 표시만 켜고 이름이 없으면 안 만든다
    const on = buildImportPayload(row({ units: [unit({ isRegularVisit: true, regularVisitor: '김민준' })] }))
    expect(on.units[0].regular_visitor).toBe('김민준')
  })

  test('방문기록을 세대 안에 담는다 — 세대와 같은 트랜잭션에 들어가야 한다', () => {
    const p = buildImportPayload(row({
      units: [unit({ visitHistories: [{ visitedAt: '2026-01-01', result: '만남', visitor: '가', timeSlot: '오전' }] })],
    }))
    expect(p.units[0].visits).toEqual([
      { result: '만남', visitor_name: '가', visited_at: '2026-01-01', time_slot: '오전' },
    ])
  })

  test('빈 값은 null 로 (빈 문자열을 넣지 않는다)', () => {
    const p = buildImportPayload(row({ units: [unit({ memo: '', naverPlaceId: '' })] }))
    expect(p.units[0].memo).toBeNull()
    expect(p.units[0].naver_place_id).toBeNull()
  })
})
