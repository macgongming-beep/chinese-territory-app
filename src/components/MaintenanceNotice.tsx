import { useEffect, useState } from 'react'
import { t, type AppLanguage } from '../i18n'
import { fetchMaintenanceNotice, type MaintenanceNotice as Notice } from '../hooks/storeMutations/appSettings'

/**
 * 점검 공지 — 확인 체크박스를 눌러야 닫히는 전면 안내.
 *
 * 왜 이게 필요한가 (anon 쓰기 차단 전환):
 *   전환 뒤에는 **세션 토큰 헤더를 보내지 않는 옛 앱은 쓰기가 전부 실패한다.**
 *   읽기는 그대로 되므로 증상이 "앱이 안 열린다" 가 아니라 "저장이 안 된다" 로
 *   나타난다 — 사용자는 권한 문제나 서버 장애로 오해한다.
 *   그리고 이 앱은 새 서비스워커가 준비돼도 **열린 페이지를 자동으로
 *   새로고침하지 않는다** (lib/pwa.ts 의 onNeedRefresh 는 알림만 한다).
 *
 * ⚠ 여기에 걸린 성질 하나: **이 팝업이 보인다는 것 자체가 새 버전이라는 뜻이다.**
 *   (팝업은 새 빌드에만 들어 있으므로) 그래서 안내가 정확해진다 —
 *   "이 안내를 보셨다면 준비된 것" 이라고 말할 수 있다.
 *
 * 켜고 끄기: 관리자가 app_settings 를 고친다 (배포 없이).
 *   supabase/tools/_점검공지_켜고끄기.sql
 */
export function MaintenanceNotice({ userId, language = 'ko' }: { userId?: number; language?: string }) {
  const lang = (language ?? 'ko') as AppLanguage
  const [notice, setNotice] = useState<Notice | null>(null)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    let alive = true
    void fetchMaintenanceNotice().then((n) => {
      if (!alive || !n) return
      // 이미 확인한 공지는 다시 안 띄운다 (사용자별·공지별)
      try {
        if (localStorage.getItem(seenKey(userId, n.id))) return
      } catch { /* localStorage 를 못 쓰면 그냥 띄운다 */ }
      setNotice(n)
    })
    return () => { alive = false }
  }, [userId])

  if (!notice) return null

  const close = () => {
    try { localStorage.setItem(seenKey(userId, notice.id), '1') } catch { /* 무시 */ }
    setNotice(null)
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed', inset: 0, zIndex: 4000,
        background: 'rgba(26, 26, 24, 0.55)',
        display: 'grid', placeItems: 'center', padding: 20,
      }}
    >
      <div
        style={{
          width: '100%', maxWidth: 420, background: 'var(--surface)',
          borderRadius: 16, padding: 20,
          boxShadow: '0 20px 48px rgba(26, 26, 24, 0.24)',
          letterSpacing: '-0.005em',
        }}
      >
        <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 10 }}>
          {t(lang, 'maintenance.title')}
        </div>

        {/* 관리자가 쓴 본문. 줄바꿈을 살린다 */}
        <div style={{ fontSize: 14.5, lineHeight: 1.62, whiteSpace: 'pre-wrap', color: 'var(--text-2)' }}>
          {notice.message}
        </div>

        <label
          style={{
            display: 'flex', alignItems: 'flex-start', gap: 10, marginTop: 18,
            padding: 12, borderRadius: 12, background: 'var(--gray-50)',
            cursor: 'pointer', fontSize: 14, fontWeight: 600,
          }}
        >
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            style={{ width: 18, height: 18, marginTop: 1, flexShrink: 0 }}
          />
          <span>{t(lang, 'maintenance.confirm')}</span>
        </label>

        <button
          type="button"
          disabled={!checked}
          onClick={close}
          style={{
            width: '100%', marginTop: 14, padding: '13px 0',
            borderRadius: 12, border: 'none', fontSize: 15, fontWeight: 700,
            background: checked ? 'var(--primary-600)' : 'var(--gray-200)',
            color: checked ? '#fff' : 'var(--gray-500)',
            cursor: checked ? 'pointer' : 'not-allowed',
          }}
        >
          {t(lang, 'maintenance.close')}
        </button>
      </div>
    </div>
  )
}

const seenKey = (userId: number | undefined, id: string) =>
  `maintenanceNoticeSeen:${userId ?? 'guest'}:${id}`
