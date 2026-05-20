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
          background: 'var(--surface)',
          borderRadius: 14,
          boxShadow: '0 12px 32px rgba(26, 26, 24, 0.10)',
          border: '1px solid var(--line)',
          padding: 14,
          animation: 'pwaBannerSlideUp 0.3s ease-out',
          letterSpacing: '-0.005em',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div
            style={{
              display: 'grid', width: 40, height: 40, placeItems: 'center',
              borderRadius: 10, background: 'var(--tint)', color: 'var(--ink)',
              flexShrink: 0,
            }}
            aria-hidden
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <rect x="7" y="3" width="10" height="18" rx="2" />
              <path d="M11 18h2" />
            </svg>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.005em' }}>
              봉사 알림 받으시려면
            </p>
            <p style={{ margin: '2px 0 0', fontSize: 13, fontWeight: 500, color: 'var(--muted)', letterSpacing: '-0.005em' }}>
              홈 화면에 추가해주세요
            </p>
          </div>
          <button
            onClick={() => {
              snooze()
              setVisible(false)
            }}
            type="button"
            aria-label="닫기"
            style={{
              width: 28, height: 28, minHeight: 28,
              display: 'grid', placeItems: 'center',
              padding: 0,
              background: 'transparent',
              border: 'none',
              borderRadius: 8,
              color: 'var(--muted-2)',
              fontSize: 18, lineHeight: 1,
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >×</button>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button
            onClick={() => {
              snooze()
              setVisible(false)
            }}
            style={{
              flex: 1,
              height: 36,
              borderRadius: 8,
              border: '1px solid var(--line-2)',
              background: 'var(--surface)',
              color: 'var(--text)',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              letterSpacing: '-0.005em',
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
              height: 36,
              borderRadius: 8,
              border: '1px solid var(--ink)',
              background: 'var(--ink)',
              color: '#fff',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              letterSpacing: '-0.005em',
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
        background: 'rgba(26,26,24,0.34)',
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
          background: 'var(--bg)',
          borderRadius: '18px 18px 0 0',
          padding: '8px 16px max(20px, env(safe-area-inset-bottom))',
          maxHeight: '85vh',
          overflowY: 'auto',
          animation: 'pwaModalSlideUp 0.3s ease-out',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ width: 32, height: 4, borderRadius: 99, background: 'var(--line-2)', margin: '4px auto 14px' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.015em' }}>
            홈 화면에 설치
          </h2>
          <button
            onClick={onClose}
            style={{
              width: 36, height: 36, minHeight: 36,
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text)', fontSize: 20,
            }}
            type="button"
            aria-label="닫기"
          >
            ✕
          </button>
        </div>

        {(ios || showBoth) && (
          <section style={{
            marginBottom: showBoth ? 12 : 12,
            padding: '14px 16px',
            background: 'var(--surface)',
            border: '1px solid var(--line)',
            borderRadius: 12,
          }}>
            <h3 style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>
              iPhone Safari
            </h3>
            <ol style={{ margin: 0, paddingLeft: 20, color: 'var(--text)', fontSize: 14, lineHeight: 1.7 }}>
              <li>하단 가운데 <b>공유 버튼</b> 탭<br/>
                <span style={{ color: 'var(--muted)', fontSize: 12 }}>(네모에 위로 화살표 ↑)</span>
              </li>
              <li>스크롤 → <b>"홈 화면에 추가"</b> 선택</li>
              <li>우상단 <b>"추가"</b> 탭</li>
            </ol>
          </section>
        )}

        {(android || showBoth) && (
          <section style={{
            marginBottom: 12,
            padding: '14px 16px',
            background: 'var(--surface)',
            border: '1px solid var(--line)',
            borderRadius: 12,
          }}>
            <h3 style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>
              Android Chrome
            </h3>
            <ol style={{ margin: 0, paddingLeft: 20, color: 'var(--text)', fontSize: 14, lineHeight: 1.7 }}>
              <li>우상단 <b>⋮</b> 메뉴 탭</li>
              <li><b>"홈 화면에 추가"</b> 또는 <b>"앱 설치"</b> 선택</li>
              <li><b>"설치"</b> 탭</li>
            </ol>
          </section>
        )}

        <div style={{ background: 'var(--paper)', borderRadius: 10, padding: '12px 14px', marginTop: 4 }}>
          <p style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>설치하면</p>
          <ul style={{ margin: 0, paddingLeft: 20, fontSize: 12.5, color: 'var(--text)', lineHeight: 1.6 }}>
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
            marginTop: 16,
            height: 48,
            minHeight: 48,
            borderRadius: 8,
            border: 'none',
            background: 'var(--ink)',
            color: '#fff',
            fontSize: 15,
            fontWeight: 600,
            cursor: 'pointer',
            letterSpacing: '-0.005em',
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

  const pushOn = isPushSupported() && subscribed
  const installSub = installed ? '홈 화면 앱으로 사용 중' : '알림을 받으려면 PWA 설치 필요'
  const pushSub =
    !isPushSupported() ? '기기에서 푸시 알림 미지원'
    : notifPermission === 'denied' ? '브라우저 설정에서 허용 필요'
    : pushOn ? '이 기기 알림 켜짐'
    : '이 기기 알림 꺼짐'

  return (
    <>
      {/* ── 이 기기 섹션 헤더 ──────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '0 4px', marginBottom: 10 }}>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.01em' }}>이 기기</h2>
      </div>

      {/* ── 홈 화면에 설치 카드 ───────────── */}
      <div style={{
        padding: '12px 16px', marginBottom: 8,
        background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>홈 화면에 설치</span>
            <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>{installSub}</span>
          </div>
          {installed ? (
            <span style={{
              flexShrink: 0, padding: '3px 9px', borderRadius: 999,
              background: 'var(--status-ok-bg)', color: 'var(--status-ok)',
              fontSize: 11.5, fontWeight: 600,
            }}>
              설치됨
            </span>
          ) : (
            <button
              onClick={() => setShowModal(true)}
              type="button"
              style={{
                height: 32, minHeight: 32, padding: '0 12px',
                border: '1px solid var(--line-2)', borderRadius: 8,
                background: 'var(--surface)', color: 'var(--text)',
                fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}
            >
              안내
            </button>
          )}
        </div>
      </div>

      {/* ── 푸시 알림 카드 ───────────────── */}
      <div style={{
        padding: '12px 16px', marginBottom: 8,
        background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>푸시 알림</span>
            <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>{pushSub}</span>
          </div>
          {isPushSupported() && user && notifPermission !== 'denied' && (
            pushOn ? (
              <button
                onClick={handleDisablePush}
                disabled={busy}
                type="button"
                style={{
                  height: 32, minHeight: 32, padding: '0 12px',
                  border: '1px solid var(--line-2)', borderRadius: 8,
                  background: 'var(--surface)', color: 'var(--text)',
                  fontSize: 13, fontWeight: 600,
                  cursor: busy ? 'wait' : 'pointer',
                  opacity: busy ? 0.6 : 1,
                }}
              >
                {busy ? '...' : '끄기'}
              </button>
            ) : (
              <button
                onClick={handleEnablePush}
                disabled={busy}
                type="button"
                style={{
                  height: 32, minHeight: 32, padding: '0 12px',
                  border: 'none', borderRadius: 8,
                  background: busy ? 'var(--tint)' : 'var(--ink)',
                  color: busy ? 'var(--muted-2)' : '#fff',
                  fontSize: 13, fontWeight: 600,
                  cursor: busy ? 'wait' : 'pointer',
                  letterSpacing: '-0.005em',
                }}
              >
                {busy ? '...' : '켜기'}
              </button>
            )
          )}
          {notifPermission === 'denied' && (
            <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--status-danger)' }}>설정 필요</span>
          )}
        </div>
      </div>

      {showModal && <PwaInstallModal onClose={() => setShowModal(false)} />}
    </>
  )
}
