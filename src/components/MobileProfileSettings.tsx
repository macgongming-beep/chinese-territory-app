import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { AuthUser, LoginLogRecord } from '../hooks/useAuth'
import type { Role } from '../types'
import { roleLabels } from '../types'
import { alertDialog } from '../lib/confirm'
import { supabase } from '../lib/supabase'
import { t, type AppLanguage } from '../i18n'
import { AppHeader } from './AppHeader'

export function MobileProfileSettings({
  user,
  language = 'ko',
  onChangePin,
  onUpdateProfile,
  onFetchLoginLogs,
}: {
  user: AuthUser
  language?: AppLanguage
  onChangePin: (newPin: string) => Promise<boolean>
  onUpdateProfile: (input: { name: string; phone?: string | null }) => Promise<boolean>
  onFetchLoginLogs?: (limit?: number) => Promise<LoginLogRecord[]>
}) {
  const navigate = useNavigate()
  const [name, setName] = useState(user.name)
  const [phone, setPhone] = useState(user.phone ?? '')
  const [newPin, setNewPin] = useState('')
  const [newPinConfirm, setNewPinConfirm] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)
  const [savingPin, setSavingPin] = useState(false)
  const [loginLogs, setLoginLogs] = useState<LoginLogRecord[]>([])
  const [loadingLoginLogs, setLoadingLoginLogs] = useState(false)
  const [loginLogsExpanded, setLoginLogsExpanded] = useState(false)
  const [groupName, setGroupName] = useState<string | null>(null)

  // 내 소속 집단 (사용자 관리에서 지정됨 — 여기선 표시만)
  useEffect(() => {
    let cancelled = false
    void supabase.from('app_users').select('group_name').eq('id', user.id).maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setGroupName((data as { group_name?: string | null } | null)?.group_name ?? null)
      })
    return () => { cancelled = true }
  }, [user.id])

  useEffect(() => {
    setName(user.name)
    setPhone(user.phone ?? '')
  }, [user.name, user.phone])

  useEffect(() => {
    let cancelled = false
    const loadLogs = async () => {
      if (!onFetchLoginLogs) return
      setLoadingLoginLogs(true)
      try {
        const logs = await onFetchLoginLogs(8)
        if (!cancelled) setLoginLogs(logs)
      } finally {
        if (!cancelled) setLoadingLoginLogs(false)
      }
    }
    void loadLogs()
    return () => {
      cancelled = true
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id])

  const canUsePhone = user.role === 'leader' || user.role === 'admin' || user.role === 'developer'
  const roleLabel = user.role === 'user' ? t(language, 'role.user') : roleLabels[user.role as Role]
  const accountSubtitle = `${roleLabel} ${t(language, 'profile.accountSuffix')}`
  const visibleLoginLogs = loginLogsExpanded ? loginLogs : loginLogs.slice(0, 3)

  return (
    <div className="mobile-profile-page">
      <AppHeader
        pageTitle={t(language, 'profile.myInfo')}
        language={language}
        subtitle={accountSubtitle}
        showBack
        onBack={() => navigate('/settings')}
        userId={user.id}
        userName={user.name}
        onOpenMenu={() => navigate('/settings')}
      />

      <section className="mobile-profile-hero">
        <div className="mobile-settings-avatar" aria-hidden="true">{user.name.slice(0, 1)}</div>
        <div>
          <strong>{user.name}</strong>
          <span>{user.loginId}</span>
        </div>
        <span className="mobile-profile-role-badge">• {roleLabel}</span>
        {groupName && <span className="mobile-profile-role-badge">• {groupName}</span>}
      </section>

      <section className="mobile-profile-card">
        <h2>{t(language, 'profile.personalInfo')}</h2>
        <label>
          <span>{t(language, 'profile.nickname')}</span>
          <input value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        {canUsePhone && (
          <label>
            <span>{t(language, 'profile.phone')}</span>
            <input
              inputMode="tel"
              placeholder="010-0000-0000"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
            />
          </label>
        )}
        <button
          disabled={savingProfile || !name.trim()}
          onClick={async () => {
            setSavingProfile(true)
            try {
              await onUpdateProfile({ name, phone: canUsePhone ? phone : undefined })
            } finally {
              setSavingProfile(false)
            }
          }}
          type="button"
        >
          {t(language, 'common.save')}
        </button>
      </section>

      <section className="mobile-profile-card">
        <h2>{t(language, 'profile.password')}</h2>
        <label>
          <span>{t(language, 'profile.newPassword')}</span>
          <input
            placeholder={t(language, 'profile.newPasswordPlaceholder')}
            type="password"
            value={newPin}
            onChange={(event) => setNewPin(event.target.value)}
          />
        </label>
        <label>
          <span>{t(language, 'profile.confirmPassword')}</span>
          <input
            placeholder={t(language, 'profile.confirmPasswordPlaceholder')}
            type="password"
            value={newPinConfirm}
            onChange={(event) => setNewPinConfirm(event.target.value)}
          />
        </label>
        <button
          disabled={savingPin || !newPin.trim() || !newPinConfirm.trim()}
          onClick={async () => {
            if (newPin !== newPinConfirm) {
              void alertDialog({ message: t(language, 'profile.pinMismatch') })
              return
            }
            setSavingPin(true)
            try {
              const ok = await onChangePin(newPin)
              if (ok) {
                setNewPin('')
                setNewPinConfirm('')
              }
            } finally {
              setSavingPin(false)
            }
          }}
          style={{
            background: 'var(--surface)',
            color: 'var(--text)',
            border: '1px solid var(--line-2)',
          }}
          type="button"
        >
          {t(language, 'profile.changePassword')}
        </button>
      </section>

      {/* 기능 설정 토글은 설정 탭 메인에서 관리 */}

      <section className="mobile-profile-card mobile-profile-login-card">
        <div className="mobile-profile-login-head">
          <h2>로그인 기록</h2>
          <span>{loginLogsExpanded ? `${loginLogs.length}건` : `최근 ${Math.min(loginLogs.length, 3)}건`}</span>
        </div>
        {loadingLoginLogs ? (
          <p className="mobile-login-empty">로그인 기록을 불러오는 중입니다.</p>
        ) : loginLogs.length === 0 ? (
          <p className="mobile-login-empty">아직 로그인 기록이 없습니다.</p>
        ) : (
          <div className={`mobile-login-list${loginLogsExpanded ? ' is-expanded' : ''}`}>
            {visibleLoginLogs.map((log) => (
              <div className="mobile-login-row" key={log.id}>
                <span>로그인</span>
                <strong>{formatLoginDateTime(log.logged_in_at)}</strong>
              </div>
            ))}
            {loginLogs.length > 3 && (
              <button
                className="mobile-login-toggle"
                onClick={() => setLoginLogsExpanded((value) => !value)}
                type="button"
              >
                {loginLogsExpanded ? '접기' : `더 보기 ${loginLogs.length - 3}건`}
              </button>
            )}
          </div>
        )}
      </section>
    </div>
  )
}

function formatLoginDateTime(value?: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  const pad = (num: number) => String(num).padStart(2, '0')
  return `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}
