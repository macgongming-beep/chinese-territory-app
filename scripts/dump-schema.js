#!/usr/bin/env node
// 운영 DB 의 **구조만** 뽑아 supabase/baseline.sql 을 만든다. (데이터는 안 뽑는다)
//
// 왜 필요한가:
//   supabase/applied/ 에 마이그레이션이 70개 있는데 이름이 알파벳순이고
//   번호가 없다. 순서대로 다시 돌릴 방법이 없다. schema.sql 은 12개
//   테이블만 담고 있어서 낡았다 (실제는 39개).
//
//   그래서 "새 회중 설치" 도 "테스트 DB 만들기" 도 지금은 재현이 안 된다.
//   운영에서 한 번 뽑아 baseline 으로 삼는 편이 정직하다.
//
// 쓰는 법:
//   .env.local 에 SUPABASE_DB_URL 을 넣고  npm run db:schema
//   (Supabase Dashboard → Settings → Database → Connection string → URI)
//
// ⚠ 읽기 전용이다. pg_dump 는 아무것도 쓰지 않는다.
import { existsSync, readFileSync, mkdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const PG_DUMP = ['/opt/homebrew/opt/libpq/bin/pg_dump', '/usr/local/opt/libpq/bin/pg_dump', 'pg_dump']
  .find((p) => { try { execFileSync(p, ['--version'], { stdio: 'ignore' }); return true } catch { return false } })

if (!PG_DUMP) {
  console.error('✗ pg_dump 가 없다.   brew install libpq')
  process.exit(1)
}

const envFile = join(root, '.env.local')
const dbUrl = process.env.SUPABASE_DB_URL
  ?? (existsSync(envFile) ? readFileSync(envFile, 'utf8').match(/^SUPABASE_DB_URL=(.*)$/m)?.[1]?.trim() : null)

if (!dbUrl) {
  console.error('✗ SUPABASE_DB_URL 이 없다.')
  console.error('')
  console.error('  Supabase Dashboard → Settings → Database → Connection string → URI')
  console.error('  를 복사해서 .env.local 에 한 줄 추가할 것:')
  console.error('')
  console.error('    SUPABASE_DB_URL=postgresql://postgres.<ref>:<비밀번호>@...pooler.supabase.com:5432/postgres')
  console.error('')
  console.error('  ⚠ 비밀번호는 채팅에 붙이지 말 것. 이 파일은 gitignore 된다.')
  process.exit(1)
}

mkdirSync(join(root, 'supabase'), { recursive: true })
const out = join(root, 'supabase/baseline.sql')

console.log(`pg_dump 로 구조를 뽑는다 (데이터 없음) …`)

// --schema-only  구조만
// --no-owner --no-privileges  다른 프로젝트에서도 돌게 (역할 이름이 다르다)
// public 스키마만 — auth/storage 는 Supabase 가 알아서 만든다
execFileSync(PG_DUMP, [
  dbUrl,
  '--schema-only', '--no-owner', '--no-privileges',
  '--schema=public',
  '--file', out,
], { stdio: ['ignore', 'inherit', 'inherit'] })

const sql = readFileSync(out, 'utf8')
const count = (re) => (sql.match(re) ?? []).length
console.log('')
console.log(`✓ supabase/baseline.sql  (${(sql.length / 1024).toFixed(0)} KB)`)
console.log(`    테이블   ${count(/^CREATE TABLE /gm)}`)
console.log(`    함수     ${count(/^CREATE FUNCTION |^CREATE OR REPLACE FUNCTION /gm)}`)
console.log(`    트리거   ${count(/^CREATE TRIGGER /gm)}`)
console.log(`    정책     ${count(/^CREATE POLICY /gm)}`)
console.log('')
console.log('  다음: 빈 Supabase 프로젝트의 SQL Editor 에서 이 파일을 실행한다.')
