import sys

with open('src/components/MobileMap.tsx', 'r') as f:
    lines = f.readlines()

# find hook insertion point
for i, line in enumerate(lines):
    if 'const [mobileMemo, setMobileMemo] = useState' in line:
        lines.insert(i+1, "  const [expandedUnitId, setExpandedUnitId] = useState<number | null>(null)\n")
        break

# find the unit-list rendering logic
start_idx = -1
end_idx = -1
for i, line in enumerate(lines):
    if '<div className="mobile-unit-list">' in line:
        start_idx = i
    # The end of the mobile-unit-list
    if '</div>' in line and '          )' in lines[i-1] and '        </div>' in lines[i+1]:
        end_idx = i + 1

if start_idx != -1 and end_idx != -1:
    pass

new_block = """        <div className="mobile-unit-list" style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '0 16px' }}>
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

                <div className="modern-unit-action-bar">
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
                    >
                      {expandedUnitId === unit.id ? '닫기 ∧' : '기록 추가 〉'}
                    </button>
                  </div>
                </div>

                {expandedUnitId === unit.id && (
                  <div className="modern-unit-expanded">
                    <label>새 방문 결과 등록</label>
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
        </div>\n"""

# since I added a line for useState, the indices might shift if I re-find them, but python lists handle it if I do it cleanly
with open('src/components/MobileMap.tsx', 'w') as f:
    f.writelines(lines[:start_idx] + [new_block] + lines[end_idx:])

