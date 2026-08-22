// 이름이 오타로 갈라지는 걸 막는다.
//
// 사람 이름이 '오세창' 과 '吴世昶' 으로 갈려 통계가 반토막 났던 적이 있다.
// 지역·동 이름도 같은 위험이 있는데, 이건 카드 이름의 재료라 더 아프다.
// ('처인구 백암면 1' 과 '처안구 백암면 1' 은 다른 구역이 된다)
//
// 하드코딩 목록이 사라지면서 맞춤법 검사기 노릇도 같이 사라졌다. 그 자리를 메운다.

/** 앞뒤·가운데 공백 정리 — '백암면 ' 과 '백암면' 이 갈리지 않게 */
export function normalizeName(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ')
}

/** 한 글자만 고치면 같아지는가 (백앙면 ↔ 백암면) */
export function isOneEditApart(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false
  const [short, long] = a.length <= b.length ? [a, b] : [b, a]
  let i = 0
  let j = 0
  let edits = 0
  while (i < short.length && j < long.length) {
    if (short[i] === long[j]) { i += 1; j += 1; continue }
    edits += 1
    if (edits > 1) return false
    if (short.length === long.length) i += 1
    j += 1
  }
  return edits + (long.length - j) <= 1
}

/**
 * 이미 있는 이름 중 '이걸 말한 것 같은' 것을 찾는다. 없으면 null.
 * 똑같은 이름은 오타가 아니므로 제외한다.
 *
 * 일부러 좁게 잡는다 — 엉뚱한 경고가 반복되면 사람들이 경고 자체를 무시하게 된다.
 */
export function findSimilarName(input: string, existing: string[]): string | null {
  const name = normalizeName(input)
  if (!name) return null
  const bare = name.replace(/\s/g, '')
  for (const other of existing) {
    if (other === name) continue
    const otherBare = other.replace(/\s/g, '')
    if (otherBare === bare) return other       // 공백만 다름 ('백암 면')
    if (isOneEditApart(bare, otherBare)) return other
  }
  return null
}
