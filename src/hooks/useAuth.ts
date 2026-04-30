import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { showToast } from '../lib/toast'
import type { Role } from '../types'

export type AuthUser = {
  id: number
  loginId: string
  name: string
  phone?: string | null
  role: Role
}

export type AppUserRecord = {
  id: number
  loginId: string
  name: string
  phone?: string | null
  role: Role
  created_at: string
  lastLoginAt?: string | null
}

const ROLE_VALUES: Role[] = ['admin', 'leader', 'user', 'developer']

function isRole(value: unknown): value is Role {
  return typeof value === 'string' && ROLE_VALUES.includes(value as Role)
}

/** 관리자 수준 이상 권한 여부 (developer 포함) */
function isAdminLike(role: Role | undefined) {
  return role === 'admin' || role === 'developer'
}

function toAuthUser(data: { id: number; name: string; phone?: string | null; login_id?: string | null; role: string }): AuthUser {
  return {
    id: data.id,
    loginId: data.login_id ?? data.name,
    name: data.name,
    phone: data.phone ?? null,
    role: isRole(data.role) ? data.role : 'user',
  }
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [allUsers, setAllUsers] = useState<AppUserRecord[]>([])

  useEffect(() => {
    let cancelled = false

    const restoreSession = async () => {
      const storedSession = localStorage.getItem('auth_session')
      if (!storedSession) {
        if (!cancelled) setLoading(false)
        return
      }

      try {
        const parsed = JSON.parse(storedSession)
        if (parsed?.id) {
          const { data, error } = await supabase
            .from('app_users')
            .select('id, name, phone, login_id, role')
            .eq('id', parsed.id)
            .maybeSingle()

          if (error && !error.message?.includes('phone')) throw error
          if (data && !cancelled) {
            const freshUser = toAuthUser(data)
            setUser(freshUser)
            localStorage.setItem('currentVisitor', freshUser.name)
            localStorage.setItem('auth_session', JSON.stringify(freshUser))
            setLoading(false)
            return
          }
        }

        if (parsed && parsed.name && parsed.role && !cancelled) {
          const restoredUser: AuthUser = {
            id: parsed.id,
            loginId: parsed.loginId ?? parsed.name,
            name: parsed.name,
            phone: parsed.phone ?? null,
            role: isRole(parsed.role) ? parsed.role : 'user',
          }
          setUser(restoredUser)
          localStorage.setItem('currentVisitor', restoredUser.name)
        }
      } catch (e) {
        console.error('Failed to parse auth_session', e)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void restoreSession()
    return () => {
      cancelled = true
    }
  }, [])

  const login = async (loginId: string, pin: string, rememberMe: boolean) => {
    try {
      const normalizedLoginId = loginId.trim()

      // 서버에서 bcrypt 검증 + last_login_at 갱신 + login_logs 기록 모두 수행
      const { data, error } = await supabase.rpc('auth_login', {
        p_login_id: normalizedLoginId,
        p_pin: pin,
      })

      if (error) {
        console.error('[login] auth_login RPC failed:', error)
        showToast('로그인 중 오류가 발생했습니다.', 'error')
        return false
      }

      // RPC는 빈 배열이면 인증 실패 (사용자 없음 OR 비밀번호 불일치)
      const row = (data as Array<{ id: number; name: string; login_id: string; role: string }>)?.[0]
      if (!row) {
        showToast('아이디 또는 비밀번호가 일치하지 않습니다.', 'error')
        return false
      }

      const authUser = toAuthUser({
        id: row.id,
        name: row.name,
        login_id: row.login_id,
        role: row.role,
      })
      setUser(authUser)

      localStorage.setItem('currentVisitor', authUser.name)
      if (rememberMe) {
        localStorage.setItem('auth_session', JSON.stringify(authUser))
      } else {
        localStorage.removeItem('auth_session')
      }

      showToast('로그인 성공!', 'success')
      return true
    } catch (err) {
      console.error(err)
      showToast('로그인 중 오류가 발생했습니다.', 'error')
      return false
    }
  }

  const signup = async (loginId: string, name: string, pin: string) => {
    try {
      const normalizedLoginId = loginId.trim()
      const normalizedName = name.trim()


      const { data: existingLoginId, error: loginIdCheckError } = await supabase
        .from('app_users')
        .select('id')
        .eq('login_id', normalizedLoginId)
        .maybeSingle()

      if (loginIdCheckError) throw loginIdCheckError
      if (existingLoginId) {
        showToast('이미 사용 중인 아이디입니다.', 'error')
        return false
      }

      const { data: existingName, error: nameCheckError } = await supabase
        .from('app_users')
        .select('id')
        .eq('name', normalizedName)
        .maybeSingle()

      if (nameCheckError) throw nameCheckError
      if (existingName) {
        showToast('이미 사용 중인 닉네임입니다. 다른 이름을 사용해 주세요.', 'error')
        return false
      }

      const { data, error } = await supabase
        .from('app_users')
        .insert({ login_id: normalizedLoginId, name: normalizedName, role: 'user', pin })
        .select('id, name, login_id, role')
        .single()

      if (error || !data) {
        if ((error as any)?.message?.includes('login_id')) {
          showToast('DB에 login_id 컬럼이 없습니다. SQL 마이그레이션을 먼저 실행해 주세요.', 'error')
          return false
        }
        showToast('회원가입에 실패했습니다.', 'error')
        return false
      }

      const authUser: AuthUser = {
        id: data.id,
        loginId: data.login_id ?? normalizedLoginId,
        name: data.name,
        role: data.role as Role,
      }
      setUser(authUser)
      localStorage.setItem('currentVisitor', authUser.name)
      localStorage.setItem('auth_session', JSON.stringify(authUser)) // 회원가입 시 자동로그인

      showToast('회원가입 완료! 환영합니다.', 'success')
      return true
    } catch (err) {
      console.error(err)
      showToast('회원가입 중 오류가 발생했습니다.', 'error')
      return false
    }
  }

  const logout = () => {
    setUser(null)
    localStorage.removeItem('auth_session')
    localStorage.removeItem('currentVisitor')
    showToast('로그아웃 되었습니다.')
  }

  // 비밀번호 변경 (본인용)
  const changePin = async (newPin: string) => {
    if (!user) return false
    const { error } = await supabase
      .from('app_users')
      .update({ pin: newPin })
      .eq('id', user.id)

    if (error) {
      showToast('비밀번호 변경에 실패했습니다.', 'error')
      return false
    }
    showToast('비밀번호가 변경되었습니다.', 'success')
    return true
  }

  const updateMyProfile = async (input: { name: string; phone?: string | null }) => {
    if (!user) return false
    const trimmedName = input.name.trim()
    const trimmedPhone = input.phone?.trim() ?? ''

    if (!trimmedName) {
      showToast('닉네임을 입력해 주세요.', 'error')
      return false
    }

    const { data: duplicatedName, error: nameCheckError } = await supabase
      .from('app_users')
      .select('id')
      .eq('name', trimmedName)
      .neq('id', user.id)
      .maybeSingle()

    if (nameCheckError) {
      showToast('닉네임 중복 확인 중 오류가 발생했습니다.', 'error')
      return false
    }
    if (duplicatedName) {
      showToast('이미 사용 중인 닉네임입니다.', 'error')
      return false
    }

    const { error } = await supabase
      .from('app_users')
      .update({ name: trimmedName, phone: trimmedPhone || null })
      .eq('id', user.id)

    if (error) {
      if ((error as any)?.message?.includes('phone')) {
        showToast('DB에 phone 컬럼이 없습니다. 전화번호 마이그레이션을 먼저 실행해 주세요.', 'error')
        return false
      }
      showToast('개인 정보 변경에 실패했습니다.', 'error')
      return false
    }

    const nextUser: AuthUser = { ...user, name: trimmedName, phone: trimmedPhone || null }
    setUser(nextUser)
    localStorage.setItem('currentVisitor', nextUser.name)
    localStorage.setItem('auth_session', JSON.stringify(nextUser))
    showToast('개인 정보가 변경되었습니다.', 'success')
    await fetchAllUsers()
    return true
  }

  // --- 관리자 전용 기능 ---

  const fetchAllUsers = async () => {
    if (!user) return
    const { data, error } = await supabase
      .from('app_users')
      .select('id, name, phone, login_id, role, created_at, last_login_at')
      .order('created_at', { ascending: false })

    if (!error && data) {
      const rows = data as Array<{ id: number; name: string; phone?: string | null; login_id: string | null; role: Role; created_at: string; last_login_at?: string | null }>
      setAllUsers(rows.map((item) => ({
        id: item.id,
        loginId: item.login_id ?? item.name,
        name: item.name,
        phone: item.phone ?? null,
        // developer는 자신에게만 보임 — 다른 admin에게는 'admin'으로 표시
        role: (item.role === 'developer' && user.role !== 'developer') ? 'admin' : item.role,
        created_at: item.created_at,
        lastLoginAt: item.last_login_at ?? null,
      })))
      return
    }

    if (error?.message?.includes('login_id') || error?.message?.includes('phone')) {
      const fallback = await supabase
        .from('app_users')
        .select(error.message.includes('login_id') ? 'id, name, role, created_at' : 'id, name, login_id, role, created_at, last_login_at')
        .order('created_at', { ascending: false })
      if (!fallback.error && fallback.data) {
        setAllUsers((fallback.data as unknown as Array<{ id: number; name: string; login_id?: string | null; role: Role; created_at: string; last_login_at?: string | null }>).map((item) => ({
          id: item.id,
          loginId: item.login_id ?? item.name,
          name: item.name,
          role: item.role,
          created_at: item.created_at,
          lastLoginAt: item.last_login_at ?? null,
          phone: null,
        })))
      }
    }
  }

  // 로그인 직후 자동으로 전체 유저 목록 로드 (인도자 이름 드롭다운에 사용)
  useEffect(() => {
    void fetchAllUsers()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  const resetUserPin = async (userId: number, newPin: string = '0000') => {
    if (!isAdminLike(user?.role)) return false
    const { error } = await supabase
      .from('app_users')
      .update({ pin: newPin })
      .eq('id', userId)

    if (error) {
      showToast('비밀번호 초기화에 실패했습니다.', 'error')
      return false
    }
    showToast(`비밀번호가 '${newPin}'(으)로 초기화되었습니다.`, 'success')
    return true
  }

  const updateUserRole = async (userId: number, newRole: Role) => {
    if (!isAdminLike(user?.role)) return false
    const { error } = await supabase
      .from('app_users')
      .update({ role: newRole })
      .eq('id', userId)

    if (error) {
      showToast('권한 변경에 실패했습니다.', 'error')
      return false
    }
    showToast('권한이 변경되었습니다.', 'success')
    await fetchAllUsers()
    return true
  }

  const deleteUser = async (userId: number) => {
    if (!isAdminLike(user?.role)) return false
    if (user.id === userId) {
      showToast('현재 로그인한 관리자 계정은 제거할 수 없습니다.', 'error')
      return false
    }

    const { error } = await supabase
      .from('app_users')
      .delete()
      .eq('id', userId)

    if (error) {
      showToast('사용자 제거에 실패했습니다.', 'error')
      return false
    }

    showToast('사용자가 제거되었습니다.', 'success')
    await fetchAllUsers()
    return true
  }

  const createUser = async (loginId: string, name: string, pin: string, role: Role = 'user') => {
    if (!isAdminLike(user?.role)) return false
    const trimmedLoginId = loginId.trim()
    const trimmedName = name.trim()
    const trimmedPin = pin.trim()
    if (!trimmedLoginId || !trimmedName || !trimmedPin) {
      showToast('아이디, 닉네임, 비밀번호를 모두 입력해 주세요.', 'error')
      return false
    }


    const { data: existingLoginId, error: loginIdCheckError } = await supabase
      .from('app_users')
      .select('id')
      .eq('login_id', trimmedLoginId)
      .maybeSingle()

    if (loginIdCheckError) {
      showToast('아이디 중복 확인 중 오류가 발생했습니다.', 'error')
      return false
    }
    if (existingLoginId) {
      showToast('이미 사용 중인 아이디입니다.', 'error')
      return false
    }

    const { data: existingName, error: nameCheckError } = await supabase
      .from('app_users')
      .select('id')
      .eq('name', trimmedName)
      .maybeSingle()

    if (nameCheckError) {
      showToast('닉네임 중복 확인 중 오류가 발생했습니다.', 'error')
      return false
    }
    if (existingName) {
      showToast('이미 사용 중인 닉네임입니다.', 'error')
      return false
    }

    const { error } = await supabase
      .from('app_users')
      .insert({ login_id: trimmedLoginId, name: trimmedName, pin: trimmedPin, role })

    if (error) {
      if ((error as any)?.message?.includes('login_id')) {
        showToast('DB에 login_id 컬럼이 없습니다. SQL 마이그레이션을 먼저 실행해 주세요.', 'error')
        return false
      }
      showToast('사용자 추가에 실패했습니다.', 'error')
      return false
    }

    showToast('사용자가 추가되었습니다.', 'success')
    await fetchAllUsers()
    return true
  }

  const updateUserIdentity = async (userId: number, loginId: string, name: string) => {
    if (!isAdminLike(user?.role)) return false
    const trimmedLoginId = loginId.trim()
    const trimmedName = name.trim()

    if (!trimmedLoginId || !trimmedName) {
      showToast('아이디와 닉네임을 모두 입력해 주세요.', 'error')
      return false
    }


    const target = allUsers.find((item) => item.id === userId)
    if (!target) {
      showToast('사용자 정보를 찾을 수 없습니다.', 'error')
      return false
    }

    const duplicatedLoginId = allUsers.some((item) => item.id !== userId && item.loginId === trimmedLoginId)
    if (duplicatedLoginId) {
      showToast('이미 사용 중인 아이디입니다.', 'error')
      return false
    }

    const duplicatedName = allUsers.some((item) => item.id !== userId && item.name === trimmedName)
    if (duplicatedName) {
      showToast('이미 사용 중인 닉네임입니다.', 'error')
      return false
    }

    const { error } = await supabase
      .from('app_users')
      .update({ login_id: trimmedLoginId, name: trimmedName })
      .eq('id', userId)

    if (error) {
      if ((error as any)?.message?.includes('login_id')) {
        showToast('DB에 login_id 컬럼이 없습니다. SQL 마이그레이션을 먼저 실행해 주세요.', 'error')
        return false
      }
      showToast('아이디/닉네임 변경에 실패했습니다.', 'error')
      return false
    }

    if (user.id === userId) {
      const nextUser: AuthUser = { ...user, loginId: trimmedLoginId, name: trimmedName }
      setUser(nextUser)
      localStorage.setItem('currentVisitor', nextUser.name)
      localStorage.setItem('auth_session', JSON.stringify(nextUser))
    }

    showToast('아이디/닉네임이 변경되었습니다.', 'success')
    await fetchAllUsers()
    return true
  }

  /** 내 로그인 기록 — 본인만 조회 가능 */
  const fetchMyLoginLogs = async (limit = 20) => {
    if (!user) return []
    const { data, error } = await supabase
      .from('login_logs')
      .select('id, logged_in_at')
      .eq('user_id', user.id)
      .order('logged_in_at', { ascending: false })
      .limit(limit)
    if (error) { console.error('fetchMyLoginLogs:', error); return [] }
    return (data ?? []) as { id: number; logged_in_at: string }[]
  }

  /** 특정 사용자의 로그인 기록 — developer만 조회 가능 */
  const fetchUserLoginLogs = async (userId: number, limit = 30) => {
    if (user?.role !== 'developer') return []
    const { data, error } = await supabase
      .from('login_logs')
      .select('id, logged_in_at')
      .eq('user_id', userId)
      .order('logged_in_at', { ascending: false })
      .limit(limit)
    if (error) { console.error('fetchUserLoginLogs:', error); return [] }
    return (data ?? []) as { id: number; logged_in_at: string }[]
  }

  return {
    user,
    loading,
    login,
    signup,
    logout,
    changePin,
    updateMyProfile,
    allUsers,
    fetchAllUsers,
    resetUserPin,
    updateUserRole,
    deleteUser,
    createUser,
    updateUserIdentity,
    fetchMyLoginLogs,
    fetchUserLoginLogs,
  }
}
