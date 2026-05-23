import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { AuthUser } from '../hooks/useAuth'
import type { Role } from '../types'
import { roleLabels } from '../types'
import { t, type AppLanguage } from '../i18n'

export function DesktopProfileSettings({
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

  return (
    <div className="desk-settings-subpage" style={{ maxWidth: 640 }}>
      <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--gray-900)', marginBottom: 24 }}>내 정보</h2>
      <div className="desktop-profile-stack" style={{ display: 'grid', gap: 24 }}>
        <section className="desk-card ds-card" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div className="ds-avatar" style={{ width: 64, height: 64, fontSize: 24 }} aria-hidden="true">
            {user.name.slice(0, 1)}
          </div>
          <div style={{ display: 'grid', gap: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <strong style={{ fontSize: 18, fontWeight: 800, color: 'var(--gray-900)' }}>{user.name}</strong>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-500)', background: 'var(--gray-100)', padding: '2px 8px', borderRadius: 999 }}>
                {roleLabel}
              </span>
            </div>
            <span style={{ fontSize: 13, color: 'var(--gray-500)' }}>{user.loginId}</span>
          </div>
        </section>

        <section className="desk-card ds-card" style={{ display: 'grid', gap: 16 }}>
          <h2 className="desk-card__title">개인 정보</h2>
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--gray-700)' }}>닉네임</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{ height: 44, padding: '0 12px', border: '1px solid var(--border-default)', borderRadius: 8, background: 'var(--bg-card)', color: 'var(--gray-900)', fontSize: 14 }}
            />
          </label>
          {canUsePhone && (
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--gray-700)' }}>핸드폰 번호</span>
              <input
                inputMode="tel"
                placeholder="010-0000-0000"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                style={{ height: 44, padding: '0 12px', border: '1px solid var(--border-default)', borderRadius: 8, background: 'var(--bg-card)', color: 'var(--gray-900)', fontSize: 14 }}
              />
            </label>
          )}
          <div style={{ marginTop: 8 }}>
            <button
              className="ds-btn ds-btn-primary"
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
              style={{ width: '100%', height: 44, fontSize: 14 }}
            >
              저장
            </button>
          </div>
        </section>

        <section className="desk-card ds-card" style={{ display: 'grid', gap: 16 }}>
          <h2 className="desk-card__title">비밀번호 변경</h2>
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--gray-700)' }}>새 비밀번호</span>
            <input
              type="password"
              placeholder="새 비밀번호를 입력하세요"
              value={newPin}
              onChange={(e) => setNewPin(e.target.value)}
              style={{ height: 44, padding: '0 12px', border: '1px solid var(--border-default)', borderRadius: 8, background: 'var(--bg-card)', color: 'var(--gray-900)', fontSize: 14 }}
            />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--gray-700)' }}>새 비밀번호 확인</span>
            <input
              type="password"
              placeholder="다시 입력하세요"
              value={newPinConfirm}
              onChange={(e) => setNewPinConfirm(e.target.value)}
              style={{ height: 44, padding: '0 12px', border: '1px solid var(--border-default)', borderRadius: 8, background: 'var(--bg-card)', color: 'var(--gray-900)', fontSize: 14 }}
            />
          </label>
          <div style={{ marginTop: 8 }}>
            <button
              className="ds-btn"
              disabled={savingPin || !newPin.trim() || !newPinConfirm.trim()}
              onClick={async () => {
                if (newPin !== newPinConfirm) {
                  window.alert('비밀번호가 일치하지 않습니다.')
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
              type="button"
              style={{ width: '100%', height: 44, fontSize: 14 }}
            >
              비밀번호 변경
            </button>
          </div>
        </section>
      </div>
    </div>
  )
}
