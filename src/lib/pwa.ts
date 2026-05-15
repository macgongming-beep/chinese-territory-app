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
    return _updateAvailable
  }
  // update() 만으로는 새 SW install 완료 보장 안 됨.
  // installing SW 가 있으면 'installed' 상태까지 최대 5초 대기.
  // (onNeedRefresh 가 install 후 비동기 fire → _updateAvailable 가 true 가 됨)
  const installing = _swRegistration.installing
  if (installing && installing.state !== 'installed' && installing.state !== 'activated') {
    await new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, 5000)
      const handler = () => {
        if (installing.state === 'installed' || installing.state === 'activated' || installing.state === 'redundant') {
          clearTimeout(timer)
          installing.removeEventListener('statechange', handler)
          // onNeedRefresh 는 statechange 이후 한 틱 뒤에 fire 될 수 있으므로 작은 여유
          setTimeout(resolve, 100)
        }
      }
      installing.addEventListener('statechange', handler)
    })
  }
  return _updateAvailable
}

/**
 * 새 버전 적용 = 페이지 새로고침.
 * SW 는 skipWaiting + clientsClaim 으로 이미 백그라운드 활성화돼 있고,
 * 페이지는 새로고침 시점에 새 번들을 받음. 그래서 단순 reload 면 충분.
 */
export async function applyUpdate(): Promise<void> {
  try {
    // workbox 의 reload 흐름도 같이 호출 (SKIP_WAITING 메시지 + 자체 reload)
    await updateApp(true)
  } catch (e) {
    console.warn('[PWA] applyUpdate via workbox failed, hard reload:', e)
  }
  // 보장: 어떤 경로든 무조건 새로고침
  window.location.reload()
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
