#!/usr/bin/env node
// 출입불가와 비슷한 표현이 어느 칸에 남아 있는지 운영 DB에서 읽기만 한다.
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'

const REF = 'qdxemvdorasoryfysuoq'
const PSQL = process.env.PSQL_BIN ?? 'psql'
const die = (message) => { console.error(`\n  ✗ ${message}\n`); process.exit(1) }

if (!existsSync('.env.local')) die('.env.local이 없습니다')
const line = readFileSync('.env.local', 'utf8').split('\n')
  .find((item) => item.trim().startsWith('SUPABASE_DB_URL='))
const raw = line?.slice(line.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')
if (!raw) die('SUPABASE_DB_URL이 없습니다')

let url
try { url = new URL(raw) } catch { die('SUPABASE_DB_URL 형식이 잘못됐습니다') }
if (!`${url.username} ${url.hostname}`.includes(REF)) die(`운영 ref ${REF}가 아닌 DB입니다`)
const password = decodeURIComponent(url.password)
url.password = ''

const sql = String.raw`
begin transaction read only;
select source, value, status, count(*) as count
from (
  select '세대명'::text source, number value, status
  from public.units
  where number ~ '(출입|들어.*(없|못|불)|진입|접근)'

  union all
  select '세대메모', memo, status
  from public.units
  where coalesce(memo, '') ~ '(출입|들어.*(없|못|불)|진입|접근)'

  union all
  select '건물명', name, null
  from public.buildings
  where name ~ '(출입|들어.*(없|못|불)|진입|접근)'

  union all
  select '건물메모', memo, null
  from public.buildings
  where coalesce(memo, '') ~ '(출입|들어.*(없|못|불)|진입|접근)'

  union all
  select '방문메모', memo, result
  from public.visit_histories
  where coalesce(memo, '') ~ '(출입|들어.*(없|못|불)|진입|접근)'
) candidates
group by source, value, status
order by source, count(*) desc, value;

select
  count(*) filter (where has_existing_label) as same_building_already_has_no_entry,
  count(*) filter (where history_count > 0) as candidates_with_visit_history,
  count(*) as candidate_units
from (
  select u.id,
         exists (
           select 1 from public.units other
           where other.building_id = u.building_id
             and other.number = '출입불가'
             and other.id <> u.id
         ) as has_existing_label,
         (select count(*) from public.visit_histories h where h.unit_id = u.id) as history_count
  from public.units u
  where u.number = '들어갈 수 없음' and u.status = '대상외'
) safety;
commit;
`

try {
  execFileSync(PSQL, ['-X', '-v', 'ON_ERROR_STOP=1', url.toString(), '-c', sql], {
    stdio: 'inherit',
    env: { ...process.env, PGPASSWORD: password, PGCONNECT_TIMEOUT: '10' },
  })
} catch {
  die('출입불가 표현을 조회하지 못했습니다')
}
