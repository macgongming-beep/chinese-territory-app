// 식당 탭 — 식당 표시된 상가 목록 (지역별 그룹) + 추가 모달
// 구역 탭 > 식당 sub-tab 안에 렌더링
import { useMemo, useState } from 'react'
import type { Building, Role, TerritoryCard } from '../types'
import { RestaurantPickerModal } from './RestaurantPickerModal'
import { normalizeCardSearch } from '../utils/cardSearch'

function isLeaderOrAdmin(role: Role): boolean {
  return role === 'leader' || role === 'admin' || role === 'developer'
}

type Props = {
  role: Role
  buildings: Building[]
  cards: TerritoryCard[]
  onToggleRestaurantFlag?: (buildingId: number, isRestaurant: boolean) => Promise<void>
  onOpenMap: (cardId: number) => void
}

export function RestaurantsTab({
  role, buildings, cards, onToggleRestaurantFlag, onOpenMap,
}: Props) {
  const canManage = isLeaderOrAdmin(role)
  const [search, setSearch] = useState('')
  const [addOpen, setAddOpen] = useState(false)

  const restaurants = useMemo(
    () => buildings.filter((b) => b.type === '상가' && b.isRestaurant),
    [buildings],
  )

  // 검색 필터
  const filtered = useMemo(() => {
    const q = normalizeCardSearch(search)
    if (!q) return restaurants
    return restaurants.filter((b) =>
      normalizeCardSearch(`${b.name}${b.address}`).includes(q),
    )
  }, [restaurants, search])

  // 지역별 그룹화 (카드의 region 사용)
  const grouped = useMemo(() => {
    const map = new Map<string, Building[]>()
    for (const b of filtered) {
      const card = cards.find((c) => c.id === b.cardId)
      const region = (card?.region as string) || '기타'
      const list = map.get(region) ?? []
      list.push(b)
      map.set(region, list)
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b, 'ko'))
  }, [filtered, cards])

  return (
    <div>
      {/* 상단 카운트 + 추가 */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 12,
      }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#64748b' }}>
          전체 {restaurants.length}개
        </p>
        {canManage && (
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            style={{
              padding: '7px 12px', borderRadius: 9, border: '1px solid #fed7aa',
              background: '#fff7ed', color: '#c2410c', fontSize: 12, fontWeight: 800,
              cursor: 'pointer',
            }}
          >+ 식당 추가</button>
        )}
      </div>

      {/* 검색 */}
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="식당 이름 또는 주소 검색"
        style={{
          width: '100%', padding: '10px 12px', borderRadius: 10,
          border: '1px solid #d8dbe0', fontSize: 14, marginBottom: 12,
        }}
      />

      {/* 빈 상태 */}
      {restaurants.length === 0 ? (
        <p style={{
          padding: '40px 16px', textAlign: 'center', fontSize: 13,
          color: '#94a3b8', fontWeight: 600, lineHeight: 1.6,
        }}>
          {canManage
            ? '식당으로 표시된 건물이 없습니다.\n위 + 식당 추가로 시작하세요.'
            : '아직 등록된 식당이 없습니다.'}
        </p>
      ) : grouped.length === 0 ? (
        <p style={{
          padding: '32px 16px', textAlign: 'center', fontSize: 13,
          color: '#94a3b8', fontWeight: 600,
        }}>검색 결과가 없습니다.</p>
      ) : (
        grouped.map(([region, list]) => (
          <section key={region} style={{
            marginBottom: 12, border: '1px solid #e5e7eb', borderRadius: 12,
            background: '#fff', overflow: 'hidden',
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 12px', borderBottom: '1px solid #f1f5f9',
              background: '#f8fafc',
            }}>
              <strong style={{ flex: 1, fontSize: 14, fontWeight: 700, color: '#1e293b' }}>
                {region}
              </strong>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8' }}>
                {list.length}
              </span>
            </div>
            {list.map((b) => {
              const card = cards.find((c) => c.id === b.cardId)
              return (
                <div
                  key={b.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 12px', borderBottom: '1px solid #f8fafc',
                  }}
                >
                  <span aria-hidden style={{ fontSize: 16 }}>🍴</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                      margin: 0, fontSize: 13, fontWeight: 700, color: '#1e293b',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {b.name || b.address}
                    </p>
                    <p style={{
                      margin: '2px 0 0', fontSize: 11, color: '#94a3b8',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {card?.name ? `${card.name} · ` : ''}{b.address}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onOpenMap(b.cardId)}
                    style={{
                      padding: '5px 10px', fontSize: 11, fontWeight: 700,
                      border: '1px solid var(--brand-700, #2563eb)', borderRadius: 7,
                      background: '#fff', color: 'var(--brand-700, #2563eb)', cursor: 'pointer',
                    }}
                  >지도</button>
                  {canManage && onToggleRestaurantFlag && (
                    <button
                      type="button"
                      onClick={async () => {
                        if (confirm(`"${b.name || b.address}" 식당 표시를 해제할까요?`)) {
                          await onToggleRestaurantFlag(b.id, false)
                        }
                      }}
                      style={{
                        padding: '5px 8px', fontSize: 11, fontWeight: 700,
                        border: '1px solid #cbd5e1', borderRadius: 7,
                        background: '#fff', color: '#94a3b8', cursor: 'pointer',
                      }}
                      title="식당 표시 해제"
                    >해제</button>
                  )}
                </div>
              )
            })}
          </section>
        ))
      )}

      {/* 식당 추가 모달 (RestaurantPickerModal 재활용) */}
      {canManage && (
        <RestaurantPickerModal
          open={addOpen}
          role={role}
          buildings={buildings}
          alreadyAssignedIds={new Set()}  // 식당 마킹과 무관, 그냥 빈 set
          onSelect={() => {
            // 이 화면에선 "선택" = 마킹만. 배정과 무관.
            // RestaurantPickerModal 의 inline "식당 표시" 버튼이 실제로 마킹 함.
            // 사용자가 '선택' 누르면 그냥 닫기.
            setAddOpen(false)
          }}
          onToggleRestaurantFlag={onToggleRestaurantFlag}
          onClose={() => setAddOpen(false)}
        />
      )}
    </div>
  )
}
