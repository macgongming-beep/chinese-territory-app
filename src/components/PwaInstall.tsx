import { useEffect, useState } from 'react'
import { isPWAInstalled, isMobile, isIOS, isAndroid } from '../lib/pwa'
import {
  isPushSupported,
  isCurrentDeviceSubscribed,
  requestNotificationPermission,
  subscribeToPush,
  unsubscribeFromPush,
} from '../lib/push'
import { useAuth } from '../hooks/useAuth'

const SNOOZE_KEY = 'pwa_install_snoozed_until'
const SNOOZE_DAYS = 7

function isSnoozed(): boolean {
  const until = localStorage.getItem(SNOOZE_KEY)
  if (!until) return false
  return Number(until) > Date.now()
}

function snooze() {
  const until = Date.now() + SNOOZE_DAYS * 24 * 60 * 60 * 1000
  localStorage.setItem(SNOOZE_KEY, String(until))
}

/**
 * 모바일 + PWA 미설치 + 미스누즈 상태에서 5초 후 슬라이드업 배너
 */
export function PwaInstallBanner() {
  const [visible, setVisible] = useState(false)
  const [showModal, setShowModal] = useState(false)

  useEffect(() => {
    if (!isMobile()) return
    if (isPWAInstalled()) return
    if (isSnoozed()) return

    const timer = setTimeout(() => setVisible(true), 5000)
    return () => clearTimeout(timer)
  }, [])

  if (!visible) {
    return showModal ? <PwaInstallModal onClose={() => setShowModal(false)} /> : null
  }

  return (
    <>
      <div
        style={{
          position: 'fixed',
          left: 12,
          right: 12,
          bottom: 84, // 바텀 nav 위
          zIndex: 1000,
          background: '#fff',
          borderRadius: 14,
          boxShadow: '0 8px 32px rgba(0,0,0,0.16)',
          border: '1px solid #e2e8f0',
          padding: 16,
          animation: 'pwaBannerSlideUp 0.3s ease-out',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{
            display: 'grid', width: 40, height: 40, placeItems: 'center',
            borderRadius: 12, background: 'var(--primary-50)', color: 'var(--primary-600)',
            flexShrink: 0,
          }} aria-hidden>
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="7" y="3" width="10" height="18" rx="2" />
              <path d="M11 18h2" />
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#1e293b' }}>
              봉사 알림 받으시려면
            </p>
            <p style={{ margin: '2px 0 0', fontSize: 13, color: '#64748b' }}>
              홈 화면에 추가해주세요
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button
            onClick={() => {
              snooze()
              setVisible(false)
            }}
            style={{
              flex: 1,
              padding: '9px 0',
              borderRadius: 9,
              border: '1px solid #e2e8f0',
              background: '#fff',
              color: '#64748b',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
            type="button"
          >
            나중에
          </button>
          <button
            onClick={() => {
              setVisible(false)
              setShowModal(true)
            }}
            style={{
              flex: 2,
              padding: '9px 0',
              borderRadius: 9,
              border: 'none',
              background: '#2563eb',
              color: '#fff',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
            }}
            type="button"
          >
            설치 안내 보기
          </button>
        </div>
      </div>
      <style>{`
        @keyframes pwaBannerSlideUp {
          from { transform: translateY(120%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </>
  )
}

/**
 * 설치 안내 모달 (iOS/Android 단계별)
 */
export function PwaInstallModal({ onClose }: { onClose: () => void }) {
  const ios = isIOS()
  const android = isAndroid()
  const showBoth = !ios && !android

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2000,
        background: 'rgba(15,23,42,0.55)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 480,
          background: '#fff',
          borderRadius: '20px 20px 0 0',
          padding: '24px 20px 32px',
          maxHeight: '85vh',
          overflowY: 'auto',
          animation: 'pwaModalSlideUp 0.3s ease-out',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#111827' }}>
            앱 설치 안내
          </h2>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#94a3b8', padding: 4 }}
            type="button"
            aria-label="닫기"
          >
            ✕
          </button>
        </div>

        {(ios || showBoth) && (
          <section style={{ marginBottom: showBoth ? 24 : 16 }}>
            <h3 style={{ margin: '0 0 10px', fontSize: 15, fontWeight: 800, color: '#111827' }}>
              iPhone Safari
            </h3>
            <ol style={{ margin: 0, paddingLeft: 20, color: '#475569', fontSize: 14, lineHeight: 1.7 }}>
              <li>하단 가운데 <b>공유 버튼</b> 탭<br/>
                <span style={{ color: '#94a3b8', fontSize: 12 }}>(네모에 위로 화살표 ↑)</span>
              </li>
              <li>스크롤 → <b>"홈 화면에 추가"</b> 선택</li>
              <li>우상단 <b>"추가"</b> 탭</li>
            </ol>
          </section>
        )}

        {(android || showBoth) && (
          <section style={{ marginBottom: 16 }}>
            <h3 style={{ margin: '0 0 10px', fontSize: 15, fontWeight: 800, color: '#111827' }}>
              Android Chrome
            </h3>
            <ol style={{ margin: 0, paddingLeft: 20, color: '#475569', fontSize: 14, lineHeight: 1.7 }}>
              <li>우상단 <b>⋮</b> 메뉴 탭</li>
              <li><b>"홈 화면에 추가"</b> 또는 <b>"앱 설치"</b> 선택</li>
              <li><b>"설치"</b> 탭</li>
            </ol>
          </section>
        )}

        <div style={{ background: '#f8fafc', border: '1px solid #eef1f5', borderRadius: 12, padding: 14, marginTop: 8 }}>
          <p style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 800, color: '#111827' }}>설치하면</p>
          <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: '#475569', lineHeight: 1.7 }}>
            <li>봉사 알림 받기</li>
            <li>빠른 접근 (앱 아이콘)</li>
            <li>자동 로그인 유지</li>
            <li>더 빠른 속도</li>
          </ul>
        </div>

        <button
          onClick={onClose}
          style={{
            width: '100%',
            marginTop: 20,
            padding: '12px 0',
            borderRadius: 10,
            border: 'none',
            background: '#1d4ed8',
            color: '#fff',
            fontSize: 14,
            fontWeight: 800,
            cursor: 'pointer',
          }}
          type="button"
        >
          확인
        </button>
      </div>
      <style>{`
        @keyframes pwaModalSlideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}

/**
 * 설정 페이지에서 보여줄 PWA 상태 + 설치 안내 버튼
 */
export function PwaInstallSection() {
  const { user } = useAuth()
  const [installed, setInstalled] = useState(isPWAInstalled())
  const [showModal, setShowModal] = useState(false)
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | 'unsupported'>(
    typeof Notification !== 'undefined' ? Notification.permission : 'unsupported',
  )
  const [subscribed, setSubscribed] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const interval = setInterval(() => setInstalled(isPWAInstalled()), 3000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    isCurrentDeviceSubscribed().then(setSubscribed)
  }, [notifPermission])

  async function handleEnablePush() {
    if (!user) return
    setBusy(true)
    try {
      // 권한 먼저
      let perm = notifPermission as NotificationPermission
      if (perm !== 'granted') {
        perm = await requestNotificationPermission()
        setNotifPermission(perm)
        if (perm !== 'granted') return
      }
      // 구독 등록
      const result = await subscribeToPush(user.id)
      if (result.ok) {
        setSubscribed(true)
      } else {
        console.warn('[push] subscribe failed:', result.reason)
        alert('알림 등록에 실패했습니다: ' + (result.reason ?? 'unknown'))
      }
    } finally {
      setBusy(false)
    }
  }

  async function handleDisablePush() {
    setBusy(true)
    try {
      await unsubscribeFromPush()
      setSubscribed(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div style={{ background: '#fff', borderRadius: 18, padding: 18, border: '1px solid #e5e7eb', boxShadow: '0 1px 2px rgba(16,24,40,0.04)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <span style={{
            display: 'grid', width: 38, height: 38, placeItems: 'center',
            borderRadius: 12, background: '#f3f4f6', color: '#4b5563',
          }}>
            <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: 20, height: 20, fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }}>
              <rect x="7" y="3" width="10" height="18" rx="2" />
              <path d="M11 18h2" />
            </svg>
          </span>
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#111827', lineHeight: 1.25 }}>
              앱 설치
            </h3>
            <p style={{ margin: '3px 0 0', fontSize: 12, fontWeight: 700, color: '#6b7280' }}>
              홈 화면에서 빠르게 실행
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '11px 0', borderBottom: '1px solid #eef1f5' }}>
          <div>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: '#111827' }}>설치 상태</p>
            <p style={{ margin: '3px 0 0', fontSize: 12, fontWeight: 700, color: '#6b7280' }}>
              {installed ? '홈 화면 앱으로 사용 중' : '브라우저로 사용 중'}
            </p>
          </div>
          <span style={{
            flexShrink: 0, padding: '5px 9px', borderRadius: 999,
            background: installed ? '#ecfdf5' : '#f3f4f6',
            color: installed ? '#047857' : '#6b7280',
            fontSize: 12, fontWeight: 800,
          }}>
            {installed ? '설치됨' : '미설치'}
          </span>
          {!installed && (
            <button
              onClick={() => setShowModal(true)}
              style={{
                padding: '8px 12px',
                borderRadius: 10,
                border: '1px solid #c7d7fe',
                background: '#eff4fe',
                color: '#1d4ed8',
                fontSize: 13,
                fontWeight: 800,
                cursor: 'pointer',
              }}
              type="button"
            >
              설치 안내
            </button>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '11px 0', borderBottom: '1px solid #eef1f5' }}>
          <div>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: '#111827' }}>알림 권한</p>
            <p style={{ margin: '3px 0 0', fontSize: 12, fontWeight: 700, color: '#6b7280' }}>
              {notifPermission === 'granted' && '브라우저 알림 허용됨'}
              {notifPermission === 'denied' && '브라우저 설정에서 허용 필요'}
              {notifPermission === 'default' && '아직 권한을 요청하지 않음'}
              {notifPermission === 'unsupported' && '이 브라우저는 알림 미지원'}
            </p>
          </div>
          <span style={{
            flexShrink: 0, padding: '5px 9px', borderRadius: 999,
            background: notifPermission === 'granted' ? '#ecfdf5' : notifPermission === 'denied' ? '#fef2f2' : '#f3f4f6',
            color: notifPermission === 'granted' ? '#047857' : notifPermission === 'denied' ? '#dc2626' : '#6b7280',
            fontSize: 12, fontWeight: 800,
          }}>
            {notifPermission === 'granted' && '허용'}
            {notifPermission === 'denied' && '거부'}
            {notifPermission === 'default' && '미설정'}
            {notifPermission === 'unsupported' && '미지원'}
          </span>
        </div>

        {/* 푸시 알림 구독 토글 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '11px 0 0' }}>
          <div>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: '#111827' }}>이 기기 푸시 알림</p>
            <p style={{ margin: '3px 0 0', fontSize: 12, fontWeight: 700, color: '#6b7280' }}>
              {!isPushSupported() && '기기에서 푸시 알림 미지원'}
              {isPushSupported() && subscribed && '새 알림을 이 기기로 받는 중'}
              {isPushSupported() && !subscribed && '이 기기 알림 꺼짐'}
            </p>
          </div>
          {isPushSupported() && user && notifPermission !== 'denied' && (
            subscribed ? (
              <button
                onClick={handleDisablePush}
                disabled={busy}
                style={{
                  padding: '8px 12px',
                  borderRadius: 10,
                  border: '1px solid #d8dbe0',
                  background: '#fff',
                  color: '#4b5563',
                  fontSize: 13,
                  fontWeight: 800,
                  cursor: busy ? 'not-allowed' : 'pointer',
                  opacity: busy ? 0.6 : 1,
                }}
                type="button"
              >
                {busy ? '...' : '끄기'}
              </button>
            ) : (
              <button
                onClick={handleEnablePush}
                disabled={busy}
                style={{
                  padding: '8px 12px',
                  borderRadius: 10,
                  border: '1px solid #1d4ed8',
                  background: '#1d4ed8',
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 800,
                  cursor: busy ? 'not-allowed' : 'pointer',
                  opacity: busy ? 0.6 : 1,
                }}
                type="button"
              >
                {busy ? '...' : '켜기'}
              </button>
            )
          )}
          {notifPermission === 'denied' && (
            <span style={{ fontSize: 11, fontWeight: 800, color: '#dc2626' }}>설정 필요</span>
          )}
        </div>

        {!installed && isIOS() && (
          <div style={{ margin: '14px 0 0', padding: '12px 14px', background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 12 }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: '#92400e' }}>
              iPhone 은 푸시 알림 받으려면 필수
            </p>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: '#78350f', lineHeight: 1.5, fontWeight: 600 }}>
              Safari 탭에서는 알림이 안 옵니다.<br />
              위 <strong>설치 안내</strong> 따라 홈 화면에 추가 → 추가된 앱을 열어야 알림 권한을 켤 수 있어요.
            </p>
            <p style={{ margin: '6px 0 0', fontSize: 11, color: '#a16207' }}>
              iOS 16.4 이상에서 동작
            </p>
          </div>
        )}
        {!installed && !isIOS() && (
          <p style={{ margin: '14px 0 0', padding: '10px 12px', background: '#eff4fe', borderRadius: 12, fontSize: 12, fontWeight: 700, color: '#1d4ed8', lineHeight: 1.5 }}>
            홈 화면에 추가하면 봉사 알림, 빠른 접근, 자동 로그인 유지가 더 편해집니다.
          </p>
        )}
        {installed && isIOS() && notifPermission === 'default' && (
          <p style={{ margin: '14px 0 0', padding: '10px 12px', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 12, fontSize: 12, fontWeight: 700, color: '#047857', lineHeight: 1.5 }}>
            설치 완료! 위 <strong>"이 기기 푸시 알림" → 켜기</strong> 버튼으로 알림을 허용해 주세요.
          </p>
        )}
      </div>

      {showModal && <PwaInstallModal onClose={() => setShowModal(false)} />}
    </>
  )
}
