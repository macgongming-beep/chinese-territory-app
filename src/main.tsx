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

// 모바일 브라우저 자체 확대/축소 방지.
// iOS Safari 계열은 viewport user-scalable=no만으로는 핀치 줌이 남는 경우가 있어
// gesture 이벤트와 두 손가락 touchmove를 함께 막는다.
const preventBrowserZoom = (event: Event) => {
  event.preventDefault()
}

document.addEventListener('gesturestart', preventBrowserZoom, { passive: false })
document.addEventListener('gesturechange', preventBrowserZoom, { passive: false })
document.addEventListener('gestureend', preventBrowserZoom, { passive: false })
document.addEventListener('touchmove', (event) => {
  if (event.touches.length > 1) {
    event.preventDefault()
  }
}, { passive: false })

import { Sentry } from './lib/sentry'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Sentry.ErrorBoundary
      fallback={({ resetError }) => (
        <div style={{ padding: 40, textAlign: 'center' }}>
          <h2 style={{ marginBottom: 10 }}>오류가 발생했습니다</h2>
          <p style={{ color: '#64748b', marginBottom: 20 }}>
            화면을 다시 불러와 주세요. 문제가 계속되면 관리자에게 문의해주세요.
          </p>
          <button
            onClick={() => { resetError(); window.location.reload() }}
            style={{
              padding: '10px 20px', background: '#2563eb', color: '#fff',
              border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700,
            }}
          >새로고침</button>
        </div>
      )}
    >
      <BrowserRouter>
        <App />
        <Analytics />
      </BrowserRouter>
    </Sentry.ErrorBoundary>
  </StrictMode>,
)
