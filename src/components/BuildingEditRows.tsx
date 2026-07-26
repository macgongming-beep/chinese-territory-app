// 건물관리 편집 폼 — draft 를 로컬 state 로 격리한 자식 컴포넌트
// (DesktopTerritory 최상단 state 로 두면 타이핑마다 3천줄 페이지+전체 행이
//  재렌더되어 입력이 뚝뚝 끊김 → 여기로 분리해 타이핑 시 이 폼만 렌더)
// 사용 시 key={building.id} / key={unit.id} 로 대상 전환 때 draft 초기화.
import { useState } from 'react'
import type { Building, TerritoryCard, Unit, UnitStatus } from '../types'

export type BuildingEditDraft = {
  name: string
  address: string
  type: Building['type']
  cardId: number
  memo: string
}

export function BuildingEditCells({
  building,
  cards,
  chineseCount,
  onSave,
  onCancel,
  onToggleHeavy,
}: {
  building: Building
  cards: TerritoryCard[]
  chineseCount: number
  onSave: (draft: BuildingEditDraft) => void
  onCancel: () => void
  onToggleHeavy: () => void
}) {
  const [draft, setDraft] = useState<BuildingEditDraft>({
    name: building.name,
    address: building.address,
    type: building.type,
    cardId: building.cardId,
    memo: building.memo ?? '',
  })
  return (
    <>
      <input
        aria-label="건물명"
        value={draft.name}
        onChange={(event) => setDraft((d) => ({ ...d, name: event.target.value }))}
      />
      <input
        aria-label="주소"
        value={draft.address}
        onChange={(event) => setDraft((d) => ({ ...d, address: event.target.value }))}
      />
      <select
        aria-label="카드 재배정"
        value={draft.cardId}
        onChange={(event) => setDraft((d) => ({ ...d, cardId: Number(event.target.value) }))}
      >
        {cards.map((item) => (
          <option key={item.id} value={item.id}>{item.name}</option>
        ))}
      </select>
      <select
        aria-label="건물 유형"
        value={draft.type}
        onChange={(event) => setDraft((d) => ({ ...d, type: event.target.value as Building['type'] }))}
      >
        <option value="상가">상가</option>
        <option value="주택">주택</option>
      </select>
      <span>{building.units.length}개</span>
      <span>{chineseCount}건</span>
      <button
        className={`building-heavy-toggle${building.isChineseHeavy ? ' active' : ''}`}
        onClick={onToggleHeavy}
        type="button"
      >
        {building.isChineseHeavy ? '다수' : '-'}
      </button>
      <span className="building-row-actions">
        <button onClick={() => onSave(draft)} type="button">저장</button>
        <button onClick={onCancel} type="button">취소</button>
      </span>
    </>
  )
}

export type UnitEditDraft = {
  number: string
  status: UnitStatus
  memo: string
  isChinese: boolean
  isRegularVisit: boolean
  isForbidden: boolean
}

export function UnitEditForm({
  unit,
  onSave,
  onCancel,
}: {
  unit: Unit
  onSave: (draft: UnitEditDraft) => void
  onCancel: () => void
}) {
  const [draft, setDraft] = useState<UnitEditDraft>({
    number: unit.number,
    status: unit.status,
    memo: unit.memo ?? '',
    isChinese: unit.isChinese ?? false,
    isRegularVisit: unit.isRegularVisit ?? false,
    isForbidden: unit.isForbidden ?? false,
  })
  return (
    <div className="unit-edit-layout">
      <div className="unit-edit-row1">
        <input
          aria-label="호수"
          className="unit-number-input"
          value={draft.number}
          onChange={(e) => setDraft((d) => ({ ...d, number: e.target.value }))}
        />
        <select
          aria-label="상태"
          value={draft.status}
          onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value as UnitStatus }))}
        >
          {(['미방문', '만남', '부재', '대상외'] as UnitStatus[]).map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <input
          aria-label="메모"
          className="unit-memo-input"
          placeholder="메모"
          value={draft.memo}
          onChange={(e) => setDraft((d) => ({ ...d, memo: e.target.value }))}
        />
        <span className="unit-row-actions">
          <button onClick={() => onSave(draft)} type="button">저장</button>
          <button onClick={onCancel} type="button">취소</button>
        </span>
      </div>
      <div className="unit-edit-flags">
        <label className="unit-flag-label">
          <input
            type="checkbox"
            checked={draft.isForbidden}
            onChange={(e) => setDraft((d) => ({ ...d, isForbidden: e.target.checked }))}
          />
          방문금지
        </label>
        <label className="unit-flag-label">
          <input
            type="checkbox"
            checked={draft.isRegularVisit}
            onChange={(e) => setDraft((d) => ({ ...d, isRegularVisit: e.target.checked }))}
          />
          정기방문
        </label>
        <label className="unit-flag-label">
          <input
            type="checkbox"
            checked={draft.isChinese}
            onChange={(e) => setDraft((d) => ({ ...d, isChinese: e.target.checked }))}
          />
          중국어
        </label>
      </div>
    </div>
  )
}
