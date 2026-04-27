import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { showToast } from '../lib/toast'
import type { Role } from '../types'

export type AuthUser = {
  id: number
  loginId: string
  name: string
  role: Role
}

export type AppUserRecord = {
  id: number
  loginId: string
  name: string
  role: Role
  created_at: string
}

const ROLE_VALUES: Role[] = ['admin', 'leader', 'user']

function isRole(value: unknown): value is Role {
  return typeof value === 'string' && ROLE_VALUES.includes(value as Role)
}

function toAuthUser(data: { id: number; name: string; login_id?: string | null; role: string }): AuthUser {
  return {
    id: data.id,
    loginId: data.login_id ?? data.name,
    name: data.name,
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
            .select('id, name, login_id, role')
            .eq('id', parsed.id)
            .maybeSingle()

          if (error) throw error
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
      let byLoginId: { id: number; name: string; login_id: string | null; role: string; pin: string } | null = null
      let byLoginIdError: any = null

      const byLoginIdResult = await supabase
        .from('app_users')
        .select('id, name, login_id, role, pin')
        .eq('login_id', normalizedLoginId)
        .maybeSingle()
      byLoginId = byLoginIdResult.data as any
      byLoginIdError = byLoginIdResult.error

      // 하위 호환: login_id 도입 전 데이터
      let data = byLoginId
      const noLoginIdColumn = byLoginIdError?.message?.includes('login_id')
      if (!data) {
        const { data: byName, error: byNameError } = await supabase
          .from('app_users')
          .select(noLoginIdColumn ? 'id, name, role, pin' : 'id, name, login_id, role, pin')
          .eq('name', normalizedLoginId)
          .maybeSingle()
        if (byNameError) throw byNameError
        const byNameAny = byName as any
        data = noLoginIdColumn
          ? (byNameAny ? { id: byNameAny.id, name: byNameAny.name, login_id: byNameAny.name, role: byNameAny.role, pin: byNameAny.pin } : null)
          : byNameAny
      }
      if (byLoginIdError && !noLoginIdColumn) throw byLoginIdError

      if (!data) {
        showToast('등록되지 않은 아이디입니다.', 'error')
        return false
      }

      if (data.pin !== pin) {
        showToast('비밀번호가 일치하지 않습니다.', 'error')
        return false
      }

      const authUser = toAuthUser(data)
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

      if (normalizedLoginId === normalizedName) {
        showToast('아이디와 닉네임은 다르게 입력해 주세요.', 'error')
        return false
      }

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

  // --- 관리자 전용 기능 ---

  const fetchAllUsers = async () => {
    if (!user) return
    const { data, error } = await supabase
      .from('app_users')
      .select('id, name, login_id, role, created_at')
      .order('created_at', { ascending: false })

    if (!error && data) {
      setAllUsers((data as Array<{ id: number; name: string; login_id: string | null; role: Role; created_at: string }>).map((item) => ({
        id: item.id,
        loginId: item.login_id ?? item.name,
        name: item.name,
        role: item.role,
        created_at: item.created_at,
      })))
      return
    }

    if (error?.message?.includes('login_id')) {
      const fallback = await supabase
        .from('app_users')
        .select('id, name, role, created_at')
        .order('created_at', { ascending: false })
      if (!fallback.error && fallback.data) {
        setAllUsers((fallback.data as Array<{ id: number; name: string; role: Role; created_at: string }>).map((item) => ({
          id: item.id,
          loginId: item.name,
          name: item.name,
          role: item.role,
          created_at: item.created_at,
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
    if (user?.role !== 'admin') return false
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
    if (user?.role !== 'admin') return false
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
    if (user?.role !== 'admin') return false
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
    if (user?.role !== 'admin') return false
    const trimmedLoginId = loginId.trim()
    const trimmedName = name.trim()
    const trimmedPin = pin.trim()
    if (!trimmedLoginId || !trimmedName || !trimmedPin) {
      showToast('아이디, 닉네임, 비밀번호를 모두 입력해 주세요.', 'error')
      return false
    }
    if (trimmedLoginId === trimmedName) {
      showToast('아이디와 닉네임은 다르게 입력해 주세요.', 'error')
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
    if (user?.role !== 'admin') return false
    const trimmedLoginId = loginId.trim()
    const trimmedName = name.trim()

    if (!trimmedLoginId || !trimmedName) {
      showToast('아이디와 닉네임을 모두 입력해 주세요.', 'error')
      return false
    }
    if (trimmedLoginId === trimmedName) {
      showToast('아이디와 닉네임은 다르게 입력해 주세요.', 'error')
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

  return {
    user,
    loading,
    login,
    signup,
    logout,
    changePin,
    allUsers,
    fetchAllUsers,
    resetUserPin,
    updateUserRole,
    deleteUser,
    createUser,
    updateUserIdentity,
  }
}
