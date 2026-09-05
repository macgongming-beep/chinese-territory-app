#!/usr/bin/env node
// Test DB only: proves direct restaurant registration and cleans every fixture.
import { createClient } from '@supabase/supabase-js'
import { loadTestEnv } from './testEnvGuard.js'

const env = loadTestEnv()
if (!env.allowWrites) throw new Error('PLAYWRIGHT_ALLOW_WRITES=true is required')
const db = createClient(env.url, env.anonKey)
const marker = `_smoke_restaurant_${Date.now()}`
const madeUsers = []
let madeBuilding = null
let failures = 0
const check = (ok, label, detail = '') => {
  console.log(`${ok ? '✅' : '❌'} ${label}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failures += 1
}
const login = async (id, pin) => {
  const { data, error } = await db.rpc('auth_login', { p_login_id: id, p_pin: pin })
  if (error) throw error
  return data?.[0]?.token
}

try {
  const adminToken = await login('test-admin', '1234')
  const client = (token) => createClient(env.url, env.anonKey, { global: { headers: { 'x-session-token': token } } })
  for (const role of ['user', 'leader']) {
    const id = `${marker}_${role}`
    const { data, error } = await client(adminToken).from('app_users').insert({ login_id: id, name: id, pin: '4321', role, approval_status: 'approved', is_active: true }).select('id').single()
    if (error) throw error
    madeUsers.push(data.id)
  }
  const [userToken, leaderToken] = await Promise.all([login(`${marker}_user`, '4321'), login(`${marker}_leader`, '4321')])
  const { data: card } = await db.from('cards').select('id').limit(1).single()
  if (!card) throw new Error('test card missing')
  const params = { p_token: userToken, p_name: `${marker}_식당1`, p_address: `${marker} 주소`, p_existing_building_id: null, p_card_id: card.id, p_lat: 37.5, p_lng: 127.1 }

  const noSession = await db.rpc('register_restaurant_tx', { ...params, p_token: null })
  check(Boolean(noSession.error), '무세션은 등록하지 못한다')
  const user = await db.rpc('register_restaurant_tx', params)
  check(Boolean(user.error), '일반 사용자는 등록하지 못한다')
  const leader = await db.rpc('register_restaurant_tx', { ...params, p_token: leaderToken })
  check(!leader.error && Boolean(leader.data?.building_id && leader.data?.unit_id), '인도자는 새 상가와 식당을 등록한다', leader.error?.message)
  madeBuilding = leader.data?.building_id ?? null

  const made = await db.from('buildings').select('id,type,is_restaurant,units(id,number,status,is_restaurant)').eq('id', madeBuilding).single()
  check(made.data?.type === '상가' && made.data?.is_restaurant === true, '건물은 상가·식당으로 저장된다')
  check(made.data?.units?.[0]?.number === `${marker}_식당1` && made.data?.units?.[0]?.status === '미방문' && made.data?.units?.[0]?.is_restaurant === true, '식당은 미방문 세대로 저장된다')

  const second = await db.rpc('register_restaurant_tx', { ...params, p_token: leaderToken, p_name: `${marker}_식당2`, p_existing_building_id: madeBuilding })
  check(!second.error && second.data?.building_id === madeBuilding, '기존 상가에 두 번째 식당을 추가한다', second.error?.message)
  const retry = await db.rpc('register_restaurant_tx', { ...params, p_token: leaderToken })
  check(!retry.error && retry.data?.unit_id === leader.data?.unit_id, '중복 탭은 같은 식당을 다시 만들지 않는다', retry.error?.message)
} finally {
  const adminToken = await login('test-admin', '1234').catch(() => null)
  if (adminToken) {
    const admin = createClient(env.url, env.anonKey, { global: { headers: { 'x-session-token': adminToken } } })
    if (madeBuilding) await admin.from('buildings').delete().eq('id', madeBuilding)
    if (madeUsers.length) await admin.from('app_users').delete().in('id', madeUsers)
  }
}
console.log(failures ? `\n❌ ${failures}개 실패` : '\n✅ 직접 식당 등록 smoke 통과')
process.exit(failures ? 1 : 0)
