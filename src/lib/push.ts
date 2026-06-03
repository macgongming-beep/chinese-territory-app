// 웹 푸시 구독 / 해지 로직
import { supabase } from './supabase'
import { getAuthToken } from './authToken'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined

/** Base64 URL 문자열을 Uint8Array로 변환 (VAPID applicationServerKey용) */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

/** ArrayBuffer → Base64 URL 문자열 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return window.btoa(binary)
}

export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

export async function getNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (typeof Notification === 'undefined') return 'unsupported'
  return Notification.permission
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof Notification === 'undefined') {
    throw new Error('이 브라우저는 알림을 지원하지 않습니다')
  }
  return await Notification.requestPermission()
}

/**
 * 푸시 알림 구독 등록.
 * - Service Worker 등록 후 호출
 * - 알림 권한이 'granted'여야 함
 * - push_subscriptions 테이블에 upsert (endpoint unique)
 */
export async function subscribeToPush(userId: number): Promise<{ ok: boolean; reason?: string }> {
  if (!isPushSupported()) {
    return { ok: false, reason: 'PUSH_UNSUPPORTED' }
  }

  if (!VAPID_PUBLIC_KEY) {
    return { ok: false, reason: 'VAPID_PUBLIC_KEY_MISSING' }
  }

  // 권한 확인
  const permission = await getNotificationPermission()
  if (permission !== 'granted') {
    return { ok: false, reason: 'PERMISSION_NOT_GRANTED' }
  }

  // Service Worker ready 대기
  const registration = await navigator.serviceWorker.ready

  // 기존 구독 확인
  let subscription = await registration.pushManager.getSubscription()

  // VAPID 키가 바뀌었거나 없으면 새로 구독
  if (!subscription) {
    try {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        // 일부 TS lib.dom 정의가 SharedArrayBuffer 까지 포함된 BufferSource를 요구하지만
        // 실제로는 Uint8Array (ArrayBuffer 기반)도 동작 — 안전하게 BufferSource로 캐스팅
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as unknown as BufferSource,
      })
    } catch (err) {
      console.error('[push] subscribe failed:', err)
      return { ok: false, reason: (err as { message?: string })?.message ?? 'SUBSCRIBE_FAILED' }
    }
  }

  // 키 추출
  const p256dhKey = subscription.getKey('p256dh')
  const authKey = subscription.getKey('auth')

  if (!p256dhKey || !authKey) {
    return { ok: false, reason: 'KEYS_MISSING' }
  }

  const token = getAuthToken()
  if (!token) {
    return { ok: false, reason: 'AUTH_TOKEN_MISSING' }
  }

  // RPC로 등록 (서버에서 토큰 검증 + user_id 추출)
  const { error } = await supabase.rpc('upsert_push_subscription', {
    p_token: token,
    p_endpoint: subscription.endpoint,
    p_p256dh: arrayBufferToBase64(p256dhKey),
    p_auth: arrayBufferToBase64(authKey),
    p_device_label: navigator.userAgent.slice(0, 80),
  })

  if (error) {
    console.error('[push] RPC upsert failed:', error)
    return { ok: false, reason: error.message }
  }

  // userId 미사용이지만 시그니처 호환 위해 사용
  void userId
  return { ok: true }
}

/**
 * 구독 해지 (브라우저 알림 끄기 + DB 삭제)
 */
export async function unsubscribeFromPush(): Promise<{ ok: boolean; reason?: string }> {
  if (!isPushSupported()) return { ok: false, reason: 'PUSH_UNSUPPORTED' }

  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.getSubscription()
  if (!subscription) return { ok: true } // 이미 없음

  const endpoint = subscription.endpoint
  await subscription.unsubscribe()

  // DB에서도 삭제 (토큰 기반 RPC)
  const token = getAuthToken()
  if (!token) return { ok: true } // 로그아웃 상태면 브라우저만 해제하고 끝

  const { error } = await supabase.rpc('delete_push_subscription', {
    p_token: token,
    p_endpoint: endpoint,
  })
  if (error) {
    console.error('[push] RPC delete failed:', error)
    return { ok: false, reason: error.message }
  }
  return { ok: true }
}

/** 현재 이 디바이스가 푸시 구독 중인지 확인 */
export async function isCurrentDeviceSubscribed(): Promise<boolean> {
  if (!isPushSupported()) return false
  try {
    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.getSubscription()
    return subscription !== null
  } catch {
    return false
  }
}
