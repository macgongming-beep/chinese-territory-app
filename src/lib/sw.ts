/// <reference lib="webworker" />
// Custom Service Worker (vite-plugin-pwa injectManifest 모드)
// - precache: workbox로 빌드 자산 자동 캐싱
// - runtime: Supabase API NetworkFirst
// - push: 알림 표시 + 클릭 시 해당 링크로 이동
// - 알림 묶음 처리 (5분 윈도우, tag 기반)

import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching'
import { registerRoute, NavigationRoute } from 'workbox-routing'
import { NetworkFirst } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'

declare const self: ServiceWorkerGlobalScope

// ─── Precache (자동 생성된 매니페스트) ─────────────────────
precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

// SPA 라우팅: index.html로 폴백
registerRoute(new NavigationRoute(
  async () => {
    const cache = await caches.open('workbox-precache-v2-https://example/')
    const response = await cache.match('/index.html')
    return response ?? fetch('/index.html')
  },
  {
    denylist: [/^\/api/, /^\/auth/, /\/sw\.js/, /\/manifest\.webmanifest/],
  }
))

// Supabase API: NetworkFirst (오프라인 폴백)
registerRoute(
  ({ url }) => url.hostname.includes('supabase.co'),
  new NetworkFirst({
    cacheName: 'supabase-cache',
    networkTimeoutSeconds: 5,
    plugins: [
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 60 * 5, // 5분
      }),
    ],
  })
)

// ─── Push 이벤트 ───────────────────────────────────────────
interface PushPayload {
  title: string
  body?: string
  link?: string
  type?: string
  related_id?: number
  timestamp?: number
}

self.addEventListener('push', (event: PushEvent) => {
  if (!event.data) return

  let payload: PushPayload
  try {
    payload = event.data.json() as PushPayload
  } catch {
    payload = { title: '알림', body: event.data.text() }
  }

  // 알림 묶음 처리: 같은 type + related_id면 같은 tag → 새 알림이 기존 것 대체
  // (Service Worker spec: 같은 tag로 새 알림 표시 시 기존 알림 자동 갱신)
  const tag = `${payload.type ?? 'default'}-${payload.related_id ?? 'na'}`

  // renotify는 표준 NotificationOptions 타입에 없지만 실제 브라우저는 지원
  // (같은 tag로 새 알림 표시 시 진동/소리 다시 울리지 않음 = 묶음 효과)
  const options = {
    body: payload.body ?? '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag,
    renotify: false,
    data: {
      link: payload.link ?? '/',
      type: payload.type,
      related_id: payload.related_id,
      timestamp: payload.timestamp ?? Date.now(),
    },
    requireInteraction: false,
  } as NotificationOptions & { renotify?: boolean }

  event.waitUntil(
    self.registration.showNotification(payload.title, options)
  )
})

// ─── Notification click ─────────────────────────────────
self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close()
  const link = (event.notification.data as { link?: string })?.link ?? '/'

  event.waitUntil(
    (async () => {
      // 이미 열린 탭 찾기
      const clientsList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const client of clientsList) {
        // 같은 origin이면 그쪽에 메시지 전달 + focus
        try {
          const url = new URL(client.url)
          const targetUrl = new URL(link, self.location.origin)
          if (url.origin === targetUrl.origin) {
            await client.focus()
            client.postMessage({ type: 'NAVIGATE', link })
            return
          }
        } catch {
          // 무시
        }
      }
      // 열린 탭 없으면 새로 열기
      await self.clients.openWindow(link)
    })()
  )
})

// ─── Skip waiting (즉시 활성화) ──────────────────────────
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})
