#!/usr/bin/env node
// anon 쓰기 차단 전환 SQL 을 **하나의 트랜잭션**으로 넣는다.
//
// 왜 이 스크립트가 필요한가:
//   · Supabase SQL Editor 는 begin/commit 을 지키지 않는다 (테스트 DB 에서 실측).
//     중간에 멈추면 app_users 가 열린 채로 남는 구간이 생긴다.
//   · supabase CLI 의 --linked 는 **운영 프로젝트에 링크돼 있다.** 사고 나기 쉽다.
//   → psql --single-transaction 으로 넣되, **어느 DB 인지 눈으로 확인**시킨다.
//
// 쓰는 법:
//   npm run apply:lockdown -- --db-url "postgresql://...:5432/postgres"
//   확인 문구가 뜨면 --confirm <ref> 를 붙여 다시 실행한다.
//
// ⚠ 접속 문자열은 화면에 안 찍는다 (비밀번호가 들어 있다).
import { execFileSync, execSync } from 'node:child_process'
import { existsSync } from 'node:fs'

const FILE = 'supabase/migrations/20260828_1200_anon_write_lockdown.sql'
const PRODUCTION_REFS = ['qdxemvdorasoryfysuoq']   // 용인 중국어 (운영)

const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null }
const dbUrl = arg('--db-url') ?? process.env.SUPABASE_DB_URL
const confirm = arg('--confirm')

const die = (msg) => { console.error(`\n  ✗ ${msg}\n`); process.exit(1) }

if (!dbUrl) die('접속 문자열이 없다.\n     npm run apply:lockdown -- --db-url "postgresql://..."\n     (Supabase Dashboard → Settings → Database → Connection string → URI)')
if (!existsSync(FILE)) die(`${FILE} 이 없다`)

try { execSync('psql --version', { stdio: 'ignore' }) }
catch { die('psql 이 없다. 설치:  brew install libpq && brew link --force libpq') }

// 어느 프로젝트인가 — 비밀번호는 안 찍는다
const ref = dbUrl.match(/(?:db\.|@)([a-z0-9]{20})\.supabase/)?.[1]
         ?? dbUrl.match(/postgres\.([a-z0-9]{20})/)?.[1]
         ?? null
if (!ref) die('접속 문자열에서 project ref 를 못 찾았다. 주소가 맞는지 확인할 것')

const isProd = PRODUCTION_REFS.includes(ref)
console.log(`\n  대상 project ref : ${ref}`)
console.log(`  성격             : ${isProd ? '⚠⚠ 운영 (62명이 쓰는 DB)' : '테스트/기타'}`)
console.log(`  파일             : ${FILE}`)

if (confirm !== ref) {
  console.log(`\n  확인이 필요하다. 같은 명령에 아래를 붙여 다시 실행할 것:`)
  console.log(`      --confirm ${ref}`)
  if (isProd) {
    console.log(`\n  ⚠ 운영이다. 그 전에:`)
    console.log(`      · npm run backup 으로 백업했나`)
    console.log(`      · 사람들이 새 앱(헤더를 보내는 버전)을 받았나`)
    console.log(`      · 테스트 DB 에서 smoke:lockdown 이 전부 통과했나`)
  }
  console.log('')
  process.exit(1)
}

console.log(`\n  ── psql --single-transaction 으로 넣는다 ──\n`)
try {
  execFileSync('psql', ['-X', '-v', 'ON_ERROR_STOP=1', '--single-transaction', dbUrl, '-f', FILE],
    { stdio: 'inherit' })
  console.log(`\n  ✅ 커밋됐다. 다음: supabase/tools/_VERIFY_전환결과.sql 로 확인\n`)
} catch {
  console.error(`\n  ✗ 실패했다. --single-transaction 이라 **전부 롤백됐다** — DB 는 그대로다.`)
  console.error(`    위 오류를 고치고 다시 실행할 것.\n`)
  process.exit(1)
}
