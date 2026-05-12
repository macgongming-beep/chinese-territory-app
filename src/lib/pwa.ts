// PWA Service Worker 등록 + 업데이트 감지
import { registerSW } from 'virtual:pwa-register'

let _updateAvailable = false
const _updateListeners = new Set<() => void>()

export function isUpdateAvailable() {
  return _updateAvailable
}

export function onUpdateAvailable(cb: () => void) {
  _updateListeners.add(cb)
  return () => _updateListeners.delete(cb)
}

export const updateApp = registerSW({
  immediate: true,
  onNeedRefresh() {
    _updateAvailable = true
    _updateListeners.forEach((cb) => cb())
    setTimeout(() => {
      void updateApp(true)
    }, 0)
  },
  onOfflineReady() {
    // 오프라인 준비 완료 - 별도 안내 X (조용히)
    console.log('[PWA] Offline ready')
  },
  onRegistered(swRegistration) {
    if (swRegistration) {
      console.log('[PWA] Service Worker registered')
    }
  },
  onRegisterError(error) {
    console.error('[PWA] Service Worker registration failed:', error)
  },
})

/** PWA로 설치되어 실행 중인지 (홈화면에 추가 후 실행) */
export function isPWAInstalled(): boolean {
  // standalone display mode
  if (window.matchMedia('(display-mode: standalone)').matches) return true
  // iOS Safari
  if ((window.navigator as any).standalone === true) return true
  return false
}

/** 모바일 디바이스 여부 */
export function isMobile(): boolean {
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
}

/** iOS Safari 여부 */
export function isIOS(): boolean {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent)
}

/** Android 여부 */
export function isAndroid(): boolean {
  return /Android/i.test(navigator.userAgent)
}

/**
 * Service Worker → 클라이언트 navigate 메시지 수신
 * (푸시 알림 클릭 시 SW가 postMessage('NAVIGATE')로 알려줌)
 */
if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (event) => {
    const data = event.data
    if (data && data.type === 'NAVIGATE' && typeof data.link === 'string') {
      // SPA 라우팅 (history API)
      window.history.pushState({}, '', data.link)
      window.dispatchEvent(new PopStateEvent('popstate'))
    }
  })
}
