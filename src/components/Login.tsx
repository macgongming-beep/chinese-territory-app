import { useState } from 'react'
import './Login.css'

type LoginProps = {
  onLogin: (loginId: string, pin: string, rememberMe: boolean) => Promise<boolean>
  onSignup: (loginId: string, nickname: string, pin: string) => Promise<boolean>
}

export function Login({ onLogin, onSignup }: LoginProps) {
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
          <h1>{isSignup ? '회원가입' : 'CHS-Yongin'}</h1>
          <p>{isSignup ? '아이디, 닉네임, 비밀번호를 입력해주세요.' : '용인 중국어 봉사 앱'}</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="login-id">아이디</label>
            <input
              id="login-id"
              type="text"
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
              placeholder="예: yongin001"
              required
              disabled={isSubmitting}
              enterKeyHint="next"
              autoComplete="username"
            />
          </div>

          {isSignup && (
            <div className="form-group">
              <label htmlFor="nickname">닉네임 (표시 이름)</label>
              <input
                id="nickname"
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="예: 홍길동"
                required
                disabled={isSubmitting}
                enterKeyHint="next"
                autoComplete="nickname"
              />
            </div>
          )}

          <div className="form-group">
            <label htmlFor="pin">비밀번호</label>
            <input
              id="pin"
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder={isSignup ? "기억하기 쉬운 비밀번호" : "비밀번호 입력"}
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
                자동 로그인 (로그인 유지)
              </label>
            </div>
          )}

          <button
            type="submit"
            className="login-submit-btn"
            disabled={isSubmitting || !loginId.trim() || !pin.trim() || (isSignup && !nickname.trim())}
          >
            {isSubmitting ? '처리 중...' : isSignup ? '가입하기' : '로그인'}
          </button>
        </form>

        <div className="login-footer">
          {isSignup ? (
            <p>이미 계정이 있으신가요? <button type="button" onClick={() => setIsSignup(false)} className="text-btn">로그인</button></p>
          ) : (
            <p>계정이 없으신가요? <button type="button" onClick={() => setIsSignup(true)} className="text-btn">회원가입</button></p>
          )}
        </div>
      </div>
    </div>
  )
}
