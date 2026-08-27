// 알림 RPC 를 **API 로 실제로** 불러본다 (PostgREST → anon key → RPC).
// SQL Editor 매트릭스가 못 보는 것: 실행권한, 스키마 캐시, 인자 변환,
// 그리고 **호출마다 트랜잭션이 다른** 진짜 환경.
//
// 테스트 DB 에서만 돈다 (scripts/testEnvGuard.js 가 막는다).
import { loadTestEnv } from './testEnvGuard.js'

// 운영 ref 면 여기서 멈춘다
const env = loadTestEnv()
const URL_ = env.url
const KEY = env.anonKey

const rpc = async (name, body) => {
  const r = await fetch(`${URL_}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { apikey: KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return { status: r.status, data: await r.json().catch(() => null) }
}

let fail = 0
const check = (name, ok, detail) => {
  console.log(`  ${ok ? '✅' : '❌'} ${name}${detail ? '  — ' + detail : ''}`)
  if (!ok) fail += 1
}

const main = async () => {
  console.log('\n── API 로 부르는 알림 RPC smoke (호출마다 별도 트랜잭션) ──\n')

  // 1) 함수가 API 에 노출돼 있나 (스키마 캐시 포함)
  const bogus = '00000000-0000-0000-0000-000000000000'
  for (const [fn, args] of [
    ['update_calendar_event_series_tx', { p_token: bogus, p_series_id: bogus, p_from_date: '2026-01-01', p_payload: {}, p_notify: false }],
    ['update_calendar_event_tx', { p_token: bogus, p_event_id: -1, p_payload: {}, p_notify: false }],
    ['create_notice_tx', { p_token: bogus, p_title: 'x', p_content: 'y', p_priority: 'normal', p_notify: false }],
  ]) {
    const r = await rpc(fn, args)
    // 404 면 함수가 없거나 캐시가 안 돌았다는 뜻
    check(`${fn} 이 API 에 있다`, r.status !== 404, `HTTP ${r.status}`)
  }

  // 2) 가짜 토큰은 거부돼야 한다 (권한이 API 경유에서도 도는지)
  const r1 = await rpc('update_calendar_event_series_tx', {
    p_token: bogus, p_series_id: bogus, p_from_date: '2026-01-01', p_payload: { place: 'x' }, p_notify: false,
  })
  check('가짜 토큰은 거부된다', r1.status >= 400 || (r1.data && r1.data.ok === false),
    `HTTP ${r1.status} ${JSON.stringify(r1.data).slice(0, 60)}`)

  const r2 = await rpc('create_notice_tx', {
    p_token: bogus, p_title: '스모크', p_content: 'x', p_priority: 'normal', p_notify: true,
  })
  check('가짜 토큰으로 공지를 못 올린다', r2.status >= 400,
    `HTTP ${r2.status} ${JSON.stringify(r2.data).slice(0, 60)}`)

  // 3) 내부 필터 함수는 밖에서 못 불러야 한다
  const r3 = await rpc('filter_notification_recipients', { p_user_ids: [1], p_type: 'notice' })
  // 401/403 = 권한 없음, 404 = 노출 안 됨. 셋 다 '밖에서 못 부른다' 는 뜻이다.
  check('내부 필터 함수는 anon 에 안 열려 있다', [401, 403, 404].includes(r3.status),
    `HTTP ${r3.status}`)

  // 4) ── 여기부터가 진짜다: 실제 로그인해서 성공 경로를 본다 ──
  const login = await rpc('auth_login', { p_login_id: 'test-admin', p_pin: '1234' })
  const token = Array.isArray(login.data) ? login.data[0]?.token : login.data?.token
  check('테스트 관리자로 로그인된다', Boolean(token),
    token ? '' : `HTTP ${login.status} ${JSON.stringify(login.data).slice(0, 80)}`)
  if (!token) {
    console.log('\n  로그인이 안 되면 아래 성공 경로는 못 본다. seed.test.sql 을 확인할 것.\n')
    process.exit(1)
  }

  // 실제 일정 하나를 만들어 고쳐본다 (끝나면 지운다)
  const rest = async (path, init) => {
    const r = await fetch(`${URL_}/rest/v1/${path}`, {
      ...init,
      headers: { apikey: KEY, 'Content-Type': 'application/json', Prefer: 'return=representation', ...(init?.headers ?? {}) },
    })
    return { status: r.status, data: await r.json().catch(() => null) }
  }
  const future = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10)
  const made = await rest('calendar_events', {
    method: 'POST',
    body: JSON.stringify({ event_date: future, time: '10:00', title: 'SMOKE-일정', type: '봉사', place: '처음', leader_name: '' }),
  })
  const eventId = Array.isArray(made.data) ? made.data[0]?.id : null
  check('시험용 일정을 만들었다', Boolean(eventId), `HTTP ${made.status}`)

  if (eventId) {
    const upd = await rpc('update_calendar_event_tx', {
      p_token: token, p_event_id: eventId, p_payload: { place: '바뀐곳' }, p_notify: false,
    })
    check('진짜 토큰으로 단일 수정이 된다 (알림 안 보냄)',
      upd.status === 200 && upd.data?.ok === true && upd.data?.updated === 1,
      `HTTP ${upd.status} ${JSON.stringify(upd.data)}`)

    const after = await rest(`calendar_events?select=place&id=eq.${eventId}`, {})
    check('DB 에 실제로 반영됐다',
      Array.isArray(after.data) && after.data[0]?.place === '바뀐곳',
      JSON.stringify(after.data))

    await rest(`calendar_events?id=eq.${eventId}`, { method: 'DELETE' })
  }

  console.log(fail === 0 ? '\n  전부 통과\n' : `\n  ${fail}개 실패\n`)
  process.exit(fail === 0 ? 0 : 1)
}
main()
