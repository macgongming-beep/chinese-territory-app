import { describe, it, expect } from 'vitest'
import { parseUserGroups, normalizeUserGroups, serializeUserGroups, DEFAULT_USER_GROUPS, USER_GROUPS_MAX } from './userGroups'

describe('parseUserGroups', () => {
  it('저장된 JSON 배열을 그대로 읽음', () => {
    expect(parseUserGroups('["처인","신갈"]')).toEqual(['처인', '신갈'])
  })
  it('빈 값/깨진 JSON/배열 아님 → 기본값', () => {
    expect(parseUserGroups(null)).toEqual(DEFAULT_USER_GROUPS)
    expect(parseUserGroups('')).toEqual(DEFAULT_USER_GROUPS)
    expect(parseUserGroups('{oops')).toEqual(DEFAULT_USER_GROUPS)
    expect(parseUserGroups('{"a":1}')).toEqual(DEFAULT_USER_GROUPS)
  })
  it('기본값에 특정 회중의 이름이 들어 있으면 안 된다', () => {
    // 예전 기본값은 ['처인','신갈','동백','동탄'] — 용인 회중의 동네 이름이었다.
    // 다른 회중이 설치하면 첫 화면부터 남의 동네가 떠 있게 된다.
    expect(DEFAULT_USER_GROUPS).toEqual([])
  })
  it('빈 배열은 그대로 빈 배열 — 집단을 안 쓰는 회중도 있다', () => {
    expect(parseUserGroups('[]')).toEqual([])
  })
})

describe('normalizeUserGroups', () => {
  it('공백 정리·빈값 제거·중복 제거', () => {
    expect(normalizeUserGroups([' 처인 ', '처인', '', '  ', '신갈'])).toEqual(['처인', '신갈'])
  })
  it('전부 걸러지면 빈 목록 — 기본값으로 되돌리지 않는다', () => {
    // 되돌리면 '집단을 쓰지 않음' 을 저장할 수 없게 된다
    expect(normalizeUserGroups(['', '  ', 1, null])).toEqual([])
  })
  it('문자열 아닌 값 무시', () => {
    expect(normalizeUserGroups(['처인', 1, null, undefined, {}])).toEqual(['처인'])
  })
  it('이름 길이 12자로 제한', () => {
    expect(normalizeUserGroups(['가'.repeat(20)])).toEqual(['가'.repeat(12)])
  })
  it('최대 개수 초과분은 잘림', () => {
    const many = Array.from({ length: USER_GROUPS_MAX + 5 }, (_, i) => `그룹${i}`)
    expect(normalizeUserGroups(many)).toHaveLength(USER_GROUPS_MAX)
  })
})

describe('serializeUserGroups (왕복)', () => {
  it('직렬화 후 다시 읽으면 동일', () => {
    const groups = ['처인', '신갈', '동백', '동탄']
    expect(parseUserGroups(serializeUserGroups(groups))).toEqual(groups)
  })
  it('정리가 필요한 입력도 정규화되어 저장', () => {
    expect(parseUserGroups(serializeUserGroups([' 처인 ', '처인', '동백']))).toEqual(['처인', '동백'])
  })
})
