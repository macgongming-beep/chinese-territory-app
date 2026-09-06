import { useState } from 'react'
import { filterNewUnitNumbers, generateBulkUnits } from '../utils/bulkUnits'
import { t, currentLang } from '../i18n'

/**
 * 건물 상세 패널에서 호수를 추가하는 행 컴포넌트.
 * 단일 추가 + 일괄(층/호 설정) 추가를 지원합니다.
 */
export function AddUnitRow({
  buildingId,
  buildingType,
  existingNumbers,
  onAdd,
  unitsSurveyed,
  onSetUnitsSurveyed,
}: {
  buildingId: number
  buildingType: '주택' | '상가'
  existingNumbers: Set<string>
  onAdd: (buildingId: number, unitNumber: string | string[], usageType?: '주택' | '상가') => void | Promise<boolean | void | number[]>
  /** 이 건물의 세대를 다 파악했나. 이 표시가 없으면 지도 핀이 '완료' 가 안 된다 */
  unitsSurveyed?: boolean
  onSetUnitsSurveyed?: (buildingId: number, surveyed: boolean) => Promise<boolean> | void
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
  const [usageType, setUsageType] = useState<'주택' | '상가'>(buildingType)

  const handleAdd = () => {
    if (!value.trim()) return
    onAdd(buildingId, value.trim(), usageType)
    setValue('')
  }

  // 미리보기 생성 (지하 + 지상) — 공유 유틸
  const preview = generateBulkUnits({ startFloor, endFloor, unitsPerFloor, startUnit, hasBasement, basementFloors })

  const { newNumbers: newOnes, skippedNumbers } = filterNewUnitNumbers(preview, existingNumbers)
  const skipped = skippedNumbers.length

  const handleBulkAdd = async () => {
    if (newOnes.length === 0) return
    setAdding(true)
    try {
      const added = await onAdd(buildingId, newOnes, usageType)
      if (added !== false) setShowBulk(false)
    } finally {
      setAdding(false)
    }
  }

  return (
    <div className="unit-add-section">
      {/* 단일 추가 행 */}
      <div className="building-unit-row building-unit-add-row">
        <input
          className="unit-number-input"
          placeholder={t(currentLang(), 'unit.unitInputPlaceholder')}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleAdd() }}
        />
        <span className="unit-row-actions">
          <button onClick={handleAdd} type="button">{/* ⚠ 'map.addUnit' 값 자체가 이미 '+ 세대 추가' 다. 여기서 '+ ' 를 또 붙여
            **'+ + 세대 추가'** 로 보였다. 번역값을 그대로 쓴다. */}
          {t(currentLang(), 'map.addUnit', { defaultValue: '+ 추가' })}</button>
          <button
            className={`unit-bulk-toggle${showBulk ? ' active' : ''}`}
            onClick={() => setShowBulk((v) => !v)}
            type="button"
          >
            {t(currentLang(), 'unit.bulkAddToggle')} {showBulk ? '▴' : '▾'}
          </button>
          {/* ⚠ **이 표시가 있어야 지도 핀이 '완료'(채운 초록)로 바뀐다.**
              시스템은 '등록된 세대' 만 안다 — 104·105호만 등록된 건물에서 둘 다 가면
              100% 가 되어 아무도 안 갔다. 몇 세대인지는 사람만 안다.
              세대를 넣는 자리 옆에 둔다 — 다 넣은 직후가 누를 때다. */}
          {onSetUnitsSurveyed && (
            <button
              className={`unit-surveyed-toggle${unitsSurveyed ? ' active' : ''}`}
              onClick={() => void onSetUnitsSurveyed(buildingId, !unitsSurveyed)}
              type="button"
            >
              {unitsSurveyed ? '✓ ' : ''}{t(currentLang(), 'map.unitsSurveyed')}
            </button>
          )}
        </span>
      </div>

      <div className="unit-add-usage-row" aria-label="세대 용도">
        <button
          className={usageType === '주택' ? 'active' : ''}
          onClick={() => setUsageType('주택')}
          type="button"
        >
          {t(currentLang(), 'map.house')}
        </button>
        <button
          className={usageType === '상가' ? 'active' : ''}
          onClick={() => setUsageType('상가')}
          type="button"
        >
          {t(currentLang(), 'map.shop')}
        </button>
      </div>

      {/* 일괄 추가 패널 */}
      {showBulk && (
        <div className="unit-bulk-panel">
          {/* 지상층 설정 */}
          <div className="unit-bulk-section-label">{t(currentLang(), 'unit.ground')}</div>
          <div className="unit-bulk-fields">
            <label className="unit-bulk-field">
              <span>{t(currentLang(), 'unit.startFloor')}</span>
              <input type="number" min={1} value={startFloor}
                onChange={(e) => setStartFloor(Number(e.target.value))} />
            </label>
            <span className="unit-bulk-sep">~</span>
            <label className="unit-bulk-field">
              <span>{t(currentLang(), 'unit.endFloor')}</span>
              <input type="number" min={startFloor} value={endFloor}
                onChange={(e) => setEndFloor(Number(e.target.value))} />
            </label>
            <label className="unit-bulk-field">
              <span>{t(currentLang(), 'unit.unitsPerFloor')}</span>
              <input type="number" min={1} value={unitsPerFloor}
                onChange={(e) => setUnitsPerFloor(Number(e.target.value))} />
            </label>
            <label className="unit-bulk-field">
              <span>{t(currentLang(), 'unit.startUnitNum')}</span>
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
              {t(currentLang(), 'unit.includeBasement')}
            </label>
            {hasBasement && (
              <>
                <label className="unit-bulk-field">
                  <span>{t(currentLang(), 'unit.basementFloors')}</span>
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
              <strong>{t(currentLang(), 'unit.previewAdd', { count: newOnes.length })}</strong>
              {skipped > 0 && (
                <span className="unit-bulk-skip"> {t(currentLang(), 'unit.skipped', { count: skipped })}</span>
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
              {adding ? t(currentLang(), 'unit.adding') : t(currentLang(), 'unit.addCount', { count: newOnes.length })}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
