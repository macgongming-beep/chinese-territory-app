import { useState } from 'react'
import type { AppLanguage } from '../i18n'
import { languageLabels, t } from '../i18n'
import './Login.css'

type LoginProps = {
  language: AppLanguage
  onChangeLanguage: (language: AppLanguage) => void
  onLogin: (loginId: string, pin: string, rememberMe: boolean) => Promise<boolean>
  onSignup: (loginId: string, nickname: string, pin: string) => Promise<boolean>
}

const LANGUAGES: AppLanguage[] = ['ko', 'zh', 'en']

export function Login({ language, onChangeLanguage, onLogin, onSignup }: LoginProps) {
  const [isSignup, setIsSignup] = useState(false)
  const [loginId, setLoginId] = useState('')
  const [nickname, setNickname] = useState('')
  const [pin, setPin] = useState('')
  const [rememberMe, setRememberMe] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!loginId.trim() || !pin.trim() || (isSignup && !nickname.trim())) return

    setIsSubmitting(true)
    let success = false

    if (isSignup) {
      success = await onSignup(loginId.trim(), nickname.trim(), pin.trim())
    } else {
      success = await onLogin(loginId.trim(), pin.trim(), rememberMe)
    }

    if (!success) {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <div className="login-logo">
            <svg viewBox="0 0 28 28">
              <path d="M6 7.5 12.5 5l6 2.5L22 6v15l-6.5 2.5-6-2.5L6 22Z" fill="currentColor" />
              <path d="M12.5 5v16M18.5 7.5v16" stroke="white" strokeWidth="2" fill="none" />
              <circle cx="14" cy="13.5" r="2.6" fill="white" />
            </svg>
          </div>
          <h1>{isSignup ? t(language, 'login.signupTitle') : t(language, 'login.appName')}</h1>
          <p>{isSignup ? t(language, 'login.signupSubtitle') : t(language, 'login.subtitle')}</p>
          <div className="login-language-switcher" aria-label={t(language, 'settings.language')}>
            {LANGUAGES.map((item) => (
              <button
                className={language === item ? 'active' : ''}
                key={item}
                onClick={() => onChangeLanguage(item)}
                type="button"
              >
                {languageLabels[item]}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="login-id">{t(language, 'login.id')}</label>
            <input
              id="login-id"
              type="text"
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
              placeholder={t(language, 'login.idPlaceholder')}
              required
              disabled={isSubmitting}
              enterKeyHint="next"
              autoComplete="username"
            />
          </div>

          {isSignup && (
            <div className="form-group">
              <label htmlFor="nickname">{t(language, 'login.nickname')}</label>
              <input
                id="nickname"
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder={t(language, 'login.nicknamePlaceholder')}
                required
                disabled={isSubmitting}
                enterKeyHint="next"
                autoComplete="nickname"
              />
            </div>
          )}

          <div className="form-group">
            <label htmlFor="pin">{t(language, 'login.password')}</label>
            <input
              id="pin"
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder={isSignup ? t(language, 'login.newPasswordPlaceholder') : t(language, 'login.passwordPlaceholder')}
              required
              disabled={isSubmitting}
              enterKeyHint={isSignup ? "done" : "go"}
              autoComplete={isSignup ? "new-password" : "current-password"}
            />
          </div>

          {!isSignup && (
            <div className="form-group checkbox-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  disabled={isSubmitting}
                />
                {t(language, 'login.rememberMe')}
              </label>
            </div>
          )}

          <button
            type="submit"
            className="login-submit-btn"
            disabled={isSubmitting || !loginId.trim() || !pin.trim() || (isSignup && !nickname.trim())}
          >
            {isSubmitting ? t(language, 'common.processing') : isSignup ? t(language, 'login.signup') : t(language, 'login.login')}
          </button>
        </form>

        <div className="login-footer">
          {isSignup ? (
            <p>{t(language, 'login.hasAccount')} <button type="button" onClick={() => setIsSignup(false)} className="text-btn">{t(language, 'login.login')}</button></p>
          ) : (
            <p>{t(language, 'login.noAccount')} <button type="button" onClick={() => setIsSignup(true)} className="text-btn">{t(language, 'login.signupTitle')}</button></p>
          )}
        </div>
      </div>
    </div>
  )
}
