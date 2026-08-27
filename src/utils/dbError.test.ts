import { describe, test, expect } from 'vitest'
import { explainDbError, describeDbError } from './dbError'

describe('explainDbError', () => {
  test('빠뜨린 칸을 이름으로 알려준다', () => {
    expect(explainDbError({ code: '23502', message: 'null value in column "time" violates not-null' }))
      .toBe('시간을(를) 입력해 주세요.')
  })

  test('모르는 컬럼이면 컬럼 이름을 그대로 쓴다', () => {
    expect(explainDbError({ code: '23502', message: 'null value in column "wibble"' }))
      .toBe('wibble을(를) 입력해 주세요.')
  })

  test('컬럼을 못 찾으면 뭉뚱그린다', () => {
    expect(explainDbError({ code: '23502', message: '알 수 없음' }))
      .toBe('빠뜨린 칸이 있습니다.')
  })

  test('중복', () => {
    expect(explainDbError({ code: '23505' })).toContain('이미 같은 것이')
  })

  test('우리가 던진 한국어 메시지는 그대로 쓴다', () => {
    expect(explainDbError({ code: 'P0001', message: '공지는 관리자만 올릴 수 있습니다' }))
      .toBe('공지는 관리자만 올릴 수 있습니다')
  })

  test('함수가 없으면 관리자에게 알리라고 한다', () => {
    // SQL 을 아직 안 넣은 상태에서 나는 오류다
    expect(explainDbError({ code: 'PGRST202' })).toContain('아직 준비되지')
  })

  test('모르는 코드는 **지어내지 않는다**', () => {
    // 엉뚱한 이유를 붙이는 것보다 원래 메시지만 띄우는 게 낫다
    expect(explainDbError({ code: 'XX999', message: '무언가' })).toBeNull()
    expect(explainDbError(null)).toBeNull()
    expect(explainDbError('문자열')).toBeNull()
  })
})

describe('describeDbError', () => {
  test('이유를 알면 붙인다', () => {
    expect(describeDbError('일정을 등록하지 못했습니다.',
      { code: '23502', message: 'null value in column "title"' }))
      .toBe('일정을 등록하지 못했습니다.\n제목을(를) 입력해 주세요.')
  })

  test('이유를 모르면 원래 문구만', () => {
    expect(describeDbError('일정을 등록하지 못했습니다.', { code: 'XX999' }))
      .toBe('일정을 등록하지 못했습니다.')
  })
})
