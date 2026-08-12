#!/usr/bin/env node
/**
 * Supabase 전체 백업 스크립트
 *
 * 모든 테이블을 JSON 파일로 백업합니다.
 * 백업 위치: backups/YYYY-MM-DD/<table>.json
 *
 * 실행:
 *   npm run backup
 *
 * 환경 변수 (.env.local):
 *   VITE_SUPABASE_URL=...
 *   SUPABASE_SERVICE_ROLE_KEY=...   ← Supabase Dashboard → Settings → API
 *
 * SERVICE_ROLE_KEY 는 RLS 를 우회하므로 절대 클라이언트에 노출 금지.
 * .env.local 은 .gitignore 에 등록되어 있어 커밋되지 않습니다.
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

// ── .env.local 로드 (dotenv 의존성 없이 직접 파싱) ──────────────
const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = join(__dirname, '..')
const envPath = join(projectRoot, '.env.local')

if (existsSync(envPath)) {
  const envContent = readFileSync(envPath, 'utf-8')
  envContent.split('\n').forEach((line) => {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) return
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) return
    const key = trimmed.slice(0, eqIdx).trim()
    const value = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '')
    if (!process.env[key]) process.env[key] = value
  })
}

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌ 환경변수 설정 필요:')
  console.error('   .env.local 에 VITE_SUPABASE_URL 과 SUPABASE_SERVICE_ROLE_KEY 추가')
  console.error('   SERVICE_ROLE_KEY: Supabase Dashboard → Settings → API → service_role')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
})

// 백업 대상 테이블 (의존 순서 무관 — JSON 백업)
const TABLES = [
  // 사용자/인증
  'app_users',
  'login_logs',
  'app_sessions',          // 향후 추가될 수 있음 (없으면 자동 스킵)

  // 구역/카드
  'cards',
  'card_assignments',
  'card_leader_assignments',
  'card_boundaries',

  // 건물/세대
  'buildings',
  'units',

  // 방문/봉사
  'visit_histories',
  'regular_visits',
  'service_sessions',

  // 캘린더/일정
  'calendar_events',
  'event_participants',
  'event_card_assignments',
  'event_card_assignment_cards',

  // 기타
  'notices',
  'special_periods',
  'review_tasks',
]

function todayStamp() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/**
 * 한 테이블을 통째로 받아온다.
 *
 * ⚠ Supabase(PostgREST)는 한 번에 최대 1,000행만 준다. 페이지 처리를 안 하면
 *   백업이 조용히 1,000행에서 잘린다 — 실제로 세대(units) 1,553개 중 1,000개만
 *   저장돼 있었다. 잘린 백업은 없는 것보다 위험하므로 끝까지 받는다.
 */
async function dumpTable(name) {
  const pageSize = 1000
  const rows = []
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from(name)
      .select('*')
      .range(from, from + pageSize - 1)
    if (error) {
      if (error.message?.includes('does not exist') || error.code === 'PGRST205' || error.code === '42P01') {
        return { status: 'skipped' }
      }
      console.error(`❌ ${name}: ${error.message}`)
      return { status: 'failed' }
    }
    const page = data ?? []
    rows.push(...page)
    if (page.length < pageSize) break
  }
  return { status: 'ok', rows }
}

async function main() {
  const stamp = todayStamp()
  const dir = join(projectRoot, 'backups', stamp)
  mkdirSync(dir, { recursive: true })

  console.log(`📦 Supabase 백업 시작`)
  console.log(`📁 위치: backups/${stamp}/\n`)

  let total = 0
  let success = 0
  let skipped = 0
  let failed = 0

  for (const t of TABLES) {
    const result = await dumpTable(t)
    if (result.status === 'skipped') {
      skipped++
      console.log(`⏭  ${t.padEnd(32)} 테이블 없음 (스킵)`)
      continue
    }
    if (result.status === 'failed') {
      failed++
      continue
    }
    const file = join(dir, `${t}.json`)
    writeFileSync(file, JSON.stringify(result.rows, null, 2), 'utf-8')
    total += result.rows.length
    success++
    console.log(`✅ ${t.padEnd(32)} ${String(result.rows.length).padStart(5)} 행`)
  }

  // 메타 정보 저장
  const meta = {
    backedUpAt: new Date().toISOString(),
    supabaseUrl: SUPABASE_URL,
    tablesSucceeded: success,
    tablesSkipped: skipped,
    tablesFailed: failed,
    totalRows: total,
  }
  writeFileSync(join(dir, '_meta.json'), JSON.stringify(meta, null, 2), 'utf-8')

  console.log(`\n🎉 백업 완료`)
  console.log(`   성공: ${success}개 테이블 / ${total}행`)
  if (skipped > 0) console.log(`   스킵: ${skipped}개 (테이블 없음)`)
  if (failed > 0) console.log(`   ❌ 실패: ${failed}개 (위 로그 확인)`)
  console.log(`   📁 backups/${stamp}/`)
}

main().catch((e) => {
  console.error('💥 백업 중단:', e)
  process.exit(1)
})
