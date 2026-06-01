// 화면1 — 팀 짓기 (사람 전용)
// 설계: docs/leader-assignment-redesign.md v3 §3.2
//
// 참가자 멀티선택 → "묶기" → 새 팀. 미배정 사람은 팀에 탭으로 추가.
// 각 팀의 [›] → 화면2(구역 배분). draft는 useAssignmentDraft 단일 reducer.

import { useMemo, useState } from 'react'
import type { Dispatch } from 'react'
import type { TerritoryCard } from '../../types'
import type { DraftAction, DraftTeam } from '../../hooks/assignmentDraft'
import { teamHex } from './teamColors'

type Props = {
  participants: string[]              // 일정 신청자 ∪ 배정자
  teams: DraftTeam[]
  cards: TerritoryCard[]
  canEdit: boolean
  dispatch: Dispatch<DraftAction>
  onOpenTeamZones: (teamId: string) => void
}

export function TeamBuildScreen({ participants, teams, cards, canEdit, dispatch, onOpenTeamZones }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const assignedSet = useMemo(
    () => new Set(teams.flatMap((t) => t.members)),
    [teams],
  )
  const unassigned = useMemo(
    () => participants.filter((p) => !assignedSet.has(p)),
    [participants, assignedSet],
  )

  const cardName = (id: number) => cards.find((c) => c.id === id)?.name ?? `카드 ${id}`

  // 이름 → 소속 팀 색 (배정된 사람 칩 dot용)
  const memberColor = useMemo(() => {
    const m = new Map<string, string>()
    teams.forEach((t) => t.members.forEach((name) => m.set(name, teamHex(t.color))))
    return m
  }, [teams])

  const toggleSelect = (name: string) => {
    if (!canEdit) return
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  const makeTeam = () => {
    if (selected.size === 0) return
    dispatch({ type: 'CREATE_TEAM', members: Array.from(selected) })
    setSelected(new Set())
  }

  return (
    <div className="asg-build">
      {/* 요약 바 */}
      <div className="asg-summary">
        <div className="asg-summary-stats">
          <span><b className="muted">신청</b> {participants.length}</span>
          <span><b className="muted">배정</b> {assignedSet.size}</span>
          <span><b className="muted">미배정</b> <em className={unassigned.length > 0 ? 'danger' : ''}>{unassigned.length}</em></span>
        </div>
      </div>

      {/* 신청자 풀 */}
      <section className="asg-build-pool">
        <div className="asg-build-pool-head">
          <h2>신청자 <small>배정 안 된 사람만 진하게</small></h2>
          {selected.size > 0 && (
            <button className="asg-build-group-btn" onClick={makeTeam} type="button">
              {selected.size}명 새 팀으로 묶기
            </button>
          )}
        </div>
        <div className="asg-chip-wrap">
          {participants.map((name) => {
            const isSel = selected.has(name)
            const isAssigned = assignedSet.has(name)
            return (
              <button
                key={name}
                type="button"
                className={`asg-person-chip${isSel ? ' is-sel' : ''}${isAssigned ? ' is-assigned' : ''}`}
                onClick={() => toggleSelect(name)}
                disabled={!canEdit}
              >
                {isAssigned && <span className="asg-person-dot" style={{ background: memberColor.get(name) }} aria-hidden="true" />}
                {name}
              </button>
            )
          })}
        </div>
        <p className="asg-build-hint">사람을 골라 묶으면 팀이 됩니다. 묶은 뒤 팀의 › 를 눌러 구역을 배정하세요.</p>
      </section>

      {/* 팀 목록 */}
      <section className="asg-team-list">
        {teams.length === 0 ? (
          <div className="asg-empty">아직 팀이 없습니다. 위에서 사람을 골라 묶어주세요.</div>
        ) : (
          teams.map((team) => (
            <article className="asg-team-row" key={team.id} style={{ borderLeftColor: teamHex(team.color) }}>
              <div style={{ position: 'relative' }}>
                <button
                  type="button"
                  className="asg-team-open"
                  onClick={() => onOpenTeamZones(team.id)}
                  style={{ paddingRight: canEdit ? 44 : 14 }}
                >
                  <div className="asg-team-main">

                  <div className="asg-team-name-line">
                    <span className="asg-team-dot" style={{ background: teamHex(team.color) }} />
                    <strong>{team.name}</strong>
                    <small>{team.members.length}명</small>
                  </div>
                  <div className="asg-team-members">
                    {team.members.length > 0 ? team.members.join(' · ') : '구성원 없음'}
                  </div>
                  <div className={`asg-team-zones${team.cardIds.length === 0 ? ' is-empty' : ''}`}>
                    {team.cardIds.length > 0
                      ? `${team.cardIds.map(cardName).slice(0, 2).join(' · ')}${team.cardIds.length > 2 ? ` 외 ${team.cardIds.length - 2}` : ''}`
                      : '구역 미배정'}
                  </div>
                                  </div>
                  <span className="asg-team-chev" aria-hidden="true" style={{ marginRight: canEdit ? 12 : 0 }}>›</span>
                </button>
                {canEdit && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      if (confirm(`${team.name}을(를) 삭제할까요?`)) dispatch({ type: 'DELETE_TEAM', teamId: team.id })
                    }}
                    style={{
                      position: 'absolute',
                      top: 12,
                      right: 6,
                      width: 32,
                      height: 32,
                      display: 'grid',
                      placeItems: 'center',
                      border: 'none',
                      background: 'transparent',
                      color: 'var(--muted)',
                      cursor: 'pointer'
                    }}
                    aria-label="팀 삭제"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                )}
              </div>
            </article>
          ))
        )}
      </section>

      {/* 미배정 사람 */}
      {unassigned.length > 0 && (
        <section className="asg-unassigned">
          <h3>미배정 {unassigned.length}명</h3>
          <div className="asg-chip-wrap">
            {unassigned.map((name) => (
              <button
                key={name}
                type="button"
                className="asg-person-chip is-unassigned"
                disabled={!canEdit || teams.length === 0}
                onClick={() => {
                  if (teams.length === 0) return
                  if (teams.length === 1) {
                    dispatch({ type: 'ADD_MEMBER', teamId: teams[0].id, name })
                    return
                  }
                  // 여러 팀이면 간단 선택 (prompt) — 추후 시트로 개선
                  const label = teams.map((t, i) => `${i + 1}. ${t.name}`).join('\n')
                  const pick = prompt(`${name}을(를) 어느 팀에?\n${label}\n번호 입력:`)
                  const idx = Number(pick) - 1
                  if (idx >= 0 && idx < teams.length) {
                    dispatch({ type: 'ADD_MEMBER', teamId: teams[idx].id, name })
                  }
                }}
              >+ {name}</button>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
