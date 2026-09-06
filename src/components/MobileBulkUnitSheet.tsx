// 모바일 호수 일괄 추가 바텀시트
// 층 범위 + 층당 호수 + 시작 호번호 (+ 지하) → 미리보기 → 일괄 추가
import { useState } from 'react'
import { filterNewUnitNumbers, generateBulkUnits } from '../utils/bulkUnits'
import { normalizeUnitNumber } from '../utils/duplicateBuildingMerge'
import { t, currentLang } from '../i18n'
import { msg } from '../lib/msg'

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
  onAdd: (buildingId: number, unitNumber: string | string[]) => void | Promise<boolean | void | number[]>
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
  const { newNumbers: newOnes, skippedNumbers } = filterNewUnitNumbers(preview, existingNumbers)
  const skipped = skippedNumbers.length
  const existingKeys = new Set(Array.from(existingNumbers, normalizeUnitNumber))

  // 층별 범위 요약 (101호~105호 식) — 가로 절약
  const floorRanges = (() => {
    // 호수 → 층 prefix (101 → '1', B201 → 'B2')
    const byFloor = new Map<string, string[]>()
    preview.forEach((n) => {
      const floor = n.slice(0, n.length - 2) // 끝 2자리(호) 제외
      const arr = byFloor.get(floor) ?? []
      arr.push(n)
      byFloor.set(floor, arr)
    })
    return Array.from(byFloor.entries()).map(([, nums]) => {
      const allSkip = nums.every((n) => existingKeys.has(normalizeUnitNumber(n)))
      return { first: nums[0], last: nums[nums.length - 1], allSkip }
    })
  })()

  const handleAdd = async () => {
    if (newOnes.length === 0 || adding) return
    setAdding(true)
    try {
      const added = await onAdd(buildingId, newOnes)
      if (added !== false) onClose()
    } finally {
      setAdding(false)
    }
  }

  const renderStepper = (label: string, value: number, set: (n: number) => void, min = 1) => (
    <div className="mbu-field">
      <span className="mbu-field-label">{label}</span>
      <div className="mbu-stepper">
        <button type="button" onClick={() => set(Math.max(min, value - 1))} aria-label={msg('감소')}>−</button>
        <input
          type="number"
          inputMode="numeric"
          value={value}
          onChange={(e) => set(Math.max(min, Number(e.target.value) || min))}
        />
        <button type="button" onClick={() => set(value + 1)} aria-label={msg('증가')}>+</button>
      </div>
    </div>
  )

  return (
    <div className="mbu-backdrop" onClick={onClose}>
      <div className="mbu-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="mbu-handle" />
        <div className="mbu-head">
          <div>
            <strong>{t(currentLang(), 'unit.bulkAdd')}</strong>
            <span>{buildingName}</span>
          </div>
          <button className="mbu-close" onClick={onClose} type="button" aria-label={msg('닫기')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>
          </button>
        </div>

        <div className="mbu-body">
          <div className="mbu-section-label">{t(currentLang(), 'unit.ground')}</div>
          <div className="mbu-grid">
            {renderStepper(t(currentLang(), 'unit.startFloor'), startFloor, setStartFloor)}
            {renderStepper(t(currentLang(), 'unit.endFloor'), endFloor, setEndFloor, startFloor)}
            {renderStepper(t(currentLang(), 'unit.unitsPerFloor'), unitsPerFloor, setUnitsPerFloor)}
            {renderStepper(t(currentLang(), 'unit.startUnitNum'), startUnit, setStartUnit)}
          </div>

          <label className="mbu-basement-toggle">
            <input type="checkbox" checked={hasBasement} onChange={(e) => setHasBasement(e.target.checked)} />
            {t(currentLang(), 'unit.includeBasement')}
          </label>
          {hasBasement && (
            <div className="mbu-grid">
              {renderStepper(t(currentLang(), 'unit.basementFloors'), basementFloors, setBasementFloors)}
            </div>
          )}

          {/* 미리보기 */}
          <div className="mbu-preview-label">
            <strong>{t(currentLang(), 'unit.previewAdd', { count: newOnes.length })}</strong>
            {skipped > 0 && <span className="mbu-skip"> {t(currentLang(), 'unit.skipped', { count: skipped })}</span>}
          </div>
          <div className="mbu-preview-grid">
            {floorRanges.map((r) => (
              <span key={r.first} className={`mbu-chip${r.first.startsWith('B') ? ' is-basement' : ''}${r.allSkip ? ' is-skip' : ''}`}>
                {r.first === r.last ? `${r.first}호` : `${r.first}~${r.last}호`}
              </span>
            ))}
          </div>
        </div>

        <div className="mbu-footer">
          <button className="mbu-add-btn" disabled={newOnes.length === 0 || adding} onClick={handleAdd} type="button">
            {adding ? t(currentLang(), 'unit.adding') : t(currentLang(), 'unit.addCount', { count: newOnes.length })}
          </button>
        </div>
      </div>
    </div>
  )
}
