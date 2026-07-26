import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { showToast } from '../lib/toast'
import {
  clearAuthStorage,
  getAuthToken,
  getStoredAuthSession,
  isPersistentAuthSession,
  setAuthSession,
  setAuthToken,
} from '../lib/authToken'
import { setSentryUser, clearSentryUser } from '../lib/sentry'
import type { Role } from '../types'

export type AuthUser = {
  id: number
  loginId: string
  name: string
  phone?: string | null
  role: Role
  authToken?: string | null
}

export type AppUserRecord = {
  id: number
  loginId: string
  name: string
  phone?: string | null
  role: Role
  approvalStatus?: 'pending' | 'approved' | 'blocked'
  groupName?: string | null
  created_at: string
  lastLoginAt?: string | null
}

export type LoginLogRecord = {
  id: number
  logged_in_at: string
}

const ROLE_VALUES: Role[] = ['admin', 'leader', 'user', 'developer']

function isRole(value: unknown): value is Role {
  return typeof value === 'string' && ROLE_VALUES.includes(value as Role)
}

function isDeveloperAccount(data: { name?: string | null; login_id?: string | null; loginId?: string | null; role?: string | null }) {
  return data.role === 'developer' || data.login_id === '개발자' || data.loginId === '개발자' || data.name === '개발자'
}

/** 관리자 수준 이상 권한 여부 (developer 포함) */
function isAdminLike(role: Role | undefined) {
  return role === 'admin' || role === 'developer'
}

function toAuthUser(data: { id: number; name: string; phone?: string | null; login_id?: string | null; role: string; token?: string | null }): AuthUser {
  return {
    id: data.id,
    loginId: data.login_id ?? data.name,
    name: data.name,
    phone: data.phone ?? null,
    role: isDeveloperAccount(data) ? 'developer' : isRole(data.role) ? data.role : 'user',
    authToken: data.token ?? null,
  }
}

function getDeviceLabel() {
  if (typeof navigator === 'undefined') return 'unknown'
  const platform = navigator.platform || 'web'
  return `${platform} browser`
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [allUsers, setAllUsers] = useState<AppUserRecord[]>([])

  useEffect(() => {
    let cancelled = false

    const restoreSession = async () => {
      // localStorage 우선, 없으면 sessionStorage (rememberMe 꺼진 경우)
      const storedSession = getStoredAuthSession()
      if (!storedSession) {
        if (!cancelled) setLoading(false)
        return
      }

      try {
        const parsed = JSON.parse(storedSession.raw)
        if (parsed?.id) {
          const { data, error } = await supabase
            .from('app_users')
            .select('id, name, phone, login_id, role')
            .eq('id', parsed.id)
            .maybeSingle()

          if (error && !error.message?.includes('phone')) throw error
          if (data && !cancelled) {
            const restoredToken = parsed.authToken ?? getAuthToken()
            const freshUser = { ...toAuthUser(data), authToken: restoredToken ?? null }
            setUser(freshUser)
            localStorage.setItem('currentVisitor', freshUser.name)
            setAuthSession(freshUser, storedSession.persistent)
            if (restoredToken) setAuthToken(restoredToken, storedSession.persistent)
            
            // 자동 로그인 기록 업데이트 (에러 발생해도 로그인 흐름을 끊지 않도록 무시)
            try {
              await supabase.rpc('auth_record_auto_login', {
                p_user_id: data.id,
                p_device_label: getDeviceLabel(),
                p_user_agent: typeof navigator === 'undefined' ? null : navigator.userAgent
              })
            } catch (err) {
              console.error(err)
            }

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
            authToken: parsed.authToken ?? getAuthToken(),
          }
          setUser(restoredUser)
          localStorage.setItem('currentVisitor', restoredUser.name)
          setAuthSession(restoredUser, storedSession.persistent)
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
      let { data, error } = await supabase.rpc('auth_login', {
        p_login_id: normalizedLoginId,
        p_pin: pin,
        p_device_label: getDeviceLabel(),
        p_user_agent: typeof navigator === 'undefined' ? null : navigator.userAgent,
      })

      if (error && /p_device_label|function|schema cache/i.test(error.message ?? '')) {
        const fallback = await supabase.rpc('auth_login', {
          p_login_id: normalizedLoginId,
          p_pin: pin,
        })
        data = fallback.data
        error = fallback.error
      }

      if (error) {
        console.error('[login] auth_login RPC failed:', error)
        showToast('로그인 중 오류가 발생했습니다.', 'error')
        return false
      }

      // RPC는 빈 배열이면 인증 실패 (사용자 없음 OR 비밀번호 불일치)
      const row = (data as Array<{
        token?: string | null
        id: number
        name: string
        login_id: string
        role: string
        approval_status?: string | null
      }>)?.[0]
      if (!row) {
        showToast('아이디 또는 비밀번호가 일치하지 않습니다.', 'error')
        return false
      }

      if (row.approval_status === 'pending') {
        showToast('가입 신청이 승인 대기 중입니다.', 'info')
        return false
      }

      if (row.approval_status === 'blocked') {
        showToast('가입 신청이 차단되었습니다. 관리자에게 문의해 주세요.', 'error')
        return false
      }

      const authUser = toAuthUser({
        id: row.id,
        name: row.name,
        login_id: row.login_id,
        role: row.role,
        token: row.token ?? null,
      })
      setUser(authUser)
      setSentryUser({ id: authUser.id, name: authUser.name })

      localStorage.setItem('currentVisitor', authUser.name)

      // 보안 RPC 토큰은 rememberMe 무관하게 항상 저장 (모든 민감 RPC 호출에 필요)
      if (row.token) setAuthToken(row.token, rememberMe)

      if (rememberMe) {
        setAuthSession(authUser, true)
      } else {
        // rememberMe 꺼져 있어도 세션은 sessionStorage에 (브라우저 닫을 때까지 유지)
        setAuthSession(authUser, false)
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
        .insert({ login_id: normalizedLoginId, name: normalizedName, role: 'user', pin, approval_status: 'pending' })
        .select('id, name, login_id, role')
        .single()

      if (error || !data) {
        if ((error as { message?: string })?.message?.includes('login_id')) {
          showToast('DB에 login_id 컬럼이 없습니다. SQL 마이그레이션을 먼저 실행해 주세요.', 'error')
          return false
        }
        if ((error as { message?: string })?.message?.includes('approval_status')) {
          showToast('가입 승인 SQL 마이그레이션을 먼저 실행해 주세요.', 'error')
          return false
        }
        showToast('가입 신청에 실패했습니다.', 'error')
        return false
      }

      showToast('가입 신청이 접수되었습니다. 관리자 승인 후 로그인할 수 있습니다.', 'success')
      return true
    } catch (err) {
      console.error(err)
      showToast('회원가입 중 오류가 발생했습니다.', 'error')
      return false
    }
  }

  const logout = () => {
    setUser(null)
    clearSentryUser()
    clearAuthStorage()
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
      if ((error as { message?: string })?.message?.includes('phone')) {
        showToast('DB에 phone 컬럼이 없습니다. 전화번호 마이그레이션을 먼저 실행해 주세요.', 'error')
        return false
      }
      showToast('개인 정보 변경에 실패했습니다.', 'error')
      return false
    }

    const nextUser: AuthUser = { ...user, name: trimmedName, phone: trimmedPhone || null }
    setUser(nextUser)
    localStorage.setItem('currentVisitor', nextUser.name)
    setAuthSession(nextUser, isPersistentAuthSession())
    showToast('개인 정보가 변경되었습니다.', 'success')
    await fetchAllUsers()
    return true
  }

  // --- 관리자 전용 기능 ---

  const notifyUsersChanged = () => {
    if (typeof window === 'undefined') return
    window.dispatchEvent(new Event('app-users-changed'))
  }

  const fetchAllUsers = async () => {
    if (!user) return
    const { data, error } = await supabase
      .from('app_users')
      .select('id, name, phone, login_id, role, approval_status, group_name, created_at, last_login_at')
      .order('created_at', { ascending: false })

    if (!error && data) {
      const rows = data as Array<{ id: number; name: string; phone?: string | null; login_id: string | null; role: Role; approval_status?: AppUserRecord['approvalStatus'] | null; group_name?: string | null; created_at: string; last_login_at?: string | null }>
      setAllUsers(rows
        .filter((item) => user.role === 'developer' || !isDeveloperAccount(item))
        .map((item) => ({
          id: item.id,
          loginId: item.login_id ?? item.name,
          name: item.name,
          phone: item.phone ?? null,
          role: isDeveloperAccount(item) ? 'developer' : item.role,
          approvalStatus: item.approval_status ?? 'approved',
          groupName: item.group_name ?? null,
          created_at: item.created_at,
          lastLoginAt: item.last_login_at ?? null,
        })))
      return
    }

    if (
      error?.message?.includes('login_id') ||
      error?.message?.includes('phone') ||
      error?.message?.includes('approval_status') ||
      error?.message?.includes('group_name') ||
      error?.message?.includes('permission denied')
    ) {
      const fallback = await supabase
        .from('app_users')
        .select(error.message.includes('login_id') ? 'id, name, role, created_at' : 'id, name, login_id, role, created_at, last_login_at')
        .order('created_at', { ascending: false })
      if (!fallback.error && fallback.data) {
        setAllUsers((fallback.data as unknown as Array<{ id: number; name: string; login_id?: string | null; role: Role; created_at: string; last_login_at?: string | null }>)
          .filter((item) => user.role === 'developer' || !isDeveloperAccount(item))
          .map((item) => ({
            id: item.id,
            loginId: item.login_id ?? item.name,
            name: item.name,
            role: isDeveloperAccount(item) ? 'developer' : item.role,
            approvalStatus: 'approved',
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

  useEffect(() => {
    if (!user) return
    const onUsersChanged = () => {
      void fetchAllUsers()
    }
    window.addEventListener('app-users-changed', onUsersChanged)
    return () => window.removeEventListener('app-users-changed', onUsersChanged)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.role])

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

  /** 사용자 집단 지정 (한 명 = 한 집단, null/'' = 미지정). userIds 여러 개면 일괄 */
  const updateUsersGroup = async (userIds: number[], groupName: string | null) => {
    if (!isAdminLike(user?.role)) return false
    if (userIds.length === 0) return false
    const nextGroup = groupName && groupName.trim() ? groupName.trim() : null
    // select() 로 갱신된 행을 되받아 검증 — app_users 는 컬럼 단위 권한이라
    // group_name SELECT 권한이 없으면 에러 없이 조용히 반영 안 되는 것처럼 보임
    const { data, error } = await supabase
      .from('app_users')
      .update({ group_name: nextGroup })
      .in('id', userIds)
      .select('id, group_name')

    if (error) {
      if (error.message?.includes('group_name')) {
        showToast('DB에 group_name 컬럼/권한이 없습니다. supabase/add_app_users_group.sql 을 실행해 주세요.', 'error')
      } else {
        showToast('집단 지정에 실패했습니다.', 'error')
      }
      return false
    }

    const rows = (data ?? []) as Array<{ id: number; group_name?: string | null }>
    if (rows.length === 0) {
      showToast('집단이 저장되지 않았습니다. supabase/add_app_users_group.sql 의 grant 구문을 실행해 주세요.', 'error')
      return false
    }
    if (rows.some((row) => (row.group_name ?? null) !== nextGroup)) {
      showToast('집단 값이 반영되지 않았습니다. DB 권한(grant select … group_name)을 확인해 주세요.', 'error')
      return false
    }
    showToast(
      groupName ? `${userIds.length}명을 '${groupName}' 집단으로 지정했습니다.` : `${userIds.length}명의 집단을 해제했습니다.`,
      'success',
    )
    await fetchAllUsers()
    notifyUsersChanged()
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
    notifyUsersChanged()
    return true
  }

  const deleteUser = async (userId: number) => {
    if (!isAdminLike(user?.role)) return false
    if (user.id === userId) {
      showToast('현재 로그인한 관리자 계정은 제거할 수 없습니다.', 'error')
      return false
    }

    const targetName = allUsers.find((item) => item.id === userId)?.name ?? null

    const { error } = await supabase
      .from('app_users')
      .delete()
      .eq('id', userId)

    if (error) {
      showToast('사용자 제거에 실패했습니다.', 'error')
      return false
    }

    // 배정 잔재 정리: 카드 담당/배정, 정기방문 담당에서 이름 제거 (best-effort)
    // (이름 텍스트로 저장돼 있어 계정 삭제만으로는 배정 화면에 이름이 남음)
    if (targetName) {
      const cleanups = await Promise.all([
        supabase.from('card_leader_assignments').delete().eq('user_name', targetName),
        supabase.from('card_assignments').delete().eq('user_name', targetName),
        supabase.from('regular_visits').delete().eq('visitor_name', targetName),
      ])
      cleanups.forEach((r) => { if (r.error) console.warn('[deleteUser] 배정 정리 실패', r.error) })
    }

    showToast('사용자가 제거되었습니다.', 'success')
    await fetchAllUsers()
    notifyUsersChanged()
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
      .insert({ login_id: trimmedLoginId, name: trimmedName, pin: trimmedPin, role, approval_status: 'approved' })

    if (error) {
      if ((error as { message?: string })?.message?.includes('login_id')) {
        showToast('DB에 login_id 컬럼이 없습니다. SQL 마이그레이션을 먼저 실행해 주세요.', 'error')
        return false
      }
      if ((error as { message?: string })?.message?.includes('approval_status')) {
        const fallback = await supabase
          .from('app_users')
          .insert({ login_id: trimmedLoginId, name: trimmedName, pin: trimmedPin, role })
        if (!fallback.error) {
          showToast('사용자가 추가되었습니다.', 'success')
          await fetchAllUsers()
          notifyUsersChanged()
          return true
        }
      }
      showToast('사용자 추가에 실패했습니다.', 'error')
      return false
    }

    showToast('사용자가 추가되었습니다.', 'success')
    await fetchAllUsers()
    notifyUsersChanged()
    return true
  }

  const updateUserApprovalStatus = async (userId: number, approvalStatus: AppUserRecord['approvalStatus']) => {
    if (!isAdminLike(user?.role) || !approvalStatus) return false
    if (user.id === userId && approvalStatus !== 'approved') {
      showToast('현재 로그인한 계정은 차단할 수 없습니다.', 'error')
      return false
    }

    const { error } = await supabase
      .from('app_users')
      .update({ approval_status: approvalStatus })
      .eq('id', userId)

    if (error) {
      if ((error as { message?: string })?.message?.includes('approval_status')) {
        showToast('가입 승인 SQL 마이그레이션을 먼저 실행해 주세요.', 'error')
        return false
      }
      showToast('가입 신청 상태 변경에 실패했습니다.', 'error')
      return false
    }

    showToast(
      approvalStatus === 'approved'
        ? '가입 신청을 승인했습니다.'
        : approvalStatus === 'blocked'
          ? '가입 신청을 차단했습니다.'
          : '가입 신청을 승인 대기로 변경했습니다.',
      'success',
    )
    await fetchAllUsers()
    notifyUsersChanged()
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
      if ((error as { message?: string })?.message?.includes('login_id')) {
        showToast('DB에 login_id 컬럼이 없습니다. SQL 마이그레이션을 먼저 실행해 주세요.', 'error')
        return false
      }
      showToast('아이디/닉네임 변경에 실패했습니다.', 'error')
      return false
    }

    // 닉네임 변경 시 이름 텍스트로 저장된 배정/참여 데이터도 새 이름으로 이관 (best-effort)
    // (안 하면 옛 이름이 배정 화면에 잔재로 남고, 본인 배정을 잃어버림)
    if (target.name !== trimmedName) {
      const renames = await Promise.all([
        supabase.from('card_leader_assignments').update({ user_name: trimmedName }).eq('user_name', target.name),
        supabase.from('card_assignments').update({ user_name: trimmedName }).eq('user_name', target.name),
        supabase.from('regular_visits').update({ visitor_name: trimmedName }).eq('visitor_name', target.name),
        supabase.from('event_participants').update({ user_name: trimmedName }).eq('user_name', target.name),
        supabase.from('event_card_assignments').update({ user_name: trimmedName }).eq('user_name', target.name),
      ])
      renames.forEach((r) => { if (r.error) console.warn('[updateUserIdentity] 배정 이름 이관 실패', r.error) })
    }

    if (user.id === userId) {
      const nextUser: AuthUser = { ...user, loginId: trimmedLoginId, name: trimmedName }
      setUser(nextUser)
      localStorage.setItem('currentVisitor', nextUser.name)
      setAuthSession(nextUser, isPersistentAuthSession())
    }

    showToast('아이디/닉네임이 변경되었습니다.', 'success')
    await fetchAllUsers()
    notifyUsersChanged()
    return true
  }

  /** 내 로그인 기록 — 본인만 조회 가능 (RPC 사용) */
  const fetchMyLoginLogs = async (limit = 20) => {
    if (!user) return []
    const { data, error } = await supabase.rpc('get_login_logs', {
      p_user_id: user.id,
      p_since: null,
      p_limit: limit,
    })
    if (error) { console.error('fetchMyLoginLogs:', error); return [] }
    return (data ?? []) as LoginLogRecord[]
  }

  /** 특정 사용자의 로그인 기록 — developer만 조회 가능 (RPC 사용) */
  const fetchUserLoginLogs = async (userId: number, limit = 30) => {
    if (user?.role !== 'developer') return []
    const { data, error } = await supabase.rpc('get_login_logs', {
      p_user_id: userId,
      p_since: null,
      p_limit: limit,
    })
    if (error) { console.error('fetchUserLoginLogs:', error); return [] }
    return (data ?? []) as LoginLogRecord[]
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
    updateUsersGroup,
    deleteUser,
    createUser,
    updateUserIdentity,
    updateUserApprovalStatus,
    fetchMyLoginLogs,
    fetchUserLoginLogs,
  }
}
