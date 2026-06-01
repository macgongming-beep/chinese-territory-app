// 모바일 호수 일괄 추가 바텀시트
// 층 범위 + 층당 호수 + 시작 호번호 (+ 지하) → 미리보기 → 일괄 추가
import { useState } from 'react'
import { generateBulkUnits } from '../utils/bulkUnits'

export function MobileBulkUnitSheet({
  buildingId,
  buildingName,
  existingNumbers,
  onAdd,
  onClose,
}: {
  buildingId: number
  buildingName: string
  existingNumbers: Set<string>
  onAdd: (buildingId: number, unitNumber: string) => void
  onClose: () => void
}) {
  const [startFloor, setStartFloor] = useState(1)
  const [endFloor, setEndFloor] = useState(3)
  const [unitsPerFloor, setUnitsPerFloor] = useState(5)
  const [startUnit, setStartUnit] = useState(1)
  const [hasBasement, setHasBasement] = useState(false)
  const [basementFloors, setBasementFloors] = useState(1)
  const [adding, setAdding] = useState(false)

  const preview = generateBulkUnits({ startFloor, endFloor, unitsPerFloor, startUnit, hasBasement, basementFloors })
  const newOnes = preview.filter((n) => !existingNumbers.has(n))
  const skipped = preview.length - newOnes.length

  const handleAdd = async () => {
    if (newOnes.length === 0 || adding) return
    setAdding(true)
    for (const num of newOnes) {
      await new Promise<void>((resolve) => {
        onAdd(buildingId, num)
        setTimeout(resolve, 25)
      })
    }
    setAdding(false)
    onClose()
  }

  const renderStepper = (label: string, value: number, set: (n: number) => void, min = 1) => (
    <div className="mbu-field">
      <span className="mbu-field-label">{label}</span>
      <div className="mbu-stepper">
        <button type="button" onClick={() => set(Math.max(min, value - 1))} aria-label="감소">−</button>
        <input
          type="number"
          inputMode="numeric"
          value={value}
          onChange={(e) => set(Math.max(min, Number(e.target.value) || min))}
        />
        <button type="button" onClick={() => set(value + 1)} aria-label="증가">+</button>
      </div>
    </div>
  )

  return (
    <div className="mbu-backdrop" onClick={onClose}>
      <div className="mbu-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="mbu-handle" />
        <div className="mbu-head">
          <div>
            <strong>호수 일괄 추가</strong>
            <span>{buildingName}</span>
          </div>
          <button className="mbu-close" onClick={onClose} type="button" aria-label="닫기">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>
          </button>
        </div>

        <div className="mbu-body">
          <div className="mbu-section-label">지상</div>
          <div className="mbu-grid">
            {renderStepper('시작층', startFloor, setStartFloor)}
            {renderStepper('끝층', endFloor, setEndFloor, startFloor)}
            {renderStepper('층당 호수', unitsPerFloor, setUnitsPerFloor)}
            {renderStepper('시작 호번호', startUnit, setStartUnit)}
          </div>

          <label className="mbu-basement-toggle">
            <input type="checkbox" checked={hasBasement} onChange={(e) => setHasBasement(e.target.checked)} />
            지하 포함
          </label>
          {hasBasement && (
            <div className="mbu-grid">
              {renderStepper('지하 층수', basementFloors, setBasementFloors)}
            </div>
          )}

          {/* 미리보기 */}
          <div className="mbu-preview-label">
            미리보기 <strong>총 {newOnes.length}개 추가</strong>
            {skipped > 0 && <span className="mbu-skip"> · {skipped}개 이미 있어 스킵</span>}
          </div>
          <div className="mbu-preview-grid">
            {preview.map((n) => (
              <span key={n} className={`mbu-chip${n.startsWith('B') ? ' is-basement' : ''}${existingNumbers.has(n) ? ' is-skip' : ''}`}>
                {n}호
              </span>
            ))}
          </div>
        </div>

        <div className="mbu-footer">
          <button className="mbu-add-btn" disabled={newOnes.length === 0 || adding} onClick={handleAdd} type="button">
            {adding ? '추가 중...' : `${newOnes.length}개 추가하기`}
          </button>
        </div>
      </div>
    </div>
  )
}
