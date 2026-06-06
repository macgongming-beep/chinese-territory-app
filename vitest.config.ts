import { defineConfig } from 'vitest/config'

// 빌드용 vite.config.ts 와 분리 — 순수 로직 단위 테스트 전용.
// jsdom 환경: persistence 등 localStorage 의존 테스트 지원.
export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    globals: true,
    clearMocks: true,
  },
})
