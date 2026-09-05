import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      strategies: 'injectManifest',
      srcDir: 'src/lib',
      filename: 'sw.ts',
      injectRegister: false, // src/lib/pwa.ts에서 직접 등록
      includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
      manifest: {
        name: 'Field Map',
        short_name: 'Field Map',
        description: 'Yongin Chinese Territory Field Map',
        theme_color: '#1A1A1A',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        lang: 'ko',
        icons: [
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp}'],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        // ⚠ 예전에는 경로로 desktop/mobile/map 청크를 강제로 갈랐다. 그러면
        // lazy() 경계가 무너져 Vite 가 desktop 청크까지 modulepreload 에 넣고,
        // 폰이 PC 전용 코드를 통째로 받는다 (실측 495KB → 아래 참고).
        // 라이브러리만 묶고 나머지는 import 그래프를 따르게 둔다.
        manualChunks(id) {
          if (id.includes('node_modules')) return 'vendor'
          return undefined
        },
      },
    },
  },
})
