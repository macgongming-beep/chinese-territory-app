import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { BrowserRouter } from 'react-router-dom'
import App from './App.tsx'
import { preloadNaverMapSDK } from './lib/preloadMap'
import './lib/pwa' // Service Worker 등록 (사이드 이펙트만)

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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
