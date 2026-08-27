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
    ['filter_notification_recipients', { p_user_ids: [], p_type: 'notice' }],
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

  // 3) 필터 함수가 실제로 걸러내나 (없는 사용자 id)
  const r3 = await rpc('filter_notification_recipients', { p_user_ids: [999999], p_type: 'notice' })
  check('없는 사용자는 걸러진다', Array.isArray(r3.data) && r3.data.length === 0,
    JSON.stringify(r3.data))

  console.log(fail === 0 ? '\n  전부 통과\n' : `\n  ${fail}개 실패\n`)
  process.exit(fail === 0 ? 0 : 1)
}
main()
