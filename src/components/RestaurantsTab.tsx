// 식당 탭 — design_handoff 06 화면
// 식당 표시된 상가 목록 (지역별 그룹) + 추가 모달 + 식당봉사 신청 승인
import { useMemo, useState } from 'react'
import type { Building, RestaurantRequest, Role, TerritoryCard } from '../types'
import { RestaurantPickerModal } from './RestaurantPickerModal'
import { normalizeCardSearch } from '../utils/cardSearch'

function isLeaderOrAdmin(role: Role): boolean {
  return role === 'leader' || role === 'admin' || role === 'developer'
}

// Naver Maps 지오코딩 (Promise wrapping)
function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    const naver = (window as Window & { naver?: { maps?: { Service?: { geocode?: (opts: { query: string }, cb: (status: string, res: { v2?: { addresses?: Array<{ x: string; y: string }> } }) => void) => void } } } }).naver
    const geocode = naver?.maps?.Service?.geocode
    if (!geocode) { resolve(null); return }
    geocode({ query: address }, (status, res) => {
      const addr = res?.v2?.addresses?.[0]
      if (status !== 'OK' || !addr) { resolve(null); return }
      resolve({ lat: parseFloat(addr.y), lng: parseFloat(addr.x) })
    })
  })
}

type Props = {
  role: Role
  buildings: Building[]
  cards: TerritoryCard[]
  currentVisitor?: string
  restaurantRequests?: RestaurantRequest[]
  onToggleRestaurantFlag?: (buildingId: number, isRestaurant: boolean) => Promise<void>
  onApproveRestaurantRequest?: (id: number, opts: { name: string; address: string; reviewer: string; existingBuildingId?: number | null; lat?: number; lng?: number }) => Promise<void>
  onRejectRestaurantRequest?: (id: number, reviewer: string) => Promise<void>
  onOpenMap: (cardId: number) => void
}

// ── 아이콘 ─────────────────────────────
function ForkIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 2v7c0 1.66 1.34 3 3 3h0c1.66 0 3-1.34 3-3V2" />
      <line x1="6" y1="12" x2="6" y2="22" />
      <path d="M15 22V12c0-3 2-7 4-7v17" />
    </svg>
  )
}
function MapIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <polygon points="3 6 9 3 15 6 21 3 21 21 15 18 9 21 3 18 3 6" />
      <line x1="9" y1="3" x2="9" y2="21" />
      <line x1="15" y1="6" x2="15" y2="18" />
    </svg>
  )
}
function DotsIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <circle cx="12" cy="5" r="1.5" />
      <circle cx="12" cy="12" r="1.5" />
      <circle cx="12" cy="19" r="1.5" />
    </svg>
  )
}
function PlusIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}
function SearchIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  )
}
function ChevD({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}

export function RestaurantsTab({
  role, buildings, cards, currentVisitor = '', restaurantRequests = [],
  onToggleRestaurantFlag, onApproveRestaurantRequest, onRejectRestaurantRequest, onOpenMap,
}: Props) {
  const canManage = isLeaderOrAdmin(role)
  const [search, setSearch] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [openMenuId, setOpenMenuId] = useState<number | null>(null)

  // 승인 대기 신청 편집 상태
  const [editingReqId, setEditingReqId] = useState<number | null>(null)
  const [editReqName, setEditReqName] = useState('')
  const [editReqAddress, setEditReqAddress] = useState('')
  const [reqProcessing, setReqProcessing] = useState<number | null>(null)
  const [geocoding, setGeocoding] = useState(false)
  // 건물 매칭 선택: null = 새 건물 생성, number = 기존 건물 id
  const [matchingReqId, setMatchingReqId] = useState<number | null>(null)
  const [matchedBuildings, setMatchedBuildings] = useState<Building[]>([])
  const [selectedMatchId, setSelectedMatchId] = useState<number | null | 'new'>('new')
  const [geocodedCoords, setGeocodedCoords] = useState<{ lat: number; lng: number } | null>(null)

  const pendingRequests = useMemo(
    () => restaurantRequests.filter((r) => r.status === 'pending'),
    [restaurantRequests],
  )

  const handleStartEdit = (req: RestaurantRequest) => {
    setEditingReqId(req.id)
    setEditReqName(req.name)
    setEditReqAddress(req.address)
    setMatchingReqId(null)
    setMatchedBuildings([])
    setSelectedMatchId('new')
    setGeocodedCoords(null)
  }

  const handleApprove = async (req: RestaurantRequest) => {
    if (!onApproveRestaurantRequest) return
    const name = editingReqId === req.id ? editReqName : req.name
    const address = editingReqId === req.id ? editReqAddress : req.address

    // 건물 매칭 단계가 아직 실행되지 않았으면 먼저 지오코딩 + 매칭 확인
    if (matchingReqId !== req.id) {
      setGeocoding(true)
      setMatchingReqId(req.id)
      setEditingReqId(req.id)
      setEditReqName(name)
      setEditReqAddress(address)

      // 주소 기반 기존 건물 찾기
      const addrNorm = address.trim()
      const found = buildings.filter((b) =>
        b.address.trim() === addrNorm || b.address.includes(addrNorm) || addrNorm.includes(b.address.trim())
      )
      setMatchedBuildings(found)
      setSelectedMatchId(found.length > 0 ? found[0].id : 'new')

      // 지오코딩
      const coords = await geocodeAddress(address)
      setGeocodedCoords(coords)
      setGeocoding(false)
      return // 매칭 UI 표시 — 다음 클릭에 실제 승인
    }

    // 실제 승인 처리
    setReqProcessing(req.id)
    await onApproveRestaurantRequest(req.id, {
      name,
      address,
      reviewer: currentVisitor,
      existingBuildingId: selectedMatchId === 'new' ? null : (selectedMatchId as number),
      lat: geocodedCoords?.lat,
      lng: geocodedCoords?.lng,
    })
    setReqProcessing(null)
    setEditingReqId(null)
    setMatchingReqId(null)
    setMatchedBuildings([])
    setSelectedMatchId('new')
    setGeocodedCoords(null)
  }

  const handleReject = async (reqId: number) => {
    if (!onRejectRestaurantRequest) return
    setReqProcessing(reqId)
    await onRejectRestaurantRequest(reqId, currentVisitor)
    setReqProcessing(null)
  }

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── 식당봉사 승인 대기 ─────────────────────────── */}
      {canManage && pendingRequests.length > 0 && (
        <div style={{
          background: 'var(--gray-50, #f9f8f7)',
          border: '1px solid var(--line, #e5e4e0)',
          borderRadius: 12, overflow: 'hidden',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '12px 16px',
            borderBottom: '1px solid var(--line, #e5e4e0)',
            background: 'var(--tint, #EFEFED)',
          }}>
            <span style={{ fontSize: 15 }}>🍜</span>
            <strong style={{ fontSize: 14, color: 'var(--ink)' }}>식당봉사 추가 신청</strong>
            <span style={{
              marginLeft: 'auto',
              background: '#ef4444', color: '#fff',
              borderRadius: 10, padding: '1px 7px', fontSize: 11, fontWeight: 700,
            }}>{pendingRequests.length}</span>
          </div>
          {pendingRequests.map((req) => (
            <div key={req.id} style={{
              padding: '14px 16px',
              borderBottom: '1px solid var(--line, #e5e4e0)',
            }}>
              {matchingReqId === req.id ? (
                /* 매칭 + 지오코딩 단계 */
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div>
                    <input
                      value={editReqName}
                      onChange={(e) => setEditReqName(e.target.value)}
                      placeholder="식당 이름"
                      style={{ width: '100%', boxSizing: 'border-box', padding: '7px 10px', borderRadius: 8, border: '1.5px solid var(--line)', fontSize: 14, marginBottom: 6 }}
                    />
                    <input
                      value={editReqAddress}
                      onChange={(e) => setEditReqAddress(e.target.value)}
                      placeholder="주소"
                      style={{ width: '100%', boxSizing: 'border-box', padding: '7px 10px', borderRadius: 8, border: '1.5px solid var(--line)', fontSize: 14 }}
                    />
                  </div>

                  {geocoding ? (
                    <div style={{ fontSize: 12, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ display: 'inline-block', width: 12, height: 12, border: '2px solid var(--muted)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                      주소 위치 확인 중...
                    </div>
                  ) : (
                    <>
                      {geocodedCoords ? (
                        <div style={{ fontSize: 12, color: 'var(--status-success, #22c55e)' }}>
                          📍 위치 확인됨 ({geocodedCoords.lat.toFixed(5)}, {geocodedCoords.lng.toFixed(5)})
                        </div>
                      ) : (
                        <div style={{ fontSize: 12, color: 'var(--muted)' }}>📍 위치를 찾지 못했습니다. 지도에서 직접 확인하세요.</div>
                      )}

                      {/* 기존 건물 매칭 선택 */}
                      {matchedBuildings.length > 0 && (
                        <div>
                          <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', marginBottom: 6 }}>
                            같은 주소의 기존 건물이 있습니다. 어느 건물로 등록할까요?
                          </p>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {matchedBuildings.map((b) => (
                              <label key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, border: `1.5px solid ${selectedMatchId === b.id ? 'var(--primary-500, #6366f1)' : 'var(--line)'}`, cursor: 'pointer', background: selectedMatchId === b.id ? 'var(--primary-50, #eef2ff)' : 'var(--surface)' }}>
                                <input type="radio" name={`match-${req.id}`} value={b.id} checked={selectedMatchId === b.id} onChange={() => setSelectedMatchId(b.id)} style={{ accentColor: 'var(--primary-500)' }} />
                                <div>
                                  <strong style={{ fontSize: 13 }}>{b.name || b.address}</strong>
                                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>{b.address} · 세대 {b.units.length}개</div>
                                </div>
                              </label>
                            ))}
                            <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, border: `1.5px solid ${selectedMatchId === 'new' ? 'var(--primary-500, #6366f1)' : 'var(--line)'}`, cursor: 'pointer', background: selectedMatchId === 'new' ? 'var(--primary-50, #eef2ff)' : 'var(--surface)' }}>
                              <input type="radio" name={`match-${req.id}`} value="new" checked={selectedMatchId === 'new'} onChange={() => setSelectedMatchId('new')} style={{ accentColor: 'var(--primary-500)' }} />
                              <div>
                                <strong style={{ fontSize: 13 }}>새 건물로 추가</strong>
                                <div style={{ fontSize: 11, color: 'var(--muted)' }}>미배정 건물 카드에 새로 생성</div>
                              </div>
                            </label>
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                    <button type="button" onClick={() => handleApprove(req)} disabled={!!reqProcessing || geocoding}
                      style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: 'none', background: 'var(--ink)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                      {reqProcessing === req.id ? '처리 중...' : '승인 확정'}
                    </button>
                    <button type="button" onClick={() => { setMatchingReqId(null); setEditingReqId(null) }}
                      style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--line)', background: 'transparent', fontSize: 13, cursor: 'pointer' }}>
                      취소
                    </button>
                  </div>
                </div>
              ) : (
                /* 기본 모드 */
                <>
                  <div style={{ marginBottom: 6 }}>
                    <strong style={{ fontSize: 14, color: 'var(--ink)' }}>{req.name}</strong>
                    <span style={{ fontSize: 12, color: 'var(--muted)', marginLeft: 8 }}>{req.address}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>
                    신청: {req.requestedBy}
                    {req.memo && <> · <em style={{ fontStyle: 'normal', color: 'var(--ink-light, #666)' }}>"{req.memo}"</em></>}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="button" onClick={() => handleApprove(req)} disabled={!!reqProcessing || geocoding}
                      style={{ flex: 1, padding: '7px 0', borderRadius: 8, border: 'none', background: 'var(--ink)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                      {geocoding && matchingReqId === req.id ? '확인 중...' : '승인'}
                    </button>
                    <button type="button" onClick={() => handleStartEdit(req)}
                      style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid var(--line)', background: 'transparent', fontSize: 13, cursor: 'pointer' }}>
                      수정
                    </button>
                    <button type="button" onClick={() => handleReject(req.id)} disabled={!!reqProcessing}
                      style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid #fca5a5', background: '#fff', color: '#ef4444', fontSize: 13, cursor: 'pointer' }}>
                      거절
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 상단 카운트 + 추가 */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 4px',
      }}>
        <span style={{ fontSize: 13, color: 'var(--muted)' }}>
          전체 {restaurants.length}개
        </span>
        {canManage && (
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              height: 32, minHeight: 32, padding: '0 12px',
              border: 'none', borderRadius: 8,
              background: 'var(--ink)', color: '#fff',
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
              letterSpacing: '-0.005em',
            }}
          >
            <PlusIcon /> 식당 추가
          </button>
        )}
      </div>

      {/* 검색 */}
      <label style={{
        background: 'var(--surface)',
        border: '1px solid var(--line)',
        borderRadius: 10,
        padding: '11px 14px',
        fontSize: 14,
        color: 'var(--text)',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        cursor: 'text',
      }}>
        <span style={{ color: 'var(--muted-2)', display: 'inline-flex' }}><SearchIcon /></span>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="식당 이름 또는 주소 검색"
          style={{
            flex: 1, minWidth: 0, border: 'none', outline: 'none',
            background: 'transparent', font: 'inherit', color: 'inherit', padding: 0,
          }}
        />
      </label>

      {/* 빈 상태 */}
      {restaurants.length === 0 ? (
        <div style={{
          padding: '40px 16px', textAlign: 'center', fontSize: 13,
          color: 'var(--muted)', lineHeight: 1.6,
          background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 12,
        }}>
          {canManage
            ? <>아직 등록된 식당이 없습니다.<br />위 + 식당 추가로 시작하세요.</>
            : <>아직 등록된 식당이 없습니다.</>}
        </div>
      ) : grouped.length === 0 ? (
        <div style={{
          padding: '32px 16px', textAlign: 'center', fontSize: 13,
          color: 'var(--muted)',
        }}>검색 결과가 없습니다.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {grouped.map(([region, list]) => (
            <section key={region}>
              {/* 그룹 헤더 */}
              <div style={{
                display: 'flex', alignItems: 'center',
                padding: '0 4px', justifyContent: 'space-between',
                marginBottom: 10,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <ChevD />
                  <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>{region}</span>
                  <span style={{ fontSize: 12, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>
                    {list.length}
                  </span>
                </div>
              </div>

              {/* 식당 카드들 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {list.map((b) => {
                  const card = cards.find((c) => c.id === b.cardId)
                  return (
                    <div
                      key={b.id}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: 14,
                        background: 'var(--surface)',
                        border: '1px solid var(--line)',
                        borderRadius: 12,
                      }}
                    >
                      <div style={{
                        width: 40, height: 40, borderRadius: 10,
                        background: 'var(--tint)',
                        display: 'grid', placeItems: 'center',
                        color: 'var(--muted)', flexShrink: 0,
                      }}>
                        <ForkIcon />
                      </div>
                      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span style={{
                          fontSize: 15, fontWeight: 600, color: 'var(--ink)',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {b.name || b.address}
                        </span>
                        <span style={{
                          fontSize: 12.5, color: 'var(--muted)',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {card?.name ? `${card.name} · ` : ''}{b.address}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => onOpenMap(b.cardId)}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 5,
                          height: 34, minHeight: 34, padding: '0 12px',
                          fontSize: 13, fontWeight: 600,
                          border: '1px solid var(--line-2)', borderRadius: 8,
                          background: 'var(--surface)', color: 'var(--text)', cursor: 'pointer',
                        }}
                      >
                        <MapIcon /> 지도
                      </button>
                      {canManage && onToggleRestaurantFlag && (
                        <div style={{ position: 'relative' }}>
                          <button
                            type="button"
                            onClick={() => setOpenMenuId(openMenuId === b.id ? null : b.id)}
                            style={{
                              width: 28, height: 28, minHeight: 28,
                              display: 'grid', placeItems: 'center',
                              background: 'transparent', border: 'none',
                              color: 'var(--text)', cursor: 'pointer', borderRadius: 6,
                            }}
                            aria-label="더보기"
                          >
                            <DotsIcon />
                          </button>
                          {openMenuId === b.id && (
                            <>
                              <div
                                onClick={() => setOpenMenuId(null)}
                                style={{ position: 'fixed', inset: 0, zIndex: 30 }}
                              />
                              <div
                                style={{
                                  position: 'absolute', top: '100%', right: 0,
                                  marginTop: 4, zIndex: 31,
                                  background: 'var(--surface)',
                                  border: '1px solid var(--line)',
                                  borderRadius: 8,
                                  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                                  minWidth: 140,
                                  padding: 4,
                                }}
                              >
                                <button
                                  type="button"
                                  onClick={async () => {
                                    setOpenMenuId(null)
                                    if (confirm(`"${b.name || b.address}" 식당 표시를 해제할까요?`)) {
                                      await onToggleRestaurantFlag(b.id, false)
                                    }
                                  }}
                                  style={{
                                    width: '100%', textAlign: 'left',
                                    padding: '8px 10px', minHeight: 0,
                                    background: 'transparent', border: 'none',
                                    fontSize: 13, color: 'var(--status-danger)',
                                    cursor: 'pointer', borderRadius: 6,
                                  }}
                                >
                                  식당 표시 해제
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </section>
          ))}

          {/* 빈 자리 안내 (디자인 06 의 dashed empty slot) */}
          {canManage && (
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              style={{
                padding: '18px 14px',
                border: '1px dashed var(--line-2)',
                background: 'transparent',
                color: 'var(--muted)',
                borderRadius: 12,
                display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center',
                font: 'inherit', fontSize: 13, fontWeight: 500,
                cursor: 'pointer', minHeight: 0,
              }}
            >
              <PlusIcon /> 다음 식당 추가하기
            </button>
          )}
        </div>
      )}

      {/* 식당 추가 모달 (RestaurantPickerModal 재활용) */}
      {canManage && (
        <RestaurantPickerModal
          open={addOpen}
          role={role}
          buildings={buildings}
          alreadyAssignedIds={new Set()}
          onSelect={() => setAddOpen(false)}
          onToggleRestaurantFlag={onToggleRestaurantFlag}
          onClose={() => setAddOpen(false)}
        />
      )}
    </div>
  )
}
