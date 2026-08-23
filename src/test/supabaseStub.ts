// 테스트에서 진짜 Supabase 로 나가는 길을 막는다.
//
// 이게 없으면 이렇게 된다. vitest 는 .env.local 을 읽는다 — 그건 운영이다.
// 컴포넌트 테스트가 lib/supabase 를 import 하는 순간 80명이 쓰는 DB 로
// 실제 요청이 나간다. 실제로 확인했다: npm test 가 보는 project ref 가
// 운영 ref 와 같았다.
//
// vitest.config.ts 의 alias 가 lib/supabase 를 이 파일로 바꿔친다.
// 그래서 테스트 코드는 아무것도 안 해도 자동으로 보호된다.
//
// 테스트에서 데이터가 필요하면 가짜를 주입할 것. 진짜 클라이언트를 쓰지 않는다.

function block(path: string): never {
  throw new Error(
    `테스트에서 Supabase 를 호출했다: supabase.${path}\n` +
    `\n` +
    `  테스트는 진짜 DB 에 붙지 않는다. .env.local 은 운영을 가리킨다.\n` +
    `  필요한 데이터는 가짜로 주입할 것.\n` +
    `\n` +
    `  (막은 곳: src/test/supabaseStub.ts — vitest.config.ts 의 alias)`
  )
}

/** 어디를 건드리든 던진다. 체이닝(.from(...).select(...))도 첫 단계에서 막힌다. */
function trap(prefix: string): unknown {
  return new Proxy(function () {} as object, {
    get(_t, prop) {
      if (prop === 'then') return undefined            // await 로 잘못 잡히지 않게
      if (typeof prop === 'symbol') return undefined
      return trap(prefix ? `${prefix}.${String(prop)}` : String(prop))
    },
    apply() { block(prefix) },
  })
}

export const supabase = trap('') as never
