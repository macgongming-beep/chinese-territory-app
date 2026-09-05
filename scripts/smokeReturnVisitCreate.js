#!/usr/bin/env node
// Test DB only: proves linked regular-visit creation, ownership protection,
// first-log atomicity, retry idempotence, and linked-address immutability.
import { createClient } from '@supabase/supabase-js'
import { loadTestEnv } from './testEnvGuard.js'

const env = loadTestEnv()
if (!env.allowWrites) throw new Error('PLAYWRIGHT_ALLOW_WRITES=true is required')

const db = createClient(env.url, env.anonKey)
const marker = `_smoke_return_visit_${Date.now()}`
const madeUsers = []
let madeBuilding = null
let madeLooseVisit = null
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
const client = (token) => createClient(env.url, env.anonKey, {
  global: { headers: { 'x-session-token': token } },
})

try {
  const adminToken = await login('test-admin', '1234')
  const admin = client(adminToken)
  const userLogin = `${marker}_user`
  const userName = `${marker}_사용자`
  const madeUser = await admin.from('app_users').insert({
    login_id: userLogin,
    name: userName,
    pin: '4321',
    role: 'user',
    approval_status: 'approved',
    is_active: true,
  }).select('id').single()
  if (madeUser.error) throw madeUser.error
  madeUsers.push(madeUser.data.id)
  const userToken = await login(userLogin, '4321')
  const user = client(userToken)

  const card = await db.from('cards').select('id').limit(1).single()
  if (card.error || !card.data) throw card.error ?? new Error('test card missing')
  const building = await admin.from('buildings').insert({
    card_id: card.data.id,
    name: `${marker}_건물`,
    address: `${marker} 주소`,
    type: '주택',
    lat: 37.2,
    lng: 127.2,
  }).select('id').single()
  if (building.error) throw building.error
  madeBuilding = building.data.id
  const units = await admin.from('units').insert([
    { building_id: madeBuilding, number: '101', status: '미방문' },
    { building_id: madeBuilding, number: '102', status: '미방문' },
  ]).select('id,number')
  if (units.error || units.data.length !== 2) throw units.error ?? new Error('unit fixture missing')
  const ownUnit = units.data.find((row) => row.number === '101')
  const occupiedUnit = units.data.find((row) => row.number === '102')

  const base = {
    p_token: userToken,
    p_display_name: `${marker}_별명`,
    p_address: '무시되어야 할 주소',
    p_memo: '첫 기록 메모',
    p_first_result: '만남',
    p_unit_id: ownUnit.id,
  }
  const noSession = await db.rpc('create_return_visit_tx', { ...base, p_token: null })
  check(Boolean(noSession.error), '무세션은 정기방문을 만들지 못한다')

  const created = await db.rpc('create_return_visit_tx', base)
  check(!created.error && created.data?.created === true, '기존 세대에 정기방문 두 표를 함께 만든다', created.error?.message)
  const visitId = created.data?.id
  const [regular, visit, logs] = await Promise.all([
    db.from('regular_visits').select('visitor_name').eq('unit_id', ownUnit.id),
    db.from('return_visits').select('id,address,assigned_user_name,last_result,last_visited_at').eq('unit_id', ownUnit.id),
    db.from('return_visit_logs').select('result,memo,created_by').eq('return_visit_id', visitId),
  ])
  check(regular.data?.length === 1 && regular.data[0].visitor_name === userName,
    '세대 정기방문 담당자는 로그인 사용자다')
  check(visit.data?.length === 1 && visit.data[0].address === `${marker} 주소` && visit.data[0].assigned_user_name === userName,
    '활동 정기방문은 건물 주소와 로그인 사용자를 쓴다')
  check(logs.data?.length === 1 && logs.data[0].result === '만남' && logs.data[0].memo === '첫 기록 메모',
    '첫 결과와 메모를 같은 요청에서 남긴다')
  check(visit.data?.[0]?.last_result === '만남' && Boolean(visit.data?.[0]?.last_visited_at),
    '첫 결과가 활동 정기방문 요약에도 반영된다')

  const retried = await db.rpc('create_return_visit_tx', base)
  const retryCounts = await Promise.all([
    db.from('regular_visits').select('id').eq('unit_id', ownUnit.id),
    db.from('return_visits').select('id').eq('unit_id', ownUnit.id),
    db.from('return_visit_logs').select('id').eq('return_visit_id', visitId),
  ])
  check(!retried.error && retried.data?.created === false
    && retryCounts.every((result) => result.data?.length === 1),
  '같은 날 재시도해도 담당·항목·첫 기록이 중복되지 않는다')

  const linkedAddress = await user.from('return_visits')
    .update({ address: '바뀌면 안 되는 주소' }).eq('id', visitId).select('id')
  check(Boolean(linkedAddress.error), '세대에 연결된 주소는 따로 바꾸지 못한다')

  const changedBuildingAddress = `${marker} 고친 건물 주소`
  const buildingAddress = await admin.from('buildings')
    .update({ address: changedBuildingAddress }).eq('id', madeBuilding).select('id')
  const syncedVisit = await db.from('return_visits').select('address').eq('id', visitId).single()
  check(!buildingAddress.error && syncedVisit.data?.address === changedBuildingAddress,
    '건물 주소를 고치면 연결된 정기방문 주소도 같은 트랜잭션에서 맞춘다')

  const occupied = await admin.from('regular_visits').insert({
    unit_id: occupiedUnit.id,
    visitor_name: '다른 담당자',
    registered_at: new Date().toISOString(),
  })
  if (occupied.error) throw occupied.error
  const rejected = await db.rpc('create_return_visit_tx', { ...base, p_unit_id: occupiedUnit.id })
  const partial = await db.from('return_visits').select('id').eq('unit_id', occupiedUnit.id)
  check(Boolean(rejected.error) && partial.data?.length === 0,
    '다른 담당자가 있으면 거부하고 반쪽 활동 항목도 남기지 않는다')

  const loose = await db.rpc('create_return_visit_tx', {
    ...base,
    p_display_name: `${marker}_미연결`,
    p_address: `${marker} 자유 주소`,
    p_memo: '',
    p_first_result: null,
    p_unit_id: null,
  })
  madeLooseVisit = loose.data?.id ?? null
  check(!loose.error && Boolean(madeLooseVisit), '세대에 잇지 않은 기존 흐름도 유지한다', loose.error?.message)
  const looseAddress = await user.from('return_visits')
    .update({ address: `${marker} 고친 주소` }).eq('id', madeLooseVisit).select('address')
  check(looseAddress.data?.[0]?.address === `${marker} 고친 주소`, '미연결 항목은 주소를 고칠 수 있다')
} catch (error) {
  console.error(`❌ smoke 중단 — ${error?.message ?? error}`)
  failures += 1
} finally {
  const adminToken = await login('test-admin', '1234').catch(() => null)
  if (adminToken) {
    const admin = client(adminToken)
    if (madeLooseVisit) await admin.from('return_visits').delete().eq('id', madeLooseVisit)
    if (madeBuilding) await admin.from('buildings').delete().eq('id', madeBuilding)
    if (madeUsers.length) await admin.from('app_users').delete().in('id', madeUsers)
  }
}

console.log(failures ? `\n❌ ${failures}개 실패` : '\n✅ 정기방문 생성 smoke 통과')
process.exit(failures ? 1 : 0)
