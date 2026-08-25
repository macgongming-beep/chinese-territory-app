// 건물 CSV 파서. **여기가 틀리면 엉뚱한 건물이 대량으로 들어간다.**
// 한 번에 수백 줄이 올라가고, 잘못 들어간 것을 골라내려면 사람이 다 봐야 한다.
import { describe, test, expect } from 'vitest'
import {
  createCsvUnits, isInvitationLeft, looksTruthy, normalizeCsvKey, normalizeTimeSlot,
  normalizeUnitStatus, normalizeWarning, parseCsv, parseCsvDate, splitUnitNumbers,
} from './csvBuildingImport'

describe('parseCsv — 엑셀이 내보내는 모양', () => {
  test('기본', () => {
    expect(parseCsv('a,b\n1,2')).toEqual([['a', 'b'], ['1', '2']])
  })

  test('따옴표 안의 쉼표는 나누지 않는다 — 주소에 쉼표가 흔하다', () => {
    expect(parseCsv('주소,이름\n"용인시 처인구, 언동로 1",빌라'))
      .toEqual([['주소', '이름'], ['용인시 처인구, 언동로 1', '빌라']])
  })

  test('따옴표 안의 줄바꿈도 한 칸이다 — 메모가 그렇다', () => {
    expect(parseCsv('메모\n"첫 줄\n둘째 줄"')).toEqual([['메모'], ['첫 줄\n둘째 줄']])
  })

  test('두 겹 따옴표는 한 개로', () => {
    expect(parseCsv('a\n"그가 ""안녕"" 했다"')).toEqual([['a'], ['그가 "안녕" 했다']])
  })

  test('윈도우 줄바꿈(CRLF)을 읽는다 — 엑셀 기본이다', () => {
    expect(parseCsv('a,b\r\n1,2\r\n')).toEqual([['a', 'b'], ['1', '2']])
  })

  test('빈 줄은 버린다 — 엑셀이 끝에 붙인다', () => {
    expect(parseCsv('a,b\n1,2\n\n\n')).toEqual([['a', 'b'], ['1', '2']])
  })

  test('칸 앞뒤 공백을 없앤다', () => {
    expect(parseCsv('  a , b \n 1 , 2 ')).toEqual([['a', 'b'], ['1', '2']])
  })
})

describe('parseCsvDate — 사람이 적는 모양을 너그럽게 읽는다', () => {
  // "0 을 붙여 적으세요" 라고 시키면 언젠가 까먹고, 그러면 날짜가 조용히 사라진다
  test.each([
    ['2026-08-13', '2026-08-13'],
    ['2026.8.13', '2026-08-13'],
    ['2026/8/13', '2026-08-13'],
    ['2026년 8월 13일', '2026-08-13'],
    ['2026-8-3', '2026-08-03'],
  ])('%s → %s', (input, expected) => {
    expect(parseCsvDate(input)?.slice(0, 10)).toBe(expected)
  })

  test('엑셀이 숫자로 내보낸 날짜도 읽는다', () => {
    // 1900 년 윤년 버그 때문에 엑셀 기준일은 1899-12-30 이다
    expect(parseCsvDate('46247')?.slice(0, 10)).toBe('2026-08-13')
  })

  test('빈 값과 알 수 없는 것은 null', () => {
    expect(parseCsvDate('')).toBeNull()
    expect(parseCsvDate('  ')).toBeNull()
    expect(parseCsvDate('작년 봄')).toBeNull()
    expect(parseCsvDate('2026-13-45')).toBeNull()
  })
})

describe('normalizeUnitStatus — 사람이 적은 결과를 상태로', () => {
  test.each([
    ['만남', '만남'], ['만남!', '만남'],
    ['초대장 드림', '만남'], ['초대', '만남'],
    ['부재중', '부재'],
    ['대상외', '대상외'], ['한국인', '대상외'],
    ['정기방문', '만남'], ['재방문', '만남'],
    ['', '미방문'], ['모르겠음', '미방문'],
  ])('%s → %s', (input, expected) => {
    expect(normalizeUnitStatus(input)).toBe(expected)
  })

  test('초대장은 상태와 별개로 표시가 남는다', () => {
    expect(isInvitationLeft('초대장 드림')).toBe(true)
    expect(isInvitationLeft('만남')).toBe(false)
  })
})

describe('splitUnitNumbers — 한 칸에 여러 호수', () => {
  test('여러 구분자를 받는다', () => {
    expect(splitUnitNumbers('101|102;103/104,105')).toEqual(['101', '102', '103', '104', '105'])
  })

  test('같은 호수는 한 번만', () => {
    expect(splitUnitNumbers('101, 101 ,101')).toEqual(['101'])
  })

  test('빈 값은 버린다', () => {
    expect(splitUnitNumbers('101,,  ,102')).toEqual(['101', '102'])
  })
})

describe('looksTruthy — ㅇ 하나만 적어도 알아듣는다', () => {
  test.each(['true', 'Y', '1', '중국어', '중국인', '정기', '있음', 'ㅇ', '예'])('%s → 참', (v) => {
    expect(looksTruthy(v)).toBe(true)
  })
  test.each(['', 'no', '0', '아니오', '한국'])('%s → 거짓', (v) => {
    expect(looksTruthy(v)).toBe(false)
  })
})

describe('createCsvUnits', () => {
  const base = { status: '미방문' as const, isChinese: false, regularVisitor: '', memo: '' }

  test('호수가 없으면 1층으로 만든다 — 단독주택이 그렇다', () => {
    const units = createCsvUnits('', base)
    expect(units.map((u) => u.number)).toEqual(['1층'])
  })

  test('정기방문자가 있으면 중국어 세대로 본다', () => {
    const [u] = createCsvUnits('101', { ...base, regularVisitor: '김민준' })
    expect(u.isChinese).toBe(true)
    expect(u.isRegularVisit).toBe(true)
    expect(u.regularVisitor).toBe('김민준')
  })

  test('만남·부재는 중국어 세대로 본다 — 만났으니 중국인이다', () => {
    expect(createCsvUnits('101', { ...base, status: '만남' })[0].isChinese).toBe(true)
    expect(createCsvUnits('101', { ...base, status: '부재' })[0].isChinese).toBe(true)
    expect(createCsvUnits('101', { ...base, status: '대상외' })[0].isChinese).toBe(false)
  })

  test('호수가 여럿이면 같은 값으로 여러 개 만든다', () => {
    const units = createCsvUnits('101|102', { ...base, memo: '공통 메모' })
    expect(units).toHaveLength(2)
    expect(units.every((u) => u.memo === '공통 메모')).toBe(true)
  })
})

describe('나머지', () => {
  test('normalizeCsvKey — 머리글의 공백·대소문자 차이를 무시한다', () => {
    expect(normalizeCsvKey(' 업체 ID ')).toBe(normalizeCsvKey('업체id'))
  })

  test('normalizeTimeSlot', () => {
    expect(normalizeTimeSlot('오후 2시')).toBe('오후')
    expect(normalizeTimeSlot('저녁')).toBe('저녁')
    expect(normalizeTimeSlot('밤')).toBe('저녁')
    expect(normalizeTimeSlot('')).toBe('오전')
    expect(normalizeTimeSlot('아무거나')).toBe('오전')
  })

  test('normalizeWarning — ㅇ 는 방문금지, 글자는 그대로 남긴다', () => {
    expect(normalizeWarning('ㅇ')).toBe('방문금지')
    expect(normalizeWarning('개 조심')).toBe('개 조심')
    expect(normalizeWarning('')).toBeUndefined()
  })
})
