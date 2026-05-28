import { useMemo, useState, useEffect, useRef } from 'react'
import { useAuth } from '../hooks/useAuth'
import type { Role, VisitHistory } from '../types'

type UserProfile = {
  name: string
  role: Role
  isRegistered: boolean
  userId?: number
  lastLoginAt?: string | null
}

type LoginLog = { id: number; logged_in_at: string }

const ROLE_ORDER: Record<Role, number> = { developer: 0, admin: 1, leader: 2, user: 3 }

function getRoleScope(role: Role) {
  if (role === 'developer') return ['개발자']
  if (role === 'admin') return ['관리자', '인도자', '봉사자']
  if (role === 'leader') return ['인도자', '봉사자']
  return ['봉사자']
}

function formatLoginAt(iso: string | null | undefined): string {
  if (!iso) return '-'
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}


function avatarBg(profile: UserProfile) {
  if (!profile.isRegistered) return '#CBD5E1'
  if (profile.role === 'developer') return '#6D28D9'   // 보라색
  if (profile.role === 'admin')  return 'var(--danger-600)'
  if (profile.role === 'leader') return 'var(--success-600)'
  return 'var(--primary-600)'
}

/* ── 사용자 추가 모달 ── */
function AddUserModal({
  onClose,
  onCreated,
  createUser,
}: {
  onClose: () => void
  onCreated: (name: string) => void
  createUser: (loginId: string, name: string, pin: string, role: Role) => Promise<boolean>
}) {
  const [loginId, setLoginId]   = useState('')
  const [name, setName]         = useState('')
  const [pin, setPin]           = useState('')
  const [role, setRole]         = useState<Role>('user')
  const backdropRef = useRef<HTMLDivElement>(null)

  const disabled = !loginId.trim() || !name.trim() || !pin.trim()

  return (
    <div
      ref={backdropRef}
      onClick={(e) => { if (e.target === backdropRef.current) onClose() }}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(17,24,39,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div style={{
        background: '#fff', borderRadius: '16px',
        padding: '28px 28px 24px',
        width: '400px', maxWidth: 'calc(100vw - 32px)',
        boxShadow: 'var(--shadow-lg)',
        display: 'flex', flexDirection: 'column', gap: '18px',
      }}>
        {/* 헤더 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--gray-500)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>사용자 관리</div>
            <h2 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: 'var(--gray-900)' }}>새 사용자 추가</h2>
          </div>
          <button
            onClick={onClose}
            style={{ width: 32, height: 32, borderRadius: '50%', border: 'none', background: 'var(--gray-100)', color: 'var(--gray-600)', fontSize: '18px', cursor: 'pointer', display: 'grid', placeItems: 'center' }}
            type="button"
          >
            ×
          </button>
        </div>

        {/* 폼 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div>
            <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--gray-700)', display: 'block', marginBottom: '4px' }}>아이디 (로그인용)</label>
            <input
              autoFocus
              placeholder="예: hong123"
              style={{ width: '100%', height: '36px', borderRadius: '6px', border: '1px solid var(--border-default)', padding: '0 10px', fontSize: '13px', boxSizing: 'border-box' }}
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
            />
          </div>
          <div>
            <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--gray-700)', display: 'block', marginBottom: '4px' }}>닉네임 (앱 표시 이름)</label>
            <input
              placeholder="예: 홍길동"
              style={{ width: '100%', height: '36px', borderRadius: '6px', border: '1px solid var(--border-default)', padding: '0 10px', fontSize: '13px', boxSizing: 'border-box' }}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--gray-700)', display: 'block', marginBottom: '4px' }}>비밀번호</label>
            <input
              placeholder="초기 비밀번호"
              style={{ width: '100%', height: '36px', borderRadius: '6px', border: '1px solid var(--border-default)', padding: '0 10px', fontSize: '13px', boxSizing: 'border-box' }}
              value={pin}
              onChange={(e) => setPin(e.target.value)}
            />
          </div>
          <div>
            <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--gray-700)', display: 'block', marginBottom: '4px' }}>역할</label>
            <select
              value={role}
              style={{ width: '100%', height: '36px', borderRadius: '6px', border: '1px solid var(--border-default)', padding: '0 10px', fontSize: '13px', background: '#fff', boxSizing: 'border-box' }}
              onChange={(e) => setRole(e.target.value as Role)}
            >
              <option value="user">봉사자</option>
              <option value="leader">인도자</option>
              <option value="admin">관리자</option>
              {/* developer 옵션은 개발자 계정으로 로그인했을 때만 노출 */}
            </select>
          </div>
        </div>

        {/* 액션 */}
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{ height: '36px', padding: '0 16px', borderRadius: '8px', border: '1px solid var(--border-default)', background: '#fff', fontSize: '13px', fontWeight: 600, color: 'var(--gray-700)', cursor: 'pointer' }}
            type="button"
          >
            취소
          </button>
          <button
            disabled={disabled}
            onClick={async () => {
              const ok = await createUser(loginId.trim(), name.trim(), pin.trim(), role)
              if (ok) {
                onCreated(name.trim())
                onClose()
              }
            }}
            style={{
              height: '36px', padding: '0 20px', borderRadius: '8px',
              border: 'none', background: disabled ? 'var(--gray-300)' : 'var(--primary-500)',
              color: '#fff', fontSize: '13px', fontWeight: 700,
              cursor: disabled ? 'not-allowed' : 'pointer',
            }}
            type="button"
          >
            추가
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── 메인 컴포넌트 ── */
export function DesktopUsers({
  visitHistories: _visitHistories,
}: {
  visitHistories: VisitHistory[]
}) {
  const [selectedUser, setSelectedUser] = useState<string | null>(null)
  const [search, setSearch]             = useState('')
  const [customPin, setCustomPin]       = useState('')
  const [editLoginId, setEditLoginId]   = useState('')
  const [editNickname, setEditNickname] = useState('')
  const [showAddModal, setShowAddModal]     = useState(false)
  const [loginLogs, setLoginLogs]           = useState<LoginLog[]>([])
  const [logsLoading, setLogsLoading]       = useState(false)
  const [showOldLogs, setShowOldLogs]       = useState(false)

  const { user: currentUser, allUsers, fetchAllUsers, resetUserPin, updateUserRole, deleteUser, createUser, updateUserIdentity, fetchUserLoginLogs } = useAuth()

  const isDev = currentUser?.role === 'developer'
  const isAdminLike = currentUser?.role === 'admin' || isDev

  useEffect(() => {
    if (isAdminLike) fetchAllUsers()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.role])

  /* 사용자 목록: developer → admin → leader → user → 가나다
     developer 계정은 본인(developer)만 볼 수 있음 */
  const users = useMemo<UserProfile[]>(() => {
    return allUsers
      .filter((u) => (u.approvalStatus ?? 'approved') === 'approved')
      .map((u) => ({
        name:         u.name,
        role:         u.role,
        isRegistered: true,
        userId:       u.id,
        lastLoginAt:  u.lastLoginAt ?? null,
      } satisfies UserProfile))
      .filter((u) => {
        if (u.role === 'developer') return currentUser?.role === 'developer'
        return true
      })
      .sort((a, b) => {
        const ro = ROLE_ORDER[a.role] - ROLE_ORDER[b.role]
        if (ro !== 0) return ro
        return a.name.localeCompare(b.name, 'ko')
      })
  }, [allUsers, currentUser?.role])

  const filtered = useMemo(
    () => users.filter((u) => u.name.includes(search)),
    [users, search],
  )

  const profile = users.find((u) => u.name === selectedUser) ?? users[0] ?? null

  /* developer: 선택 유저 바뀔 때 로그인 기록 fetch */
  useEffect(() => {
    setLoginLogs([])
    setShowOldLogs(false)
    if (!isDev || !profile?.userId) return
    setLogsLoading(true)
    fetchUserLoginLogs(profile.userId).then((logs) => {
      setLoginLogs(logs)
      setLogsLoading(false)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.userId, isDev])

  useEffect(() => {
    if (!profile?.isRegistered) { setEditLoginId(''); setEditNickname(''); return }
    setEditLoginId(profile.name)
    setEditNickname(profile.name)
    const dbUser = allUsers.find((item) => item.id === profile.userId)
    if (dbUser) { setEditLoginId(dbUser.loginId); setEditNickname(dbUser.name) }
  }, [profile?.userId, profile?.isRegistered, allUsers])

  const roleScopeLabel = (role: Role) => getRoleScope(role).join(' · ')

  const handleDeleteUser = async (p: UserProfile) => {
    if (!p.userId) return
    if (currentUser?.id === p.userId) return
    const msg = `${p.name} 사용자를 제거할까요?\n\n로그인 계정만 삭제되며, 기존 방문 기록은 보존됩니다.`
    if (!confirm(msg)) return
    const ok = await deleteUser(p.userId)
    if (ok) setSelectedUser(null)
  }

  return (
    <>
      <section className="desktop-content calendar-layout">
        {/* ── 좌측: 사용자 목록 ── */}
        <div className="calendar-pane">
          <header className="page-header">
            <div className="page-header-text">
              <h1 className="page-header-title">사용자 목록 ({users.length}명)</h1>
            </div>
            <div className="page-header-actions">
              <input
                aria-label="사용자 검색"
                placeholder="이름 검색..."
                style={{ padding: '6px 10px', borderRadius: 'var(--r-sm)', border: '1px solid var(--border-default)', fontSize: '13px', height: '32px' }}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {isAdminLike && (
                <button
                  onClick={() => setShowAddModal(true)}
                  style={{
                    height: '32px', padding: '0 12px', borderRadius: '8px',
                    border: 'none', background: 'var(--primary-500)',
                    color: '#fff', fontSize: '13px', fontWeight: 700,
                    cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
                    display: 'flex', alignItems: 'center', gap: '4px',
                  }}
                  type="button"
                >
                  <span style={{ fontSize: '16px', lineHeight: 1 }}>+</span> 사용자 추가
                </button>
              )}
            </div>
          </header>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '8px' }}>
            {filtered.length === 0 && (
              <div className="map-empty-state"><p>검색 결과가 없습니다</p></div>
            )}
            {filtered.map((user) => (
              <button
                key={user.name}
                onClick={() => setSelectedUser(user.name)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '10px 12px',
                  background: selectedUser === user.name ? 'var(--primary-50)' : user.isRegistered ? '#fff' : '#f8fafc',
                  border: selectedUser === user.name ? '1px solid var(--primary-500)' : '1px solid var(--border-default)',
                  borderRadius: 'var(--r-md)', cursor: 'pointer', textAlign: 'left',
                }}
                type="button"
              >
                {/* 아바타 */}
                <div style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: avatarBg(user),
                  color: '#fff', display: 'grid', placeItems: 'center',
                  fontSize: '13px', fontWeight: 700, flexShrink: 0,
                }}>
                  {user.name[0]}
                </div>
                {/* 이름 + 역할 */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--gray-900)' }}>{user.name}</span>
                    <span style={{
                      fontSize: '11px', padding: '1px 6px', borderRadius: '999px',
                      background: !user.isRegistered ? '#E2E8F0' : user.role === 'admin' ? 'var(--danger-100)' : user.role === 'leader' ? 'var(--success-100)' : 'var(--primary-100)',
                      color: !user.isRegistered ? 'var(--gray-500)' : user.role === 'admin' ? 'var(--danger-700)' : user.role === 'leader' ? 'var(--success-700)' : 'var(--primary-700)',
                    }}>
                      {user.isRegistered ? roleScopeLabel(user.role) : '삭제됨'}
                    </span>
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--gray-500)', margin: '2px 0 0' }}>
                    {isDev && user.lastLoginAt
                      ? `최근 접속 ${formatLoginAt(user.lastLoginAt).slice(0, 10)}`
                      : user.lastLoginAt
                        ? `최근 접속 ${formatLoginAt(user.lastLoginAt).slice(0, 10)}`
                        : '로그인 기록 없음'}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* ── 우측: 상세 패널 ── */}
        <aside className="detail-pane" aria-label="사용자 상세">
          {!profile ? (
            <div className="map-empty-state" style={{ marginTop: '40px' }}>
              <p>사용자를 선택하세요</p>
            </div>
          ) : (
            <div className="detail-stack">

              {/* ── 프로필 블록 (패딩 0) ── */}
              <div style={{ padding: '20px 20px 0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: '50%',
                    background: avatarBg(profile),
                    color: '#fff', display: 'grid', placeItems: 'center',
                    fontSize: '18px', fontWeight: 700, flexShrink: 0,
                  }}>
                    {profile.name[0]}
                  </div>
                  <div>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--gray-900)', lineHeight: 1.3 }}>
                      {profile.name}
                    </div>
                    <div style={{ fontSize: '12px', color: '#6B7280', marginTop: '2px' }}>
                      {profile.isRegistered
                        /* developer가 보는 경우에만 실제 역할 표시, 그 외엔 developer → 관리자로 마스킹 */
                        ? roleScopeLabel(isDev ? profile.role : (profile.role === 'developer' ? 'admin' : profile.role))
                        : '삭제된 사용자 기록'}
                      {profile.isRegistered && isDev && (
                        <span style={{ marginLeft: '6px' }}>
                          · 아이디 {allUsers.find((item) => item.id === profile.userId)?.loginId ?? '-'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* ── 통계 행 ── */}
                <div style={{
                  display: 'flex', gap: '24px', flexWrap: 'wrap',
                  padding: '12px 0',
                  marginTop: '14px',
                  borderBottom: '1px solid var(--border-default)',
                }}>
                  <div style={{ fontSize: '13px', color: 'var(--gray-500)' }}>
                    계정 상태&nbsp;
                    <strong style={{ color: profile.isRegistered ? 'var(--success-600)' : 'var(--gray-500)' }}>
                      {profile.isRegistered ? '사용 중' : '삭제됨'}
                    </strong>
                  </div>
                </div>

                {/* ── 로그인 기록 (developer 전용) ── */}
                {isDev && (
                  <div style={{ marginTop: '12px', marginBottom: '4px' }}>
                    {/* 최근 로그인 — 항상 표시 */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--gray-500)' }}>
                        <svg width="13" height="13" viewBox="0 0 12 12" fill="none" style={{ color: 'var(--gray-400)', flexShrink: 0 }}>
                          <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.3" />
                          <path d="M6 3.5v2.75l1.5 1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                        </svg>
                        로그인 기록&nbsp;
                        {logsLoading
                          ? <span style={{ color: 'var(--gray-400)' }}>불러오는 중…</span>
                          : <strong style={{ color: 'var(--gray-900)', fontVariantNumeric: 'tabular-nums' }}>
                              {loginLogs[0] ? formatLoginAt(loginLogs[0].logged_in_at) : '-'}
                            </strong>
                        }
                      </div>
                      {loginLogs.length > 1 && (
                        <button
                          onClick={() => setShowOldLogs((v) => !v)}
                          style={{ fontSize: '12px', color: 'var(--primary-600)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px', padding: 0 }}
                          type="button"
                        >
                          이전 기록 {loginLogs.length - 1}건
                          <svg width="11" height="11" viewBox="0 0 12 12" fill="none" style={{ transform: showOldLogs ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}>
                            <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>
                      )}
                    </div>

                    {/* 이전 기록 토글 */}
                    {showOldLogs && loginLogs.length > 1 && (
                      <div style={{
                        borderRadius: '8px', border: '1px solid var(--border-default)',
                        background: 'var(--bg-subtle)', maxHeight: '200px', overflowY: 'auto',
                      }}>
                        {loginLogs.slice(1).map((log) => (
                          <div key={log.id} style={{
                            padding: '7px 12px', fontSize: '12px', color: 'var(--gray-600)',
                            fontVariantNumeric: 'tabular-nums',
                            borderBottom: '1px solid var(--border-subtle)',
                          }}>
                            {formatLoginAt(log.logged_in_at)}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* ── 계정 관리 카드 ── */}
              <article className="detail-card">
                <h2 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '16px' }}>계정 관리</h2>

                {!profile.isRegistered ? (
                  <div style={{ fontSize: '13px', color: 'var(--gray-600)', background: 'var(--bg-subtle)', padding: '12px', borderRadius: '8px' }}>
                    <p style={{ margin: '0 0 8px' }}>이 사용자는 로그인 계정이 삭제됐지만, 과거 방문 기록에 이름이 남아 있습니다.</p>
                    <p style={{ margin: 0 }}>기록 보존을 위해 방문 기록은 삭제하지 않습니다.</p>
                  </div>
                ) : isAdminLike ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

                    {/* 아이디 / 닉네임 */}
                    <div>
                      <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--gray-700)', margin: '0 0 4px' }}>아이디 / 닉네임 변경</p>
                      <p style={{ fontSize: '12px', color: 'var(--gray-500)', margin: '0 0 8px' }}>
                        아이디는 로그인용, 닉네임은 앱 표시 이름입니다.
                      </p>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '8px' }}>
                        <input
                          placeholder="아이디"
                          style={{ height: '36px', borderRadius: '6px', border: '1px solid var(--border-default)', padding: '0 10px', fontSize: '13px' }}
                          value={editLoginId}
                          onChange={(e) => setEditLoginId(e.target.value)}
                        />
                        <input
                          placeholder="닉네임"
                          style={{ height: '36px', borderRadius: '6px', border: '1px solid var(--border-default)', padding: '0 10px', fontSize: '13px' }}
                          value={editNickname}
                          onChange={(e) => setEditNickname(e.target.value)}
                        />
                        <button
                          disabled={!editLoginId.trim() || !editNickname.trim()}
                          onClick={async () => {
                            const ok = await updateUserIdentity(profile.userId!, editLoginId, editNickname)
                            if (ok) setSelectedUser(editNickname.trim())
                          }}
                          style={{
                            height: '36px', padding: '0 14px', borderRadius: '6px',
                            border: 'none',
                            background: !editLoginId.trim() || !editNickname.trim() ? 'var(--gray-300)' : 'var(--primary-500)',
                            color: '#fff', fontSize: '13px', fontWeight: 700,
                            cursor: !editLoginId.trim() || !editNickname.trim() ? 'not-allowed' : 'pointer',
                          }}
                          type="button"
                        >
                          저장
                        </button>
                      </div>
                    </div>

                    {/* 사용자 권한 */}
                    <div>
                      <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--gray-700)', margin: '0 0 8px' }}>사용자 권한</p>
                      <div style={{ display: 'grid', gap: '8px', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-default)', background: '#fff' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: 'var(--gray-700)', fontWeight: 600, cursor: 'default' }}>
                          <input checked disabled type="checkbox" /> 봉사자 (기본)
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: 'var(--gray-700)', fontWeight: 600, cursor: profile.role === 'admin' ? 'not-allowed' : 'pointer', opacity: profile.role === 'admin' ? 0.5 : 1 }}>
                          <input
                            checked={profile.role !== 'user'}
                            disabled={profile.role === 'admin'}
                            onChange={async () => {
                              const next: Role = profile.role === 'user' ? 'leader' : 'user'
                              await updateUserRole(profile.userId!, next)
                            }}
                            type="checkbox"
                          />
                          인도자
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: 'var(--gray-700)', fontWeight: 600, cursor: 'pointer' }}>
                          <input
                            checked={profile.role === 'admin'}
                            onChange={async () => {
                              const next: Role = profile.role === 'admin' ? 'leader' : 'admin'
                              await updateUserRole(profile.userId!, next)
                            }}
                            type="checkbox"
                          />
                          관리자
                        </label>
                      </div>
                      <p style={{ fontSize: '12px', color: 'var(--gray-500)', margin: '4px 0 0' }}>
                        관리자 권한은 인도자/봉사자 권한을 포함합니다. 권한 변경 후 앱 재실행 시 반영됩니다.
                      </p>
                    </div>

                    {/* 비밀번호 강제 초기화 */}
                    <div style={{ borderTop: '1px solid var(--border-default)', paddingTop: '16px' }}>
                      <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--gray-700)', margin: '0 0 4px' }}>비밀번호 강제 초기화</p>
                      <p style={{ fontSize: '12px', color: 'var(--gray-500)', margin: '0 0 10px' }}>
                        <strong>{profile.name}</strong>님이 비밀번호를 잊어버린 경우, 관리자가 '0000'으로 초기화해 줄 수 있습니다.
                      </p>
                      <button
                        onClick={() => {
                          if (confirm(`${profile.name}님의 비밀번호를 '0000'으로 초기화하시겠습니까?`)) {
                            resetUserPin(profile.userId!)
                          }
                        }}
                        style={{ fontSize: '13px', padding: '8px 16px', borderRadius: '6px', border: '1px solid var(--danger-500)', color: 'var(--danger-600)', background: '#fff', cursor: 'pointer', fontWeight: 600 }}
                        type="button"
                      >
                        비밀번호 '0000'으로 초기화
                      </button>
                    </div>

                    {/* 비밀번호 재설정 */}
                    <div style={{ borderTop: '1px solid var(--border-default)', paddingTop: '16px' }}>
                      <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--gray-700)', margin: '0 0 4px' }}>비밀번호 재설정</p>
                      <p style={{ fontSize: '12px', color: 'var(--gray-500)', margin: '0 0 10px' }}>
                        <strong>{profile.name}</strong>님의 비밀번호를 원하는 값으로 직접 지정합니다.
                      </p>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '8px' }}>
                        <input
                          placeholder="새 비밀번호"
                          style={{ height: '36px', borderRadius: '6px', border: '1px solid var(--border-default)', padding: '0 10px', fontSize: '13px' }}
                          value={customPin}
                          onChange={(e) => setCustomPin(e.target.value)}
                        />
                        <button
                          disabled={!customPin.trim()}
                          onClick={async () => {
                            const pin = customPin.trim()
                            if (!pin) return
                            const ok = await resetUserPin(profile.userId!, pin)
                            if (ok) setCustomPin('')
                          }}
                          style={{
                            height: '36px', padding: '0 14px', borderRadius: '6px',
                            border: 'none',
                            background: !customPin.trim() ? 'var(--gray-300)' : 'var(--primary-500)',
                            color: '#fff', fontSize: '13px', fontWeight: 700,
                            cursor: !customPin.trim() ? 'not-allowed' : 'pointer',
                          }}
                          type="button"
                        >
                          재설정
                        </button>
                      </div>
                    </div>

                    {/* 사용자 제거 */}
                    <div style={{ borderTop: '1px solid var(--border-default)', paddingTop: '16px' }}>
                      <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--danger-600)', margin: '0 0 4px' }}>사용자 제거</p>
                      <p style={{ fontSize: '12px', color: 'var(--gray-500)', margin: '0 0 10px' }}>
                        로그인 계정을 삭제합니다. 기존 방문 기록은 보존됩니다.
                      </p>
                      <button
                        disabled={currentUser?.id === profile.userId}
                        onClick={() => handleDeleteUser(profile)}
                        style={{
                          fontSize: '13px', padding: '8px 16px', borderRadius: '6px',
                          border: '1px solid var(--danger-500)',
                          color: currentUser?.id === profile.userId ? 'var(--gray-400)' : '#fff',
                          background: currentUser?.id === profile.userId ? 'var(--gray-100)' : 'var(--danger-600)',
                          cursor: currentUser?.id === profile.userId ? 'not-allowed' : 'pointer',
                          fontWeight: 600,
                        }}
                        type="button"
                      >
                        사용자 제거
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: '13px', color: 'var(--gray-600)' }}>
                    계정 관리는 관리자만 가능합니다.
                  </div>
                )}
              </article>
            </div>
          )}
        </aside>
      </section>

      {/* 사용자 추가 모달 */}
      {showAddModal && (
        <AddUserModal
          createUser={createUser}
          onClose={() => setShowAddModal(false)}
          onCreated={(name) => setSelectedUser(name)}
        />
      )}
    </>
  )
}
