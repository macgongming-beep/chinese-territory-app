import { describe, test, expect } from 'vitest'
import { renameInNameList } from './nameList'

describe('renameInNameList', () => {
  test('목록 가운데 이름을 갈아끼운다', () => {
    expect(renameInNameList('장웅, 김휘민, 박씨', '김휘민', '金辉敏김휘민'))
      .toBe('장웅, 金辉敏김휘민, 박씨')
  })

  test('옛 이름과 새 이름이 같이 있으면 하나로 접는다', () => {
    // 화면에 '장웅, 김휘민, 金辉敏김휘민' 으로 보이던 그 줄
    expect(renameInNameList('张雄장웅, 김휘민, 金辉敏김휘민', '김휘민', '金辉敏김휘민'))
      .toBe('张雄장웅, 金辉敏김휘민')
  })

  test('접히면 자리는 처음 나온 쪽을 지킨다', () => {
    expect(renameInNameList('金辉敏김휘민, 장웅, 김휘민', '김휘민', '金辉敏김휘민'))
      .toBe('金辉敏김휘민, 장웅')
  })

  test('부분만 겹치는 이름은 건드리지 않는다', () => {
    // '김휘' 를 바꾼다고 '김휘민' 이 바뀌면 안 된다
    expect(renameInNameList('김휘민, 김휘', '김휘', '새이름'))
      .toBe('김휘민, 새이름')
  })

  test('그 이름이 없으면 그대로 (공백만 정리)', () => {
    expect(renameInNameList('장웅,  박씨', '김휘민', '새이름')).toBe('장웅, 박씨')
  })

  test('빈 값과 null 을 견딘다', () => {
    expect(renameInNameList(null, 'a', 'b')).toBe('')
    expect(renameInNameList('', 'a', 'b')).toBe('')
    expect(renameInNameList(' , , ', 'a', 'b')).toBe('')
  })
})
