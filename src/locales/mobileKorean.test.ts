// 모바일 화면에 번역 안 된 한국어가 다시 스며드는 것을 막는 감시 테스트.
//
// 왜 필요한가: 지금까지 번역 작업이 여러 번 "다 했다"고 하고도 빠진 게 남았다.
// 사람이 눈으로 훑는 방식이라 확인할 방법이 없었기 때문이다. 이 테스트가
// 그 확인을 대신한다 — 모바일 컴포넌트의 JSX 본문과 화면에 보이는 속성에
// 한국어가 그대로 있으면 실패한다.
//
// 새 문구를 추가할 때: msg('...') 로 감싸면 통과한다.
// 값(상태·탭 식별자 등)이라 번역하면 안 되는 것은 VALUE_WORDS 에 넣는다.

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const COMPONENTS = 'src/components'

// 화면에 보이지만 번역하면 안 되는 값 (DB 저장값·타입 식별자)
const VALUE_WORDS = new Set([
  '만남', '부재', '대상외', '미방문', '거절', '확인필요',
  '오전', '오후', '저녁', '주택', '상가', '전체', '기타',
  '홈', '캘린더', '활동', '구역', '지도', '배정', '설정',
  '진행중', '완료', '미배정', '대상없음', '주말', '평일',
  '식당', '비공식', '카드', '내 카드',
])

function mobileFiles(): string[] {
  const out: string[] = []
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name)
      if (entry.isDirectory()) {
        if (entry.name === 'assignment' || entry.name === 'admin') walk(path)
        continue
      }
      if (!entry.name.endsWith('.tsx')) continue
      const isMobile =
        entry.name.startsWith('Mobile') ||
        entry.name.startsWith('AdminMobile') ||
        dir.endsWith('assignment') ||
        ['ChatRoom.tsx', 'NotificationCenter.tsx', 'CommentSection.tsx'].includes(entry.name)
      if (isMobile) out.push(path)
    }
  }
  walk(COMPONENTS)
  return out
}

// JSX 본문: 한 줄 안의 >글자< 이고 코드 문자가 없어야 한다 (제네릭 오인 방지)
const JSX_TEXT = /> *([^<>{}\n]*[가-힣][^<>{}\n]*?) *</g
const VISIBLE_ATTRS = /(?:placeholder|title|aria-label|alt|label|sub|pageTitle)="([^"\n]*[가-힣][^"\n]*)"/g

function findUntranslated(source: string): string[] {
  const found: string[] = []
  for (const m of source.matchAll(JSX_TEXT)) {
    const text = m[1].trim()
    if (!text || /[();=&|!?:[\]]/.test(text)) continue
    if (VALUE_WORDS.has(text)) continue
    found.push(text)
  }
  for (const m of source.matchAll(VISIBLE_ATTRS)) {
    if (!VALUE_WORDS.has(m[1].trim())) found.push(m[1])
  }
  return found
}

describe('모바일 화면에 번역 안 된 한국어', () => {
  it('JSX 본문·표시 속성에 한국어가 그대로 남아 있지 않다', () => {
    const offenders: string[] = []
    for (const file of mobileFiles()) {
      for (const text of findUntranslated(readFileSync(file, 'utf8'))) {
        offenders.push(`${file}: ${text}`)
      }
    }
    expect(offenders).toEqual([])
  })

  it('검사기가 실제로 잡아낸다 (감시 테스트가 헛돌지 않는지)', () => {
    expect(findUntranslated('<span>저장했습니다</span>')).toEqual(['저장했습니다'])
    expect(findUntranslated('<span>{msg(\'저장했습니다\')}</span>')).toEqual([])
    expect(findUntranslated('<span>만남</span>')).toEqual([])          // 값은 통과
    expect(findUntranslated('useState<Region>(\'전체\')')).toEqual([])  // 제네릭 오인 없음
  })
})
