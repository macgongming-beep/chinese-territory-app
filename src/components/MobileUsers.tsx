import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import type { Role } from '../types'
import { roleLabels } from '../types'
import { AppHeader } from './AppHeader'

type UserFilter = 'all' | 'admin' | 'leader' | 'user'

const roleOrder: Record<Role, number> = { developer: 0, admin: 1, leader: 2, user: 3 }

function displayRole(role: Role) {
  if (role === 'developer') return '개발자'
  if (role === 'user') return '봉사자'
  return roleLabels[role]
}

function roleScope(role: Role) {
  if (role === 'developer') return '개발자'
  if (role === 'admin') return '관리자 · 인도자 · 봉사자'
  if (role === 'leader') return '인도자 · 봉사자'
  return '봉사자'
}

function roleClass(role: Role) {
  if (role === 'admin' || role === 'developer') return 'admin'
  if (role === 'leader') return 'leader'
  return 'user'
}

export function MobileUsers() {
  const navigate = useNavigate()
  const {
    user: currentUser,
    allUsers,
    fetchAllUsers,
    createUser,
    updateUserIdentity,
    updateUserRole,
    resetUserPin,
    deleteUser,
  } = useAuth()

  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<UserFilter>('all')
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newLoginId, setNewLoginId] = useState('')
  const [newName, setNewName] = useState('')
  const [newPin, setNewPin] = useState('')
  const [newRole, setNewRole] = useState<Role>('user')
  const [editLoginId, setEditLoginId] = useState('')
  const [editName, setEditName] = useState('')
  const [editPin, setEditPin] = useState('')

  const isAdminLike = currentUser?.role === 'admin' || currentUser?.role === 'developer'

  useEffect(() => {
    if (isAdminLike) void fetchAllUsers()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdminLike, currentUser?.role])

  const users = useMemo(() => {
    return allUsers
      .filter((item) => currentUser?.role === 'developer' || item.role !== 'developer')
      .filter((item) => (item.approvalStatus ?? 'approved') === 'approved')
      .sort((a, b) => {
        const byRole = roleOrder[a.role] - roleOrder[b.role]
        if (byRole !== 0) return byRole
        return a.name.localeCompare(b.name, 'ko')
      })
  }, [allUsers, currentUser?.role])

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase()
    return users.filter((item) => {
      const matchesRole = roleFilter === 'all' || item.role === roleFilter
      const matchesSearch =
        !query ||
        item.name.toLowerCase().includes(query) ||
        item.loginId.toLowerCase().includes(query)
      return matchesRole && matchesSearch
    })
  }, [roleFilter, search, users])

  const selectedUser = users.find((item) => item.id === selectedUserId) ?? null

  useEffect(() => {
    if (!selectedUser) return
    setEditLoginId(selectedUser.loginId)
    setEditName(selectedUser.name)
    setEditPin('')
  }, [selectedUser])

  const resetAddForm = () => {
    setNewLoginId('')
    setNewName('')
    setNewPin('')
    setNewRole('user')
  }

  if (!isAdminLike) {
    return (
      <div className="mobile-users-page">
        <AppHeader
          pageTitle="사용자"
          showBack
          onBack={() => navigate('/settings')}
          userId={currentUser?.id}
          userName={currentUser?.name}
          onOpenMenu={() => navigate('/settings')}
        />
        <section className="mobile-users-empty">관리자만 사용할 수 있습니다.</section>
      </div>
    )
  }

  if (selectedUser) {
    const canDelete = currentUser?.id !== selectedUser.id
    return (
      <div className="mobile-users-page">
        <AppHeader
          pageTitle={selectedUser.name}
          subtitle={roleScope(selectedUser.role)}
          showBack
          onBack={() => setSelectedUserId(null)}
          userId={currentUser?.id}
          userName={currentUser?.name}
          onOpenMenu={() => navigate('/settings')}
        />

        <section className="mobile-user-detail-card">
          <div className={`mobile-user-avatar ${roleClass(selectedUser.role)}`}>
            {selectedUser.name.slice(0, 1)}
          </div>
          <div>
            <strong>{selectedUser.name}</strong>
            <span>{selectedUser.loginId}</span>
          </div>
          <span className={`mobile-user-role-badge ${roleClass(selectedUser.role)}`}>
            {displayRole(selectedUser.role)}
          </span>
        </section>

        <section className="mobile-user-manage-card">
          <h2>계정 관리</h2>
          <label>
            <span>아이디</span>
            <input value={editLoginId} onChange={(event) => setEditLoginId(event.target.value)} />
          </label>
          <label>
            <span>닉네임</span>
            <input value={editName} onChange={(event) => setEditName(event.target.value)} />
          </label>
          <button
            disabled={!editLoginId.trim() || !editName.trim()}
            onClick={async () => {
              const ok = await updateUserIdentity(selectedUser.id, editLoginId, editName)
              if (ok) setSelectedUserId(selectedUser.id)
            }}
            type="button"
          >
            아이디 · 닉네임 저장
          </button>
        </section>

        <section className="mobile-user-manage-card">
          <h2>사용자 권한</h2>
          <div className="mobile-user-role-select">
            {(['admin', 'leader', 'user'] as Role[]).map((role) => (
              <button
                key={role}
                className={selectedUser.role === role ? 'active' : ''}
                onClick={() => updateUserRole(selectedUser.id, role)}
                type="button"
              >
                {displayRole(role)}
              </button>
            ))}
          </div>
          <p>관리자는 인도자와 봉사자 권한을 포함합니다.</p>
        </section>

        <section className="mobile-user-manage-card">
          <h2>비밀번호</h2>
          <button onClick={() => resetUserPin(selectedUser.id)} type="button">
            0000으로 초기화
          </button>
          <div className="mobile-user-inline-form">
            <input
              placeholder="새 비밀번호"
              value={editPin}
              onChange={(event) => setEditPin(event.target.value)}
            />
            <button
              disabled={!editPin.trim()}
              onClick={async () => {
                const ok = await resetUserPin(selectedUser.id, editPin)
                if (ok) setEditPin('')
              }}
              type="button"
            >
              변경
            </button>
          </div>
        </section>

        <section className="mobile-user-danger-card">
          <div>
            <strong>사용자 제거</strong>
            <span>로그인 계정만 삭제하고 방문 기록은 보존합니다.</span>
          </div>
          <button
            disabled={!canDelete}
            onClick={async () => {
              if (!confirm(`${selectedUser.name} 사용자를 제거할까요?`)) return
              const ok = await deleteUser(selectedUser.id)
              if (ok) setSelectedUserId(null)
            }}
            type="button"
          >
            제거
          </button>
        </section>
      </div>
    )
  }

  return (
    <div className="mobile-users-page">
      <AppHeader
        pageTitle="사용자"
        showBack
        onBack={() => navigate('/settings')}
        userId={currentUser?.id}
        userName={currentUser?.name}
        onOpenMenu={() => navigate('/settings')}
      />

      <section className="mobile-users-toolbar">
        <div className="mobile-users-search-row">
          <input
            aria-label="사용자 이름 검색"
            placeholder="이름 검색"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <select
            aria-label="권한 필터"
            value={roleFilter}
            onChange={(event) => setRoleFilter(event.target.value as UserFilter)}
          >
            <option value="all">전체</option>
            <option value="admin">관리자</option>
            <option value="leader">인도자</option>
            <option value="user">봉사자</option>
          </select>
        </div>
        <button className="mobile-users-add-toggle" onClick={() => setShowAddForm((value) => !value)} type="button">
          + 사용자 추가
        </button>
      </section>

      {showAddForm && (
        <section className="mobile-user-manage-card mobile-users-add-card">
          <h2>사용자 추가</h2>
          <label>
            <span>아이디</span>
            <input value={newLoginId} onChange={(event) => setNewLoginId(event.target.value)} />
          </label>
          <label>
            <span>닉네임</span>
            <input value={newName} onChange={(event) => setNewName(event.target.value)} />
          </label>
          <label>
            <span>초기 비밀번호</span>
            <input value={newPin} onChange={(event) => setNewPin(event.target.value)} />
          </label>
          <label>
            <span>권한</span>
            <select value={newRole} onChange={(event) => setNewRole(event.target.value as Role)}>
              <option value="user">봉사자</option>
              <option value="leader">인도자</option>
              <option value="admin">관리자</option>
            </select>
          </label>
          <div className="mobile-users-add-actions">
            <button
              onClick={() => {
                resetAddForm()
                setShowAddForm(false)
              }}
              type="button"
            >
              취소
            </button>
            <button
              disabled={!newLoginId.trim() || !newName.trim() || !newPin.trim()}
              onClick={async () => {
                const ok = await createUser(newLoginId, newName, newPin, newRole)
                if (ok) {
                  resetAddForm()
                  setShowAddForm(false)
                }
              }}
              type="button"
            >
              추가
            </button>
          </div>
        </section>
      )}

      <section className="mobile-users-list" aria-label="사용자 목록">
        <div className="mobile-users-list-head">
          <strong>사용자 목록</strong>
          <span>{filteredUsers.length}명</span>
        </div>
        {filteredUsers.length === 0 ? (
          <div className="mobile-users-empty">검색 결과가 없습니다.</div>
        ) : (
          filteredUsers.map((item) => (
            <button key={item.id} onClick={() => setSelectedUserId(item.id)} type="button">
              <span className={`mobile-user-avatar ${roleClass(item.role)}`}>{item.name.slice(0, 1)}</span>
              <span className="mobile-users-row-main">
                <strong>{item.name}</strong>
                <small>{item.loginId}</small>
              </span>
              <span className={`mobile-user-role-badge ${roleClass(item.role)}`}>
                {displayRole(item.role)}
              </span>
              <span className="mobile-users-chevron" aria-hidden="true">›</span>
            </button>
          ))
        )}
      </section>
    </div>
  )
}
