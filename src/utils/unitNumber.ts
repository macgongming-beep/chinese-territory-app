// 호수 정렬. 지하(B/b) → 지상 숫자 → 한글·기타 순.
//
// hooks/storeTransforms 에 있던 것을 여기로 옮겼다.
// utils 가 hooks 를 import 하는 방향이 되어 있었는데, 순환은 아니어도
// 계층이 거꾸로라 언젠가 순환을 만든다. 순수 함수이므로 utils 가 제자리다.
const collator = new Intl.Collator('ko-KR', { numeric: true, sensitivity: 'base' })
const priority = (s: string) => (/^[Bb]/.test(s) ? 0 : /^[0-9]/.test(s) ? 1 : 2)

export function compareUnitNumbers(a: string, b: string): number {
  const diff = priority(a) - priority(b)
  return diff !== 0 ? diff : collator.compare(a, b)
}
