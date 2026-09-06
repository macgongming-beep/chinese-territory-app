// 호수 정렬. 지하(B/b) → 지상 숫자 → 한글·기타 순.
//
// hooks/storeTransforms 에 있던 것을 여기로 옮겼다.
// utils 가 hooks 를 import 하는 방향이 되어 있었는데, 순환은 아니어도
// 계층이 거꾸로라 언젠가 순환을 만든다. 순수 함수이므로 utils 가 제자리다.
const collator = new Intl.Collator('ko-KR', { numeric: true, sensitivity: 'base' })
const priority = (s: string) => (/^[Bb]/.test(s) ? 0 : /^[0-9]/.test(s) ? 1 : 2)

/**
 * 저장·표시용 세대 이름. 정확히 `101호` 또는 `B03호`인 경우에만 끝의 `호`를 뺀다.
 *
 * `duplicateBuildingMerge.normalizeUnitNumber`와 목적이 다르다. 그 함수는 중복 비교를
 * 위해 대소문자와 앞자리 0까지 무시하지만, 이 함수는 사용자가 적은 `B03` 표기를
 * 보존한다. 두 함수를 합치거나 여기서 대문자화하면 안 된다.
 */
export function canonicalUnitNumber(raw: string): string {
  const value = (raw ?? '').trim()
  if (/^\d+\s*호$/.test(value) || /^[Bb]\d+\s*호$/.test(value)) {
    return value.replace(/\s*호$/, '')
  }
  return value
}

export function compareUnitNumbers(a: string, b: string): number {
  const diff = priority(a) - priority(b)
  return diff !== 0 ? diff : collator.compare(a, b)
}
