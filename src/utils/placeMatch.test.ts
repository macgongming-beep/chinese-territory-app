import { describe, it, expect } from 'vitest'
import {
  normalizeRoadAddress,
  normalizePlaceName,
  matchSurveyRows,
  normalizeSurveyAnswer,
  type KnownUnit,
  type SurveyRow,
} from './placeMatch'

function unit(id: number, name: string, address: string, extra: Partial<KnownUnit> = {}): KnownUnit {
  return { unitId: id, buildingId: id * 10, name, address, isChinese: false, ...extra }
}
function row(name: string, address: string, placeId = ''): SurveyRow {
  return { placeId, name, address }
}

describe('주소 정규화', () => {
  it('시·군·구·면과 상세주소를 떼고 도로명+번호만 남긴다', () => {
    expect(normalizeRoadAddress('경기 용인시 처인구 백암면 백암로 175 돈가네옛날김치돼지찌개')).toBe('백암로 175')
    expect(normalizeRoadAddress('경기 용인시 처인구 백암면 백암로201번길 11')).toBe('백암로201번길 11')
  })

  it('가지번호(-)도 살린다 — 다른 건물이다', () => {
    expect(normalizeRoadAddress('경기 용인시 기흥구 신구로 42-11')).toBe('신구로 42-11')
    expect(normalizeRoadAddress('신구로 42')).not.toBe(normalizeRoadAddress('신구로 42-11'))
  })

  it('도로명이 없으면 빈 값 (지번 주소 등)', () => {
    expect(normalizeRoadAddress('경기 용인시 처인구 백암면 백암리 123')).toBe('')
  })
})

describe('상호명 정규화', () => {
  it('지점·괄호·공백 차이를 무시한다', () => {
    expect(normalizePlaceName('라홍방마라탕 보라점')).toBe(normalizePlaceName('라홍방마라탕'))
    expect(normalizePlaceName('이현우 (李諼友）')).toBe(normalizePlaceName('이현우'))
    expect(normalizePlaceName('백강 양꼬치&훠궈')).toBe('백강양꼬치훠궈')
  })

  it('다른 가게는 다르게 남는다', () => {
    expect(normalizePlaceName('반주')).not.toBe(normalizePlaceName('일반 주택'))
  })
})

describe('대조', () => {
  const units = [
    unit(1, '라홍방마라탕', '경기 용인시 수지구 죽전로 20', { placeId: '111' }),
    unit(2, '정가미 감자탕', '경기 용인시 수지구 죽전로 20'),
    unit(3, '제일식당', '경기 용인시 처인구 백암면 백암로201번길 11'),
  ]

  it('업체ID가 같으면 확실히 등록된 곳', () => {
    const [r] = matchSurveyRows([row('이름이 바뀐 가게', '아무 주소', '111')], units, new Set())
    expect(r.kind).toBe('registered')
    expect(r.unit?.unitId).toBe(1)
    expect(r.reason).toContain('업체ID')
  })

  it('주소와 상호가 같으면 등록된 곳', () => {
    const [r] = matchSurveyRows([row('제일식당', '경기 용인시 처인구 백암면 백암로201번길 11')], units, new Set())
    expect(r.kind).toBe('registered')
    expect(r.unit?.unitId).toBe(3)
  })

  it('같은 건물인데 이름이 다르면 사람이 판단하도록 남긴다', () => {
    const [r] = matchSurveyRows([row('새로 생긴 국수집', '경기 용인시 수지구 죽전로 20')], units, new Set())
    expect(r.kind).toBe('ambiguous')
    expect(r.reason).toContain('같은 건물')
  })

  it('조사 대장에 있으면 등록 안 됐어도 다시 걸지 않는다', () => {
    const [r] = matchSurveyRows([row('중앙식당', '경기 용인시 처인구 백암면 근창로 13', '999')], units, new Set(['999']))
    expect(r.kind).toBe('surveyed')
  })

  it('아무 데도 없으면 신규 — 전화 대상', () => {
    const [r] = matchSurveyRows([row('고기이야기', '경기 용인시 처인구 원삼면 원양로 540')], units, new Set())
    expect(r.kind).toBe('new')
  })

  it("이름만 비슷하고 주소가 다르면 신규 ('반주'가 '일반 주택'에 걸리던 사고 방지)", () => {
    const withHouse = [...units, unit(4, '일반 주택', '경기 용인시 처인구 다른로 5')]
    const [r] = matchSurveyRows([row('반주', '경기 용인시 처인구 원삼면 원양로 540')], withHouse, new Set())
    expect(r.kind).toBe('new')
  })
})

describe('조사 결과 값 읽기', () => {
  it('있음/없음/미확인으로 정리한다', () => {
    expect(normalizeSurveyAnswer('있음')).toBe('있음')
    expect(normalizeSurveyAnswer('Y')).toBe('있음')
    expect(normalizeSurveyAnswer('없음')).toBe('없음')
    expect(normalizeSurveyAnswer('X')).toBe('없음')
    expect(normalizeSurveyAnswer('미확인')).toBe('미확인')
    expect(normalizeSurveyAnswer('전화 안 받음')).toBe('미확인')
  })

  it('빈칸은 아직 조사 안 한 것 — 대장에 넣지 않는다', () => {
    expect(normalizeSurveyAnswer('')).toBeNull()
    expect(normalizeSurveyAnswer(undefined)).toBeNull()
  })
})

describe('등록·조사가 겹칠 때', () => {
  const units = [unit(3, '제일식당', '경기 용인시 처인구 백암면 백암로201번길 11')]

  it('지도에도 있고 조사도 했으면 등록됨으로 알려 준다 (세대를 찾아야 업체ID를 붙인다)', () => {
    const [r] = matchSurveyRows(
      [row('제일식당', '경기 용인시 처인구 백암면 백암로201번길 11', '777')],
      units,
      new Set(['777']),
    )
    expect(r.kind).toBe('registered')
    expect(r.unit?.unitId).toBe(3)          // ← 여기서 업체ID를 붙일 수 있다
    expect(r.reason).toContain('조사도 완료')
  })

  it('지도에 없고 조사만 했으면 조사함', () => {
    const [r] = matchSurveyRows([row('없는가게', '경기 용인시 처인구 어딘로 9', '888')], units, new Set(['888']))
    expect(r.kind).toBe('surveyed')
    expect(r.unit).toBeUndefined()
  })
})
