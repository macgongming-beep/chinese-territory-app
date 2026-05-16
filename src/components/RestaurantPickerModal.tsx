// 식당 선택 모달 — 전체 상가 검색 + 식당 토글 + 마킹 inline
import { useMemo, useState } from 'react'
import type { Building, Role } from '../types'
import { normalizeCardSearch } from '../utils/cardSearch'

type Props = {
  open: boolean
  role: Role
  buildings: Building[]
  // 이미 선택된 building_id 들 (이 팀에 이미 배정된 건 비활성/표시만)
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
  const canMark = canMarkRestaurant(role) && onToggleRestaurantFlag

  // 상가만, 검색어 필터, 식당 토글
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
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 250,
        background: 'rgba(15,23,42,0.55)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 560, maxHeight: '85vh',
          background: '#fff', borderTopLeftRadius: 18, borderTopRightRadius: 18,
          display: 'flex', flexDirection: 'column',
        }}
      >
        <div style={{
          padding: '14px 16px', borderBottom: '1px solid #e2e8f0',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#1e293b' }}>
            🍴 식당 선택
          </h3>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: 20, color: '#94a3b8', cursor: 'pointer' }}
            aria-label="닫기"
          >✕</button>
        </div>

        <div style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', gap: 8 }}>
          <input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="식당 이름 또는 주소 검색"
            style={{
              flex: 1, padding: '8px 12px', border: '1px solid #d8dbe0',
              borderRadius: 10, fontSize: 14,
            }}
          />
          <label style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '0 12px', borderRadius: 10,
            background: restaurantOnly ? '#fed7aa' : '#f3f4f6',
            color: restaurantOnly ? '#9a3412' : '#6b7280',
            fontSize: 12, fontWeight: 700, cursor: 'pointer',
          }}>
            <input
              type="checkbox"
              checked={restaurantOnly}
              onChange={(e) => setRestaurantOnly(e.target.checked)}
              style={{ accentColor: '#ea580c' }}
            />
            식당만
          </label>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
          {filtered.length === 0 ? (
            <p style={{ padding: 32, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
              {restaurantOnly
                ? '식당으로 표시된 상가가 없어요. 토글을 꺼서 전체 상가에서 찾으세요.'
                : '검색 결과가 없습니다.'}
            </p>
          ) : (
            filtered.map((b) => {
              const isAssigned = alreadyAssignedIds.has(b.id)
              return (
                <div
                  key={b.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '12px 16px', borderBottom: '1px solid #f1f5f9',
                  }}
                >
                  <span aria-hidden style={{ fontSize: 18 }}>🍴</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                      margin: 0, fontSize: 14, fontWeight: 700, color: '#1e293b',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {b.name || b.address}
                    </p>
                    <p style={{
                      margin: '2px 0 0', fontSize: 11, color: '#64748b',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {b.address}
                    </p>
                  </div>
                  {canMark && !b.isRestaurant && (
                    <button
                      type="button"
                      onClick={() => onToggleRestaurantFlag?.(b.id, true)}
                      style={{
                        padding: '4px 8px', fontSize: 11, fontWeight: 700,
                        border: '1px solid #fed7aa', borderRadius: 6,
                        background: '#fff7ed', color: '#c2410c', cursor: 'pointer',
                      }}
                    >
                      식당 표시
                    </button>
                  )}
                  {canMark && b.isRestaurant && (
                    <button
                      type="button"
                      onClick={() => onToggleRestaurantFlag?.(b.id, false)}
                      style={{
                        padding: '4px 8px', fontSize: 11, fontWeight: 700,
                        border: '1px solid #cbd5e1', borderRadius: 6,
                        background: '#fff', color: '#64748b', cursor: 'pointer',
                      }}
                      title="식당 표시 해제"
                    >
                      ✓ 식당
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onSelect(b.id)}
                    disabled={isAssigned}
                    style={{
                      padding: '6px 12px', fontSize: 12, fontWeight: 800,
                      border: 'none', borderRadius: 8,
                      background: isAssigned ? '#e5e7eb' : '#ea580c',
                      color: isAssigned ? '#9ca3af' : '#fff',
                      cursor: isAssigned ? 'default' : 'pointer',
                    }}
                  >
                    {isAssigned ? '추가됨' : '선택'}
                  </button>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
