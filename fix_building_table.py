import re

with open('src/components/DesktopTerritory.tsx', 'r') as f:
    code = f.read()

# 1. Remove 정기, 메모 from header
code = code.replace(
'''              <span>다수</span>
              <span>정기</span>
              <span>메모</span>
              <span>작업</span>''',
'''              <span>다수</span>
              <span></span>'''
)

# 2. Remove from isEditing row
code = code.replace(
'''                        <button
                          className={`building-heavy-toggle${building.isChineseHeavy ? ' active' : ''}`}
                          onClick={() => toggleChineseHeavyBuilding(building)}
                          type="button"
                        >
                          {building.isChineseHeavy ? '다수' : '-'}
                        </button>
                        <span>{regularCount}건</span>
                        <input
                          aria-label="메모"
                          value={buildingEditDraft.memo}
                          onChange={(event) => setBuildingEditDraft((draft) => ({ ...draft, memo: event.target.value }))}
                        />
                        <span className="building-row-actions">''',
'''                        <button
                          className={`building-heavy-toggle${building.isChineseHeavy ? ' active' : ''}`}
                          onClick={() => toggleChineseHeavyBuilding(building)}
                          type="button"
                        >
                          {building.isChineseHeavy ? '다수' : '-'}
                        </button>
                        <span className="building-row-actions">'''
)

# 3. Remove from normal row
code = code.replace(
'''                        <button
                          className={`building-heavy-toggle${building.isChineseHeavy ? ' active' : ''}`}
                          onClick={() => toggleChineseHeavyBuilding(building)}
                          type="button"
                        >
                          {building.isChineseHeavy ? '다수' : '-'}
                        </button>
                        <span>{regularCount}건</span>
                        <span>{building.memo || '-'}</span>
                        <span className="building-row-actions">''',
'''                        <button
                          className={`building-heavy-toggle${building.isChineseHeavy ? ' active' : ''}`}
                          onClick={() => toggleChineseHeavyBuilding(building)}
                          type="button"
                        >
                          {building.isChineseHeavy ? '다수' : '-'}
                        </button>
                        <span className="building-row-actions">'''
)

# 4. Fix checkboxes in header and row (removing bulk-check)
code = code.replace(
'''              <label className="bulk-check">
                <input
                  checked={filteredBuildings.length > 0 && filteredBuildings.every((building) => checkedBuildingIds.has(building.id))}
                  onChange={toggleAllFilteredBuildings}
                  type="checkbox"
                />
              </label>''',
'''              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', paddingLeft: 6 }}>
                <input
                  checked={filteredBuildings.length > 0 && filteredBuildings.every((building) => checkedBuildingIds.has(building.id))}
                  onChange={toggleAllFilteredBuildings}
                  type="checkbox"
                />
              </div>'''
)

code = code.replace(
'''                    <label className="bulk-check">
                      <input
                        checked={checkedBuildingIds.has(building.id)}
                        onChange={() => toggleCheckedBuilding(building.id)}
                        type="checkbox"
                      />
                    </label>''',
'''                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', paddingLeft: 6 }}>
                      <input
                        checked={checkedBuildingIds.has(building.id)}
                        onChange={() => toggleCheckedBuilding(building.id)}
                        type="checkbox"
                      />
                    </div>'''
)

with open('src/components/DesktopTerritory.tsx', 'w') as f:
    f.write(code)

print("DesktopTerritory.tsx fixed")
