#!/usr/bin/env node
// anon 쓰기 차단 전환 SQL 을 **하나의 트랜잭션**으로 넣는다.
//
// 왜 이 스크립트가 필요한가:
//   · Supabase SQL Editor 는 begin/commit 을 지키지 않는다 (테스트 DB 에서 실측).
//     중간에 멈추면 app_users 가 열린 채로 남는 구간이 생긴다.
//   · supabase CLI 의 --linked 는 **운영 프로젝트에 링크돼 있다.** 사고 나기 쉽다.
//   → psql --single-transaction 으로 넣되, **어느 DB 인지 눈으로 확인**시킨다.
//
// ⚠ **비밀번호를 명령줄에 쓰지 않는다.** 명령줄 인자는
//   ~/.zsh_history 에 남고 `ps` 로 다른 프로세스에서도 보인다.
//   운영 비밀번호가 거기 남으면 SQL 을 아무리 안전하게 만들어도 소용이 없다.
//   → `.env.local` (gitignore 됨)의 `SUPABASE_DB_URL` 에서 읽는다.
//
// 쓰는 법:
//   1) .env.local 에 한 줄 추가 (따옴표 없이):
//        SUPABASE_DB_URL=postgresql://postgres.<ref>:<비밀번호>@...pooler.supabase.com:5432/postgres
//   2) npm run apply:lockdown
//   3) 확인 문구가 뜨면  npm run apply:lockdown -- --confirm <ref>
//
// ⚠ 접속 문자열은 화면에 안 찍는다.
import { execFileSync, execSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'

const FILE = 'supabase/migrations/20260828_1200_anon_write_lockdown.sql'
const PRODUCTION_REFS = ['qdxemvdorasoryfysuoq']   // 용인 중국어 (운영)

const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null }
const confirm = arg('--confirm')

const die = (msg) => { console.error(`\n  ✗ ${msg}\n`); process.exit(1) }

/** .env.local 에서 한 줄 읽는다 (값은 절대 안 찍는다) */
const fromEnvFile = (key) => {
  if (!existsSync('.env.local')) return null
  const line = readFileSync('.env.local', 'utf8').split('\n')
    .find((l) => l.trim().startsWith(`${key}=`))
  return line ? line.slice(line.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '') : null
}

if (arg('--db-url')) {
  die('⚠ `--db-url` 은 더 이상 받지 않는다.\n'
    + '     명령줄 인자는 셸 기록(~/.zsh_history)에 남고 `ps` 로 다른 프로세스에서도 보인다.\n'
    + '     운영 비밀번호가 거기 남으면 안 된다.\n\n'
    + '     대신 .env.local 에 한 줄 넣을 것 (이 파일은 gitignore 된다):\n'
    + '        SUPABASE_DB_URL=postgresql://postgres.<ref>:<비밀번호>@...:5432/postgres')
}

const dbUrl = fromEnvFile('SUPABASE_DB_URL') ?? process.env.SUPABASE_DB_URL
if (!dbUrl) die('.env.local 에 SUPABASE_DB_URL 이 없다.\n'
  + '     Supabase Dashboard → 초록 Connect 버튼 → Session pooler (포트 5432) 의 URI 를\n'
  + '     .env.local 에 한 줄로 넣을 것:\n'
  + '        SUPABASE_DB_URL=postgresql://postgres.<ref>:<비밀번호>@...:5432/postgres')
if (!existsSync(FILE)) die(`${FILE} 이 없다`)

try { execSync('psql --version', { stdio: 'ignore' }) }
catch { die('psql 이 없다. 설치:  brew install libpq && brew link --force libpq') }

// 어느 프로젝트인가 — 비밀번호는 안 찍는다
const ref = dbUrl.match(/(?:db\.|@)([a-z0-9]{20})\.supabase/)?.[1]
         ?? dbUrl.match(/postgres\.([a-z0-9]{20})/)?.[1]
         ?? null
if (!ref) die('접속 문자열에서 project ref 를 못 찾았다. 주소가 맞는지 확인할 것')

// 비밀번호를 떼어낸 주소를 만든다 (psql argv 로 넘길 것)
let safeUrl = dbUrl, password = process.env.PGPASSWORD ?? ''
try {
  const u = new URL(dbUrl)
  password = u.password || password
  u.password = ''
  safeUrl = u.toString()
} catch { die('접속 문자열 형식이 이상하다 (postgresql://... 이어야 한다)') }
if (!password) die('접속 문자열에 비밀번호가 없다. .env.local 의 SUPABASE_DB_URL 을 확인할 것')

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
  // ⚠ **비밀번호만 떼어 환경변수(PGPASSWORD)로 준다.** 주소·사용자명은 argv 에 남아도
  //   괜찮지만 비밀번호는 `ps` 에 보이면 안 된다.
  execFileSync('psql', ['-X', '-v', 'ON_ERROR_STOP=1', '--single-transaction', safeUrl, '-f', FILE],
    { stdio: 'inherit', env: { ...process.env, PGPASSWORD: password } })
  console.log(`\n  ✅ 커밋됐다. 다음: supabase/tools/_VERIFY_전환결과.sql 로 확인\n`)
} catch {
  console.error(`\n  ✗ 실패했다. --single-transaction 이라 **전부 롤백됐다** — DB 는 그대로다.`)
  console.error(`    위 오류를 고치고 다시 실행할 것.\n`)
  process.exit(1)
}
