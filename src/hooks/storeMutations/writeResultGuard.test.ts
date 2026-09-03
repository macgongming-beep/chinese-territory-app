import { describe, expect, test } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

/**
 * PostgREST 는 RLS 로 대상 행이 가려진 UPDATE/DELETE 에 **오류가 아니라 0행**을 준다.
 * `.select()` 없이 `error` 만 보면 앱은 "저장했습니다" 를 띄우고 아무것도 안 바뀐다.
 * 8/30 봉사 때 겪은 "저장이 안 된다" 와 같은 모양인데, 오류 로그조차 없어 더 찾기 어렵다.
 *
 * 그래서 두 가지를 지킨다.
 *   ① 이미 역할별 권한으로 좁힌 표는 **한 곳도 예외 없이** 결과를 확인한다
 *   ② 나머지는 지금 숫자를 상한으로 두고 **늘어나지 못하게** 한다 (줄어들면 상한을 낮춘다)
 */
const DIR = 'src/hooks/storeMutations'

/** 역할별 권한으로 이미 좁힌 표 — 여기서 0행은 "권한 없음" 이므로 반드시 잡아야 한다 */
const NARROWED_TABLES = new Set([
  'login_logs', 'special_periods', 'chat_room_mutes', 'comments',
  'territory_regions', 'service_suggestions', 'informal_groups', 'informal_assets',
  'phone_surveys',
])

/** 아직 TEMP 관문인 표들의 현재 위반 수. **줄이기만 한다.** */
const REMAINING_MAX = 96

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')
}

type Violation = { file: string; line: number; table: string }

function findViolations(): Violation[] {
  const out: Violation[] = []
  for (const name of readdirSync(DIR).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))) {
    const code = stripComments(readFileSync(join(DIR, name), 'utf-8'))
    const re = /\.from\((['"])([\w-]+)\1\)\s*((?:\.[A-Za-z_]\w*\([^()]*(?:\([^()]*\))?[^()]*\)\s*)+)/g
    for (let m = re.exec(code); m; m = re.exec(code)) {
      const chain = m[3]
      if (!/\.(update|delete|upsert|insert)\(/.test(chain)) continue
      if (chain.includes('.select(')) continue
      out.push({ file: name, line: code.slice(0, m.index).split('\n').length, table: m[2] })
    }
  }
  return out
}

describe('쓰기 결과 확인 감시', () => {
  const violations = findViolations()

  test('감시식이 실제로 무언가를 보고 있다', () => {
    // 정규식이 깨져 0건이 되면 아래 두 시험이 통째로 헛돈다.
    expect(violations.length).toBeGreaterThan(0)
  })

  test('역할별 권한으로 좁힌 표는 쓰기 결과를 반드시 확인한다', () => {
    const bad = violations.filter((v) => NARROWED_TABLES.has(v.table))
    expect(bad.map((v) => `${v.file}:${v.line} ${v.table}`)).toEqual([])
  })

  test('나머지 표의 위반은 늘어나지 않는다', () => {
    const rest = violations.filter((v) => !NARROWED_TABLES.has(v.table))
    // 줄었다면 REMAINING_MAX 를 그 숫자로 낮춘다 (래칫).
    expect(rest.length).toBeLessThanOrEqual(REMAINING_MAX)
  })
})
