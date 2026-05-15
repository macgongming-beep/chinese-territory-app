import { useMemo, useState } from 'react'
import { showToast } from '../lib/toast'
import type { TerritoryCard } from '../types'

function getCardLeaders(card: TerritoryCard) {
  return card.assignedLeaders && card.assignedLeaders.length > 0
    ? card.assignedLeaders
    : card.assignedLeader
      ? [card.assignedLeader]
      : []
}

export function MobileAdminAssignment({
  cards,
  leaderNames = [],
  onSetCardLeaders,
}: {
  cards: TerritoryCard[]
  leaderNames?: string[]
  onSetCardLeaders: (cardId: number, leaders: string[], options?: { silentSuccess?: boolean }) => Promise<void> | void
}) {
  const [step, setStep] = useState<1 | 2>(1)
  const [selectedLeader, setSelectedLeader] = useState<string | null>(leaderNames[0] ?? null)
  const [leaderSearch, setLeaderSearch] = useState('')
  const [cardQuery, setCardQuery] = useState('')
  const [regionFilter, setRegionFilter] = useState('전체')
  const [areaFilter, setAreaFilter] = useState('전체')
  const [onlyUnassigned, setOnlyUnassigned] = useState(false)
  const [selectMode, setSelectMode] = useState(false)
  const [selectedCardIds, setSelectedCardIds] = useState<Set<number>>(() => new Set())
  const [bulkAssigning, setBulkAssigning] = useState(false)

  const leaders = useMemo(() => {
    const names = leaderNames.length > 0
      ? leaderNames
      : Array.from(new Set(cards.flatMap((card) => getCardLeaders(card))))
    return names.sort((a, b) => a.localeCompare(b, 'ko'))
  }, [cards, leaderNames])

  const filteredLeaders = useMemo(
    () => leaders.filter((leader) => leader.includes(leaderSearch.trim())),
    [leaderSearch, leaders],
  )

  const regions = useMemo(
    () => Array.from(new Set(cards.map((card) => card.region))).sort((a, b) => a.localeCompare(b, 'ko')),
    [cards],
  )

  const areas = useMemo(
    () => Array.from(new Set(
      cards
        .filter((card) => regionFilter === '전체' || card.region === regionFilter)
        .map((card) => card.area),
    )).sort((a, b) => a.localeCompare(b, 'ko')),
    [cards, regionFilter],
  )

  const leaderCards = useMemo(() => {
    if (!selectedLeader) return []
    return cards.filter((card) => getCardLeaders(card).includes(selectedLeader))
  }, [cards, selectedLeader])

  const filteredCards = useMemo(() => {
    const query = cardQuery.trim().toLowerCase()
    return cards.filter((card) => {
      const cardLeaders = getCardLeaders(card)
      if (regionFilter !== '전체' && card.region !== regionFilter) return false
      if (areaFilter !== '전체' && card.area !== areaFilter) return false
      if (onlyUnassigned && cardLeaders.length > 0) return false
      if (!query) return true
      return `${card.name} ${card.region} ${card.area}`.toLowerCase().includes(query)
    })
  }, [areaFilter, cardQuery, cards, onlyUnassigned, regionFilter])

  const filteredCardIds = useMemo(() => filteredCards.map((card) => card.id), [filteredCards])
  const filteredSelectedCount = filteredCardIds.filter((cardId) => selectedCardIds.has(cardId)).length
  const allFilteredSelected = filteredCardIds.length > 0 && filteredSelectedCount === filteredCardIds.length

  const toggleSelectMode = () => {
    setSelectMode((current) => !current)
    setSelectedCardIds(new Set())
  }

  const toggleSelectCard = (cardId: number) => {
    setSelectedCardIds((current) => {
      const next = new Set(current)
      if (next.has(cardId)) {
        next.delete(cardId)
      } else {
        next.add(cardId)
      }
      return next
    })
  }

  const toggleSelectAll = () => {
    setSelectedCardIds((current) => {
      if (allFilteredSelected) {
        const next = new Set(current)
        filteredCardIds.forEach((cardId) => next.delete(cardId))
        return next
      }
      return new Set([...current, ...filteredCardIds])
    })
  }

  const assignCard = async (card: TerritoryCard) => {
    if (!selectedLeader) {
      showToast('인도자를 먼저 선택하세요.', 'info')
      return
    }
    const cardLeaders = getCardLeaders(card)
    if (cardLeaders.includes(selectedLeader)) {
      showToast('이미 배정된 카드입니다.', 'info')
      return
    }
    await Promise.resolve(onSetCardLeaders(card.id, [...cardLeaders, selectedLeader], { silentSuccess: true }))
    showToast(`${card.name} 배정 완료`)
  }

  const releaseCard = async (card: TerritoryCard) => {
    if (!selectedLeader) return
    await Promise.resolve(onSetCardLeaders(card.id, getCardLeaders(card).filter((leader) => leader !== selectedLeader), { silentSuccess: true }))
    showToast(`${card.name} 배정을 해제했습니다.`)
  }

  const assignSelectedCards = async () => {
    if (!selectedLeader) {
      showToast('인도자를 먼저 선택하세요.', 'info')
      return
    }
    if (selectedCardIds.size === 0) {
      showToast('선택한 구역이 없습니다.', 'info')
      return
    }

    setBulkAssigning(true)
    let assignedCount = 0

    await Promise.all(Array.from(selectedCardIds).map((cardId) => {
      const card = cards.find((item) => item.id === cardId)
      if (!card) return Promise.resolve()
      const cardLeaders = getCardLeaders(card)
      if (cardLeaders.includes(selectedLeader)) return Promise.resolve()
      assignedCount += 1
      return Promise.resolve(onSetCardLeaders(card.id, [...cardLeaders, selectedLeader], { silentSuccess: true }))
    }))

    setBulkAssigning(false)
    setSelectedCardIds(new Set())
    setSelectMode(false)
    showToast(
      assignedCount > 0 ? `${assignedCount}개 구역을 배정했습니다.` : '새로 배정할 구역이 없습니다.',
      assignedCount > 0 ? 'success' : 'info',
    )
  }

  const unassignedCount = cards.filter((card) => getCardLeaders(card).length === 0).length

  return (
    <section className="maa-page">
      <header className="maa-header maa-header--subhead">
        <p>인도자에게 담당 구역을 지정합니다.</p>
        <span>미배정 {unassignedCount}개</span>
      </header>

      <div className="maa-step-tabs" role="tablist" aria-label="관리자 배정 단계">
        <button className={step === 1 ? 'active' : ''} onClick={() => setStep(1)} type="button">
          <span>1</span> 인도자 선택
        </button>
        <button className={step === 2 ? 'active' : ''} disabled={!selectedLeader} onClick={() => setStep(2)} type="button">
          <span>2</span> 전체 구역
        </button>
      </div>

      {step === 1 && (
        <>
          <section className="maa-panel">
            <div className="maa-section-title">
              <h2>인도자 선택</h2>
              {selectedLeader && <span>담당 {leaderCards.length}개</span>}
            </div>
            <input className="maa-search" placeholder="인도자 검색" value={leaderSearch} onChange={(event) => setLeaderSearch(event.target.value)} />
            <div className="maa-leader-list">
              {filteredLeaders.map((leader) => (
                <button
                  className={selectedLeader === leader ? 'active' : ''}
                  key={leader}
                  onClick={() => setSelectedLeader(leader)}
                  type="button"
                >
                  <strong>{leader}</strong>
                  <span>담당 구역 {cards.filter((card) => getCardLeaders(card).includes(leader)).length}개</span>
                </button>
              ))}
            </div>
          </section>

          {selectedLeader && (
            <section className="maa-panel">
              <div className="maa-section-title">
                <h2>{selectedLeader} 담당 구역</h2>
                <span>{leaderCards.length}개</span>
              </div>
              {leaderCards.length === 0 ? (
                <p className="maa-empty">담당 구역이 없습니다.</p>
              ) : (
                <div className="maa-assigned-list">
                  {leaderCards.map((card) => (
                    <article key={card.id}>
                      <div>
                        <strong>{card.name}</strong>
                        <span>{card.region} · {card.area}</span>
                      </div>
                      <button onClick={() => void releaseCard(card)} type="button">해제</button>
                    </article>
                  ))}
                </div>
              )}
              <button className="maa-next-btn" onClick={() => setStep(2)} type="button">
                전체 구역에서 배정하기
              </button>
            </section>
          )}
        </>
      )}

      {step === 2 && (
        <section className="maa-panel">
          <div className="maa-section-title">
            <h2>전체 구역 목록</h2>
            <span>{filteredCards.length}개</span>
          </div>
          <div className="maa-selected-leader">
            <div>
              <span>선택 인도자</span>
              <strong>{selectedLeader ?? '인도자 선택 필요'}</strong>
            </div>
            <button onClick={() => setStep(1)} type="button">변경</button>
          </div>
          <div className="maa-filters">
            <input className="maa-search" placeholder="구역명 또는 동 검색" value={cardQuery} onChange={(event) => setCardQuery(event.target.value)} />
            <select
              value={regionFilter}
              onChange={(event) => {
                setRegionFilter(event.target.value)
                setAreaFilter('전체')
              }}
            >
              <option value="전체">전체 지역</option>
              {regions.map((region) => <option key={region} value={region}>{region}</option>)}
            </select>
            <select value={areaFilter} onChange={(event) => setAreaFilter(event.target.value)}>
              <option value="전체">동 전체</option>
              {areas.map((area) => <option key={area} value={area}>{area}</option>)}
            </select>
            <label>
              <input type="checkbox" checked={onlyUnassigned} onChange={(event) => setOnlyUnassigned(event.target.checked)} />
              미배정만
            </label>
          </div>
          <div className="maa-select-tools">
            <button className={selectMode ? 'active' : ''} onClick={toggleSelectMode} type="button">
              선택 모드
            </button>
            {selectMode && (
              <>
                <button onClick={toggleSelectAll} type="button">
                  {allFilteredSelected ? '전체 해제' : '전체 선택'}
                </button>
                <span>{filteredSelectedCount}개 선택</span>
              </>
            )}
          </div>
          {selectMode && (
            <div className="maa-selection-bar">
              <strong>{selectedCardIds.size}개 선택됨</strong>
              <div>
                <button onClick={() => setSelectedCardIds(new Set())} type="button">선택 해제</button>
                <button disabled={bulkAssigning || selectedCardIds.size === 0} onClick={() => void assignSelectedCards()} type="button">
                  선택 배정
                </button>
              </div>
            </div>
          )}
          <div className="maa-card-list">
            {filteredCards.map((card) => {
              const cardLeaders = getCardLeaders(card)
              const alreadyAssigned = !!selectedLeader && cardLeaders.includes(selectedLeader)
              const selected = selectedCardIds.has(card.id)
              return (
                <article
                  className={`${selectMode ? 'selecting' : ''} ${selected ? 'selected' : ''}`}
                  key={card.id}
                  onClick={() => {
                    if (selectMode) toggleSelectCard(card.id)
                  }}
                >
                  {selectMode && (
                    <input
                      aria-label={`${card.name} 선택`}
                      checked={selected}
                      className="maa-card-check"
                      onChange={() => toggleSelectCard(card.id)}
                      onClick={(event) => event.stopPropagation()}
                      type="checkbox"
                    />
                  )}
                  <div>
                    <strong>{card.name}</strong>
                    <span>{card.region} · {card.area} · 세대 {card.units}</span>
                    <em>{cardLeaders.length > 0 ? cardLeaders.join(', ') : '미배정'}</em>
                  </div>
                  {!selectMode && (
                    <button disabled={alreadyAssigned} onClick={() => void assignCard(card)} type="button">
                      {alreadyAssigned ? '배정됨' : '배정'}
                    </button>
                  )}
                </article>
              )
            })}
          </div>
        </section>
      )}
    </section>
  )
}
