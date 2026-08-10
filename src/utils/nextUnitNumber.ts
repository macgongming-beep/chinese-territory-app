// 다음에 추가할 호수 번호 추천
//
// 세대 추가 입력칸에 '101' 을 미리 박아두면 매번 지우고 다시 쳐야 한다.
// 대신 이미 있는 호수를 보고 다음 번호를 추천해, 그냥 눌러도 알아서 붙게 한다.
//
// 규칙:
//  - 숫자로만 된 호수 중 가장 큰 값 + 1  (101,102 → 103)
//  - 지하(B101) 등 숫자가 아닌 호수는 계산에서 제외
//  - 하나도 없으면 '101'

export const FIRST_UNIT_NUMBER = '101'

export function suggestNextUnitNumber(existingNumbers: Iterable<string>): string {
  let max = -1
  let width = 3
  for (const raw of existingNumbers) {
    const value = String(raw).trim()
    if (!/^\d+$/.test(value)) continue
    const num = Number(value)
    if (Number.isNaN(num)) continue
    if (num > max) {
      max = num
      width = value.length
    }
  }
  if (max < 0) return FIRST_UNIT_NUMBER
  // 자리수 유지 (0101 처럼 앞자리 0 으로 맞춰 둔 건물 배려)
  return String(max + 1).padStart(width, '0')
}
