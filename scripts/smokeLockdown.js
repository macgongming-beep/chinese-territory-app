// anon 쓰기 차단이 **실제로 무는지** HTTP 로 증명한다.
//
// ⚠ 이 smoke 는 최종 전환 SQL 을 **적용한 뒤** 돌린다. 적용 전에 돌리면 전부 실패한다.
// ⚠ 테스트 DB 에서만 돈다 (testEnvGuard 가 막는다).
//
// SQL Editor 의 `set local role anon` 으로는 증명이 안 된다 —
// PostgREST 를 거쳐야 request.headers 가 실제로 실린다.
import { loadTestEnv } from './testEnvGuard.js'
import { createClient } from '@supabase/supabase-js'

const env = loadTestEnv()
if (!env.allowWrites) {
  console.error('\n  ✗ 이 smoke 는 쓴다. npm run smoke:lockdown 으로 실행할 것.\n')
  process.exit(1)
}
const URL_ = env.url
const KEY = env.anonKey

let fail = 0
const check = (name, ok, detail) => {
  console.log(`  ${ok ? '✅' : '❌'} ${name}${detail ? '  — ' + detail : ''}`)
  if (!ok) fail += 1
}
const req = (path, init = {}, token) =>
  fetch(`${URL_}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: KEY, 'Content-Type': 'application/json', Prefer: 'return=representation',
      ...(token ? { 'x-session-token': token } : {}),
      ...(init.headers ?? {}),
    },
  })
const login = async (id, pin) => {
  const r = await fetch(`${URL_}/rest/v1/rpc/auth_login`, {
    method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_login_id: id, p_pin: pin }),
  })
  const d = await r.json().catch(() => null)
  return Array.isArray(d) ? d[0] : d
}
/** 막혔는가. 401/403 뿐 아니라 **0행 반영**도 막힌 것이다 (RLS 는 조용히 0행을 준다) */
const blocked = async (res) => {
  if (res.status === 401 || res.status === 403) return true
  if (!res.ok) return true
  const body = await res.json().catch(() => null)
  return Array.isArray(body) && body.length === 0
}

const main = async () => {
  console.log('\n── anon 쓰기 차단 smoke ──\n')

  const admin = await login('test-admin', '1234')
  if (!admin?.token) { console.error('  ✗ 테스트 관리자로 로그인 못 함'); process.exit(1) }
  console.log('  (관리자 토큰 확보)\n')

  // ═══ ① 헤더 없음 — 쓰기는 전부 막히고 읽기는 살아야 한다 ═══
  console.log('  ① 헤더 없음')
  const noHdrIns = await req('cards', { method: 'POST', body: JSON.stringify({ name: '_smoke_침입', area: 'x' }) })
  check('헤더 없이 카드 INSERT 가 막힌다', await blocked(noHdrIns), `HTTP ${noHdrIns.status}`)

  const noHdrDel = await req('cards?name=eq._smoke_없는거', { method: 'DELETE' })
  check('헤더 없이 DELETE 가 막힌다', await blocked(noHdrDel), `HTTP ${noHdrDel.status}`)

  const noHdrRead = await req('cards?select=id&limit=1')
  check('⚠ 헤더 없어도 **읽기는 된다** (Realtime 이 이것에 달려 있다)',
    noHdrRead.ok, `HTTP ${noHdrRead.status}`)

  // ═══ ② 가짜 토큰 ═══
  console.log('\n  ② 가짜 토큰')
  for (const [label, tok] of [['형식이 이상한', 'not-a-uuid'],
                              ['형식은 맞지만 없는', '00000000-0000-0000-0000-000000000000']]) {
    const r = await req('cards', { method: 'POST', body: JSON.stringify({ name: '_smoke_가짜', area: 'x' }) }, tok)
    check(`${label} 토큰으로 쓰기가 막힌다 (500 예외 아님)`,
      await blocked(r) && r.status !== 500, `HTTP ${r.status}`)
  }

  // ═══ ③ 정상 토큰 — 평범한 쓰기는 되어야 한다 ═══
  console.log('\n  ③ 정상 토큰 (관리자)')
  const ins = await req('cards', { method: 'POST', body: JSON.stringify({ name: '_smoke_정상', area: 'x' }) }, admin.token)
  const created = await ins.json().catch(() => null)
  const cardId = Array.isArray(created) ? created[0]?.id : null
  check('로그인 상태로 카드가 만들어진다', ins.ok && Boolean(cardId), `HTTP ${ins.status}`)

  // ═══ ④ 일반 사용자가 권한을 올릴 수 있나 — 여기가 핵심 ═══
  console.log('\n  ④ 일반 사용자의 권한 상승')
  const LOGIN_ID = '_smoke_user', PIN = '4321'
  await req(`app_users?login_id=eq.${LOGIN_ID}`, { method: 'DELETE' }, admin.token)   // 앞선 실행 잔재
  const mk = await req('app_users', {
    method: 'POST',
    body: JSON.stringify({ login_id: LOGIN_ID, name: '_smoke_일반', pin: PIN, role: 'user', approval_status: 'approved' }),
  }, admin.token)
  const mkBody = await mk.json().catch(() => null)
  const userId = Array.isArray(mkBody) ? mkBody[0]?.id : null
  check('관리자는 사용자를 만들 수 있다', mk.ok && Boolean(userId), `HTTP ${mk.status}`)

  const u = userId ? await login(LOGIN_ID, PIN) : null
  check('그 일반 사용자로 로그인된다', Boolean(u?.token))

  if (u?.token && userId) {
    const esc = await req(`app_users?id=eq.${userId}`, { method: 'PATCH', body: JSON.stringify({ role: 'admin' }) }, u.token)
    check('⚠ 자기 role 을 admin 으로 못 올린다', await blocked(esc), `HTTP ${esc.status}`)

    // **정말 안 바뀌었는지 다시 읽어 확인한다** — HTTP 코드만 믿지 않는다
    const after = await req(`app_users?id=eq.${userId}&select=role`, {}, admin.token)
    const rows = await after.json().catch(() => null)
    check('   다시 읽어도 role 이 user 그대로다', rows?.[0]?.role === 'user', `role=${rows?.[0]?.role}`)

    const appr = await req(`app_users?id=eq.${userId}`, { method: 'PATCH', body: JSON.stringify({ approval_status: 'approved', is_active: true }) }, u.token)
    check('approval_status·is_active 도 직접 못 바꾼다', await blocked(appr), `HTTP ${appr.status}`)

    const other = await req(`app_users?login_id=eq.test-admin`, { method: 'PATCH', body: JSON.stringify({ name: '_smoke_남의이름' }) }, u.token)
    check('남의 계정을 못 고친다', await blocked(other), `HTTP ${other.status}`)

    const mkAdmin = await req('app_users', {
      method: 'POST',
      body: JSON.stringify({ login_id: '_smoke_침입admin', name: '침입', pin: '9999', role: 'admin', approval_status: 'approved' }),
    }, u.token)
    check('⚠ 자기를 admin 으로 한 줄 더 못 만든다', await blocked(mkAdmin), `HTTP ${mkAdmin.status}`)

    const own = await req(`app_users?id=eq.${userId}`, { method: 'PATCH', body: JSON.stringify({ phone: '010-0000-0000' }) }, u.token)
    check('   그래도 자기 전화번호는 고칠 수 있다 (과하게 막지 않았나)', own.ok, `HTTP ${own.status}`)

    const settings = await req('app_settings', { method: 'POST', body: JSON.stringify({ key: '_smoke', value: 'x' }) }, u.token)
    check('app_settings 를 일반 사용자가 못 쓴다', await blocked(settings), `HTTP ${settings.status}`)
  }

  // ═══ ⑤ 관리자는 여전히 할 수 있어야 한다 (과잉 차단 확인) ═══
  console.log('\n  ⑤ 관리자 권한은 살아 있나')
  if (userId) {
    const promote = await req(`app_users?id=eq.${userId}`, { method: 'PATCH', body: JSON.stringify({ role: 'leader' }) }, admin.token)
    check('관리자는 role 을 바꿀 수 있다', promote.ok, `HTTP ${promote.status}`)
  }

  // ═══ ⑥ Realtime — WebSocket 에는 x-session-token 이 **안 붙는다** ═══
  //   그래서 세션 관문을 SELECT 에 걸면 구독이 조용히 끊긴다.
  //   "연결됐다" 만 보면 안 된다 — **실제 변경 이벤트가 도착하는지** 봐야 한다.
  console.log('\n  ⑥ Realtime (헤더 없는 WebSocket)')
  const rt = createClient(URL_, KEY)
  const got = await new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), 15000)
    const ch = rt.channel('_smoke_lockdown')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'cards' }, (p) => {
        if (p.new?.name === '_smoke_realtime') { clearTimeout(timer); resolve(p.new) }
      })
      .subscribe(async (status) => {
        if (status !== 'SUBSCRIBED') return
        await req('cards', { method: 'POST', body: JSON.stringify({ name: '_smoke_realtime', area: 'x' }) }, admin.token)
      })
    void ch
  })
  check('구독이 살아 있고 INSERT 이벤트가 도착한다 (15초 안)', Boolean(got),
    got ? `id=${got.id}` : '⚠ 못 받음 — SELECT 정책이 세션을 요구하고 있지 않은지 볼 것')
  await rt.removeAllChannels()
  if (got?.id) await req(`cards?id=eq.${got.id}`, { method: 'DELETE' }, admin.token)

  // ═══ 뒷정리 ═══
  if (cardId) await req(`cards?id=eq.${cardId}`, { method: 'DELETE' }, admin.token)
  if (userId) await req(`app_users?id=eq.${userId}`, { method: 'DELETE' }, admin.token)
  await req(`app_users?login_id=eq._smoke_침입admin`, { method: 'DELETE' }, admin.token)
  await req(`app_settings?key=eq._smoke`, { method: 'DELETE' }, admin.token)

  const left = await req('cards?name=like._smoke_*&select=id', {}, admin.token)
  const leftRows = await left.json().catch(() => [])
  check('\n  뒷정리 — 남은 _smoke_ 자료 없음', Array.isArray(leftRows) && leftRows.length === 0,
    `${leftRows?.length ?? '?'}건`)

  console.log(`\n  ${fail === 0 ? '✅ 전부 통과' : `❌ ${fail}개 실패`}\n`)
  process.exit(fail === 0 ? 0 : 1)
}
main().catch((e) => { console.error(e); process.exit(1) })
