#!/usr/bin/env node
// 운영 보안 전환 상태를 읽기 전용으로 확인한다.
// 사용자 식별정보와 접속 문자열은 출력하지 않는다.
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'

const REF = 'qdxemvdorasoryfysuoq'
const PSQL = process.env.PSQL_BIN ?? 'psql'
const die = (message) => { console.error(`\n  ✗ ${message}\n`); process.exit(1) }
const envValue = (name) => {
  if (!existsSync('.env.local')) return null
  const line = readFileSync('.env.local', 'utf8').split('\n')
    .find((item) => item.trim().startsWith(`${name}=`))
  return line?.slice(line.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '') || null
}

const raw = envValue('SUPABASE_DB_URL')
if (!raw) die('.env.local에 운영 SUPABASE_DB_URL이 없습니다')

let url
try { url = new URL(raw) } catch { die('SUPABASE_DB_URL 형식이 잘못됐습니다') }
if (!`${url.username} ${url.hostname}`.includes(REF)) die(`운영 ref ${REF}가 아닌 DB입니다`)

const password = decodeURIComponent(url.password)
if (!password) die('운영 DB 비밀번호가 없습니다')
url.password = ''

const sql = String.raw`
begin transaction read only;

with user_counts as (
  select
    count(*) filter (
      where coalesce(is_active, true)
        and coalesce(approval_status, 'approved') = 'approved'
    )::integer as active_approved,
    count(*) filter (
      where coalesce(is_active, true)
        and coalesce(approval_status, 'approved') = 'approved'
        and last_login_at >= now() - interval '7 days'
    )::integer as active_7d,
    count(*) filter (
      where coalesce(is_active, true)
        and coalesce(approval_status, 'approved') = 'approved'
        and last_login_at >= now() - interval '30 days'
    )::integer as active_30d,
    count(*)::integer as total
  from public.app_users
), session_counts as (
  select
    count(distinct s.user_id) filter (where s.expires_at > now())::integer as valid,
    count(distinct s.user_id) filter (
      where s.expires_at > now()
        and s.last_used_at >= now() - interval '7 days'
    )::integer as used_7d,
    count(distinct s.user_id) filter (
      where s.expires_at > now()
        and u.last_login_at >= now() - interval '7 days'
    )::integer as valid_for_active_7d,
    count(distinct s.user_id) filter (
      where s.expires_at > now()
        and u.last_login_at >= now() - interval '30 days'
    )::integer as valid_for_active_30d
  from public.auth_sessions s
  join public.app_users u on u.id = s.user_id
  where coalesce(u.is_active, true)
    and coalesce(u.approval_status, 'approved') = 'approved'
), policy_counts as (
  select
    count(*) filter (where policyname like 'EMERGENCY_open_%')::integer as emergency,
    count(*) filter (where policyname like 'TEMP_session_gate_%')::integer as session_gate,
    count(*) filter (where policyname like '%_select_all')::integer as select_all
  from pg_policies
  where schemaname = 'public'
), definer_counts as (
  select count(*)::integer as anon_callable
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.prosecdef
    and has_function_privilege('anon', p.oid, 'execute')
), rls_off_writable as (
  select coalesce(json_agg(c.relname order by c.relname), '[]'::json) as tables
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'r'
    and not c.relrowsecurity
    and (
      has_table_privilege('anon', c.oid, 'insert')
      or has_table_privilege('anon', c.oid, 'update')
      or has_table_privilege('anon', c.oid, 'delete')
    )
)
select json_build_object(
  'checked_at_kst', to_char(clock_timestamp() at time zone 'Asia/Seoul', 'YYYY-MM-DD HH24:MI:SS'),
  'total_users', u.total,
  'active_approved_users', u.active_approved,
  'active_users_7d', u.active_7d,
  'active_users_30d', u.active_30d,
  'valid_session_users', s.valid,
  'sessions_used_last_7d', s.used_7d,
  'valid_sessions_for_active_7d', s.valid_for_active_7d,
  'valid_sessions_for_active_30d', s.valid_for_active_30d,
  'emergency_open_policies', p.emergency,
  'session_gate_policies', p.session_gate,
  'select_all_policies', p.select_all,
  'anon_callable_definers', d.anon_callable,
  'rls_off_anon_writable_tables', w.tables
)
from user_counts u, session_counts s, policy_counts p, definer_counts d, rls_off_writable w;

select coalesce(json_agg(row_to_json(x) order by x.jobname), '[]'::json)
from (
  select j.jobname, j.schedule, j.username, j.command,
         d.status as last_status,
         to_char(d.start_time at time zone 'Asia/Seoul', 'YYYY-MM-DD HH24:MI:SS') as last_run_kst,
         left(d.return_message, 160) as last_message
  from cron.job j
  left join lateral (
    select status, start_time, return_message
    from cron.job_run_details
    where jobid = j.jobid
    order by start_time desc
    limit 1
  ) d on true
  where j.jobname in ('cleanup-old-data', 'auto-reset-met-units')
) x;

commit;
`

let output
try {
  output = execFileSync(PSQL, [
    '-X', '-v', 'ON_ERROR_STOP=1', '-A', '-t', url.toString(), '-c', sql,
  ], {
    encoding: 'utf8',
    env: { ...process.env, PGPASSWORD: password, PGCONNECT_TIMEOUT: '10' },
  })
} catch {
  die('운영 보안 상태를 읽지 못했습니다. DB 연결과 비밀번호를 확인하세요')
}

const jsonLines = output.split('\n').map((line) => line.trim()).filter((line) => line.startsWith('{') || line.startsWith('['))
if (jsonLines.length !== 2) die('운영 상태 응답 형식이 예상과 다릅니다')

const status = JSON.parse(jsonLines[0])
const jobs = JSON.parse(jsonLines[1])
const gap = status.active_approved_users - status.valid_session_users

console.log(`\n  운영 보안 상태 (${status.checked_at_kst} KST)`)
console.log('  ─────────────────────────────────────')
console.log(`  전체 사용자                 ${status.total_users}명`)
console.log(`  활성·승인 사용자            ${status.active_approved_users}명`)
console.log(`  유효 토큰 보유              ${status.valid_session_users}명 (부족 ${Math.max(0, gap)}명)`)
console.log(`  최근 7일 토큰 사용          ${status.sessions_used_last_7d}명`)
console.log(`  최근 7일 사용자 중 토큰     ${status.valid_sessions_for_active_7d}/${status.active_users_7d}명`)
console.log(`  최근 30일 사용자 중 토큰    ${status.valid_sessions_for_active_30d}/${status.active_users_30d}명`)
console.log(`  긴급 개방 정책              ${status.emergency_open_policies}개`)
console.log(`  세션 관문 정책              ${status.session_gate_policies}개`)
console.log(`  SELECT 재현 정책            ${status.select_all_policies}개`)
console.log(`  anon 실행 가능 definer      ${status.anon_callable_definers}개`)
console.log(`  RLS 꺼진 anon 쓰기 표        ${status.rls_off_anon_writable_tables.length}개`)
if (status.rls_off_anon_writable_tables.length > 0) {
  console.log(`    ⚠ ${status.rls_off_anon_writable_tables.join(', ')}`)
  process.exitCode = 1
}

console.log('\n  최근 cron 상태')
for (const job of jobs) {
  console.log(`  - ${job.jobname}: ${job.last_status ?? '실행 기록 없음'} (${job.last_run_kst ?? '없음'} KST, 일정 ${job.schedule} UTC)`)
  if (job.last_message && job.last_status !== 'succeeded') console.log(`    ${job.last_message}`)
}

if (status.emergency_open_policies > 0) {
  console.log('\n  ⚠ 긴급 개방이 유지 중입니다. 이 출력만 보고 자동으로 재잠금하지 마세요.')
  console.log('    사용자 안내와 실사용 확인 뒤, 사람이 별도 재잠금 절차를 결정해야 합니다.\n')
} else {
  console.log('\n  ✓ 긴급 개방 정책이 없습니다.\n')
}
