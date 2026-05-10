import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      strategies: 'injectManifest',
      srcDir: 'src/lib',
      filename: 'sw.ts',
      injectRegister: false, // src/lib/pwa.ts에서 직접 등록
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
