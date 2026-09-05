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
let madeRequest = null
let failedRequest = null
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
  const params = { p_token: userToken, p_name: `${marker}_식당1`, p_address: `${marker} 주소`, p_existing_building_id: null, p_card_id: card.id, p_lat: 37.5, p_lng: 127.1, p_is_chinese: false, p_initial_state: '부재', p_regular_visitor: null, p_building_name: `${marker} 짧은주소` }

  const noSession = await db.rpc('register_restaurant_v2_tx', { ...params, p_token: null })
  check(Boolean(noSession.error), '무세션은 등록하지 못한다')
  const user = await db.rpc('register_restaurant_v2_tx', params)
  check(Boolean(user.error), '일반 사용자는 등록하지 못한다')
  const leader = await db.rpc('register_restaurant_v2_tx', { ...params, p_token: leaderToken })
  check(!leader.error && Boolean(leader.data?.building_id && leader.data?.unit_id), '인도자는 새 상가와 식당을 등록한다', leader.error?.message)
  madeBuilding = leader.data?.building_id ?? null

  const made = await db.from('buildings').select('id,name,address,type,is_restaurant,units(id,number,status,is_chinese,is_restaurant)').eq('id', madeBuilding).single()
  check(made.data?.type === '상가' && made.data?.is_restaurant === true && made.data?.name === `${marker} 짧은주소`, '건물은 짧은 주소 이름의 상가·식당으로 저장된다')
  check(made.data?.units?.[0]?.number === `${marker}_식당1` && made.data?.units?.[0]?.status === '부재' && made.data?.units?.[0]?.is_chinese === false && made.data?.units?.[0]?.is_restaurant === true, '선택한 상태와 중국어 여부로 식당을 저장한다')

  const second = await db.rpc('register_restaurant_v2_tx', { ...params, p_token: leaderToken, p_name: `${marker}_식당2`, p_existing_building_id: madeBuilding, p_is_chinese: true, p_initial_state: '정기방문', p_regular_visitor: `${marker}_leader` })
  check(!second.error && second.data?.building_id === madeBuilding, '기존 상가에 두 번째 식당을 추가한다', second.error?.message)
  const regular = await db.from('units').select('status,is_chinese,regular_visits(visitor_name)').eq('id', second.data?.unit_id).single()
  const regularRow = Array.isArray(regular.data?.regular_visits) ? regular.data.regular_visits[0] : regular.data?.regular_visits
  check(regular.data?.status === '만남' && regular.data?.is_chinese === true && regularRow?.visitor_name === `${marker}_leader`, '정기방문은 만남 상태와 담당자를 함께 저장한다', JSON.stringify(regular.data ?? regular.error))
  const retry = await db.rpc('register_restaurant_v2_tx', { ...params, p_token: leaderToken })
  check(!retry.error && retry.data?.unit_id === leader.data?.unit_id, '중복 탭은 같은 식당을 다시 만들지 않는다', retry.error?.message)
  const historyAfterRetry = await db.from('visit_histories').select('id').eq('unit_id', leader.data?.unit_id).eq('visit_type', 'restaurant')
  check(historyAfterRetry.data?.length === 1, '같은 날 재시도해도 방문기록은 중복되지 않는다')

  const stopRegular = await db.rpc('register_restaurant_v2_tx', {
    ...params, p_token: leaderToken, p_name: `${marker}_식당2`, p_existing_building_id: madeBuilding,
    p_is_chinese: true, p_initial_state: '미방문', p_regular_visitor: null,
  })
  const regularAfterStop = await db.from('regular_visits').select('unit_id').eq('unit_id', second.data?.unit_id)
  check(!stopRegular.error && regularAfterStop.data?.length === 0, '정기방문이 아닌 상태를 고르면 기존 정기방문 지정도 해제된다')

  // 신청 승인: 같은 이름의 일반 세대를 재사용해도 식당 표시와 선택값을 모두 반영해야 한다.
  const approvalName = `${marker}_승인식당`
  const plainUnit = await client(adminToken).from('units').insert({
    building_id: madeBuilding, number: approvalName, status: '확인필요', is_chinese: true, is_restaurant: false,
  }).select('id').single()
  if (plainUnit.error) throw plainUnit.error
  const request = await client(userToken).from('restaurant_requests').insert({
    name: approvalName,
    address: `${marker} 주소`,
    requested_by: `${marker}_user`,
    visited_at: new Date().toISOString(),
    is_chinese: false,
    initial_status: '대상외',
  }).select('id').single()
  if (request.error) throw request.error
  madeRequest = request.data.id
  const approved = await db.rpc('approve_restaurant_request_tx', {
    p_token: adminToken,
    p_request_id: madeRequest,
    p_name: approvalName,
    p_address: `${marker} 주소`,
    p_existing_building_id: madeBuilding,
    p_card_id: null,
    p_lat: 0,
    p_lng: 0,
    p_building_name: `${marker} 짧은주소`,
  })
  check(!approved.error && approved.data?.unit_id === plainUnit.data.id, '승인은 같은 이름의 기존 세대를 재사용한다', approved.error?.message)
  const approvedUnit = await db.from('units').select('id,status,is_chinese,is_restaurant,visit_histories(result,visit_type)').eq('id', plainUnit.data.id).single()
  check(approvedUnit.data?.is_restaurant === true && approvedUnit.data?.is_chinese === false && approvedUnit.data?.status === '대상외', '재사용한 세대에도 식당 표시·상태·중국어 여부를 반영한다')
  check(approvedUnit.data?.visit_histories?.some((v) => v.result === '대상외' && v.visit_type === 'restaurant'), '신청한 방문 결과를 식당 방문기록으로 남긴다')
  const approvedRequest = await db.from('restaurant_requests').select('status,building_id').eq('id', madeRequest).single()
  check(approvedRequest.data?.status === 'approved' && approvedRequest.data?.building_id === madeBuilding, '건물·세대 처리 후에 신청을 승인한다')

  // 동명 세대가 둘이면 임의로 고르지 않고, 신청도 pending 그대로여야 한다.
  const duplicateName = `${marker}_중복`
  const duplicates = await client(adminToken).from('units').insert([
    { building_id: madeBuilding, number: duplicateName, status: '미방문', is_chinese: true, is_restaurant: false },
    { building_id: madeBuilding, number: duplicateName.toUpperCase(), status: '미방문', is_chinese: true, is_restaurant: false },
  ])
  if (duplicates.error) throw duplicates.error
  const pending = await client(userToken).from('restaurant_requests').insert({
    name: duplicateName, address: `${marker} 주소`, requested_by: `${marker}_user`, initial_status: '만남', is_chinese: true,
  }).select('id').single()
  if (pending.error) throw pending.error
  failedRequest = pending.data.id
  const rejectedApproval = await db.rpc('approve_restaurant_request_tx', {
    p_token: adminToken, p_request_id: failedRequest, p_name: duplicateName, p_address: `${marker} 주소`,
    p_existing_building_id: madeBuilding, p_card_id: null, p_lat: 0, p_lng: 0, p_building_name: `${marker} 짧은주소`,
  })
  const stillPending = await db.from('restaurant_requests').select('status,building_id').eq('id', failedRequest).single()
  check(Boolean(rejectedApproval.error) && stillPending.data?.status === 'pending' && stillPending.data?.building_id == null, '중복 세대로 승인이 멈추면 신청도 반쪽 승인되지 않는다')
} finally {
  const adminToken = await login('test-admin', '1234').catch(() => null)
  if (adminToken) {
    const admin = createClient(env.url, env.anonKey, { global: { headers: { 'x-session-token': adminToken } } })
    if (madeRequest) await admin.from('restaurant_requests').delete().eq('id', madeRequest)
    if (failedRequest) await admin.from('restaurant_requests').delete().eq('id', failedRequest)
    if (madeBuilding) await admin.from('buildings').delete().eq('id', madeBuilding)
    if (madeUsers.length) await admin.from('app_users').delete().in('id', madeUsers)
  }
}
console.log(failures ? `\n❌ ${failures}개 실패` : '\n✅ 직접 식당 등록 smoke 통과')
process.exit(failures ? 1 : 0)
