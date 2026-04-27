import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
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
