import sys

with open('src/components/DesktopMap.tsx', 'r') as f:
    lines = f.readlines()

start_idx = -1
end_idx = -1

for i, line in enumerate(lines):
    if '<div className="unit-work-table">' in line:
        start_idx = i
    if line.strip() == '</div>' and '})}' in lines[i-1] and '</div>' in lines[i-3]:
        # heuristics to find end_idx
        pass

# Let's do exact line numbers: 712 to 879 (0-indexed)
# File lines 713 to 880
start_idx = 712
end_idx = 880

new_block = """                    <div className="unit-work-table" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {(strategyFilter === '전체'
                        ? building.units
                        : building.units.filter(unitMatchesStrategyFilter)
                      ).map((unit) => {
                        const unitHistories = visitHistories.filter((h) => h.unitId === unit.id)
                        const latestHistory = unitHistories[0]
                        const strategyChips = getVisitStrategyChips(unit, unitHistories)
                        return (
                          <div className={`modern-unit-card ${unit.isRegularVisit ? 'has-regular' : ''}`} key={unit.id}>
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
                                  onClick={() => onToggleChinese(building.id, unit.id)}
                                  title={unit.isChinese ? '중국인 배제' : '중국인 추가'}
                                  type="button"
                                >
                                  🇨🇳
                                </button>
                                <button
                                  className={unit.isRegularVisit ? 'icon-chip active-chip' : 'icon-chip'}
                                  disabled={unit.status !== '만남' && !unit.isRegularVisit}
                                  onClick={() => onToggleRegularVisit(building.id, unit.id)}
                                  title={unit.isRegularVisit ? '정기방문 해제' : '정기방문 등록'}
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
                                  className="danger-action"
                                  onClick={() => onDeleteUnit(building.id, unit.id)}
                                  style={{ padding: '6px 12px', fontSize: '13px', minHeight: 'auto', borderRadius: '999px', background: '#fee2e2', color: '#ef4444', border: 'none' }}
                                  type="button"
                                >
                                  삭제
                                </button>
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
                                        onUpdateUnitStatus(building.id, unit.id, result, visitMemo)
                                        setVisitMemo('')
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
                                  onChange={(e) => setVisitMemo(e.target.value)}
                                  placeholder="방문 메모를 입력하세요 (선택)"
                                  value={visitMemo}
                                />
                                
                                {unitHistories.length > 0 && (
                                  <div className="modern-history-list">
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                      <p style={{ margin: 0 }}>과거 방문 이력</p>
                                      {latestHistory && (
                                        <button
                                          onClick={() => onUndoLatestVisit(building.id, unit.id)}
                                          style={{ background: 'transparent', border: 'none', color: '#ef4444', fontSize: '12px', cursor: 'pointer', fontWeight: 600 }}
                                          type="button"
                                        >
                                          최근 1건 삭제
                                        </button>
                                      )}
                                    </div>
                                    {unitHistories.slice(0, 3).map((history) => (
                                      <div className="history-item" key={history.id}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                          <span>{history.visitedAt} {history.timeSlot} - {history.visitor} : <strong style={{color:'#111827'}}>{history.result}</strong></span>
                                          <button
                                            onClick={() => {
                                              setEditingHistoryId(history.id)
                                              setHistoryEditForm({
                                                result: history.result,
                                                timeSlot: history.timeSlot,
                                                memo: history.memo || '',
                                                visitedAt: history.visitedAt,
                                              })
                                            }}
                                            style={{ background: '#f1f5f9', border: 'none', color: '#475569', fontSize: '11px', cursor: 'pointer', padding: '4px 8px', borderRadius: '4px', fontWeight: 600 }}
                                            type="button"
                                          >
                                            수정
                                          </button>
                                        </div>
                                        {history.memo && <em style={{marginTop:'4px', display:'block'}}>{history.memo}</em>}
                                        
                                        {editingHistoryId === history.id && (
                                          <div className="history-edit-form" style={{ marginTop: '8px', padding: '12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                            <div className="form-group" style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                                              <input
                                                style={{ flex: 1, padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                                                type="date"
                                                value={historyEditForm.visitedAt}
                                                onChange={(e) => setHistoryEditForm(prev => ({ ...prev, visitedAt: e.target.value }))}
                                              />
                                              <select 
                                                 style={{ flex: 1, padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                                                 value={historyEditForm.timeSlot} 
                                                 onChange={(e) => setHistoryEditForm(prev => ({ ...prev, timeSlot: e.target.value } as any))}
                                              >
                                                <option value="오전">오전</option>
                                                <option value="오후">오후</option>
                                                <option value="저녁">저녁</option>
                                              </select>
                                              <select 
                                                 style={{ flex: 1, padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                                                 value={historyEditForm.result} 
                                                 onChange={(e) => setHistoryEditForm(prev => ({ ...prev, result: e.target.value } as any))}
                                              >
                                                <option value="만남">만남</option>
                                                <option value="부재">부재</option>
                                                <option value="거절">거절</option>
                                                <option value="한국인">한국인</option>
                                                <option value="확인필요">확인필요</option>
                                              </select>
                                            </div>
                                            <input
                                              style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', marginBottom: '8px' }}
                                              placeholder="메모를 수정하세요"
                                              value={historyEditForm.memo}
                                              onChange={(e) => setHistoryEditForm(prev => ({ ...prev, memo: e.target.value }))}
                                            />
                                            <div className="form-actions" style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                              <button type="button" onClick={() => setEditingHistoryId(null)} style={{ background: '#e2e8f0', color: '#475569', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '13px', fontWeight: 600 }}>취소</button>
                                              <button 
                                                type="button" 
                                                style={{ background: '#2563eb', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '13px', fontWeight: 600 }}
                                                onClick={() => {
                                                  onUpdateVisitHistory(history.id, unit.id, historyEditForm)
                                                  setEditingHistoryId(null)
                                                }}
                                              >
                                                저장완료
                                              </button>
                                            </div>
                                          </div>
                                        )}
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

lines[start_idx:end_idx] = [new_block]

with open('src/components/DesktopMap.tsx', 'w') as f:
    f.writelines(lines)

