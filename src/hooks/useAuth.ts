import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { shouldForceRelogin } from '../lib/sessionRelogin'
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
import { t, currentLang } from '../i18n'
import { msg } from '../lib/msg'
import { describeDbError } from '../utils/dbError'
import { renameInNameList } from '../utils/nameList'

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

/**
 * 이름이 텍스트로 저장된 모든 곳을 새 이름으로 옮긴다.
 *
 * 이 앱은 배정·기록을 user_id 가 아니라 **이름 문자열**로 들고 있다.
 * 그래서 닉네임을 바꾸면 옛 이름이 남은 기록은 그 사람 것이 아니게 된다 —
 * 실제로 통계가 두 사람으로 갈라지고, 구역 인도자 배정을 잃어버리는 일이 있었다.
 * (예전에는 5개 테이블만 옮기고 방문 기록·봉사 세션은 빠져 있었다)
 *
 * 새 테이블에 이름 컬럼이 생기면 여기에도 추가할 것.
 */
async function migrateUserNameReferences(oldName: string, newName: string): Promise<void> {
  if (!oldName || oldName === newName) return

  // 1순위: 한 트랜잭션 RPC. 유니크 제약이 걸린 표는 옛 줄을 지워 합치고,
  // anon 이 못 쓰는 표(chat_messages / service_logs)까지 여기서만 옮길 수 있다.
  const token = getAuthToken()
  if (token) {
    const rpc = await supabase.rpc('rename_user_name_references', {
      p_token: token,
      p_old: oldName,
      p_new: newName,
    })
    if (!rpc.error) return
    console.warn('[migrateUserNameReferences] RPC 실패 — 레거시 경로로 시도', rpc.error)
  }

  // 폴백: RPC 가 아직 안 올라간 DB. 옮길 수 있는 만큼만 옮기고 실패는 알린다.
  const targets: Array<[table: string, column: string]> = [
    ['visit_histories', 'visitor_name'],
    ['service_sessions', 'user_name'],
    ['regular_visits', 'visitor_name'],
    ['card_leader_assignments', 'user_name'],
    ['card_assignments', 'user_name'],
    ['event_participants', 'user_name'],
    ['event_card_assignments', 'user_name'],
    ['event_card_assignment_cards', 'user_name'],
    ['event_restaurant_assignments', 'user_name'],
    ['event_informal_assignments', 'user_name'],
    ['cards', 'leader_name'],
    ['comments', 'author_name'],
    ['notices', 'author'],
    ['return_visits', 'assigned_user_name'],
    ['return_visits', 'created_by'],
    ['restaurant_requests', 'requested_by'],
    ['restaurant_requests', 'reviewer'],
    ['phone_surveys', 'checked_by'],
    ['phone_surveys', 'uploaded_by'],
  ]
  const results = await Promise.all(
    targets.map(([table, column]) =>
      supabase.from(table).update({ [column]: newName }).eq(column, oldName)),
  )
  const failed = results.filter((r) => r.error)
  results.forEach((r, i) => {
    if (r.error) console.warn('[migrateUserNameReferences] 이관 실패', targets[i][0], r.error)
  })

  // 일정 인도자는 "가, 나, 다" 로 한 칸에 들어 있어 eq 로 안 걸린다
  const { data: events } = await supabase
    .from('calendar_events')
    .select('id, leader_name')
    .like('leader_name', `%${oldName}%`)
  for (const ev of (events ?? []) as Array<{ id: number; leader_name: string | null }>) {
    const next = renameInNameList(ev.leader_name, oldName, newName)
    if (next === (ev.leader_name ?? '')) continue
    const { error } = await supabase.from('calendar_events').update({ leader_name: next }).eq('id', ev.id)
    if (error) failed.push({ error } as (typeof results)[number])
  }

  if (failed.length > 0) {
    showToast(msg('옛 이름으로 남은 기록 일부를 옮기지 못했습니다. 관리자에게 알려 주세요.'), 'error')
  }
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

            // ⚠⚠ **토큰이 없거나 서버에서 무효면 자동 로그인하지 않는다.**
            //
            //   2026-08-30 봉사 중에 이것 때문에 크게 터졌다. 세션은 30일 뒤
            //   만료되는데 앱은 localStorage 만 보고 로그인 상태로 뒀다.
            //   그래서 **토큰이 만료된 줄도 모르고 쓰던 사람이 62명 중 38명**이었고,
            //   쓰기에 세션 관문을 걸자 그들의 방문 기록·배정이 전부 실패했다.
            //   화면은 멀쩡한데 저장만 안 되는, 제일 나쁜 모양이었다.
            //
            //   토큰이 살아 있는지 서버에 물어보고(그때 만료도 30일 연장된다),
            //   아니면 **로그인 화면으로 보낸다.** 한 번 다시 로그인하면
            //   그 뒤로는 쓰는 한 안 끊긴다.
            let tokenOk = false
            if (restoredToken) {
              const { error: verifyError } = await supabase.rpc('verify_session', { p_token: restoredToken })
              // ⚠ 오류를 뭉뚱그리면 안 된다. 서버가 **거부**한 것만 다시 로그인시키고,
              //   서버에 **못 닿은 것**(지하·신호 끊김)은 그대로 둔다 — 안 그러면
              //   봉사 중에 쫓겨난다. (`lib/sessionRelogin.ts`)
              tokenOk = !shouldForceRelogin(verifyError)
              if (verifyError) console.warn('[auth] verify_session 오류:', verifyError.code ?? '(네트워크)', verifyError.message)
            }
            if (!tokenOk) {
              clearAuthStorage()
              localStorage.removeItem('currentVisitor')
              if (!cancelled) setLoading(false)
              return
            }

            const freshUser = { ...toAuthUser(data), authToken: restoredToken ?? null }
            setUser(freshUser)
            localStorage.setItem('currentVisitor', freshUser.name)
            setAuthSession(freshUser, storedSession.persistent)
            if (restoredToken) setAuthToken(restoredToken, storedSession.persistent)
            
            // 자동 로그인 기록 (실패해도 로그인 흐름을 끊지 않는다)
            // ⚠ `try/catch` 만으로는 못 잡는다 — supabase 는 DB 오류를 **던지지 않고**
            //   `{ error }` 로 돌려준다. 그래서 예전에는 기록이 안 쌓여도 아무 흔적이
            //   없었고, '로그인 기록이 8월 10일에 멈춘 것' 을 늦게야 알았다.
            try {
              const { error: recordError } = await supabase.rpc('auth_record_auto_login', {
                p_user_id: data.id,
                p_device_label: getDeviceLabel(),
                p_user_agent: typeof navigator === 'undefined' ? null : navigator.userAgent
              })
              if (recordError) console.warn('[auth] 자동 로그인 기록 실패:', recordError.message)
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
        showToast(msg('로그인 중 오류가 발생했습니다.'), 'error')
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
        showToast(msg('아이디 또는 비밀번호가 일치하지 않습니다.'), 'error')
        return false
      }

      if (row.approval_status === 'pending') {
        showToast(msg('가입 신청이 승인 대기 중입니다.'), 'info')
        return false
      }

      if (row.approval_status === 'blocked') {
        showToast(t(currentLang(), 'auth.signupBlocked'), 'error')
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

      showToast(msg('로그인 성공!'), 'success')
      return true
    } catch (err) {
      console.error(err)
      showToast(msg('로그인 중 오류가 발생했습니다.'), 'error')
      return false
    }
  }

  const signup = async (loginId: string, name: string, pin: string) => {
    // ⚠ app_users 에 직접 insert 하지 않는다. 가입은 로그인 전이라 세션 헤더가 없고,
    //   무엇보다 **역할과 승인 상태를 클라이언트가 정하면 안 된다** —
    //   가입하면서 자기를 admin 으로 만들 수 있다. 서버가 user/pending 을 강제한다.
    try {
      const rpc = await supabase.rpc('signup_tx', {
        p_login_id: loginId,
        p_name: name,
        p_pin: pin,
      })
      if (rpc.error) {
        console.error('[signup]', rpc.error)
        showToast(describeDbError(msg('가입 신청에 실패했습니다.'), rpc.error), 'error')
        return false
      }
      const result = rpc.data as { ok?: boolean; message?: string } | null
      if (!result?.ok) {
        showToast(msg(result?.message ?? '가입 신청에 실패했습니다.'), 'error')
        return false
      }
      showToast(t(currentLang(), 'auth.signupRequested'), 'success')
      return true
    } catch (err) {
      console.error(err)
      showToast(msg('회원가입 중 오류가 발생했습니다.'), 'error')
      return false
    }
  }

  const logout = () => {
    setUser(null)
    clearSentryUser()
    clearAuthStorage()
    localStorage.removeItem('currentVisitor')
    showToast(t(currentLang(), 'auth.loggedOut'))
  }

  // 비밀번호 변경 (본인용)
  const changePin = async (newPin: string) => {
    if (!user) return false
    const { error } = await supabase
      .from('app_users')
      .update({ pin: newPin })
      .eq('id', user.id)

    if (error) {
      showToast(msg('비밀번호 변경에 실패했습니다.'), 'error')
      return false
    }
    showToast(t(currentLang(), 'auth.pwChanged'), 'success')
    return true
  }

  const updateMyProfile = async (input: { name: string; phone?: string | null }) => {
    if (!user) return false
    const trimmedName = input.name.trim()
    const trimmedPhone = input.phone?.trim() ?? ''

    if (!trimmedName) {
      showToast(msg('닉네임을 입력해 주세요.'), 'error')
      return false
    }

    const { data: duplicatedName, error: nameCheckError } = await supabase
      .from('app_users')
      .select('id')
      .eq('name', trimmedName)
      .neq('id', user.id)
      .maybeSingle()

    if (nameCheckError) {
      showToast(msg('닉네임 중복 확인 중 오류가 발생했습니다.'), 'error')
      return false
    }
    if (duplicatedName) {
      showToast(msg('이미 사용 중인 닉네임입니다.'), 'error')
      return false
    }

    const previousName = user.name
    const { error } = await supabase
      .from('app_users')
      .update({ name: trimmedName, phone: trimmedPhone || null })
      .eq('id', user.id)

    if (error) {
      if ((error as { message?: string })?.message?.includes('phone')) {
        showToast(msg('DB에 phone 컬럼이 없습니다. 전화번호 마이그레이션을 먼저 실행해 주세요.'), 'error')
        return false
      }
      showToast(msg('개인 정보 변경에 실패했습니다.'), 'error')
      return false
    }

    // 이름이 바뀌면 이름으로 저장된 기록도 함께 옮긴다 —
    // 안 하면 본인 방문 기록·봉사 시간이 옛 이름에 남아 통계가 갈라진다
    await migrateUserNameReferences(previousName, trimmedName)

    const nextUser: AuthUser = { ...user, name: trimmedName, phone: trimmedPhone || null }
    setUser(nextUser)
    localStorage.setItem('currentVisitor', nextUser.name)
    setAuthSession(nextUser, isPersistentAuthSession())
    showToast(t(currentLang(), 'auth.infoChanged'), 'success')
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
      showToast(msg('비밀번호 초기화에 실패했습니다.'), 'error')
      return false
    }
    showToast(t(currentLang(), 'auth.pwChanged') + ` (${newPin})`, 'success')
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
        showToast(msg('DB에 group_name 컬럼/권한이 없습니다. supabase/applied/add_app_users_group.sql 을 실행해 주세요.'), 'error')
      } else {
        showToast(msg('집단 지정에 실패했습니다.'), 'error')
      }
      return false
    }

    const rows = (data ?? []) as Array<{ id: number; group_name?: string | null }>
    if (rows.length === 0) {
      showToast(msg('집단이 저장되지 않았습니다. supabase/applied/add_app_users_group.sql 의 grant 구문을 실행해 주세요.'), 'error')
      return false
    }
    if (rows.some((row) => (row.group_name ?? null) !== nextGroup)) {
      showToast(msg('집단 값이 반영되지 않았습니다. DB 권한(grant select … group_name)을 확인해 주세요.'), 'error')
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

  /** 집단 이름 변경 — 그 집단에 속한 사용자들의 group_name 도 함께 이관 */
  const renameUserGroup = async (oldName: string, newName: string) => {
    if (!isAdminLike(user?.role)) return false
    const from = oldName.trim()
    const to = newName.trim()
    if (!from || !to || from === to) return false

    const { error } = await supabase
      .from('app_users')
      .update({ group_name: to })
      .eq('group_name', from)

    if (error) {
      showToast(msg('집단 이름 변경에 실패했습니다.'), 'error')
      return false
    }
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
      showToast(msg('권한 변경에 실패했습니다.'), 'error')
      return false
    }
    showToast(t(currentLang(), 'auth.permissionChanged'), 'success')
    await fetchAllUsers()
    notifyUsersChanged()
    return true
  }

  const deleteUser = async (userId: number) => {
    if (!isAdminLike(user?.role)) return false
    if (user.id === userId) {
      showToast(msg('현재 로그인한 관리자 계정은 제거할 수 없습니다.'), 'error')
      return false
    }

    const targetName = allUsers.find((item) => item.id === userId)?.name ?? null

    const { error } = await supabase
      .from('app_users')
      .delete()
      .eq('id', userId)

    if (error) {
      showToast(msg('사용자 제거에 실패했습니다.'), 'error')
      return false
    }

    // 이름 잔재 정리 — 지난 기록은 남기고 앞으로의 것만 뗀다.
    // (예전에는 세 표만 치워서, 지운 사람이 미래 일정의 인도자 줄과
    //  팀 배정에 유령으로 남았다. 인도자는 쉼표 목록이라 더 안 걸렸다)
    if (targetName) {
      const token = getAuthToken()
      const purge = token
        ? await supabase.rpc('purge_user_name_references', { p_token: token, p_name: targetName })
        : { error: { message: 'no token' } }
      if (purge.error) {
        console.warn('[deleteUser] 이름 정리 RPC 실패 — 레거시 경로', purge.error)
        const cleanups = await Promise.all([
          supabase.from('card_leader_assignments').delete().eq('user_name', targetName),
          supabase.from('card_assignments').delete().eq('user_name', targetName),
          supabase.from('regular_visits').delete().eq('visitor_name', targetName),
        ])
        if (cleanups.some((r) => r.error)) {
          showToast(msg('계정은 지웠지만 배정에 남은 이름을 다 치우지 못했습니다.'), 'error')
        }
      }
    }

    showToast(t(currentLang(), 'auth.userRemoved'), 'success')
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
      showToast(msg('아이디, 닉네임, 비밀번호를 모두 입력해 주세요.'), 'error')
      return false
    }


    const { data: existingLoginId, error: loginIdCheckError } = await supabase
      .from('app_users')
      .select('id')
      .eq('login_id', trimmedLoginId)
      .maybeSingle()

    if (loginIdCheckError) {
      showToast(msg('아이디 중복 확인 중 오류가 발생했습니다.'), 'error')
      return false
    }
    if (existingLoginId) {
      showToast(msg('이미 사용 중인 아이디입니다.'), 'error')
      return false
    }

    const { data: existingName, error: nameCheckError } = await supabase
      .from('app_users')
      .select('id')
      .eq('name', trimmedName)
      .maybeSingle()

    if (nameCheckError) {
      showToast(msg('닉네임 중복 확인 중 오류가 발생했습니다.'), 'error')
      return false
    }
    if (existingName) {
      showToast(msg('이미 사용 중인 닉네임입니다.'), 'error')
      return false
    }

    const { error } = await supabase
      .from('app_users')
      .insert({ login_id: trimmedLoginId, name: trimmedName, pin: trimmedPin, role, approval_status: 'approved' })

    if (error) {
      if ((error as { message?: string })?.message?.includes('login_id')) {
        showToast(msg('DB에 login_id 컬럼이 없습니다. SQL 마이그레이션을 먼저 실행해 주세요.'), 'error')
        return false
      }
      if ((error as { message?: string })?.message?.includes('approval_status')) {
        const fallback = await supabase
          .from('app_users')
          .insert({ login_id: trimmedLoginId, name: trimmedName, pin: trimmedPin, role })
        if (!fallback.error) {
          showToast(t(currentLang(), 'auth.userAdded'), 'success')
          await fetchAllUsers()
          notifyUsersChanged()
          return true
        }
      }
      showToast(msg('사용자 추가에 실패했습니다.'), 'error')
      return false
    }

    showToast(t(currentLang(), 'auth.userAdded'), 'success')
    await fetchAllUsers()
    notifyUsersChanged()
    return true
  }

  const updateUserApprovalStatus = async (userId: number, approvalStatus: AppUserRecord['approvalStatus']) => {
    if (!isAdminLike(user?.role) || !approvalStatus) return false
    if (user.id === userId && approvalStatus !== 'approved') {
      showToast(msg('현재 로그인한 계정은 차단할 수 없습니다.'), 'error')
      return false
    }

    const { error } = await supabase
      .from('app_users')
      .update({ approval_status: approvalStatus })
      .eq('id', userId)

    if (error) {
      if ((error as { message?: string })?.message?.includes('approval_status')) {
        showToast(msg('가입 승인 SQL 마이그레이션을 먼저 실행해 주세요.'), 'error')
        return false
      }
      showToast(msg('가입 신청 상태 변경에 실패했습니다.'), 'error')
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
      showToast(msg('아이디와 닉네임을 모두 입력해 주세요.'), 'error')
      return false
    }


    const target = allUsers.find((item) => item.id === userId)
    if (!target) {
      showToast(msg('사용자 정보를 찾을 수 없습니다.'), 'error')
      return false
    }

    const duplicatedLoginId = allUsers.some((item) => item.id !== userId && item.loginId === trimmedLoginId)
    if (duplicatedLoginId) {
      showToast(msg('이미 사용 중인 아이디입니다.'), 'error')
      return false
    }

    const duplicatedName = allUsers.some((item) => item.id !== userId && item.name === trimmedName)
    if (duplicatedName) {
      showToast(msg('이미 사용 중인 닉네임입니다.'), 'error')
      return false
    }

    const { error } = await supabase
      .from('app_users')
      .update({ login_id: trimmedLoginId, name: trimmedName })
      .eq('id', userId)

    if (error) {
      if ((error as { message?: string })?.message?.includes('login_id')) {
        showToast(msg('DB에 login_id 컬럼이 없습니다. SQL 마이그레이션을 먼저 실행해 주세요.'), 'error')
        return false
      }
      showToast(msg('아이디/닉네임 변경에 실패했습니다.'), 'error')
      return false
    }

    // 닉네임 변경 시 이름 텍스트로 저장된 배정/참여 데이터도 새 이름으로 이관 (best-effort)
    // (안 하면 옛 이름이 배정 화면에 잔재로 남고, 본인 배정을 잃어버림)
    if (target.name !== trimmedName) {
      await migrateUserNameReferences(target.name, trimmedName)
    }

    if (user.id === userId) {
      const nextUser: AuthUser = { ...user, loginId: trimmedLoginId, name: trimmedName }
      setUser(nextUser)
      localStorage.setItem('currentVisitor', nextUser.name)
      setAuthSession(nextUser, isPersistentAuthSession())
    }

    showToast(t(currentLang(), 'auth.idChanged'), 'success')
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
    renameUserGroup,
    deleteUser,
    createUser,
    updateUserIdentity,
    updateUserApprovalStatus,
    fetchMyLoginLogs,
    fetchUserLoginLogs,
  }
}
