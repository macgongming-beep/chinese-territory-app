import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { BrowserRouter } from 'react-router-dom'
import App from './App.tsx'
import { preloadNaverMapSDK } from './lib/preloadMap'

// 지도 SDK 미리 로드 (지도 화면 진입 시 즉시 사용 가능)
preloadNaverMapSDK()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
