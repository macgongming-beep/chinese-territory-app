// 식당 선택 모달 (디자인 v2 28e — 시트 형식)
import { useMemo, useState } from 'react'
import type { Building, Role } from '../types'
import { normalizeCardSearch } from '../utils/cardSearch'

type Props = {
  open: boolean
  role: Role
  buildings: Building[]
  alreadyAssignedIds: Set<number>
  onSelect: (buildingId: number) => Promise<void> | void
  onToggleRestaurantFlag?: (buildingId: number, isRestaurant: boolean) => Promise<void> | void
  onClose: () => void
}

function canMarkRestaurant(role: Role): boolean {
  return role === 'leader' || role === 'admin' || role === 'developer'
}

export function RestaurantPickerModal({
  open, role, buildings, alreadyAssignedIds,
  onSelect, onToggleRestaurantFlag, onClose,
}: Props) {
  const [search, setSearch] = useState('')
  const [restaurantOnly, setRestaurantOnly] = useState(true)
  const canMark = canMarkRestaurant(role) && !!onToggleRestaurantFlag

  const filtered = useMemo(() => {
    const q = normalizeCardSearch(search)
    return buildings
      .filter((b) => b.type === '상가')
      .filter((b) => (restaurantOnly ? b.isRestaurant : true))
      .filter((b) => {
        if (!q) return true
        return normalizeCardSearch(`${b.name}${b.address}`).includes(q)
      })
      .slice(0, 100)
  }, [buildings, search, restaurantOnly])

  if (!open) return null

  return (
    <div className="v2-picker-backdrop" onClick={onClose}>
      <div className="v2-picker-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="v2-picker-grabber" />
        <div className="v2-picker-head">
          <span className="v2-picker-title">🍴 식당 선택</span>
          <button className="v2-picker-close" onClick={onClose} aria-label="닫기" type="button">×</button>
        </div>

        <div className="v2-restaurant-search-row">
          <div className="v2-restaurant-search">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ color: 'var(--muted-2)' }}>
              <circle cx="11" cy="11" r="7"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="식당 이름 또는 주소 검색"
            />
          </div>
          <label className={`v2-restaurant-only${restaurantOnly ? '' : ' off'}`}>
            <input
              type="checkbox"
              checked={restaurantOnly}
              onChange={(e) => setRestaurantOnly(e.target.checked)}
              style={{ display: 'none' }}
            />
            <span className="v2-restaurant-only-check">
              {restaurantOnly && (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden><polyline points="20 6 9 17 4 12"/></svg>
              )}
            </span>
            <span>식당만</span>
          </label>
        </div>

        {filtered.length === 0 ? (
          <p className="v2-picker-empty">
            {restaurantOnly
              ? '식당으로 표시된 상가가 없어요. 토글을 꺼서 전체 상가에서 찾으세요.'
              : '검색 결과가 없습니다.'}
          </p>
        ) : (
          <div className="v2-restaurant-list">
            {filtered.map((b) => {
              const isAssigned = alreadyAssignedIds.has(b.id)
              return (
                <div key={b.id} className="v2-restaurant-row">
                  <span className="v2-restaurant-icon" aria-hidden>🍴</span>
                  <div className="v2-restaurant-body">
                    <strong>{b.name || b.address}</strong>
                    <span>{b.address}</span>
                  </div>
                  {b.isRestaurant && (
                    <span className="v2-restaurant-pill-ok">✓ 식당</span>
                  )}
                  {canMark && !b.isRestaurant && (
                    <button
                      type="button"
                      className="v2-restaurant-mark-btn"
                      onClick={() => onToggleRestaurantFlag?.(b.id, true)}
                    >
                      식당 표시
                    </button>
                  )}
                  <button
                    type="button"
                    className="v2-restaurant-add-btn"
                    onClick={() => onSelect(b.id)}
                    disabled={isAssigned}
                  >
                    {isAssigned ? '추가됨' : '선택'}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
