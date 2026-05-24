import re

with open('src/components/DesktopTerritory.tsx', 'r') as f:
    code = f.read()

# Replace Layer 3 (Building management and Point management)
target = '''          {/* Layer 3: 건물 관리 필터 */}
          {activeTab === '건물 관리' && buildingSubTab === '건물 목록' && (
            <div className="tbl-filter-layer" style={{ gap: 12 }}>
              <span className="tbl-filter-label">유형</span>
              <div className="tbl-mini-seg">
                {(['전체', '상가', '주택'] as Array<Building['type'] | '전체'>).map((f) => (
                  <button key={f} className={buildingTypeFilter === f ? 'active' : ''} onClick={() => setBuildingTypeFilter(f)} type="button">{f}</button>
                ))}
              </div>
              <span className="tbl-filter-label">카드</span>
              <select className="tbl-filter-select" value={buildingCardFilter} onChange={(e) => setBuildingCardFilter(e.target.value === '전체' ? '전체' : Number(e.target.value))}>
                <option value="전체">전체 카드</option>
                {unassignedCardId && (
                  <option value={unassignedCardId}>⚠ 미배정 건물</option>
                )}
                {filteredCards.filter((c) => c.id !== unassignedCardId).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <button
                className={`tbl-filter-toggle${buildingFilterPanelOpen ? ' active' : ''}`}
                onClick={() => setBuildingFilterPanelOpen((open) => !open)}
                type="button"
              >
                필터
                {activeAdvancedBuildingFilterCount > 0 && <span>{activeAdvancedBuildingFilterCount}</span>}
              </button>
              {buildingFilterPanelOpen && (
                <div className="tbl-advanced-filter-panel">
                  <div className="tbl-filter-group">
                    <span className="tbl-filter-label">정기방문</span>
                    <div className="tbl-mini-seg">
                      {(['전체', '있음', '없음'] as const).map((f) => (
                        <button key={f} className={buildingRegularFilter === f ? 'active' : ''} onClick={() => setBuildingRegularFilter(f)} type="button">{f}</button>
                      ))}
                    </div>
                  </div>
                  <div className="tbl-filter-group">
                    <span className="tbl-filter-label">메모</span>
                    <div className="tbl-mini-seg">
                      {(['전체', '있음', '없음'] as const).map((f) => (
                        <button key={f} className={buildingMemoFilter === f ? 'active' : ''} onClick={() => setBuildingMemoFilter(f)} type="button">{f}</button>
                      ))}
                    </div>
                  </div>
                  <div className="tbl-filter-group">
                    <span className="tbl-filter-label">중국인 다수</span>
                    <div className="tbl-mini-seg">
                      {(['전체', '있음', '없음'] as const).map((f) => (
                        <button key={f} className={buildingChineseHeavyFilter === f ? 'active' : ''} onClick={() => setBuildingChineseHeavyFilter(f)} type="button">{f}</button>
                      ))}
                    </div>
                  </div>
                  <button
                    className="tbl-filter-reset"
                    disabled={activeAdvancedBuildingFilterCount === 0}
                    onClick={() => {
                      setBuildingRegularFilter('전체')
                      setBuildingMemoFilter('전체')
                      setBuildingChineseHeavyFilter('전체')
                    }}
                    type="button"
                  >
                    초기화
                  </button>
                </div>
              )}
            </div>
          )}
          {activeTab === '건물 관리' && buildingSubTab === '건물 목록' && (
            <div className="tbl-filter-layer tbl-filter-layer--sort">
              <span className="tbl-filter-label">정렬</span>
              <div className="tbl-mini-seg">
                {(['카드', '건물', '주소', '유형'] as BuildingSortKey[]).map((key) => (
                  <button key={key} className={buildingSort.key === key ? 'active' : ''} onClick={() => setBuildingSort((prev) => prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' })} type="button">
                    {key}{buildingSort.key === key ? (buildingSort.dir === 'asc' ? ' ↑' : ' ↓') : ''}
                  </button>
                ))}
              </div>
            </div>
          )}
          {activeTab === '건물 관리' && buildingSubTab === '중국인 포인트' && (
            <div className="tbl-filter-layer" style={{ gap: 12 }}>
              <span className="tbl-filter-label">상태</span>
              <select className="tbl-filter-select" value={pointStatusFilter} onChange={(e) => setPointStatusFilter(e.target.value as UnitStatus | '전체')}>
                <option value="전체">전체 상태</option>
                <option value="미방문">미방문</option>
                <option value="만남">만남</option>
                <option value="부재">부재</option>
                <option value="한국인">한국인</option>
              </select>
              <button
                className={`tbl-filter-toggle${pointFilterPanelOpen ? ' active' : ''}`}
                onClick={() => setPointFilterPanelOpen((open) => !open)}
                type="button"
              >
                필터
                {activeAdvancedPointFilterCount > 0 && <span>{activeAdvancedPointFilterCount}</span>}
              </button>
              {pointFilterPanelOpen && (
                <div className="tbl-advanced-filter-panel">
                  <div className="tbl-filter-group">
                    <span className="tbl-filter-label">정기방문</span>
                    <div className="tbl-mini-seg">
                      {(['전체', '있음', '없음'] as const).map((f) => (
                        <button key={f} className={pointRegularFilter === f ? 'active' : ''} onClick={() => setPointRegularFilter(f)} type="button">{f}</button>
                      ))}
                    </div>
                  </div>
                  <div className="tbl-filter-group">
                    <span className="tbl-filter-label">메모</span>
                    <div className="tbl-mini-seg">
                      {(['전체', '있음', '없음'] as const).map((f) => (
                        <button key={f} className={pointMemoFilter === f ? 'active' : ''} onClick={() => setPointMemoFilter(f)} type="button">{f}</button>
                      ))}
                    </div>
                  </div>
                  <button
                    className="tbl-filter-reset"
                    disabled={activeAdvancedPointFilterCount === 0}
                    onClick={() => {
                      setPointRegularFilter('전체')
                      setPointMemoFilter('전체')
                    }}
                    type="button"
                  >
                    초기화
                  </button>
                </div>
              )}
            </div>
          )}'''

replacement = '''          {/* Layer 3: 건물 목록 필터 및 정렬 */}
          {activeTab === '건물 관리' && buildingSubTab === '건물 목록' && (
            <div className="tbl-filter-layer">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span className="tbl-filter-label" style={{ fontWeight: 700 }}>필터</span>
                <select className="tbl-filter-select" value={buildingTypeFilter} onChange={(e) => setBuildingTypeFilter(e.target.value as Building['type'] | '전체')}>
                  <option value="전체">유형: 전체</option>
                  <option value="상가">상가</option>
                  <option value="주택">주택</option>
                </select>
                <select className="tbl-filter-select" value={buildingChineseHeavyFilter} onChange={(e) => setBuildingChineseHeavyFilter(e.target.value as any)}>
                  <option value="전체">중국인: 전체</option>
                  <option value="있음">다수 건물</option>
                </select>
                <select className="tbl-filter-select" value={buildingCardFilter} onChange={(e) => setBuildingCardFilter(e.target.value === '전체' ? '전체' : Number(e.target.value))}>
                  <option value="전체">카드: 전체</option>
                  {unassignedCardId && <option value={unassignedCardId}>⚠ 미배정 건물</option>}
                  {filteredCards.filter((c) => c.id !== unassignedCardId).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div style={{ flex: 1 }} />

              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span className="tbl-filter-label" style={{ fontWeight: 700 }}>정렬</span>
                <div className="tbl-mini-seg">
                  {(['카드', '건물', '주소', '유형'] as BuildingSortKey[]).map((key) => (
                    <button key={key} className={buildingSort.key === key ? 'active' : ''} onClick={() => setBuildingSort((prev) => prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' })} type="button">
                      {key}{buildingSort.key === key ? (buildingSort.dir === 'asc' ? ' ↑' : ' ↓') : ''}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
          {/* Layer 3: 중국인 포인트 필터 및 정렬 */}
          {activeTab === '건물 관리' && buildingSubTab === '중국인 포인트' && (
            <div className="tbl-filter-layer">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span className="tbl-filter-label" style={{ fontWeight: 700 }}>필터</span>
                <select className="tbl-filter-select" value={pointStatusFilter} onChange={(e) => setPointStatusFilter(e.target.value as UnitStatus | '전체')}>
                  <option value="전체">상태: 전체</option>
                  <option value="미방문">미방문</option>
                  <option value="만남">만남</option>
                  <option value="부재">부재</option>
                  <option value="한국인">한국인</option>
                </select>
                <select className="tbl-filter-select" value={pointRegularFilter} onChange={(e) => setPointRegularFilter(e.target.value as any)}>
                  <option value="전체">정기방문: 전체</option>
                  <option value="있음">정기 대상</option>
                </select>
                <select className="tbl-filter-select" value={pointMemoFilter} onChange={(e) => setPointMemoFilter(e.target.value as any)}>
                  <option value="전체">메모: 전체</option>
                  <option value="있음">메모 있음</option>
                </select>
              </div>

              <div style={{ flex: 1 }} />

              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span className="tbl-filter-label" style={{ fontWeight: 700 }}>정렬</span>
                <div className="tbl-mini-seg">
                  {(['카드', '건물/주소', '최근방문'] as PointSortKey[]).map((key) => (
                    <button key={key} className={pointSort.key === key ? 'active' : ''} onClick={() => setPointSort((prev) => prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' })} type="button">
                      {key}{pointSort.key === key ? (pointSort.dir === 'asc' ? ' ↑' : ' ↓') : ''}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}'''

if target in code:
    with open('src/components/DesktopTerritory.tsx', 'w') as f:
        f.write(code.replace(target, replacement))
    print("UI fixed successfully!")
else:
    print("UI target not found! Here is what we found at that location:")
    import subprocess
    subprocess.run(["sed", "-n", "2250,2300p", "src/components/DesktopTerritory.tsx"])
