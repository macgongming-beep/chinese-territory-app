#!/usr/bin/env node
// comments의 작성자 권한, 고정 칸, 고아 댓글, Realtime을 API 경유로 검증한다.
// 테스트 DB 전용이다.
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
const rpc = (name, body) => rest(`rpc/${name}`, {
  method: 'POST', body: JSON.stringify(body), headers: headers(null, false),
})
const rows = async (response) => {
  const body = await response.json().catch(() => null)
  return Array.isArray(body) ? body : []
}
const login = async (loginId, pin) => {
  const response = await rpc('auth_login', { p_login_id: loginId, p_pin: pin })
  const body = await response.json().catch(() => null)
  return Array.isArray(body) ? body[0] : body
}

let failures = 0
const check = (label, ok, detail = '') => {
  console.log(`${ok ? '✅' : '❌'} ${label}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failures += 1
}

const marker = `_smoke_comment_${Date.now()}`
let adminToken = null
let eventId = null
const userIds = []
const commentIds = []

try {
  const admin = await login('test-admin', '1234')
  adminToken = admin?.token ?? null
  if (!adminToken) throw new Error('테스트 관리자로 로그인하지 못했습니다')

  const eventResponse = await rest('calendar_events?select=id', {
    method: 'POST', body: JSON.stringify({ event_date: '2030-01-01', title: marker }),
  }, adminToken)
  eventId = (await rows(eventResponse))[0]?.id ?? null
  if (!eventId) throw new Error('일정 fixture를 만들지 못했습니다')

  const users = []
  for (const suffix of ['a', 'b']) {
    const loginId = `${marker}_${suffix}`
    const name = `${marker}_name_${suffix}`
    const made = await rest('app_users?select=id,name', {
      method: 'POST',
      body: JSON.stringify({ login_id: loginId, name, pin: '4321', role: 'user', approval_status: 'approved' }),
    }, adminToken)
    const madeRows = await rows(made)
    const id = madeRows[0]?.id ?? null
    if (!id) throw new Error(`사용자 ${suffix} fixture를 만들지 못했습니다`)
    userIds.push(id)
    const token = (await login(loginId, '4321'))?.token ?? null
    if (!token) throw new Error(`사용자 ${suffix} 로그인에 실패했습니다`)
    users.push({ id, name, token })
  }
  const [a, b] = users
  const comment = (author, content = marker) => ({
    target_type: 'calendar_event', target_id: eventId,
    author_id: author.id, author_name: author.name, content,
  })

  const noSession = await rest('comments?select=id', {
    method: 'POST', body: JSON.stringify(comment(a, `${marker}_no_session`)),
  })
  check('무세션 INSERT를 막는다', !noSession.ok, `HTTP ${noSession.status}`)

  const spoofId = await rest('comments?select=id', {
    method: 'POST', body: JSON.stringify(comment(b, `${marker}_spoof_id`)),
  }, a.token)
  check('남의 author_id로 INSERT하지 못한다', !spoofId.ok, `HTTP ${spoofId.status}`)

  const spoofName = await rest('comments?select=id', {
    method: 'POST', body: JSON.stringify({ ...comment(a, `${marker}_spoof_name`), author_name: b.name }),
  }, a.token)
  check('남의 author_name으로 INSERT하지 못한다', !spoofName.ok, `HTTP ${spoofName.status}`)

  const ownInsert = await rest('comments?select=id,content', {
    method: 'POST', body: JSON.stringify(comment(a)),
  }, a.token)
  const ownId = (await rows(ownInsert))[0]?.id ?? null
  if (ownId) commentIds.push(ownId)
  check('본인 댓글 INSERT를 허용한다', ownInsert.ok && Boolean(ownId), `HTTP ${ownInsert.status}`)

  const publicRead = await rest(`comments?id=eq.${ownId}&select=id`)
  check('무세션 공개 SELECT를 유지한다', publicRead.ok && (await rows(publicRead)).length === 1)

  const otherRead = await rest(`comments?id=eq.${ownId}&select=id`, {}, b.token)
  check('다른 사용자도 댓글을 읽을 수 있다', otherRead.ok && (await rows(otherRead)).length === 1)

  const ownUpdate = await rest(`comments?id=eq.${ownId}&select=id,content`, {
    method: 'PATCH', body: JSON.stringify({ content: `${marker}_edited` }),
  }, a.token)
  check('작성자는 내용을 수정할 수 있다', (await rows(ownUpdate))[0]?.content === `${marker}_edited`)

  const otherUpdate = await rest(`comments?id=eq.${ownId}&select=id`, {
    method: 'PATCH', body: JSON.stringify({ content: `${marker}_stolen` }),
  }, b.token)
  check('다른 사용자는 내용을 수정하지 못한다', (await rows(otherUpdate)).length === 0, `HTTP ${otherUpdate.status}`)

  const moveTarget = await rest(`comments?id=eq.${ownId}&select=id`, {
    method: 'PATCH', body: JSON.stringify({ target_id: eventId + 1 }),
  }, a.token)
  check('작성자도 target_id를 바꾸지 못한다', !moveTarget.ok, `HTTP ${moveTarget.status}`)

  const changeType = await rest(`comments?id=eq.${ownId}&select=id`, {
    method: 'PATCH', body: JSON.stringify({ target_type: 'notice' }),
  }, a.token)
  check('작성자도 target_type을 바꾸지 못한다', !changeType.ok, `HTTP ${changeType.status}`)

  const changeAuthorId = await rest(`comments?id=eq.${ownId}&select=id`, {
    method: 'PATCH', body: JSON.stringify({ author_id: b.id }),
  }, adminToken)
  check('관리자도 author_id를 바꾸지 못한다', !changeAuthorId.ok, `HTTP ${changeAuthorId.status}`)

  const renameAuthor = await rest(`comments?id=eq.${ownId}&select=id`, {
    method: 'PATCH', body: JSON.stringify({ author_name: b.name }),
  }, adminToken)
  check('관리자도 author_name을 바꾸지 못한다', !renameAuthor.ok, `HTTP ${renameAuthor.status}`)

  const renamed = `${a.name}_renamed`
  const renameResponse = await rpc('rename_user_name_references', {
    p_token: adminToken, p_old: a.name, p_new: renamed,
  })
  const afterRename = await rows(await rest(`comments?id=eq.${ownId}&select=author_name`, {}, adminToken))
  check('서버의 이름 변경 RPC는 author_name을 옮길 수 있다',
    renameResponse.ok && afterRename[0]?.author_name === renamed, `HTTP ${renameResponse.status}`)

  const ownerHardDelete = await rest(`comments?id=eq.${ownId}&select=id`, {
    method: 'DELETE',
  }, a.token)
  check('작성자는 영구 DELETE하지 못한다', (await rows(ownerHardDelete)).length === 0, `HTTP ${ownerHardDelete.status}`)

  const ownSoftDelete = await rest(`comments?id=eq.${ownId}&select=id,deleted_at`, {
    method: 'PATCH', body: JSON.stringify({ deleted_at: new Date().toISOString() }),
  }, a.token)
  check('작성자는 soft delete할 수 있다', Boolean((await rows(ownSoftDelete))[0]?.deleted_at))

  const orphanInsert = await rest('comments?select=id', {
    method: 'POST', body: JSON.stringify(comment(a, `${marker}_orphan`)),
  }, a.token)
  const orphanId = (await rows(orphanInsert))[0]?.id ?? null
  if (orphanId) commentIds.push(orphanId)
  await rest(`app_users?id=eq.${a.id}&select=id`, { method: 'DELETE' }, adminToken)
  const orphan = await rows(await rest(`comments?id=eq.${orphanId}&select=id,author_id`, {}, adminToken))
  check('사용자 삭제 뒤 과거 댓글은 author_id=null로 남는다', orphan[0]?.author_id === null)

  const orphanOther = await rest(`comments?id=eq.${orphanId}&select=id`, {
    method: 'PATCH', body: JSON.stringify({ deleted_at: new Date().toISOString() }),
  }, b.token)
  check('일반 사용자는 고아 댓글을 수정하지 못한다', (await rows(orphanOther)).length === 0)

  const orphanAdmin = await rest(`comments?id=eq.${orphanId}&select=id,deleted_at`, {
    method: 'PATCH', body: JSON.stringify({ deleted_at: new Date().toISOString() }),
  }, adminToken)
  check('관리자는 고아 댓글을 soft delete할 수 있다', Boolean((await rows(orphanAdmin))[0]?.deleted_at))

  const realtime = createClient(env.url, env.anonKey)
  const realtimeContent = `${marker}_realtime`
  let rtStatus = '(구독 콜백 없음)'
  let rtInsert = '(INSERT 안 함)'
  const got = await new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), 15000)
    realtime.channel(marker)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'comments' }, (payload) => {
        if (payload.new?.content === realtimeContent) {
          clearTimeout(timer)
          resolve(payload.new)
        }
      })
      .subscribe(async (status, error) => {
        if (status !== 'SUBSCRIBED') {
          rtStatus = `${status}${error ? ` · ${error.message ?? error}` : ''}`
          return
        }
        rtStatus = 'SUBSCRIBED'
        await new Promise((ready) => setTimeout(ready, 750))
        const inserted = await rest('comments?select=id', {
          method: 'POST', body: JSON.stringify(comment(b, realtimeContent)),
        }, b.token)
        const id = (await rows(inserted))[0]?.id ?? null
        rtInsert = `HTTP ${inserted.status} · id=${id ?? '없음'}`
        if (id) commentIds.push(id)
      })
  })
  check('헤더 없는 Realtime에서 실제 댓글 INSERT를 받는다', Boolean(got),
    `${rtStatus} · ${rtInsert}`)
  await realtime.removeAllChannels()
} catch (error) {
  console.error(`❌ smoke 중단 — ${error?.message ?? error}`)
  failures += 1
} finally {
  if (adminToken) {
    if (eventId) {
      await rest(`comments?target_type=eq.calendar_event&target_id=eq.${eventId}&select=id`, {
        method: 'DELETE',
      }, adminToken).catch(() => null)
    }
    for (const id of commentIds) await rest(`comments?id=eq.${id}&select=id`, { method: 'DELETE' }, adminToken).catch(() => null)
    if (eventId) await rest(`calendar_events?id=eq.${eventId}&select=id`, { method: 'DELETE' }, adminToken).catch(() => null)
    for (const id of userIds) await rest(`app_users?id=eq.${id}&select=id`, { method: 'DELETE' }, adminToken).catch(() => null)
  }
}

console.log(`\n${failures === 0 ? '✅ comments 권한 smoke 통과' : `❌ ${failures}개 실패`}\n`)
process.exit(failures === 0 ? 0 : 1)
