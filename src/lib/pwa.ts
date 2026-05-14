// PWA Service Worker 등록 + 업데이트 감지
import { registerSW } from 'virtual:pwa-register'

let _updateAvailable = false
let _swRegistration: ServiceWorkerRegistration | null = null
const _updateListeners = new Set<() => void>()

export function isUpdateAvailable() {
  return _updateAvailable
}

export function onUpdateAvailable(cb: () => void) {
  _updateListeners.add(cb)
  return () => _updateListeners.delete(cb)
}

/** 수동 업데이트 확인 — 새 SW가 있는지 즉시 검사 */
export async function checkForUpdate(): Promise<boolean> {
  if (!_swRegistration) return false
  try {
    await _swRegistration.update()
  } catch (e) {
    console.warn('[PWA] update check failed:', e)
  }
  return _updateAvailable
}

/** 새 버전 적용 (SKIP_WAITING + reload) */
export async function applyUpdate(): Promise<void> {
  try {
    await updateApp(true)
  } catch (e) {
    console.warn('[PWA] applyUpdate failed, hard reload:', e)
    window.location.reload()
  }
}

export const updateApp = registerSW({
  immediate: true,
  onNeedRefresh() {
    _updateAvailable = true
    _updateListeners.forEach((cb) => cb())
    // 자동 적용하지 않음 — 사용자가 설정에서 버튼으로 적용
  },
  onOfflineReady() {
    console.log('[PWA] Offline ready')
  },
  onRegistered(swRegistration) {
    if (swRegistration) {
      _swRegistration = swRegistration
      console.log('[PWA] Service Worker registered')
      // 주기적으로 업데이트 확인 (30분마다)
      setInterval(() => {
        swRegistration.update().catch(() => {})
      }, 30 * 60 * 1000)
      // 포커스/가시성 변경 시에도 확인 (마지막 체크가 10분 넘었으면)
      let lastCheck = Date.now()
      const onVisible = () => {
        if (document.hidden) return
        if (Date.now() - lastCheck < 10 * 60 * 1000) return
        lastCheck = Date.now()
        swRegistration.update().catch(() => {})
      }
      document.addEventListener('visibilitychange', onVisible)
      window.addEventListener('focus', onVisible)
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
