import { useState } from 'react'
import { territoryAreasByRegion, territoryRegions } from '../data/territoryStructure'
import type { TerritoryCard, TerritoryRegion } from '../types'

/** 카드 목록에서 특정 지역/동의 다음 카드 번호를 반환 */
function getNextCardIndex(cards: TerritoryCard[], region: string, area: string): number {
  const indexes = cards
    .filter((card) => card.region === region && card.area === area)
    .map((card) => {
      const match = card.name.match(/(\d+)$/)
      return match ? Number(match[1]) : 0
    })
    .filter((index) => Number.isFinite(index))
  return Math.max(0, ...indexes) + 1
}

/**
 * 새 구역 카드 추가 모달
 * 자체 상태를 관리하고, 생성 완료 시 onCreated 를 통해 새 카드 정보를 부모에 전달합니다.
 */
export function CardCreateModal({
  cards,
  onClose,
  onCreateCard,
  onCreated,
}: {
  cards: TerritoryCard[]
  onClose: () => void
  onCreateCard: (input: {
    area: string
    region: string
    index: number
    pinCount: number
  }) => Promise<number | null> | number | null
  /** 카드 생성 성공 시 호출 — 부모에서 선택 카드 변경·구역선 안내 등에 활용 */
  onCreated: (newCardId: number, newCardName: string) => void
}) {
  const defaultRegion = territoryRegions[0] as TerritoryRegion
  const defaultArea = territoryAreasByRegion[defaultRegion]?.[0] ?? ''

  const [region, setRegion] = useState<string>(defaultRegion)
  const [area, setArea] = useState<string>(defaultArea)
  const [index, setIndex] = useState<number>(() => getNextCardIndex(cards, defaultRegion, defaultArea))
  const [pinCount, setPinCount] = useState(5)
  const [creating, setCreating] = useState(false)

  const cardName = `${region} ${area} ${index}`
  const isDuplicate = cards.some((card) => card.name === cardName)

  const handleRegionChange = (nextRegion: string) => {
    const nextArea = territoryAreasByRegion[nextRegion as keyof typeof territoryAreasByRegion]?.[0] ?? ''
    setRegion(nextRegion)
    setArea(nextArea)
    setIndex(getNextCardIndex(cards, nextRegion, nextArea))
  }

  const handleAreaChange = (nextArea: string) => {
    setArea(nextArea)
    setIndex(getNextCardIndex(cards, region, nextArea))
  }

  const handleCreate = async () => {
    if (isDuplicate || creating) return
    setCreating(true)
    const newCardId = await onCreateCard({ area, region, index, pinCount })
    setCreating(false)
    if (!newCardId) return
    onClose()
    onCreated(newCardId, cardName)
  }

  return (
    <div className="cal-modal-backdrop" onClick={onClose}>
      <div className="cal-modal" style={{ maxWidth: '440px' }} onClick={(e) => e.stopPropagation()}>
        <div className="cal-modal-head">
          <div className="cal-modal-title">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="12" y1="18" x2="12" y2="12" /><line x1="9" y1="15" x2="15" y2="15" />
            </svg>
            <h2>새 구역 카드 추가</h2>
          </div>
          <button className="cal-modal-close" onClick={onClose} type="button">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="cal-modal-body">
          <div className="cal-field-row">
            <div className="cal-field">
              <label>지역</label>
              <select
                className="cal-input"
                value={region}
                onChange={(e) => handleRegionChange(e.target.value)}
              >
                {territoryRegions.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
            <div className="cal-field">
              <label>동</label>
              <select
                className="cal-input"
                value={area}
                onChange={(e) => handleAreaChange(e.target.value)}
              >
                {(territoryAreasByRegion[region as keyof typeof territoryAreasByRegion] ?? []).map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="cal-field-row">
            <div className="cal-field">
              <label>번호</label>
              <input
                className="cal-input"
                min="1"
                type="number"
                value={index}
                onChange={(e) => setIndex(Number(e.target.value))}
              />
            </div>
            <div className="cal-field">
              <label>핀 수</label>
              <input
                className="cal-input"
                max="6"
                min="4"
                type="number"
                value={pinCount}
                onChange={(e) => setPinCount(Number(e.target.value))}
              />
            </div>
          </div>

          <div style={{ padding: '12px 14px', borderRadius: 'var(--r-md)', background: '#f3f4f6' }}>
            <span style={{ fontSize: '12px', color: 'var(--ink-500)', fontWeight: 700 }}>생성될 카드 이름</span>
            <p style={{ margin: '4px 0 0', fontSize: '16px', fontWeight: 700, color: 'var(--ink-900)' }}>{cardName}</p>
          </div>

          {isDuplicate && (
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--danger-600)', fontWeight: 700 }}>
              이미 같은 이름의 카드가 있습니다. 번호를 바꿔주세요.
            </p>
          )}
        </div>

        <div className="cal-modal-foot">
          <button className="cal-cancel-btn" onClick={onClose} type="button">취소</button>
          <button
            className="cal-save-btn"
            disabled={creating || isDuplicate}
            onClick={handleCreate}
            type="button"
          >
            {creating ? '생성 중...' : '카드 생성'}
          </button>
        </div>
      </div>
    </div>
  )
}
