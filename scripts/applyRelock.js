#!/usr/bin/env node
// 긴급 개방 정책을 제거해 세션 관문을 다시 활성화한다.
// 운영은 cron 수정본의 첫 성공과 신선한 백업을 확인한 뒤에만 적용한다.
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const PROD_REF = 'qdxemvdorasoryfysuoq'
const TEST_REF = 'itjlykpjmlcvanqpmkmc'
const RELOCK = 'supabase/tools/_RELOCK_긴급개방_해제.sql'
const EMERGENCY = 'supabase/tools/_EMERGENCY_쓰기_다시열기.sql'
const VERIFY = 'supabase/tools/_VERIFY_전환결과.sql'
const PSQL = process.env.PSQL_BIN ?? 'psql'

const die = (message) => { console.error(`\n  ✗ ${message}\n`); process.exit(1) }
const arg = (name) => {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : null
}
const hasArg = (name) => process.argv.includes(name)
const envValue = (name) => {
  if (!existsSync('.env.local')) return null
  const line = readFileSync('.env.local', 'utf8').split('\n')
    .find((item) => item.trim().startsWith(`${name}=`))
  return line?.slice(line.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '') || null
}
const newestBackup = () => {
  if (!existsSync('backups')) return null
  const backups = []
  for (const dir of readdirSync('backups')) {
    const path = join('backups', dir)
    const metaPath = join(path, '_meta.json')
    if (!existsSync(metaPath)) continue
    try {
      const meta = JSON.parse(readFileSync(metaPath, 'utf8'))
      const tableFiles = readdirSync(path).filter((name) => name.endsWith('.json') && name !== '_meta.json')
      backups.push({ path, meta, tableFiles, time: new Date(meta.backedUpAt).getTime() })
    } catch { /* 깨진 메타는 완료된 백업이 아니다 */ }
  }
  return backups.filter((item) => Number.isFinite(item.time)).sort((a, b) => b.time - a.time)[0] ?? null
}
const connection = (raw, expectedRef) => {
  if (!raw) die(`.env.local에 ${expectedRef === PROD_REF ? 'SUPABASE_DB_URL' : 'SUPABASE_TEST_DB_URL'}이 없습니다`)
  let url
  try { url = new URL(raw) } catch { die('DB URL 형식이 잘못됐습니다') }
  if (!`${url.username} ${url.hostname}`.includes(expectedRef)) die(`대상 ref가 ${expectedRef}가 아닙니다`)
  const password = decodeURIComponent(url.password)
  if (!password) die('DB 비밀번호가 없습니다')
  url.password = ''
  return {
    safeUrl: url.toString(),
    env: { ...process.env, PGPASSWORD: password, PGCONNECT_TIMEOUT: '10' },
  }
}
const psql = (conn, args, capture = false) => execFileSync(PSQL, [
  '-X', '-v', 'ON_ERROR_STOP=1', conn.safeUrl, ...args,
], { encoding: capture ? 'utf8' : undefined, stdio: capture ? 'pipe' : 'inherit', env: conn.env })

for (const file of [RELOCK, EMERGENCY, VERIFY]) {
  if (!existsSync(file)) die(`${file}이 없습니다`)
}

if (hasArg('--test')) {
  const conn = connection(envValue('SUPABASE_TEST_DB_URL'), TEST_REF)
  const count = Number(psql(conn, ['-A', '-t', '-c', `
    select count(*) from pg_policies
    where schemaname='public' and policyname like 'EMERGENCY\\_open\\_%';
  `], true).trim())
  if (count !== 0) die(`테스트 DB에 긴급 개방 정책이 이미 ${count}개 있습니다`)

  const recoveryCheck = String.raw`
    do $$
    declare v_count integer;
    begin
      select count(*) into v_count from pg_policies
      where schemaname='public' and policyname like 'EMERGENCY\_open\_%';
      if v_count <> 26 then raise exception '복구 정책은 26개여야 합니다: %', v_count; end if;
      if exists (select 1 from pg_policies where schemaname='public' and tablename='app_users'
                 and policyname like 'EMERGENCY\_open\_%') then
        raise exception '복구가 app_users를 열었습니다';
      end if;
    end $$;
  `
  console.log('\n  테스트 DB에서 재잠금 → 긴급 복구 → 재잠금을 한 트랜잭션으로 검증합니다.\n')
  try {
    psql(conn, [
      '--single-transaction',
      '-f', EMERGENCY, '-f', RELOCK, '-f', VERIFY,
      '-f', EMERGENCY, '-c', recoveryCheck,
      '-f', RELOCK, '-f', VERIFY,
    ])
  } catch {
    die('테스트 DB 재잠금 시뮬레이션이 실패했습니다. 전체 트랜잭션은 롤백됐습니다')
  }

  // 이름만 TEMP이고 실제 조건은 true인 정책을 심으면 재잠금이 거부돼야 한다.
  const mutation = String.raw`
    drop policy "TEMP_session_gate_buildings_ins" on public.buildings;
    create policy "TEMP_session_gate_buildings_ins" on public.buildings
      for insert to anon with check (true);
  `
  let mutationRejected = false
  try {
    psql(conn, ['--single-transaction', '-f', EMERGENCY, '-c', mutation, '-f', RELOCK])
  } catch {
    mutationRejected = true
  }
  if (!mutationRejected) die('가짜 TEMP 정책을 심었는데도 재잠금이 통과했습니다')

  const afterMutation = JSON.parse(psql(conn, ['-A', '-t', '-c', String.raw`
    select json_build_object(
      'emergency', (select count(*) from pg_policies where schemaname='public' and policyname like 'EMERGENCY\_open\_%'),
      'gate_is_real', (select (coalesce(with_check,'') ~* 'request_session_user_id')
        from pg_policies where schemaname='public' and tablename='buildings'
          and policyname='TEMP_session_gate_buildings_ins')
    );
  `], true).trim())
  if (afterMutation.emergency !== 0 || !afterMutation.gate_is_real) {
    die('가짜 관문 변형 트랜잭션이 깨끗하게 롤백되지 않았습니다')
  }
  console.log('  ✅ 이름만 TEMP인 가짜 관문을 심으면 재잠금이 거부되고 전부 롤백됩니다.')
  console.log('\n  ✅ 테스트 DB 재잠금 시뮬레이션과 최종 검증이 통과했습니다.\n')
  process.exit(0)
}

const conn = connection(envValue('SUPABASE_DB_URL'), PROD_REF)
const expectedEmergencyNames = [...readFileSync(EMERGENCY, 'utf8').matchAll(/create policy\s+"([^"]+)"/gi)]
  .map((match) => match[1]).sort()
if (expectedEmergencyNames.length !== 26) die(`복구 파일의 긴급 정책은 26개여야 합니다: ${expectedEmergencyNames.length}`)
const preflightSql = String.raw`
begin transaction read only;
with counts as (
  select
    (select count(*) from public.app_users
      where coalesce(is_active,true) and coalesce(approval_status,'approved')='approved')::integer as users,
    (select count(distinct s.user_id) from public.auth_sessions s
      join public.app_users u on u.id=s.user_id
      where s.expires_at > now() and coalesce(u.is_active,true)
        and coalesce(u.approval_status,'approved')='approved')::integer as tokens,
    (select count(*) from pg_policies where schemaname='public'
      and policyname like 'EMERGENCY\_open\_%')::integer as emergency,
    (select count(*) from pg_policies where schemaname='public'
      and policyname like 'TEMP\_session\_gate\_%')::integer as gates,
    (select count(*) from pg_policies where schemaname='public' and tablename='app_users'
      and policyname like 'EMERGENCY\_open\_%')::integer as users_open
), jobs as (
  select j.jobname, j.command, d.status, d.start_time
  from cron.job j
  left join lateral (
    select status, start_time from cron.job_run_details
    where jobid=j.jobid order by start_time desc limit 1
  ) d on true
  where j.jobname in ('cleanup-old-data','auto-reset-met-units')
)
select json_build_object(
  'users', c.users, 'tokens', c.tokens, 'emergency', c.emergency,
  'gates', c.gates, 'app_users_open', c.users_open,
  'cron_ready', coalesce((select count(*)=2 and bool_and(
    status='succeeded'
    and (start_time at time zone 'Asia/Seoul')::date = (now() at time zone 'Asia/Seoul')::date
  ) from jobs), false),
  'cron_commands_ready', coalesce((select count(*)=2 and bool_and(
    case jobname
      when 'cleanup-old-data' then lower(regexp_replace(command, '[[:space:];]+', '', 'g')) = 'selectprivate.cleanup_old_data_core()'
      when 'auto-reset-met-units' then lower(regexp_replace(command, '[[:space:];]+', '', 'g')) in ('selectauto_reset_met_units()', 'selectpublic.auto_reset_met_units()')
      else false
    end
  ) from jobs), false),
  'emergency_names', (select coalesce(json_agg(policyname order by policyname), '[]'::json)
    from pg_policies where schemaname='public' and policyname like 'EMERGENCY\_open\_%'),
  'cron', coalesce((select json_agg(json_build_object(
    'job',jobname,'status',status,
    'run_kst',to_char(start_time at time zone 'Asia/Seoul','YYYY-MM-DD HH24:MI:SS')
  ) order by jobname) from jobs), '[]'::json)
)
from counts c;
commit;
`

let state
try {
  const line = psql(conn, ['-A', '-t', '-c', preflightSql], true)
    .split('\n').map((item) => item.trim()).find((item) => item.startsWith('{'))
  state = JSON.parse(line)
} catch {
  die('운영 재잠금 preflight를 읽지 못했습니다')
}

console.log(`\n  대상                 ⚠ 운영 ${PROD_REF}`)
console.log(`  활성·승인 / 유효토큰  ${state.users} / ${state.tokens}명`)
console.log(`  긴급 개방 / 세션관문  ${state.emergency} / ${state.gates}개`)
for (const job of state.cron) console.log(`  cron ${job.job.padEnd(22)} ${job.status ?? '없음'} (${job.run_kst ?? '없음'} KST)`)

if (state.emergency !== 26) die(`긴급 개방 정책이 26개가 아닙니다: ${state.emergency}`)
if (state.gates < 80) die(`세션 관문 정책이 모자랍니다: ${state.gates}`)
if (state.app_users_open !== 0) die('app_users가 긴급 개방돼 있습니다')
if (state.cron.length !== 2) die(`필수 cron 작업은 2개여야 합니다: ${state.cron.length}`)
if (JSON.stringify(state.emergency_names) !== JSON.stringify(expectedEmergencyNames)) {
  die('운영 긴급 정책 이름이 복구 파일의 26개와 정확히 일치하지 않습니다')
}
if (!state.cron_commands_ready) die('cron 명령이 후속 보안 마이그레이션의 최종 형태가 아닙니다')

const backup = newestBackup()
const backupAgeMinutes = backup ? (Date.now() - backup.time) / 60_000 : Infinity
const backupComplete = Boolean(backup
  && backup.meta.supabaseUrl?.includes(PROD_REF)
  && backup.meta.tablesFailed === 0
  && backup.meta.tablesSucceeded >= 39
  && backup.meta.tablesSucceeded + backup.meta.tablesSkipped >= 40
  && backup.tableFiles.length === backup.meta.tablesSucceeded)
console.log(`  최신 전체 백업          ${backup ? `${Math.round(backupAgeMinutes)}분 전 (${backup.meta.tablesSucceeded}개 성공·${backup.meta.tablesSkipped}개 스킵·${backup.meta.tablesFailed}개 실패)` : '없음'}`)

if (arg('--confirm') !== PROD_REF) {
  console.log('\n  아직 적용하지 않았습니다.')
  if (!state.cron_ready) console.log('  ⚠ 수정본 적용 뒤 cron 두 개가 아직 모두 성공하지 않았습니다.')
  console.log('  다음 04:00 KST 이후 cron 성공과 앱 실사용을 확인한 뒤 다시 판단하세요.\n')
  process.exit(0)
}

if (!state.cron_ready) die('수정본 적용 뒤 cron 두 개가 모두 성공하기 전에는 재잠금하지 않습니다')
if (!backupComplete || backupAgeMinutes > 30) die('30분 이내 완료된 전체 백업이 필요합니다. npm run backup을 먼저 실행하세요')
if (!hasArg('--off-hours')) die('봉사 없는 시간임을 확인하려면 --off-hours를 붙이세요')
if (!hasArg('--core-user-ready')) die('핵심 사용자의 새 앱·재로그인·저장을 확인했다면 --core-user-ready를 붙이세요')

console.log('\n  ── 긴급 개방 26개를 한 트랜잭션으로 제거 ──\n')
try {
  psql(conn, ['--single-transaction', '-f', RELOCK, '-f', VERIFY])
} catch {
  die('재잠금이 실패했습니다. 단일 트랜잭션이라 전체 롤백됐습니다')
}

console.log('\n  ✅ 재잠금과 DB 검증이 완료됐습니다.')
console.log('  지금 앱에서 대표 사용자로 실제 저장 smoke를 하고, 실패하면 안전한 긴급 복구 절차를 사용하세요.\n')
