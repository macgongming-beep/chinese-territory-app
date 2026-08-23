#!/usr/bin/env node
// eslint.config.js 의 supabase allowlist 가 늘어나지 않았는지 확인한다.
//
// 규칙만 있으면 allowlist 는 조용히 늘어난다 — 막히면 거기 한 줄 추가하면 되니까.
// 상한선이 있어야 규칙이 산다. 이 숫자는 **줄일 때만** 고친다.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const MAX = 9   // 2026-08-23 기준. 파일을 옮길 때마다 이 숫자를 줄인다.

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const config = readFileSync(join(root, 'eslint.config.js'), 'utf8')

// allowlist 블록 = 'no-restricted-imports': 'off' 를 가진 files 배열
const block = config.match(/files:\s*\[([^\]]*)\][\s\S]{0,200}?'no-restricted-imports':\s*'off'/)
if (!block) {
  console.error('✗ allowlist 블록을 못 찾았다. eslint.config.js 구조가 바뀌었는지 확인할 것.')
  process.exit(1)
}

const files = [...block[1].matchAll(/'([^']+)'/g)].map((m) => m[1])

if (files.length > MAX) {
  console.error(`✗ supabase allowlist 가 ${MAX}개에서 ${files.length}개로 늘었다.`)
  console.error('')
  console.error('  화면에서 supabase 를 직접 부르지 말고, hooks/storeMutations 나')
  console.error('  feature api 모듈에 함수를 만들어 쓸 것.')
  console.error('  정말로 예외가 필요하면 이 파일의 MAX 를 사유와 함께 고친다.')
  console.error('')
  console.error('  늘어난 것:')
  for (const f of files.slice(MAX)) console.error(`    ${f}`)
  process.exit(1)
}

if (files.length < MAX) {
  console.log(`✓ allowlist ${files.length}개 (상한 ${MAX}). ${MAX - files.length}개 줄었다 —`)
  console.log(`  scripts/check-supabase-allowlist.js 의 MAX 를 ${files.length} 로 내릴 것.`)
  process.exit(0)
}

console.log(`✓ supabase allowlist ${files.length}개 (상한 ${MAX})`)
