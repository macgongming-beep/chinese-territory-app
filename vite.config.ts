import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
      manifest: {
        name: '중국 구역 봉사 관리',
        short_name: '구역봉사',
        description: '한국 회중 중국인 봉사 관리 도구',
        theme_color: '#2563eb',
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
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp}'],
        // Naver 지도 SDK는 캐시하지 않음 (외부 도메인)
        navigateFallbackDenylist: [/^\/api/, /^\/auth/],
        runtimeCaching: [
          {
            // Supabase API 응답은 NetworkFirst (최신 데이터 우선, 오프라인 시 캐시)
            urlPattern: ({ url }) => url.hostname.includes('supabase.co'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 5, // 5분
              },
              networkTimeoutSeconds: 5,
            },
          },
        ],
      },
      devOptions: {
        enabled: false, // 개발 중엔 비활성화 (캐시 헷갈림 방지)
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) return 'vendor'
          if (
            id.includes('/src/components/MapCanvas') ||
            id.includes('/src/components/DesktopMap') ||
            id.includes('/src/components/MobileMap') ||
            id.includes('/src/utils/mapUtils') ||
            id.includes('/src/lib/preloadMap')
          ) {
            return 'map'
          }
          if (id.includes('/src/components/Desktop')) return 'desktop'
          if (id.includes('/src/components/Mobile')) return 'mobile'
          return undefined
        },
      },
    },
  },
})
