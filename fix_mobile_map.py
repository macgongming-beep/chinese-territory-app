import sys

# Replace the entire MobileMap.tsx with the correctly assembled version that includes isChinese, expandedUnitId, and the modern UI.
content = """import { useState } from 'react'
import { MapCanvas } from './MapCanvas'
import type { Building, CardBoundary, TerritoryCard, UnitStatus, VisitHistory } from '../types'
import { visitResults } from '../types'
import { getCardName } from '../utils/mapUtils'
import { getVisitStrategyChips } from '../utils/visitStrategy'

export function MobileMap({
  buildings,
  cardBoundaries,
  cards,
  currentVisitor,
  onBack,
  onToggleRegularVisit,
  onToggleChinese,
  onUndoLatestVisit,
  onUpdateUnitStatus,
  visitHistories,
}: {
  buildings: Building[]
  cardBoundaries: CardBoundary[]
  cards: TerritoryCard[]
  currentVisitor: string
  onBack: () => void
  onToggleRegularVisit: (buildingId: number, unitId: number) => void
  onToggleChinese: (buildingId: number, unitId: number) => void
  onUndoLatestVisit: (buildingId: number, unitId: number) => void
  onUpdateUnitStatus: (buildingId: number, unitId: number, status: UnitStatus, memo?: string) => void
  visitHistories: VisitHistory[]
}) {
  const [mobileMemo, setMobileMemo] = useState('')
  const [expandedUnitId, setExpandedUnitId] = useState<number | null>(null)
  
  const userCardIds = cards
    .filter((card) => card.assignedUsers.includes(currentVisitor))
    .map((card) => card.id)
  const visibleBuildings = buildings.filter((b) => userCardIds.includes(b.cardId))
  const mapBuildings = visibleBuildings.length > 0 ? visibleBuildings : buildings
  const [selectedBuildingId, setSelectedBuildingId] = useState(
    mapBuildings[0]?.id ?? buildings[0]?.id,
  )
  const selectedBuilding =
    mapBuildings.find((b) => b.id === selectedBuildingId) ?? mapBuildings[0]

  return (
    <main className="mobile-map-shell">
      <header className="mobile-map-header">
        <button onClick={onBack} type="button">
          뒤로
        </button>
        <div>
          <p>내 카드 지도</p>
          <h1>{currentVisitor} 배정 구역</h1>
        </div>
      </header>

      <div className="mobile-card-strip">
        {(visibleBuildings.length > 0 ? cards.filter((card) => userCardIds.includes(card.id)) : cards)
          .slice(0, 4)
          .map((card) => (
            <span key={card.id}>{card.name}</span>
          ))}
      </div>

      <div className="mobile-map-container">
        <MapCanvas
          buildings={mapBuildings}
          cardBoundaries={cardBoundaries.filter((cb) => userCardIds.includes(cb.cardId))}
          cards={cards}
          onBuildingClick={setSelectedBuildingId}
          selectedBuildingId={selectedBuildingId}
        />
      </div>

      <section className="mobile-bottom-sheet">
        <div className="sheet-handle" />
        <h2>
          {selectedBuilding.name}
          <small>{getCardName(cards, selectedBuilding.cardId)}</small>
        </h2>
        <p className="building-address">{selectedBuilding.address}</p>

        <div className="mobile-unit-list" style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '0 16px', overflowY: 'auto', maxHeight: 'calc(100vh - 400px)' }}>
          {selectedBuilding.units.map((unit) => {
            const unitHistories = visitHistories.filter((h) => h.unitId === unit.id)
            const latestHistory = unitHistories[0]
            const strategyChips = getVisitStrategyChips(unit, unitHistories)
            
            return (
              <div className={`modern-unit-card ${unit.isRegularVisit ? 'has-regular' : ''}`} key={unit.id} style={{ marginBottom: 0 }}>
                <div className="modern-unit-header">
                  <div className="unit-title-group">
                    <strong>{unit.number}</strong>
                    <span className={`unit-status status-${unit.status}`}>{unit.status}</span>
                    {strategyChips.map((chip) => (
                      <span className={`strategy-chip ${chip.tone}`} key={`${unit.id}-${chip.label}`} style={{ fontSize: '11px', padding: '2px 6px', height: 'auto', marginLeft: '4px' }}>
                        {chip.label}
                      </span>
                    ))}
                  </div>
                  <div className="unit-properties-chips">
                    <button
                      className={unit.isChinese ? 'icon-chip active-chip' : 'icon-chip'}
                      onClick={() => onToggleChinese(selectedBuilding.id, unit.id)}
                      type="button"
                    >
                      🇨🇳
                    </button>
                    <button
                      className={unit.isRegularVisit ? 'icon-chip active-chip' : 'icon-chip'}
                      disabled={unit.status !== '만남' && !unit.isRegularVisit}
                      onClick={() => onToggleRegularVisit(selectedBuilding.id, unit.id)}
                      type="button"
                    >
                      ⭐
                    </button>
                  </div>
                </div>

                <div className="modern-unit-action-bar" style={{borderTop: 'none', paddingTop: 0}}>
                  <div className="recent-log-text">
                    {latestHistory ? (
                      <span>최근: {latestHistory.visitedAt} ({latestHistory.result})</span>
                    ) : (
                      <span>이력 없음</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      className="expand-action-btn"
                      onClick={() => setExpandedUnitId(expandedUnitId === unit.id ? null : unit.id)}
                      type="button"
                      style={{ padding: '6px 12px' }}
                    >
                      {expandedUnitId === unit.id ? '닫기 ∧' : '기록 추가 〉'}
                    </button>
                  </div>
                </div>

                {expandedUnitId === unit.id && (
                  <div className="modern-unit-expanded">
                    <label>새 방문 기록</label>
                    <div className="modern-action-grid">
                      {visitResults.map((result) => (
                        <button
                          key={result}
                          className={unit.status === result ? 'modern-btn-active' : 'modern-btn'}
                          onClick={() => {
                            onUpdateUnitStatus(selectedBuilding.id, unit.id, result, mobileMemo)
                            setMobileMemo('')
                            setExpandedUnitId(null)
                          }}
                          type="button"
                        >
                          {result}
                        </button>
                      ))}
                    </div>
                    <input
                      className="modern-memo-input"
                      onChange={(e) => setMobileMemo(e.target.value)}
                      placeholder="방문 메모 입력 (선택)"
                      value={mobileMemo}
                    />
                    {unitHistories.length > 0 && (
                      <div className="modern-history-list">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <p style={{ margin: 0 }}>과거 이력</p>
                          {latestHistory && (
                            <button
                              onClick={() => onUndoLatestVisit(selectedBuilding.id, unit.id)}
                              style={{ background: 'transparent', border: 'none', color: '#ef4444', fontSize: '12px', cursor: 'pointer', fontWeight: 600 }}
                              type="button"
                            >
                              최근 삭제
                            </button>
                          )}
                        </div>
                        {unitHistories.slice(0, 3).map((history) => (
                          <div className="history-item" key={history.id}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span>{history.visitedAt} {history.timeSlot} - {history.visitor} : <strong style={{color:'#111827'}}>{history.result}</strong></span>
                            </div>
                            {history.memo && <em style={{marginTop:'4px', display:'block'}}>{history.memo}</em>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </section>
    </main>
  )
}
"""

with open('src/components/MobileMap.tsx', 'w') as f:
    f.write(content)
