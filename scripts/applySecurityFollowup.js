#!/usr/bin/env node
// 2026-08-30 후속 보안 마이그레이션 셋을 운영에 한 트랜잭션으로 적용한다.
// 비밀번호는 argv에 넣지 않고 .env.local의 SUPABASE_DB_URL에서 읽는다.
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, statSync } from 'node:fs'

const REF = 'qdxemvdorasoryfysuoq'
const FILES = [
  'supabase/migrations/20260830_1700_guard_admin_maintenance.sql',
  'supabase/migrations/20260830_1710_fix_global_settings_auth.sql',
  'supabase/migrations/20260830_1720_guard_login_logs_and_auto_close.sql',
]
const VERIFY = 'supabase/tools/_VERIFY_20260830_관리함수_권한.sql'

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

for (const file of [...FILES, VERIFY]) {
  if (!existsSync(file)) die(`${file} 이 없습니다`)
}

const backup = 'backups/2026-08-30/app_users.json'
if (!existsSync(backup)) die('오늘 app_users 백업이 없습니다. 먼저 npm run backup')
const backupAgeMinutes = (Date.now() - statSync(backup).mtimeMs) / 60_000
if (backupAgeMinutes > 30) die(`백업이 ${Math.round(backupAgeMinutes)}분 전입니다. npm run backup을 다시 실행하세요`)

const raw = envValue('SUPABASE_DB_URL')
if (!raw) die('.env.local에 운영 SUPABASE_DB_URL이 없습니다')
let url
try { url = new URL(raw) } catch { die('SUPABASE_DB_URL 형식이 잘못됐습니다') }
const identity = `${url.username} ${url.hostname}`
if (!identity.includes(REF)) die(`운영 ref ${REF}가 아닌 DB입니다`)
const password = decodeURIComponent(url.password)
if (!password) die('운영 DB 비밀번호가 없습니다')
url.password = ''
const safeUrl = url.toString()
const env = { ...process.env, PGPASSWORD: password, PGCONNECT_TIMEOUT: '10' }
const psql = (...args) => execFileSync('/opt/homebrew/bin/psql', [
  '-X', '-v', 'ON_ERROR_STOP=1', safeUrl, ...args,
], { stdio: 'inherit', env })

console.log(`\n  대상       : ⚠ 운영 ${REF}`)
console.log(`  백업       : ${Math.round(backupAgeMinutes)}분 전`)
console.log('  적용 파일  :')
for (const file of FILES) console.log(`               ${file}`)

console.log('\n  ── 읽기 전용 preflight ──\n')
try {
  psql('-c', `
do $$
declare v_users integer; v_env text;
begin
  select count(*) into v_users from public.app_users;
  select value into v_env from public.app_private_settings where key = 'environment';
  if v_users < 20 then raise exception '운영 사용자 수가 예상보다 적습니다: %', v_users; end if;
  if coalesce(v_env, '') = 'test' then raise exception '테스트 DB 표식이 있습니다'; end if;
  raise notice '운영 preflight: 사용자 %명, test 표식 없음', v_users;
end $$;
select jobid, jobname, username, command from cron.job
where jobname in ('cleanup-old-data', 'auto-reset-met-units') order by jobname;
`)
} catch {
  die('운영 DB preflight 접속에 실패했습니다. 아직 아무것도 적용하지 않았습니다.\n'
    + '     .env.local의 SUPABASE_DB_URL과 운영 DB 비밀번호를 확인하세요')
}

if (arg('--confirm') !== REF) {
  console.log('\n  아직 적용하지 않았습니다. 위 대상이 맞으면 다음 명령을 실행하세요:\n')
  console.log(`    npm run apply:security-followup -- --confirm ${REF}\n`)
  process.exit(0)
}

console.log('\n  ── 세 파일을 한 트랜잭션으로 적용 ──\n')
try {
  psql('--single-transaction', ...FILES.flatMap((file) => ['-f', file]))
} catch {
  die('적용에 실패했습니다. --single-transaction이라 세 파일 모두 롤백됐습니다')
}
console.log('\n  ── 적용 결과 검증: 모든 결과가 0 rows여야 함 ──\n')
try {
  psql('-f', VERIFY)
} catch {
  die('SQL은 적용됐지만 검증 실행이 실패했습니다. 추가 변경 없이 원인을 확인하세요')
}
console.log('\n  ✅ 운영 적용과 읽기 검증이 끝났습니다. 앱 실사용 smoke는 별도로 확인하세요.\n')
