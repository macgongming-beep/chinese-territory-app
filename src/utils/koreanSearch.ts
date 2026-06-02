// 한글 이름 검색 — 부분일치 + 초성 검색.
//   matchesName('김민준', '민준')  → true
//   matchesName('김민준', 'ㄱㅁ')  → true (초성)
//   matchesName('김민준', 'ㅁㅈ')  → true (이어진 초성)

const CHOSEONG = [
  'ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ',
  'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ',
]

// 문자열의 초성만 추출 (한글 음절만, 나머지는 원문 유지)
function toChoseong(text: string): string {
  let out = ''
  for (const ch of text) {
    const code = ch.charCodeAt(0)
    if (code >= 0xac00 && code <= 0xd7a3) {
      out += CHOSEONG[Math.floor((code - 0xac00) / 588)]
    } else {
      out += ch
    }
  }
  return out
}

// 쿼리가 초성 자모로만 이뤄졌는지 (ㄱ~ㅎ)
function isChoseongQuery(query: string): boolean {
  return /^[ㄱ-ㅎ]+$/.test(query)
}

export function matchesName(name: string, rawQuery: string): boolean {
  const query = rawQuery.trim().toLowerCase().replace(/\s+/g, '')
  if (!query) return true
  const target = name.toLowerCase().replace(/\s+/g, '')
  if (target.includes(query)) return true
  // 초성 쿼리면 이름의 초성열과 비교
  if (isChoseongQuery(rawQuery.trim())) {
    return toChoseong(target).includes(rawQuery.trim())
  }
  return false
}
