import { useMemo, useState, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import type { Role, VisitHistory } from '../types'

type UserProfile = {
  name: string
  role: Role
  isRegistered: boolean
  userId?: number
  visitCount: number
  lastVisitAt?: string
}

function getRoleScope(role: Role) {
  if (role === 'admin') return ['관리자', '인도자', '봉사자']
  if (role === 'leader') return ['인도자', '봉사자']
  return ['봉사자']
}

export function DesktopUsers({
  visitHistories,
}: {
  visitHistories: VisitHistory[]
}) {
  const [selectedUser, setSelectedUser] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [customPin, setCustomPin] = useState('')
  const [editLoginId, setEditLoginId] = useState('')
  const [editNickname, setEditNickname] = useState('')
  const [newUserLoginId, setNewUserLoginId] = useState('')
  const [newUserName, setNewUserName] = useState('')
  const [newUserPin, setNewUserPin] = useState('')
  const [newUserRole, setNewUserRole] = useState<Role>('user')
  const { user: currentUser, allUsers, fetchAllUsers, resetUserPin, updateUserRole, deleteUser, createUser, updateUserIdentity } = useAuth()

  useEffect(() => {
    if (currentUser?.role === 'admin') {
      fetchAllUsers()
    }
  }, [currentUser?.role])

  const users = useMemo<UserProfile[]>(() => {
    const nameSet = new Set<string>()
    allUsers.forEach((u) => nameSet.add(u.name))
    visitHistories.forEach((h) => nameSet.add(h.visitor))

    return Array.from(nameSet)
      .sort()
      .map((name) => {
        const dbUser = allUsers.find(u => u.name === name)
        const userVisits = visitHistories.filter((h) => h.visitor === name)
        const visitCount = userVisits.length
        const lastVisitAt = userVisits[0]?.visitedAt
        return {
          name,
          role: dbUser?.role ?? 'user',
          isRegistered: !!dbUser,
          userId: dbUser?.id,
          visitCount,
          lastVisitAt,
        }
      })
  }, [visitHistories, allUsers])

  const filtered = useMemo(
    () => users.filter((u) => u.name.includes(search)),
    [users, search],
  )

  const profile = users.find((u) => u.name === selectedUser) ?? users[0] ?? null

  useEffect(() => {
    if (!profile?.isRegistered) {
      setEditLoginId('')
      setEditNickname('')
      return
    }
    setEditLoginId(profile.name)
    setEditNickname(profile.name)
    const dbUser = allUsers.find((item) => item.id === profile.userId)
    if (dbUser) {
      setEditLoginId(dbUser.loginId)
      setEditNickname(dbUser.name)
    }
  }, [profile?.userId, profile?.isRegistered, allUsers])

  const roleScopeLabel = (role: Role) => getRoleScope(role).join(' · ')

  const handleDeleteUser = async (profileToDelete: UserProfile) => {
    if (!profileToDelete.userId) return
    if (currentUser?.id === profileToDelete.userId) {
      return
    }
    const message = `${profileToDelete.name} 사용자를 제거할까요?\n\n로그인 계정만 삭제되며, 기존 방문 기록은 보존됩니다. 방문 기록이 있는 이름은 삭제 후에도 삭제됨 상태로 표시될 수 있습니다.`
    if (!confirm(message)) return
    const ok = await deleteUser(profileToDelete.userId)
    if (ok) {
      setSelectedUser(null)
    }
  }

  return (
    <section className="desktop-content calendar-layout">
      <div className="calendar-pane">
        <div className="calendar-toolbar">
          <div>
            <p>봉사자 관리</p>
            <h1>사용자 목록 ({users.length}명)</h1>
          </div>
          <input
            aria-label="사용자 검색"
            placeholder="이름 검색..."
            style={{ padding: '6px 10px', borderRadius: 'var(--r-sm)', border: '1px solid #e5e7eb', fontSize: '14px' }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '8px' }}>
          {filtered.length === 0 && (
            <div className="map-empty-state">
              <p>검색 결과가 없습니다</p>
            </div>
          )}
          {filtered.map((user) => (
            <button
              key={user.name}
              onClick={() => setSelectedUser(user.name)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 12px',
                background: selectedUser === user.name ? 'var(--brand-50)' : user.isRegistered ? '#fff' : '#f8fafc',
                border: selectedUser === user.name ? '1px solid var(--brand-700)' : '1px solid #e5e7eb',
                borderRadius: 'var(--r-md)',
                cursor: 'pointer',
                textAlign: 'left',
              }}
              type="button"
            >
              <div style={{
                width: '32px', height: '32px', borderRadius: '999px',
                background: !user.isRegistered ? '#cbd5e1' : user.role === 'admin' ? 'var(--danger-600)' : user.role === 'leader' ? 'var(--accent-700)' : 'var(--brand-700)',
                color: '#fff', display: 'grid', placeItems: 'center',
                fontSize: '13px', fontWeight: 700, flexShrink: 0,
              }}>
                {user.name[0]}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <strong style={{ fontSize: '14px' }}>{user.name}</strong>
                  <span style={{
                    fontSize: '11px', padding: '1px 6px', borderRadius: '999px',
                    background: !user.isRegistered ? '#e2e8f0' : user.role === 'admin' ? '#fee2e2' : user.role === 'leader' ? '#dcfce7' : '#eff6ff',
                    color: !user.isRegistered ? 'var(--ink-500)' : user.role === 'admin' ? 'var(--danger-700)' : user.role === 'leader' ? 'var(--accent-700)' : 'var(--brand-700)',
                  }}>
                    {user.isRegistered ? roleScopeLabel(user.role) : '삭제됨'}
                  </span>
                </div>
                <p style={{ fontSize: '12px', color: 'var(--ink-500)', margin: '2px 0 0' }}>
                  방문 기록 {user.visitCount}건 {user.lastVisitAt ? `· 최근 ${user.lastVisitAt.slice(5, 10).replace('-', '/')}` : ''}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>

      <aside className="detail-pane" aria-label="사용자 상세">
        {!profile ? (
          <div className="map-empty-state" style={{ marginTop: '40px' }}>
            <p>사용자를 선택하세요</p>
          </div>
        ) : (
          <div className="detail-stack">
            <div className="detail-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '48px', height: '48px', borderRadius: '999px',
                  background: !profile.isRegistered ? '#cbd5e1' : profile.role === 'admin' ? 'var(--danger-600)' : profile.role === 'leader' ? 'var(--accent-700)' : 'var(--brand-700)',
                  color: '#fff', display: 'grid', placeItems: 'center',
                  fontSize: '18px', fontWeight: 700,
                }}>
                  {profile.name[0]}
                </div>
                <div>
                  <p style={{ fontSize: '12px', color: 'var(--ink-500)' }}>
                    {profile.isRegistered ? roleScopeLabel(profile.role) : '삭제된 사용자 기록'}
                  </p>
                  <strong style={{ fontSize: '18px' }}>{profile.name}</strong>
                  {profile.isRegistered && (
                    <p style={{ fontSize: '12px', color: 'var(--ink-500)', marginTop: '2px' }}>
                      아이디 {allUsers.find((item) => item.id === profile.userId)?.loginId ?? '-'}
                    </p>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '16px', fontSize: '13px', color: 'var(--ink-500)', marginTop: '8px' }}>
                <span>계정 상태 <strong style={{ color: profile.isRegistered ? 'var(--primary-600)' : 'var(--ink-500)' }}>{profile.isRegistered ? '사용 중' : '삭제됨'}</strong></span>
                <span>방문 기록 <strong style={{ color: 'var(--ink-900)' }}>{profile.visitCount}</strong>건</span>
                {profile.lastVisitAt && <span>최근 방문 <strong style={{ color: 'var(--ink-900)' }}>{profile.lastVisitAt}</strong></span>}
              </div>
            </div>

            <article className="detail-card">
              <h2 style={{ fontSize: '14px', marginBottom: '8px' }}>계정 관리</h2>

              {!profile.isRegistered ? (
                <div style={{ fontSize: '13px', color: 'var(--ink-600)', background: '#f9fafb', padding: '12px', borderRadius: '8px' }}>
                  <p style={{ margin: '0 0 8px' }}>이 사용자는 로그인 계정이 삭제됐지만, 과거 방문 기록에 이름이 남아 있습니다.</p>
                  <p style={{ margin: 0 }}>기록 보존을 위해 방문 기록은 삭제하지 않습니다. 같은 이름으로 다시 가입하면 새 계정으로 목록에 표시됩니다.</p>
                </div>
              ) : currentUser?.role === 'admin' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink-700)', marginBottom: '4px' }}>아이디 / 닉네임 변경</p>
                    <p style={{ fontSize: '12px', color: 'var(--ink-500)', marginBottom: '8px' }}>
                      아이디는 로그인용, 닉네임은 앱 표시 이름입니다.
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '8px' }}>
                      <input
                        placeholder="아이디"
                        style={{ minHeight: '36px', borderRadius: '6px', border: '1px solid #d1d5db', padding: '0 10px', fontSize: '13px' }}
                        value={editLoginId}
                        onChange={(event) => setEditLoginId(event.target.value)}
                      />
                      <input
                        placeholder="닉네임"
                        style={{ minHeight: '36px', borderRadius: '6px', border: '1px solid #d1d5db', padding: '0 10px', fontSize: '13px' }}
                        value={editNickname}
                        onChange={(event) => setEditNickname(event.target.value)}
                      />
                      <button
                        disabled={!editLoginId.trim() || !editNickname.trim()}
                        onClick={async () => {
                          const ok = await updateUserIdentity(profile.userId!, editLoginId, editNickname)
                          if (ok) {
                            setSelectedUser(editNickname.trim())
                          }
                        }}
                        style={{
                          fontSize: '13px',
                          padding: '8px 14px',
                          borderRadius: '6px',
                          border: '1px solid var(--brand-700)',
                          color: '#ffffff',
                          background: 'var(--brand-700)',
                          cursor: !editLoginId.trim() || !editNickname.trim() ? 'not-allowed' : 'pointer',
                          fontWeight: 600,
                          opacity: !editLoginId.trim() || !editNickname.trim() ? 0.5 : 1,
                        }}
                        type="button"
                      >
                        저장
                      </button>
                    </div>
                  </div>

                  <div>
                    <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink-700)', marginBottom: '4px' }}>사용자 권한</p>
                    <div style={{ display: 'grid', gap: '8px', padding: '10px 12px', borderRadius: '8px', border: '1px solid #d1d5db', background: '#fff' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: 'var(--ink-700)', fontWeight: 600, cursor: 'default' }}>
                        <input checked disabled type="checkbox" />
                        봉사자 (기본)
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: 'var(--ink-700)', fontWeight: 600, cursor: profile.role === 'admin' ? 'not-allowed' : 'pointer', opacity: profile.role === 'admin' ? 0.65 : 1 }}>
                        <input
                          checked={profile.role !== 'user'}
                          disabled={profile.role === 'admin'}
                          onChange={async () => {
                            const nextRole: Role = profile.role === 'user' ? 'leader' : 'user'
                            await updateUserRole(profile.userId!, nextRole)
                          }}
                          type="checkbox"
                        />
                        인도자
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: 'var(--ink-700)', fontWeight: 600, cursor: 'pointer' }}>
                        <input
                          checked={profile.role === 'admin'}
                          onChange={async () => {
                            const nextRole: Role = profile.role === 'admin' ? 'leader' : 'admin'
                            await updateUserRole(profile.userId!, nextRole)
                          }}
                          type="checkbox"
                        />
                        관리자
                      </label>
                    </div>
                    <p style={{ fontSize: '12px', color: 'var(--ink-500)', marginTop: '4px' }}>
                      관리자 권한은 인도자/봉사자 권한을 포함합니다. 권한 변경 후 앱 재실행 시 반영됩니다.
                    </p>
                  </div>

                  <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '16px' }}>
                    <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink-700)', marginBottom: '4px' }}>비밀번호 강제 초기화</p>
                    <p style={{ fontSize: '12px', color: 'var(--ink-500)', marginBottom: '8px' }}>
                      사용자가 비밀번호를 잊어버린 경우, '0000'으로 초기화해 줄 수 있습니다.
                    </p>
                    <button
                      onClick={() => {
                        if (confirm(`${profile.name}님의 비밀번호를 '0000'으로 초기화하시겠습니까?`)) {
                          resetUserPin(profile.userId!)
                        }
                      }}
                      style={{ fontSize: '13px', padding: '8px 16px', borderRadius: '6px', border: '1px solid var(--danger-600)', color: 'var(--danger-600)', background: '#fff', cursor: 'pointer', fontWeight: 600 }}
                      type="button"
                    >
                      비밀번호 '0000'으로 초기화
                    </button>
                  </div>

                  <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '16px' }}>
                    <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink-700)', marginBottom: '4px' }}>비밀번호 재설정</p>
                    <p style={{ fontSize: '12px', color: 'var(--ink-500)', marginBottom: '8px' }}>
                      원하는 새 비밀번호로 바로 재설정할 수 있습니다.
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '8px' }}>
                      <input
                        placeholder="새 비밀번호"
                        style={{ minHeight: '36px', borderRadius: '6px', border: '1px solid #d1d5db', padding: '0 10px', fontSize: '13px' }}
                        value={customPin}
                        onChange={(event) => setCustomPin(event.target.value)}
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
                          fontSize: '13px',
                          padding: '8px 14px',
                          borderRadius: '6px',
                          border: '1px solid var(--brand-700)',
                          color: '#ffffff',
                          background: 'var(--brand-700)',
                          cursor: !customPin.trim() ? 'not-allowed' : 'pointer',
                          fontWeight: 600,
                          opacity: !customPin.trim() ? 0.5 : 1,
                        }}
                        type="button"
                      >
                        재설정
                      </button>
                    </div>
                  </div>

                  <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '16px' }}>
                    <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--danger-600)', marginBottom: '4px' }}>사용자 제거</p>
                    <p style={{ fontSize: '12px', color: 'var(--ink-500)', marginBottom: '8px' }}>
                      간편 로그인 계정을 삭제합니다. 기존 방문 기록은 삭제하지 않습니다.
                    </p>
                    <button
                      disabled={currentUser?.id === profile.userId}
                      onClick={() => handleDeleteUser(profile)}
                      style={{
                        fontSize: '13px',
                        padding: '8px 16px',
                        borderRadius: '6px',
                        border: '1px solid var(--danger-600)',
                        color: currentUser?.id === profile.userId ? 'var(--ink-400)' : '#ffffff',
                        background: currentUser?.id === profile.userId ? '#f1f5f9' : 'var(--danger-600)',
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
                <div style={{ fontSize: '13px', color: 'var(--ink-600)' }}>
                  계정 관리는 관리자만 가능합니다.
                </div>
              )}
            </article>

            {profile.visitCount === 0 && (
              <article className="detail-card empty">
                <h2>활동 내역 없음</h2>
                <p>이 사용자는 아직 방문 기록이 없습니다.</p>
              </article>
            )}

            {currentUser?.role === 'admin' && (
              <article className="detail-card">
                <h2 style={{ fontSize: '14px', marginBottom: '8px' }}>사용자 추가</h2>
                <p style={{ fontSize: '12px', color: 'var(--ink-500)', margin: '0 0 10px' }}>
                  아이디(로그인용), 닉네임(표시용), 비밀번호를 입력해 새 계정을 만들 수 있습니다.
                </p>
                <div style={{ display: 'grid', gap: '8px' }}>
                  <input
                    placeholder="아이디 (로그인용)"
                    style={{ minHeight: '36px', borderRadius: '6px', border: '1px solid #d1d5db', padding: '0 10px', fontSize: '13px' }}
                    value={newUserLoginId}
                    onChange={(event) => setNewUserLoginId(event.target.value)}
                  />
                  <input
                    placeholder="닉네임 (표시 이름)"
                    style={{ minHeight: '36px', borderRadius: '6px', border: '1px solid #d1d5db', padding: '0 10px', fontSize: '13px' }}
                    value={newUserName}
                    onChange={(event) => setNewUserName(event.target.value)}
                  />
                  <input
                    placeholder="비밀번호"
                    style={{ minHeight: '36px', borderRadius: '6px', border: '1px solid #d1d5db', padding: '0 10px', fontSize: '13px' }}
                    value={newUserPin}
                    onChange={(event) => setNewUserPin(event.target.value)}
                  />
                  <select
                    value={newUserRole}
                    style={{ minHeight: '36px', borderRadius: '6px', border: '1px solid #d1d5db', padding: '0 10px', fontSize: '13px', background: '#fff' }}
                    onChange={(event) => setNewUserRole(event.target.value as Role)}
                  >
                    <option value="user">봉사자</option>
                    <option value="leader">인도자</option>
                    <option value="admin">관리자</option>
                  </select>
                  <button
                    disabled={!newUserLoginId.trim() || !newUserName.trim() || !newUserPin.trim()}
                    onClick={async () => {
                      const ok = await createUser(newUserLoginId, newUserName, newUserPin, newUserRole)
                      if (!ok) return
                      const createdName = newUserName.trim()
                      setNewUserLoginId('')
                      setNewUserName('')
                      setNewUserPin('')
                      setNewUserRole('user')
                      setSelectedUser(createdName)
                    }}
                    style={{
                      fontSize: '13px',
                      padding: '10px 16px',
                      borderRadius: '6px',
                      border: '1px solid var(--accent-700)',
                      color: '#ffffff',
                      background: 'var(--accent-700)',
                      cursor: !newUserLoginId.trim() || !newUserName.trim() || !newUserPin.trim() ? 'not-allowed' : 'pointer',
                      fontWeight: 600,
                      opacity: !newUserLoginId.trim() || !newUserName.trim() || !newUserPin.trim() ? 0.5 : 1,
                    }}
                    type="button"
                  >
                    사용자 추가
                  </button>
                </div>
              </article>
            )}
          </div>
        )}
      </aside>
    </section>
  )
}
