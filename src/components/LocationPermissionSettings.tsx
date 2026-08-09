import { useEffect, useMemo, useState } from 'react'
import type { AppLanguage } from '../i18n'
import { t, currentLang } from '../i18n'

type LocationPermissionState = PermissionState | 'unsupported' | 'unknown'

const copy = {
  ko: {
    title: '위치 권한',
    desc: '현재 위치 표시와 GPS 이동에 사용합니다.',
    status: '현재 상태',
    granted: '허용됨',
    denied: '거부됨',
    prompt: '확인 필요',
    unsupported: '브라우저에서 관리',
    unknown: '확인 필요',
    request: '위치 권한 요청',
    requesting: '요청 중',
    deniedTitle: '위치 권한이 차단되어 있습니다.',
    deniedDesc: 'Safari 설정 또는 사이트 설정에서 위치 접근을 허용해 주세요.',
    guideTitle: 'iPhone/PWA에서 확인할 곳',
    guideOne: '설정 > Safari > 위치',
    guideTwo: '설정 > 개인정보 보호 및 보안 > 위치 서비스 > Safari 웹사이트',
    androidGuideTitle: 'Android/Chrome에서 확인할 곳',
    androidGuideOne: 'Chrome > 사이트 설정 > 위치',
    androidGuideTwo: '설정 > 앱 > Chrome > 권한 > 위치',
    grantedDesc: '지도에서 현재 위치 표시와 GPS 이동을 사용할 수 있습니다.',
    promptDesc: '아직 위치 권한을 정하지 않았습니다. 아래 버튼으로 다시 요청할 수 있습니다.',
    unsupportedDesc: '이 브라우저는 권한 상태 확인을 지원하지 않습니다. 위치 요청 버튼으로 확인해 주세요.',
    success: t(currentLang(), 'toast.locationPermitted'),
    failed: '위치 정보를 가져오지 못했습니다.',
  },
  zh: {
    title: '位置权限',
    desc: '用于显示当前位置和 GPS 定位。',
    status: '当前状态',
    granted: '已允许',
    denied: '已拒绝',
    prompt: '需要确认',
    unsupported: '在浏览器中管理',
    unknown: '需要确认',
    request: '请求位置权限',
    requesting: '请求中',
    deniedTitle: '位置权限已被阻止。',
    deniedDesc: '请在 Safari 设置或网站设置中允许位置访问。',
    guideTitle: 'iPhone/PWA 设置位置',
    guideOne: '设置 > Safari > 位置',
    guideTwo: '设置 > 隐私与安全性 > 定位服务 > Safari 网站',
    androidGuideTitle: 'Android/Chrome 设置位置',
    androidGuideOne: 'Chrome > 网站设置 > 位置',
    androidGuideTwo: '设置 > 应用 > Chrome > 权限 > 位置',
    grantedDesc: '地图可以使用当前位置显示和 GPS 定位。',
    promptDesc: '尚未决定位置权限。可以用下方按钮再次请求。',
    unsupportedDesc: '此浏览器不支持权限状态检查。请用位置请求按钮确认。',
    success: '位置权限已允许。',
    failed: '无法获取位置信息。',
  },
  en: {
    title: 'Location Permission',
    desc: 'Used for current location and GPS movement.',
    status: 'Current status',
    granted: 'Allowed',
    denied: 'Blocked',
    prompt: 'Needs check',
    unsupported: 'Managed by browser',
    unknown: 'Needs check',
    request: 'Request location permission',
    requesting: 'Requesting',
    deniedTitle: 'Location permission is blocked.',
    deniedDesc: 'Allow location access in Safari or site settings.',
    guideTitle: 'Where to check on iPhone/PWA',
    guideOne: 'Settings > Safari > Location',
    guideTwo: 'Settings > Privacy & Security > Location Services > Safari Websites',
    androidGuideTitle: 'Where to check on Android/Chrome',
    androidGuideOne: 'Chrome > Site settings > Location',
    androidGuideTwo: 'Settings > Apps > Chrome > Permissions > Location',
    grantedDesc: 'The map can show your current location and use GPS movement.',
    promptDesc: 'Location permission has not been decided yet. You can request it again below.',
    unsupportedDesc: 'This browser does not support permission status checks. Use the request button to check.',
    success: 'Location permission is allowed.',
    failed: 'Could not get your location.',
  },
} satisfies Record<AppLanguage, Record<string, string>>

async function queryLocationPermission(): Promise<LocationPermissionState> {
  if (typeof navigator === 'undefined') return 'unknown'
  if (!('permissions' in navigator) || !navigator.permissions?.query) return 'unsupported'

  try {
    const result = await navigator.permissions.query({ name: 'geolocation' as PermissionName })
    return result.state
  } catch {
    return 'unsupported'
  }
}

export function LocationPermissionSettings({ language = 'ko' }: { language?: AppLanguage }) {
  const lang = language ?? 'ko'
  const text = copy[lang]
  const [permission, setPermission] = useState<LocationPermissionState>('unknown')
  const [requesting, setRequesting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    let permissionStatus: PermissionStatus | null = null

    async function load() {
      const next = await queryLocationPermission()
      if (!mounted) return
      setPermission(next)

      if (typeof navigator !== 'undefined' && navigator.permissions?.query) {
        try {
          permissionStatus = await navigator.permissions.query({ name: 'geolocation' as PermissionName })
          permissionStatus.onchange = () => {
            if (mounted) setPermission(permissionStatus?.state ?? 'unknown')
          }
        } catch {
          // Safari/PWA can reject permissions.query for geolocation; request button is the fallback.
        }
      }
    }

    load()
    return () => {
      mounted = false
      if (permissionStatus) permissionStatus.onchange = null
    }
  }, [])

  const statusText = text[permission] ?? text.unknown
  const helpText = useMemo(() => {
    if (permission === 'granted') return text.grantedDesc
    if (permission === 'denied') return text.deniedDesc
    if (permission === 'unsupported') return text.unsupportedDesc
    return text.promptDesc
  }, [permission, text])

  const requestLocation = () => {
    setMessage(null)
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setPermission('unsupported')
      setMessage(text.failed)
      return
    }

    setRequesting(true)
    navigator.geolocation.getCurrentPosition(
      () => {
        setRequesting(false)
        setPermission('granted')
        setMessage(text.success)
      },
      (error) => {
        setRequesting(false)
        if (error.code === error.PERMISSION_DENIED) {
          setPermission('denied')
        }
        setMessage(text.failed)
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 },
    )
  }

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <article style={{
        background: 'var(--surface)',
        border: '1px solid var(--line)',
        borderRadius: 16,
        padding: 16,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'flex-start' }}>
          <div>
            <h3 style={{ margin: 0, color: 'var(--ink)', fontSize: 18, fontWeight: 750, letterSpacing: '-0.02em' }}>
              {text.title}
            </h3>
            <p style={{ margin: '6px 0 0', color: 'var(--muted)', fontSize: 13.5, fontWeight: 500, lineHeight: 1.45 }}>
              {text.desc}
            </p>
          </div>
          <span style={{
            flexShrink: 0,
            borderRadius: 999,
            padding: '6px 10px',
            background: permission === 'granted' ? 'var(--success-50, #ecfdf5)' : permission === 'denied' ? 'var(--danger-50, #fef2f2)' : 'var(--tint)',
            color: permission === 'granted' ? 'var(--success-700, #047857)' : permission === 'denied' ? 'var(--danger-700, #b91c1c)' : 'var(--text)',
            fontSize: 12.5,
            fontWeight: 700,
            whiteSpace: 'nowrap',
          }}>
            {statusText}
          </span>
        </div>

        <div style={{
          marginTop: 16,
          borderRadius: 14,
          border: '1px solid var(--line)',
          background: 'var(--paper)',
          padding: '13px 14px',
        }}>
          <p style={{ margin: 0, color: 'var(--muted)', fontSize: 12.5, fontWeight: 650 }}>{text.status}</p>
          <p style={{ margin: '5px 0 0', color: 'var(--ink)', fontSize: 15, fontWeight: 750 }}>{statusText}</p>
          <p style={{ margin: '7px 0 0', color: 'var(--muted)', fontSize: 13, lineHeight: 1.5, fontWeight: 500 }}>
            {helpText}
          </p>
        </div>

        {permission !== 'granted' && (
          <button
            onClick={requestLocation}
            disabled={requesting}
            type="button"
            style={{
              width: '100%',
              marginTop: 14,
              minHeight: 48,
              border: 'none',
              borderRadius: 12,
              background: 'var(--ink)',
              color: 'var(--surface)',
              fontSize: 15,
              fontWeight: 750,
              cursor: requesting ? 'wait' : 'pointer',
              opacity: requesting ? 0.7 : 1,
            }}
          >
            {requesting ? text.requesting : text.request}
          </button>
        )}

        {message && (
          <p style={{ margin: '10px 0 0', color: 'var(--muted)', fontSize: 12.5, fontWeight: 600 }}>
            {message}
          </p>
        )}
      </article>

      {(permission === 'denied' || permission === 'unsupported') && (
        <article style={{
          background: 'var(--paper)',
          border: '1px solid var(--line)',
          borderRadius: 16,
          padding: 16,
        }}>
          <h4 style={{ margin: 0, color: 'var(--ink)', fontSize: 15, fontWeight: 750 }}>{text.deniedTitle}</h4>
          <p style={{ margin: '6px 0 14px', color: 'var(--muted)', fontSize: 13, lineHeight: 1.5, fontWeight: 500 }}>
            {text.deniedDesc}
          </p>
          <div style={{ display: 'grid', gap: 8 }}>
            <strong style={{ color: 'var(--ink)', fontSize: 13.5 }}>{text.guideTitle}</strong>
            <div style={{ border: '1px solid var(--line)', borderRadius: 12, padding: '10px 12px', color: 'var(--text)', fontSize: 13, fontWeight: 600 }}>
              {text.guideOne}
            </div>
            <div style={{ border: '1px solid var(--line)', borderRadius: 12, padding: '10px 12px', color: 'var(--text)', fontSize: 13, fontWeight: 600 }}>
              {text.guideTwo}
            </div>
            <strong style={{ color: 'var(--ink)', fontSize: 13.5, marginTop: 6 }}>{text.androidGuideTitle}</strong>
            <div style={{ border: '1px solid var(--line)', borderRadius: 12, padding: '10px 12px', color: 'var(--text)', fontSize: 13, fontWeight: 600 }}>
              {text.androidGuideOne}
            </div>
            <div style={{ border: '1px solid var(--line)', borderRadius: 12, padding: '10px 12px', color: 'var(--text)', fontSize: 13, fontWeight: 600 }}>
              {text.androidGuideTwo}
            </div>
          </div>
        </article>
      )}
    </div>
  )
}
