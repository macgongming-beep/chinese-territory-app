#!/usr/bin/env node
// 비공식 자료의 DB 행과 Storage 파일은 공개로 읽되 관리자·개발자만 관리한다.
// 테스트 DB 전용이며 testEnvGuard가 운영 DB 쓰기를 막는다.
import { createClient } from '@supabase/supabase-js'
import { loadTestEnv } from './testEnvGuard.js'

const env = loadTestEnv()
if (!env.allowWrites) {
  console.error('✗ 쓰기 가드가 열리지 않았습니다')
  process.exit(1)
}

const headers = (token, prefer = true) => ({
  apikey: env.anonKey,
  'Content-Type': 'application/json',
  ...(prefer ? { Prefer: 'return=representation' } : {}),
  ...(token ? { 'x-session-token': token } : {}),
})
const rest = (path, init = {}, token) => fetch(`${env.url}/rest/v1/${path}`, {
  ...init,
  headers: { ...headers(token), ...(init.headers ?? {}) },
})
const rows = async (response) => {
  const body = await response.json().catch(() => null)
  return Array.isArray(body) ? body : []
}
const login = async (loginId, pin) => {
  const response = await fetch(`${env.url}/rest/v1/rpc/auth_login`, {
    method: 'POST', headers: headers(null, false),
    body: JSON.stringify({ p_login_id: loginId, p_pin: pin }),
  })
  const body = await response.json().catch(() => null)
  return Array.isArray(body) ? body[0] : body
}
const storage = (token) => createClient(env.url, env.anonKey, {
  global: { headers: token ? { 'x-session-token': token } : {} },
  auth: { persistSession: false, autoRefreshToken: false },
}).storage.from('informal-assets')

let failures = 0
const check = (label, ok, detail = '') => {
  console.log(`${ok ? '✅' : '❌'} ${label}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failures += 1
}

const marker = `_smoke_informal_asset_${Date.now()}`
const userIds = []
let developerToken = null
let assetId = null
let storagePath = `${marker}.png`

try {
  developerToken = (await login('test-admin', '1234'))?.token ?? null
  if (!developerToken) throw new Error('테스트 개발자로 로그인하지 못했습니다')

  const actors = []
  for (const role of ['user', 'leader', 'admin']) {
    const loginId = `${marker}_${role}`
    const made = await rest('app_users?select=id', {
      method: 'POST',
      body: JSON.stringify({
        login_id: loginId, name: `${marker}_${role}_name`, pin: '4321', role,
        approval_status: 'approved', is_active: true,
      }),
    }, developerToken)
    const id = (await rows(made))[0]?.id ?? null
    if (!id) throw new Error(`${role} fixture를 만들지 못했습니다`)
    userIds.push(id)
    const token = (await login(loginId, '4321'))?.token ?? null
    if (!token) throw new Error(`${role} fixture로 로그인하지 못했습니다`)
    actors.push({ role, token })
  }
  const adminToken = actors.find((actor) => actor.role === 'admin')?.token ?? null
  if (!adminToken) throw new Error('admin fixture 토큰이 없습니다')

  const asset = {
    name: marker,
    image_url: '',
    image_path: '',
    uploaded_by: 'smoke',
    archived: false,
    lat: 37.2,
    lng: 127.1,
  }

  const noSessionInsert = await rest('informal_assets?select=id', {
    method: 'POST', body: JSON.stringify({ ...asset, name: `${marker}_none` }),
  })
  check('무세션 사용자는 자료를 만들지 못한다', !noSessionInsert.ok, `HTTP ${noSessionInsert.status}`)

  for (const actor of actors.filter(({ role }) => role !== 'admin')) {
    const response = await rest('informal_assets?select=id', {
      method: 'POST', body: JSON.stringify({ ...asset, name: `${marker}_${actor.role}` }),
    }, actor.token)
    check(`${actor.role}는 자료를 만들지 못한다`, !response.ok, `HTTP ${response.status}`)
  }

  const createdResponse = await rest('informal_assets?select=id,name', {
    method: 'POST', body: JSON.stringify(asset),
  }, developerToken)
  const created = (await rows(createdResponse))[0]
  assetId = created?.id ?? null
  check('개발자는 자료를 만든다', createdResponse.ok && Boolean(assetId), `HTTP ${createdResponse.status}`)
  if (!assetId) throw new Error('비공식 자료 fixture를 만들지 못했습니다')

  const publicRead = await rest(`informal_assets?id=eq.${assetId}&select=id,name`)
  check('무세션 공개 읽기를 유지한다', publicRead.ok && (await rows(publicRead)).length === 1,
    `HTTP ${publicRead.status}`)

  for (const actor of actors.filter(({ role }) => role !== 'admin')) {
    const update = await rest(`informal_assets?id=eq.${assetId}&select=id`, {
      method: 'PATCH', body: JSON.stringify({ name: `${marker}_${actor.role}_changed` }),
    }, actor.token)
    check(`${actor.role}는 자료를 수정하지 못한다`, (await rows(update)).length === 0,
      `HTTP ${update.status}`)
    const remove = await rest(`informal_assets?id=eq.${assetId}&select=id`, { method: 'DELETE' }, actor.token)
    check(`${actor.role}는 자료를 직접 삭제하지 못한다`, (await rows(remove)).length === 0,
      `HTTP ${remove.status}`)
  }

  const unchanged = (await rows(await rest(
    `informal_assets?id=eq.${assetId}&select=id,name`, {}, developerToken,
  )))[0]
  check('차단된 요청 뒤 자료는 그대로다', unchanged?.name === marker)

  const updated = await rest(`informal_assets?id=eq.${assetId}&select=id,name`, {
    method: 'PATCH', body: JSON.stringify({ name: `${marker}_admin` }),
  }, adminToken)
  check('관리자는 자료를 수정한다', (await rows(updated))[0]?.name === `${marker}_admin`,
    `HTTP ${updated.status}`)

  const userToken = actors.find((actor) => actor.role === 'user')?.token
  const deniedRpc = await rest('rpc/delete_informal_asset_secure', {
    method: 'POST', body: JSON.stringify({ p_token: userToken, p_asset_id: assetId }),
  }, userToken)
  check('일반 사용자는 삭제 RPC를 통과하지 못한다', !deniedRpc.ok, `HTTP ${deniedRpc.status}`)

  const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])
  const noSessionUpload = await storage(null).upload(`${marker}_none.png`, bytes, { contentType: 'image/png' })
  check('무세션 사용자는 Storage에 올리지 못한다', Boolean(noSessionUpload.error))
  for (const actor of actors.filter(({ role }) => role !== 'admin')) {
    const uploaded = await storage(actor.token).upload(`${marker}_${actor.role}.png`, bytes, { contentType: 'image/png' })
    check(`${actor.role}는 Storage에 올리지 못한다`, Boolean(uploaded.error))
  }

  const uploaded = await storage(developerToken).upload(storagePath, bytes, { contentType: 'image/png' })
  check('개발자는 Storage에 올린다', !uploaded.error, uploaded.error?.message ?? '')
  if (uploaded.error) throw uploaded.error
  const publicObject = await fetch(`${env.url}/storage/v1/object/public/informal-assets/${storagePath}`)
  check('Storage 공개 읽기를 유지한다', publicObject.ok, `HTTP ${publicObject.status}`)
  const replaced = await storage(adminToken).update(storagePath, bytes, { contentType: 'image/png' })
  check('관리자는 Storage 파일을 수정한다', !replaced.error, replaced.error?.message ?? '')
  const removedObject = await storage(developerToken).remove([storagePath])
  check('개발자는 Storage 파일을 삭제한다', !removedObject.error, removedObject.error?.message ?? '')
  if (!removedObject.error) storagePath = ''

  const removed = await rest('rpc/delete_informal_asset_secure', {
    method: 'POST', body: JSON.stringify({ p_token: developerToken, p_asset_id: assetId }),
  }, developerToken)
  const removedBody = await removed.json().catch(() => null)
  check('개발자는 삭제 RPC로 자료를 삭제한다', removed.ok && removedBody === true, `HTTP ${removed.status}`)
  if (removed.ok && removedBody === true) assetId = null
} catch (error) {
  console.error(`❌ smoke 중단 — ${error?.message ?? error}`)
  failures += 1
} finally {
  if (developerToken) {
    await storage(developerToken).remove([
      storagePath,
      `${marker}_none.png`,
      `${marker}_user.png`,
      `${marker}_leader.png`,
    ].filter(Boolean)).catch(() => null)
    await rest(`informal_assets?name=like.${marker}*&select=id`, { method: 'DELETE' }, developerToken).catch(() => null)
    for (const id of userIds) {
      await rest(`app_users?id=eq.${id}&select=id`, { method: 'DELETE' }, developerToken).catch(() => null)
    }
  }
}

console.log(`\n${failures === 0 ? '✅ informal_assets 권한 smoke 통과' : `❌ ${failures}개 실패`}\n`)
process.exit(failures === 0 ? 0 : 1)
