import { describe, expect, test } from 'vitest'
import { filterNewUnitNumbers, generateBulkUnits } from './bulkUnits'

describe('호수 일괄 추가', () => {
  test('기존 일부 호수는 제외하고 나머지는 계속 추가한다', () => {
    const preview = generateBulkUnits({ startFloor: 1, endFloor: 5, unitsPerFloor: 5, startUnit: 1 })
    const result = filterNewUnitNumbers(preview, ['301', '403호'])

    expect(result.newNumbers).toHaveLength(23)
    expect(result.newNumbers).not.toContain('301')
    expect(result.newNumbers).not.toContain('403')
    expect(result.skippedNumbers).toEqual(['301', '403'])
  })

  test('호·공백·영문 대소문자·앞자리 0 차이를 같은 호수로 본다', () => {
    const result = filterNewUnitNumbers(
      ['101', '203', 'B02', '0101', 'b02호', '호별 방문'],
      ['101호', '203 호', 'B2호', '호별방문'],
    )

    expect(result.newNumbers).toEqual([])
    expect(result.skippedNumbers).toHaveLength(6)
  })

  test('입력 목록 자체의 중복도 한 번만 추가한다', () => {
    const result = filterNewUnitNumbers(['201', '201호', '202'], [])
    expect(result.newNumbers).toEqual(['201', '202'])
    expect(result.skippedNumbers).toEqual(['201호'])
  })
})
