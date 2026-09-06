#!/usr/bin/env node
// Test DB only: existing units are skipped while the rest of a bulk survey is saved.
import { createClient } from '@supabase/supabase-js'
import { loadTestEnv } from './testEnvGuard.js'

const env = loadTestEnv()
if (!env.allowWrites) throw new Error('PLAYWRIGHT_ALLOW_WRITES=true is required')

const db = createClient(env.url, env.anonKey)
const marker = `_smoke_add_units_${Date.now()}`
let buildingId = null
let failures = 0

const check = (ok, label, detail = '') => {
  console.log(`${ok ? '✅' : '❌'} ${label}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failures += 1
}
const login = async () => {
  const { data, error } = await db.rpc('auth_login', { p_login_id: 'test-admin', p_pin: '1234' })
  if (error) throw error
  return data?.[0]?.token
}
const client = (token) => createClient(env.url, env.anonKey, {
  global: { headers: { 'x-session-token': token } },
})

try {
  const token = await login()
  if (!token) throw new Error('테스트 관리자로 로그인하지 못했습니다')
  const admin = client(token)
  const card = await db.from('cards').select('id').limit(1).single()
  if (card.error || !card.data) throw card.error ?? new Error('테스트 카드가 없습니다')
  const building = await admin.from('buildings').insert({
    card_id: card.data.id,
    name: marker,
    address: `${marker} 주소`,
    type: '주택',
    lat: 37.2,
    lng: 127.2,
  }).select('id').single()
  if (building.error) throw building.error
  buildingId = building.data.id

  const fixtures = await admin.from('units').insert([
    { building_id: buildingId, number: '301', status: '대상외' },
    { building_id: buildingId, number: '403호', status: '부재' },
  ])
  if (fixtures.error) throw fixtures.error

  const all = []
  for (let floor = 1; floor <= 5; floor += 1) {
    for (let unit = 1; unit <= 5; unit += 1) all.push(`${floor}${String(unit).padStart(2, '0')}`)
  }
  const bulk = await admin.rpc('add_units_to_building_tx', {
    p_token: token,
    p_building_id: buildingId,
    p_unit_numbers: all,
    p_usage_type: '주택',
  })
  check(!bulk.error && bulk.data?.created_count === 23 && bulk.data?.skipped_count === 2,
    '기존 301·403호는 제외하고 나머지 23개를 추가한다', bulk.error?.message)

  const rows = await db.from('units').select('number,status').eq('building_id', buildingId)
  check(!rows.error && rows.data?.length === 25, '일괄 추가 뒤 건물에는 25개 세대가 있다')
  check(rows.data?.find((row) => row.number === '301')?.status === '대상외'
    && rows.data?.find((row) => row.number === '403호')?.status === '부재',
  '기존 세대의 상태는 바꾸지 않는다')

  const retry = await admin.rpc('add_units_to_building_tx', {
    p_token: token,
    p_building_id: buildingId,
    p_unit_numbers: all,
    p_usage_type: '주택',
  })
  check(!retry.error && retry.data?.created_count === 0 && retry.data?.skipped_count === 25,
    '같은 일괄 요청을 다시 보내도 중복 없이 전부 기존으로 처리한다', retry.error?.message)

  const variant = await admin.from('units').insert({ building_id: buildingId, number: '0301호', status: '미방문' })
  check(Boolean(variant.error), 'DB 제약이 301과 0301호의 직접 중복도 막는다')

  const concurrent = await Promise.all([
    admin.rpc('add_units_to_building_tx', { p_token: token, p_building_id: buildingId, p_unit_numbers: ['601'], p_usage_type: '주택' }),
    admin.rpc('add_units_to_building_tx', { p_token: token, p_building_id: buildingId, p_unit_numbers: ['601호'], p_usage_type: '주택' }),
  ])
  const created = concurrent.reduce((sum, result) => sum + Number(result.data?.created_count ?? 0), 0)
  const skipped = concurrent.reduce((sum, result) => sum + Number(result.data?.skipped_count ?? 0), 0)
  const count = await db.from('units').select('id', { count: 'exact', head: true })
    .eq('building_id', buildingId).in('number', ['601', '601호'])
  check(concurrent.every((result) => !result.error) && created === 1 && skipped === 1 && count.count === 1,
    '동시 요청도 하나는 추가하고 하나는 기존으로 처리한다')
} catch (error) {
  console.error(error)
  failures += 1
} finally {
  if (buildingId != null) await db.from('buildings').delete().eq('id', buildingId)
}

console.log(`\n${failures === 0 ? '✅ 세대 추가 smoke 통과' : `❌ ${failures}개 실패`}\n`)
process.exit(failures === 0 ? 0 : 1)
