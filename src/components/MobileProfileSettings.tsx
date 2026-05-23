import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { AuthUser } from '../hooks/useAuth'
import type { Role } from '../types'
import { roleLabels } from '../types'
import { t, type AppLanguage } from '../i18n'
import { AppHeader } from './AppHeader'

export function MobileProfileSettings({
  user,
  language = 'ko',
  onChangePin,
  onUpdateProfile,
}: {
  user: AuthUser
  language?: AppLanguage
  onChangePin: (newPin: string) => Promise<boolean>
  onUpdateProfile: (input: { name: string; phone?: string | null }) => Promise<boolean>
}) {
  const navigate = useNavigate()
  const [name, setName] = useState(user.name)
  const [phone, setPhone] = useState(user.phone ?? '')
  const [newPin, setNewPin] = useState('')
  const [newPinConfirm, setNewPinConfirm] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)
  const [savingPin, setSavingPin] = useState(false)

  useEffect(() => {
    setName(user.name)
    setPhone(user.phone ?? '')
  }, [user.name, user.phone])

  const canUsePhone = user.role === 'leader' || user.role === 'admin' || user.role === 'developer'
  const roleLabel = user.role === 'user' ? t(language, 'role.user') : roleLabels[user.role as Role]
  const accountSubtitle = `${roleLabel} ${t(language, 'profile.accountSuffix')}`

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
              window.alert(t(language, 'profile.pinMismatch'))
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
    </div>
  )
}
