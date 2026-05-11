import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { AuthUser } from '../hooks/useAuth'
import type { Role } from '../types'
import { roleLabels } from '../types'
import { AppHeader } from './AppHeader'

export function MobileProfileSettings({
  user,
  onChangePin,
  onUpdateProfile,
}: {
  user: AuthUser
  onChangePin: (newPin: string) => Promise<boolean>
  onUpdateProfile: (input: { name: string; phone?: string | null }) => Promise<boolean>
}) {
  const navigate = useNavigate()
  const [name, setName] = useState(user.name)
  const [phone, setPhone] = useState(user.phone ?? '')
  const [newPin, setNewPin] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)
  const [savingPin, setSavingPin] = useState(false)

  useEffect(() => {
    setName(user.name)
    setPhone(user.phone ?? '')
  }, [user.name, user.phone])

  const canUsePhone = user.role === 'leader' || user.role === 'admin' || user.role === 'developer'
  const roleLabel = user.role === 'user' ? '봉사자' : roleLabels[user.role as Role]

  return (
    <div className="mobile-profile-page">
      <AppHeader
        pageTitle="내 정보"
        subtitle={`${roleLabel} 계정 정보`}
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
      </section>

      <section className="mobile-profile-card">
        <h2>개인 정보</h2>
        <label>
          <span>닉네임</span>
          <input value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        {canUsePhone && (
          <label>
            <span>핸드폰 번호</span>
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
          저장
        </button>
      </section>

      <section className="mobile-profile-card">
        <h2>비밀번호</h2>
        <label>
          <span>새 비밀번호</span>
          <input
            placeholder="새 비밀번호를 입력하세요"
            type="password"
            value={newPin}
            onChange={(event) => setNewPin(event.target.value)}
          />
        </label>
        <button
          disabled={savingPin || !newPin.trim()}
          onClick={async () => {
            setSavingPin(true)
            try {
              const ok = await onChangePin(newPin)
              if (ok) setNewPin('')
            } finally {
              setSavingPin(false)
            }
          }}
          type="button"
        >
          비밀번호 변경
        </button>
      </section>
    </div>
  )
}
