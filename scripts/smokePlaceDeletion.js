#!/usr/bin/env node
// Test DB only. Runs the rollback-only role matrix for deleting or reporting places.
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { KNOWN_TEST_REFS, projectRefOf } from './testEnvGuard.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const envFile = join(root, '.env.test.local')
if (!existsSync(envFile)) throw new Error('.env.test.local 이 없습니다')
const env = Object.fromEntries(readFileSync(envFile, 'utf8').split(/\r?\n/).flatMap((line) => {
  const match = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/)
  return match ? [[match[1], match[2].trim().replace(/^["']|["']$/g, '')]] : []
}))
const ref = projectRefOf(env.VITE_SUPABASE_URL)
if (!ref || !KNOWN_TEST_REFS.includes(ref)) throw new Error('등록된 테스트 프로젝트가 아닙니다')
if (process.env.PLAYWRIGHT_ALLOW_WRITES !== 'true') throw new Error('PLAYWRIGHT_ALLOW_WRITES=true가 필요합니다')
if (!env.SUPABASE_DB_URL) throw new Error('.env.test.local에 SUPABASE_DB_URL이 없습니다')

const url = new URL(env.SUPABASE_DB_URL)
const result = spawnSync('psql', [
  '-X', '-v', 'ON_ERROR_STOP=1',
  '-h', url.hostname, '-p', url.port || '5432',
  '-U', decodeURIComponent(url.username), '-d', url.pathname.slice(1),
  '-f', join(root, 'supabase/tools/_TEST_장소_안전삭제.sql'),
], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, PGPASSWORD: decodeURIComponent(url.password) },
})
if (result.error) throw result.error
process.exit(result.status ?? 1)
