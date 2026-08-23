#!/usr/bin/env node
// SQL Editor 에서 받은 CSV 한 칸을 supabase/baseline.sql 로 바꾼다.
//
//   node scripts/csv-to-baseline.js ~/Downloads/result.csv [--append]
//
// _EXPORT_schema.sql 결과로 baseline 을 만들고,
// _EXPORT_extras.sql 결과는 --append 로 뒤에 붙인다.
import { readFileSync, writeFileSync, appendFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const append = args.includes('--append')
const src = args.find((a) => !a.startsWith('--'))

if (!src) {
  console.error('쓰는 법: node scripts/csv-to-baseline.js <받은.csv> [--append]')
  process.exit(1)
}
const path = resolve(src.replace(/^~/, process.env.HOME ?? '~'))
if (!existsSync(path)) {
  console.error(`✗ 파일이 없다: ${path}`)
  process.exit(1)
}

/** RFC4180 CSV 에서 첫 데이터 칸만 꺼낸다. 따옴표 안의 줄바꿈을 살린다. */
function firstCell(text) {
  let i = 0
  // 헤더 줄 건너뛰기 (따옴표 밖의 첫 개행까지)
  let inQ = false
  for (; i < text.length; i++) {
    const c = text[i]
    if (c === '"') { inQ = !inQ; continue }
    if (!inQ && (c === '\n')) { i++; break }
  }
  // 데이터 칸 읽기
  let out = ''
  if (text[i] === '"') {
    i++
    for (; i < text.length; i++) {
      if (text[i] === '"') {
        if (text[i + 1] === '"') { out += '"'; i++; continue }  // "" → "
        break
      }
      out += text[i]
    }
  } else {
    out = text.slice(i).replace(/\r?\n$/, '')
  }
  return out.replace(/\r\n/g, '\n').trim()
}

const raw = readFileSync(path, 'utf8')
const ddl = firstCell(raw)

if (!ddl || ddl.length < 100) {
  console.error('✗ 내용이 비었거나 너무 짧다. 쿼리 결과를 제대로 받았는지 확인할 것.')
  console.error(`  읽은 길이: ${ddl.length}자`)
  process.exit(1)
}

const out = join(root, 'supabase/baseline.sql')
const header = `-- 운영 스키마 baseline — supabase/tools/_EXPORT_schema.sql 로 뽑았다.
-- 만든 날: ${new Date().toISOString().slice(0, 10)}
--
-- 빈 Supabase 프로젝트의 SQL Editor 에서 이 파일을 통째로 실행하면 구조가 선다.
-- ⚠ 데이터는 들어 있지 않다. 구조뿐이다.
-- ⚠ 손으로 고치지 말 것 — 다시 뽑는다.

`

if (append) {
  appendFileSync(out, '\n\n' + ddl + '\n')
} else {
  writeFileSync(out, header + ddl + '\n')
}

const sql = readFileSync(out, 'utf8')
const n = (re) => (sql.match(re) ?? []).length
console.log(`✓ supabase/baseline.sql  (${(sql.length / 1024).toFixed(0)} KB)`)
console.log('')
console.log(`    테이블   ${n(/^create table /gim)}`)
console.log(`    함수     ${n(/^create or replace function |^create function /gim)}`)
console.log(`    트리거   ${n(/^create trigger /gim)}`)
console.log(`    정책     ${n(/^create policy /gim)}`)
console.log(`    인덱스   ${n(/^create (unique )?index /gim)}`)
console.log(`    권한     ${n(/^grant /gim)}`)
console.log(`    realtime ${n(/^alter publication /gim)}`)
