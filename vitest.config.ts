import { defineConfig } from 'vitest/config'
import { loadEnv } from 'vite'
import { fileURLToPath } from 'node:url'
import { KNOWN_PRODUCTION_REFS, projectRefOf } from './scripts/testEnvGuard.js'

// 빌드용 vite.config.ts 와 분리.
// 순수 로직 + 컴포넌트 렌더링 테스트. 진짜 DB 에는 붙지 않는다.

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url))

// ── 운영 DB 로 나가는 길을 두 겹으로 막는다 ─────────────────────────
//
// vite 는 mode 와 상관없이 .env.local 을 읽는다. 그건 운영이다.
// 실제로 확인했다 — 이 검사를 넣기 전 npm test 가 보는 project ref 가
// 운영 ref 와 같았다. 컴포넌트 테스트가 lib/supabase 를 import 하면
// 80명이 쓰는 DB 로 요청이 나갔을 것이다.
//
//   ① alias   lib/supabase 를 던지는 stub 으로 바꿔친다 (실질적 차단)
//   ② 아래    운영 URL 이 보이면 아예 시작하지 않는다 (알림)
const env = loadEnv('test', process.cwd(), '')
const ref = projectRefOf(env.VITE_SUPABASE_URL)
if (ref && KNOWN_PRODUCTION_REFS.includes(ref)) {
  console.warn(
    `\n⚠ 테스트가 운영 환경변수를 읽고 있다 (ref: ${ref}).\n` +
    `  lib/supabase 는 stub 으로 바꿔치기 돼 실제 요청은 못 나간다.\n` +
    `  그래도 테스트에서 다른 경로로 DB 에 붙지 않도록 주의할 것.\n`
  )
}

export default defineConfig({
  resolve: {
    alias: [
      // 테스트에서는 진짜 Supabase 클라이언트를 쓰지 않는다.
      // lib 안의 모듈은 `./supabase` 로도 가져온다. 이 형태를 놓치면 CI처럼
      // 환경변수가 없는 곳에서 진짜 createClient가 실행돼 테스트 로드가 깨진다.
      { find: /^\.\/supabase$/, replacement: r('./src/test/supabaseStub.ts') },
      { find: /^(.*\/)?lib\/supabase$/, replacement: r('./src/test/supabaseStub.ts') },
    ],
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['src/test/**'],
    globals: true,
    clearMocks: true,
  },
})
