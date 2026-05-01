import { useState } from 'react'

/**
 * 건물 상세 패널에서 호수를 추가하는 행 컴포넌트.
 * 단일 추가 + 일괄(층/호 설정) 추가를 지원합니다.
 */
export function AddUnitRow({
  buildingId,
  existingNumbers,
  onAdd,
}: {
  buildingId: number
  existingNumbers: Set<string>
  onAdd: (buildingId: number, unitNumber: string) => void
}) {
  const [value, setValue] = useState('')
  const [showBulk, setShowBulk] = useState(false)
  const [startFloor, setStartFloor] = useState(1)
  const [endFloor, setEndFloor] = useState(3)
  const [unitsPerFloor, setUnitsPerFloor] = useState(5)
  const [startUnit, setStartUnit] = useState(1)
  const [hasBasement, setHasBasement] = useState(false)
  const [basementFloors, setBasementFloors] = useState(1)
  const [adding, setAdding] = useState(false)

  const handleAdd = () => {
    if (!value.trim()) return
    onAdd(buildingId, value.trim())
    setValue('')
  }

  // 미리보기 생성 (지하 + 지상)
  const preview = (() => {
    const list: string[] = []
    const upf = Math.max(1, unitsPerFloor)
    const su = Math.max(1, startUnit)
    // 지하 (B층 → B101, B102...)
    if (hasBasement) {
      const bf = Math.max(1, basementFloors)
      for (let f = bf; f >= 1; f--) {
        for (let u = su; u < su + upf; u++) {
          list.push(`B${f}${String(u).padStart(2, '0')}`)
        }
      }
    }
    // 지상
    const sf = Math.max(1, startFloor)
    const ef = Math.max(sf, endFloor)
    for (let f = sf; f <= ef; f++) {
      for (let u = su; u < su + upf; u++) {
        list.push(`${f}${String(u).padStart(2, '0')}`)
      }
    }
    return list
  })()

  const newOnes = preview.filter((n) => !existingNumbers.has(n))
  const skipped = preview.length - newOnes.length

  const handleBulkAdd = async () => {
    if (newOnes.length === 0) return
    setAdding(true)
    for (const num of newOnes) {
      await new Promise<void>((resolve) => {
        onAdd(buildingId, num)
        setTimeout(resolve, 30)
      })
    }
    setAdding(false)
    setShowBulk(false)
  }

  return (
    <div className="unit-add-section">
      {/* 단일 추가 행 */}
      <div className="building-unit-row building-unit-add-row">
        <input
          className="unit-number-input"
          placeholder="호수 입력"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleAdd() }}
        />
        <span className="unit-row-actions">
          <button onClick={handleAdd} type="button">+ 추가</button>
          <button
            className={`unit-bulk-toggle${showBulk ? ' active' : ''}`}
            onClick={() => setShowBulk((v) => !v)}
            type="button"
          >
            일괄 추가 {showBulk ? '▴' : '▾'}
          </button>
        </span>
      </div>

      {/* 일괄 추가 패널 */}
      {showBulk && (
        <div className="unit-bulk-panel">
          {/* 지상층 설정 */}
          <div className="unit-bulk-section-label">지상</div>
          <div className="unit-bulk-fields">
            <label className="unit-bulk-field">
              <span>시작층</span>
              <input type="number" min={1} value={startFloor}
                onChange={(e) => setStartFloor(Number(e.target.value))} />
            </label>
            <span className="unit-bulk-sep">~</span>
            <label className="unit-bulk-field">
              <span>끝층</span>
              <input type="number" min={startFloor} value={endFloor}
                onChange={(e) => setEndFloor(Number(e.target.value))} />
            </label>
            <label className="unit-bulk-field">
              <span>층당 호수</span>
              <input type="number" min={1} value={unitsPerFloor}
                onChange={(e) => setUnitsPerFloor(Number(e.target.value))} />
            </label>
            <label className="unit-bulk-field">
              <span>시작 호번호</span>
              <input type="number" min={1} value={startUnit}
                onChange={(e) => setStartUnit(Number(e.target.value))} />
            </label>
          </div>

          {/* 지하 설정 */}
          <div className="unit-bulk-basement-row">
            <label className="unit-bulk-checkbox-label">
              <input
                type="checkbox"
                checked={hasBasement}
                onChange={(e) => setHasBasement(e.target.checked)}
              />
              지하 포함
            </label>
            {hasBasement && (
              <>
                <label className="unit-bulk-field">
                  <span>지하 층수</span>
                  <input type="number" min={1} value={basementFloors}
                    onChange={(e) => setBasementFloors(Number(e.target.value))} />
                </label>
                <span className="unit-bulk-basement-hint">
                  B{basementFloors}층 ~ B1층 · 층당 {unitsPerFloor}개
                  → B{basementFloors}{String(startUnit).padStart(2, '0')} ~ B1{String(startUnit + unitsPerFloor - 1).padStart(2, '0')}
                </span>
              </>
            )}
          </div>

          {/* 미리보기 */}
          <div className="unit-bulk-preview">
            <div className="unit-bulk-preview-label">
              미리보기 &nbsp;
              <strong>총 {newOnes.length}개 추가</strong>
              {skipped > 0 && (
                <span className="unit-bulk-skip"> · {skipped}개 이미 있어 자동 스킵</span>
              )}
            </div>
            <div className="unit-bulk-preview-grid">
              {preview.map((n) => (
                <span key={n} className={`unit-bulk-chip${n.startsWith('B') ? ' basement' : ''}${existingNumbers.has(n) ? ' skip' : ''}`}>
                  {n}호
                </span>
              ))}
            </div>
          </div>

          <div className="unit-bulk-footer">
            <button
              className="unit-bulk-add-btn"
              disabled={newOnes.length === 0 || adding}
              onClick={handleBulkAdd}
              type="button"
            >
              {adding ? '추가 중...' : `${newOnes.length}개 추가하기`}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
