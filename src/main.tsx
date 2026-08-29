import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { BrowserRouter } from 'react-router-dom'
import App from './App.tsx'
import { Analytics } from '@vercel/analytics/react'
import { preloadNaverMapSDK } from './lib/preloadMap'
import { initSentry } from './lib/sentry'
import './lib/pwa' // Service Worker 등록 (사이드 이펙트만)

// Sentry 가장 먼저 (이후 발생하는 모든 에러 캐치)
initSentry()

// 지도 SDK 미리 로드 (지도 화면 진입 시 즉시 사용 가능)
preloadNaverMapSDK()

// ⚠ 예전에는 여기서 핀치 확대를 막았다 (gesture 이벤트 + 두 손가락 touchmove).
//   viewport 의 user-scalable=no 와 합쳐 **글씨를 키울 방법을 완전히 없앴다.**
//   "너무 작아서 안 보인다" 는 분들이 실제로 계셨다 — 그분들에게는 앱을 못 쓰는 것과 같다.
//
//   확대는 접근성 기본값이다. 다시 막지 않는다.
//   지도에서 핀치가 지도 확대와 겹치면 **지도 컨테이너 안에서** 풀 것 —
//   전역으로 다시 막으면 같은 문제로 돌아온다.

import { Sentry } from './lib/sentry'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Sentry.ErrorBoundary
      fallback={({ resetError, error }) => {
        // PWA 캐시 깨짐 (배포 후 옛 bundle hash 가 존재 안 함) 의심 신호
        const errMessage = String((error as Error)?.message ?? '')
        const isChunkError = /Failed to fetch dynamically imported module|ChunkLoadError|Loading chunk/.test(errMessage)

        const hardReload = async () => {
          try {
            if ('caches' in window) {
              const keys = await caches.keys()
              await Promise.all(keys.map((k) => caches.delete(k)))
            }
            if ('serviceWorker' in navigator) {
              const regs = await navigator.serviceWorker.getRegistrations()
              await Promise.all(regs.map((r) => r.unregister()))
            }
          } catch { /* ignore */ }
          resetError()
          // 캐시 우회 새로고침
          window.location.href = `${window.location.pathname}?_r=${Date.now()}`
        }

        return (
          <div
            style={{
              minHeight: '100vh',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '40px 24px',
              textAlign: 'center',
              background: 'var(--bg, #F8F8F7)',
              fontFamily: 'Pretendard Variable, Pretendard, -apple-system, BlinkMacSystemFont, sans-serif',
            }}
          >
            <h2 style={{
              margin: '0 0 8px', fontSize: 20, fontWeight: 700,
              color: 'var(--ink, #1A1A18)', letterSpacing: '-0.01em',
            }}>
              {isChunkError ? '새 버전이 배포되었어요' : '오류가 발생했습니다'}
            </h2>
            <p style={{
              margin: '0 0 24px', fontSize: 14, fontWeight: 400,
              color: 'var(--muted, #7A7A75)', lineHeight: 1.55,
              maxWidth: 320,
            }}>
              {isChunkError
                ? '아래 버튼으로 앱을 새로고침 해주세요. 잠시면 끝납니다.'
                : '화면을 다시 불러와 주세요. 문제가 계속되면 관리자에게 문의해주세요.'}
            </p>
            <button
              onClick={isChunkError ? hardReload : () => { resetError(); window.location.reload() }}
              style={{
                height: 44, minHeight: 44, padding: '0 22px',
                background: 'var(--ink, #1A1A18)', color: '#fff',
                border: 'none', borderRadius: 8,
                fontSize: 14, fontWeight: 600,
                cursor: 'pointer', letterSpacing: '-0.005em',
              }}
            >
              {isChunkError ? '앱 새로고침' : '새로고침'}
            </button>
          </div>
        )
      }}
    >
      <BrowserRouter>
        <App />
        <Analytics />
      </BrowserRouter>
    </Sentry.ErrorBoundary>
  </StrictMode>,
)
