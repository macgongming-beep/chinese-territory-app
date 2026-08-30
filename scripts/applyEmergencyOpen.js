#!/usr/bin/env node
// 재잠금 직후 실사용 저장 장애가 확인됐을 때만 긴급 개방 26개를 되살린다.
// app_users는 권한 상승을 막기 위해 어떤 경우에도 열지 않는다.
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'

const REF = 'qdxemvdorasoryfysuoq'
const FILE = 'supabase/tools/_EMERGENCY_쓰기_다시열기.sql'
const die = (message) => { console.error(`\n  ✗ ${message}\n`); process.exit(1) }
const arg = (name) => {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : null
}
const envValue = (name) => {
  if (!existsSync('.env.local')) return null
  const line = readFileSync('.env.local', 'utf8').split('\n')
    .find((item) => item.trim().startsWith(`${name}=`))
  return line?.slice(line.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '') || null
}

if (!existsSync(FILE)) die(`${FILE}이 없습니다`)
const raw = envValue('SUPABASE_DB_URL')
if (!raw) die('.env.local에 운영 SUPABASE_DB_URL이 없습니다')

let url
try { url = new URL(raw) } catch { die('SUPABASE_DB_URL 형식이 잘못됐습니다') }
if (!`${url.username} ${url.hostname}`.includes(REF)) die(`운영 ref ${REF}가 아닌 DB입니다`)
const password = decodeURIComponent(url.password)
if (!password) die('운영 DB 비밀번호가 없습니다')
url.password = ''
const env = { ...process.env, PGPASSWORD: password, PGCONNECT_TIMEOUT: '10' }
const psql = (args, capture = false) => execFileSync('/opt/homebrew/bin/psql', [
  '-X', '-v', 'ON_ERROR_STOP=1', url.toString(), ...args,
], { encoding: capture ? 'utf8' : undefined, stdio: capture ? 'pipe' : 'inherit', env })

let state
try {
  const output = psql(['-A', '-t', '-c', String.raw`
    begin transaction read only;
    select json_build_object(
      'emergency', (select count(*) from pg_policies where schemaname='public' and policyname like 'EMERGENCY\_open\_%'),
      'gates', (select count(*) from pg_policies where schemaname='public' and policyname like 'TEMP\_session\_gate\_%'),
      'app_users_open', (select count(*) from pg_policies where schemaname='public' and tablename='app_users' and policyname like 'EMERGENCY\_open\_%')
    );
    commit;
  `], true)
  state = JSON.parse(output.split('\n').map((line) => line.trim()).find((line) => line.startsWith('{')))
} catch {
  die('운영 긴급 복구 preflight를 읽지 못했습니다')
}

console.log(`\n  대상                 ⚠ 운영 ${REF}`)
console.log(`  긴급 개방 / 세션관문  ${state.emergency} / ${state.gates}개`)

if (state.emergency !== 0) die(`긴급 개방 정책이 이미 ${state.emergency}개 있습니다`)
if (state.gates < 80) die(`세션 관문 정책이 모자랍니다: ${state.gates}`)
if (state.app_users_open !== 0) die('app_users 긴급 개방 정책이 있습니다')

if (arg('--confirm') !== REF) {
  console.log('\n  아직 복구하지 않았습니다.')
  console.log('  재잠금 직후 대표 사용자의 실제 저장이 실패한 경우에만 다음 명령을 사용하세요:')
  console.log(`  npm run apply:emergency-open -- --confirm ${REF}\n`)
  process.exit(0)
}

console.log('\n  ── app_users를 제외한 긴급 개방 26개 적용 ──\n')
try {
  psql(['--single-transaction', '-f', FILE])
} catch {
  die('긴급 복구가 실패했습니다. 단일 트랜잭션이라 전체 롤백됐습니다')
}

const after = Number(psql(['-A', '-t', '-c', String.raw`
  select count(*) from pg_policies
  where schemaname='public' and policyname like 'EMERGENCY\_open\_%';
`], true).trim())
if (after !== 26) die(`복구 뒤 긴급 개방 정책이 26개가 아닙니다: ${after}`)

console.log('\n  🚨 긴급 개방 26개를 복구했습니다. app_users는 계속 닫혀 있습니다.')
console.log('  장애 원인을 고친 뒤 다시 재잠금해야 합니다.\n')
