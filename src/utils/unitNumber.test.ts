import { describe, expect, test } from 'vitest'
import { canonicalUnitNumber } from './unitNumber'

describe('canonicalUnitNumber', () => {
  test.each([
    ['101호', '101'],
    ['101 호', '101'],
    ['B03호', 'B03'],
    ['b03 호', 'b03'],
    ['  201호  ', '201'],
  ])('%s에서 호만 제거한다', (input, expected) => {
    expect(canonicalUnitNumber(input)).toBe(expected)
  })

  test('앞자리 0과 영문 대소문자는 표시 그대로 보존한다', () => {
    expect(canonicalUnitNumber('0101호')).toBe('0101')
    expect(canonicalUnitNumber('b03호')).toBe('b03')
  })

  test.each([
    '호수다방', '302호 중국전통마사지', 'A동 103호', '3층 2호 개미인력처인점',
    '지하2호', '호별 방문', '만송빌딩 2층 애인 커피 호프', '304호 쿨샵마사지',
    '120호 천미가 마라탕', '빌A동 201호', '츠빌라 102호', '윈원룸 301호',
    'A동 102호', '스타호프', '호별방문', '동 302호', 'c동301호', '여우비 호프',
    '지하5호', '호생원', '일만호', '리디자인호텔', '지하 5호', '810동1505호',
    '얜시부 2호점', '706호 애스크나우이티오', '고시원 7호', '아스트로호텔',
    '204호 확인요망', '양도둑 동탄호수공원점', '향리원마라탕 영천점  109호',
    '이가네양꼬치 동탄4호점', '30?호', '호수불명', '101호 한국인',
    '더숨포레스트호텔', '골든튤립에버호텔', '헤르메스 호텔 에버랜드점', '라마다 호텔',
  ])('운영의 예외 이름 %s은 건드리지 않는다', (value) => {
    expect(canonicalUnitNumber(value)).toBe(value)
  })
})
