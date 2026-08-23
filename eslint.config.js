import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // dist: 빌드 산출물 / scratch: 일회성 마이그레이션 스크립트 /
  // supabase/functions: Deno 엣지 함수(브라우저용 설정 대상 아님)
  globalIgnores(['dist', 'scratch', 'supabase/functions']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      // _ 접두사 변수/인자/캐치는 "의도적 미사용"으로 허용 (표준 컨벤션)
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
        destructuredArrayIgnorePattern: '^_',
        ignoreRestSiblings: true,
      }],
    },
  },

  // ── 화면이 DB 를 직접 부르지 않는다 ────────────────────────────────
  //
  // 화면 컴포넌트가 supabase 클라이언트를 직접 잡으면 이런 일이 생긴다.
  //   · 같은 쓰기가 화면마다 다르게 실패한다 (어디는 토스트, 어디는 조용히)
  //   · 저장한 뒤 다른 화면이 갱신되지 않는다 (fetchAll 을 안 부르니까)
  //   · 테이블 이름·컬럼이 화면에 흩어져서 스키마를 바꿀 때 다 찾아야 한다
  //
  // 데이터 접근은 hooks/storeMutations 또는 feature api 모듈에 둔다.
  // 아래 allowlist 는 **줄어들기만 해야 한다.** 늘리지 말 것.
  {
    files: ['src/components/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [{
          group: ['**/lib/supabase'],
          message:
            'ﾠ화면에서 supabase 를 직접 부르지 않습니다. ' +
            'hooks/storeMutations 나 feature api 모듈에 함수를 만들어 쓰세요. ' +
            '(왜: 실패 처리가 화면마다 갈리고, 저장 후 다른 화면이 갱신되지 않습니다)',
        }],
      }],
    },
  },
  {
    // ⚠ 옮기기 전의 기존 위반 9개. 새 파일을 여기 추가하지 말 것.
    //   scripts/check-supabase-allowlist.js 가 개수를 지킨다.
    //
    //   파일                        쓰는 것              옮길 곳 / 언제
    //   ─────────────────────────────────────────────────────────────
    //   DataRoundTrip              5개 테이블 다중 쓰기  features/territory/api  ← 3A 1번 (부분 성공 위험)
    //   DesktopDataManagement      app_settings + 정리 RPC  features/admin/api   ← 3A 2번
    //   CommentSection             comments + 실시간     features/comments/api   ← 3A 3번
    //   ChatRoom                   storage (첨부 수명주기) features/chat/api      ← 3A 4번
    //   PhoneSurveyPanel           phone_surveys/buildings/units  features/survey/api ← 3A
    //   MobileUsers                app_settings          features/admin/api      ← 3A
    //   Desktop/MobileProfileSettings  app_users 1회씩   hooks/useAuth           ← 3A (제일 쉬움)
    //   NotificationSettings       푸시 구독             features/push/api       ← 3A
    files: [
      'src/components/ChatRoom.tsx',
      'src/components/CommentSection.tsx',
      'src/components/DataRoundTrip.tsx',
      'src/components/DesktopDataManagement.tsx',
      'src/components/DesktopProfileSettings.tsx',
      'src/components/MobileProfileSettings.tsx',
      'src/components/MobileUsers.tsx',
      'src/components/NotificationSettings.tsx',
      'src/components/PhoneSurveyPanel.tsx',
    ],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
])
