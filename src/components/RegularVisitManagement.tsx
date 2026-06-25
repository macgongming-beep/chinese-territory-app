// 정기방문 관리 (방식 A) — 관리자: 목록 + 재배정/해제, 개발자: + 상단 진단 통계
//
// 끊김 판정: 담당자(assignedUserName)가 비었거나 현재 활성 사용자 명단에 없음 (전출/계정삭제)
// 방치(stale) 판정: 마지막 방문이 90일+ 전이거나 기록 없음
// 데이터는 모두 클라이언트 계산 (새 SQL 없음). "해제" = return_visits 행 삭제(등록 해제), 건물·호수 안 건드림.

import { useMemo, useState } from 'react'
import type { ReturnVisit } from '../types'
import type { AppLanguage } from '../i18n'
import { confirmDialog } from '../lib/confirm'
import { formatRelativeVisitDate } from '../utils/returnVisits'
import { matchesName } from '../utils/koreanSearch'

const STALE_DAYS = 90

type ActiveUser = { name: string; role: string; approvalStatus?: 'pending' | 'approved' | 'blocked' }

type Props = {
  returnVisits: ReturnVisit[]
  activeUsers: ActiveUser[]
  isDeveloper: boolean
  language?: AppLanguage
  onReassign: (id: number, newAssignee: string) => Promise<void> | void
  onDelete: (id: number) => Promise<void> | void
}

function isStale(rv: ReturnVisit): boolean {
  if (!rv.lastVisitedAt) return true
  const cutoff = Date.now() - STALE_DAYS * 24 * 60 * 60 * 1000
  return new Date(rv.lastVisitedAt).getTime() < cutoff
}

export function RegularVisitManagement({ returnVisits, activeUsers, isDeveloper, language = 'ko', onReassign, onDelete }: Props) {
  const [onlyBroken, setOnlyBroken] = useState(false)
  const [reassignTarget, setReassignTarget] = useState<ReturnVisit | null>(null)
  const [pickerQuery, setPickerQuery] = useState('')

  // 활성(승인된) 사용자 이름 집합 — 끊김 판정 + 재배정 후보
  const activeNames = useMemo(
    () => new Set(activeUsers.filter((u) => u.approvalStatus !== 'blocked').map((u) => u.name)),
    [activeUsers],
  )

  const isBroken = (rv: ReturnVisit) => !rv.assignedUserName.trim() || !activeNames.has(rv.assignedUserName.trim())

  const stats = useMemo(() => {
    let broken = 0, stale = 0, noOwner = 0
    for (const rv of returnVisits) {
      if (!rv.assignedUserName.trim()) noOwner++
      if (isBroken(rv)) broken++
      if (isStale(rv)) stale++
    }
    return { total: returnVisits.length, broken, stale, noOwner }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [returnVisits, activeNames])

  const list = useMemo(() => {
    const arr = onlyBroken ? returnVisits.filter(isBroken) : returnVisits
    // 끊긴 것 → 오래된 것 → 나머지 순 정렬
    return [...arr].sort((a, b) => {
      const ba = isBroken(a) ? 0 : 1, bb = isBroken(b) ? 0 : 1
      if (ba !== bb) return ba - bb
      return (a.lastVisitedAt ?? '').localeCompare(b.lastVisitedAt ?? '')
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [returnVisits, onlyBroken, activeNames])

  const reassignCandidates = useMemo(
    () => activeUsers
      .filter((u) => u.approvalStatus !== 'blocked')
      .filter((u) => matchesName(u.name, pickerQuery))
      .sort((a, b) => a.name.localeCompare(b.name, 'ko')),
    [activeUsers, pickerQuery],
  )

  const handleDelete = async (rv: ReturnVisit) => {
    const ok = await confirmDialog({
      message: `"${rv.nickname || rv.displayName}" 정기방문을 해제할까요?\n등록만 풀리고 호수·방문기록은 그대로 남습니다.`,
      danger: true,
      confirmLabel: '정기방문 해제',
    })
    if (ok) await onDelete(rv.id)
  }

  const doReassign = async (name: string) => {
    if (!reassignTarget) return
    await onReassign(reassignTarget.id, name)
    setReassignTarget(null)
    setPickerQuery('')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '4px 0 40px' }}>
      {/* 개발자 전용 진단 통계 */}
      {isDeveloper && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
          {[
            { label: '전체', value: stats.total, color: 'var(--ink)' },
            { label: '끊긴 담당', value: stats.broken, color: 'var(--status-danger)' },
            { label: '90일+ 방치', value: stats.stale, color: '#ea580c' },
            { label: '담당 없음', value: stats.noOwner, color: 'var(--muted)' },
          ].map((s) => (
            <div key={s.label} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>{s.label}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: s.color, fontVariantNumeric: 'tabular-nums' }}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* 끊긴 것만 보기 토글 */}
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--ink)', cursor: 'pointer' }}>
        <input type="checkbox" checked={onlyBroken} onChange={(e) => setOnlyBroken(e.target.checked)} style={{ width: 16, height: 16, accentColor: 'var(--status-danger)' }} />
        담당자가 끊긴 정기방문만 보기 {stats.broken > 0 && <span style={{ color: 'var(--status-danger)', fontWeight: 700 }}>({stats.broken})</span>}
      </label>

      {/* 목록 */}
      {list.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--muted)', fontSize: 13 }}>
          {onlyBroken ? '끊긴 정기방문이 없어요 👍' : '정기방문이 없습니다'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {list.map((rv) => {
            const broken = isBroken(rv)
            const stale = isStale(rv)
            return (
              <div key={rv.id} style={{ background: 'var(--surface)', border: `1px solid ${broken ? 'var(--status-danger)' : 'var(--line)'}`, borderRadius: 12, padding: '12px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>{rv.nickname || rv.displayName}</div>
                    {rv.address && <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 2 }}>{rv.address}</div>}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                      {/* 담당자 배지 */}
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600,
                        padding: '2px 8px', borderRadius: 6,
                        background: broken ? 'rgba(220,38,38,0.1)' : 'var(--bg-muted)',
                        color: broken ? 'var(--status-danger)' : 'var(--muted)',
                      }}>
                        <span style={{ width: 6, height: 6, borderRadius: 99, background: broken ? 'var(--status-danger)' : 'var(--status-ok, #16a34a)' }} />
                        {rv.assignedUserName.trim() || '담당 없음'}{broken && rv.assignedUserName.trim() ? ' · 전출/삭제' : ''}
                      </span>
                      {/* 마지막 방문 */}
                      <span style={{ fontSize: 12, color: stale ? '#ea580c' : 'var(--muted)' }}>
                        {rv.lastVisitedAt ? formatRelativeVisitDate(rv.lastVisitedAt, language) : '방문 기록 없음'}
                      </span>
                    </div>
                  </div>
                </div>
                {/* 액션 */}
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <button type="button" onClick={() => { setReassignTarget(rv); setPickerQuery('') }}
                    style={{ flex: 1, minHeight: 0, padding: '8px 10px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                      border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--ink)', cursor: 'pointer' }}>
                    담당자 재배정
                  </button>
                  <button type="button" onClick={() => handleDelete(rv)}
                    style={{ flex: 1, minHeight: 0, padding: '8px 10px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                      border: '1px solid var(--danger-100, rgba(220,38,38,0.25))', background: 'rgba(220,38,38,0.06)', color: 'var(--status-danger)', cursor: 'pointer' }}>
                    정기방문 해제
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* 재배정 피커 (오버레이) */}
      {reassignTarget && (
        <div
          onClick={() => setReassignTarget(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'flex-end' }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxHeight: '70vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)', borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: '16px 16px max(20px, env(safe-area-inset-bottom))' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>담당자 재배정</div>
            <div style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 12 }}>"{reassignTarget.nickname || reassignTarget.displayName}" 을(를) 맡을 봉사자 선택</div>
            <input
              value={pickerQuery}
              onChange={(e) => setPickerQuery(e.target.value)}
              placeholder="이름 검색 (초성 가능)"
              style={{ minHeight: 0, padding: '10px 12px', border: '1px solid var(--line)', borderRadius: 10, fontSize: 14, marginBottom: 10, background: 'var(--surface)', color: 'var(--ink)' }}
            />
            <div style={{ overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, alignContent: 'start' }}>
              {reassignCandidates.length === 0 ? (
                <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '24px 0', color: 'var(--muted)', fontSize: 13 }}>해당하는 사용자가 없어요</div>
              ) : reassignCandidates.map((u) => (
                <button key={u.name} type="button" onClick={() => doReassign(u.name)}
                  style={{
                    minHeight: 0, padding: '10px 6px', borderRadius: 9,
                    border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink)',
                    fontSize: 13.5, fontWeight: 600, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                  {u.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
