// 식당 탭 — design_handoff 06 화면
// 식당 표시된 상가 목록 (지역별 그룹) + 추가 모달 + 식당봉사 신청 승인
import { useEffect, useMemo, useState } from 'react'
import type { Building, RestaurantRequest, Role, TerritoryCard } from '../types'
import { RestaurantPickerModal } from './RestaurantPickerModal'
import { normalizeCardSearch } from '../utils/cardSearch'

function isLeaderOrAdmin(role: Role): boolean {
  return role === 'leader' || role === 'admin' || role === 'developer'
}

// Naver Maps 지오코딩 (Promise wrapping + 4초 타임아웃)
// 지도 페이지 밖에서는 콜백이 안 돌아오는 경우가 있어 타임아웃 필수
function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    const naver = (window as Window & { naver?: { maps?: { Service?: { geocode?: (opts: { query: string }, cb: (status: string, res: { v2?: { addresses?: Array<{ x: string; y: string }> } }) => void) => void } } } }).naver
    if (!naver?.maps?.Service?.geocode) { resolve(null); return }
    const timer = setTimeout(() => resolve(null), 4000) // 4초 내 응답 없으면 null
    // 주의: geocode를 구조분해할당 하면 this 컨텍스트를 잃어 콜백이 안 올 수 있음
    naver.maps.Service.geocode({ query: address }, (status: string, res: any) => {
      clearTimeout(timer)
      const addr = res?.v2?.addresses?.[0]
      if (status !== 'OK' || !addr) { resolve(null); return }
      resolve({ lat: parseFloat(addr.y), lng: parseFloat(addr.x) })
    })
  })
}

// 주소 + 좌표 기반 건물 매칭
function findMatchedBuildings(address: string, coords: { lat: number; lng: number } | null, buildings: Building[]): Building[] {
  const norm = (s: string) => s.replace(/\s+/g, '').toLowerCase()
  const addrNorm = norm(address)
  const byAddress = buildings.filter((b) => {
    const bNorm = norm(b.address)
    return bNorm === addrNorm || bNorm.includes(addrNorm) || addrNorm.includes(bNorm)
  })
  if (!coords) return byAddress
  const toRad = (d: number) => (d * Math.PI) / 180
  const byCoords = buildings.filter((b) => {
    if (!b.lat || !b.lng) return false
    const dLat = toRad(b.lat - coords.lat)
    const dLng = toRad(b.lng - coords.lng)
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(coords.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
    return 6371000 * 2 * Math.asin(Math.sqrt(a)) < 150
  })
  const ids = new Set(byAddress.map((b) => b.id))
  return [...byAddress, ...byCoords.filter((b) => !ids.has(b.id))]
}

// ── 아이콘 ─────────────────────────────
function ForkIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 2v7c0 1.66 1.34 3 3 3h0c1.66 0 3-1.34 3-3V2" /><line x1="6" y1="12" x2="6" y2="22" /><path d="M15 22V12c0-3 2-7 4-7v17" />
    </svg>
  )
}
function MapIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <polygon points="3 6 9 3 15 6 21 3 21 21 15 18 9 21 3 18 3 6" /><line x1="9" y1="3" x2="9" y2="21" /><line x1="15" y1="6" x2="15" y2="18" />
    </svg>
  )
}
function DotsIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <circle cx="12" cy="5" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="19" r="1.5" />
    </svg>
  )
}
function PlusIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round">
      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}
function SearchIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  )
}
function SearchIconLg({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
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
function Spinner() {
  return (
    <span style={{ display: 'inline-block', width: 12, height: 12, border: '2px solid var(--muted)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
  )
}

// ── 신청 카드 (카드별 독립 상태) ─────────────────────────────────────
type VerifyStatus = 'idle' | 'loading' | 'done'

function PendingRequestCard({
  req, buildings, cards, currentVisitor,
  onApprove, onReject,
}: {
  req: RestaurantRequest
  buildings: Building[]
  cards: TerritoryCard[]
  currentVisitor: string
  onApprove: (id: number, opts: { name: string; address: string; reviewer: string; existingBuildingId?: number | null; lat?: number; lng?: number }) => Promise<void>
  onReject: (id: number, reviewer: string) => Promise<void>
}) {
  const [name, setName] = useState(req.name)
  const [address, setAddress] = useState(req.address)
  const [addressDirty, setAddressDirty] = useState(false)

  const [verifyStatus, setVerifyStatus] = useState<VerifyStatus>('idle')
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [matchedBuildings, setMatchedBuildings] = useState<Building[]>([])
  const [selectedMatchId, setSelectedMatchId] = useState<number | 'new'>('new')

  const [buildingSearch, setBuildingSearch] = useState('')
  const [processing, setProcessing] = useState<'approve' | 'reject' | null>(null)

  // 렌더 시 자동 주소 확인
  useEffect(() => {
    runVerify(req.address)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const runVerify = async (addr: string) => {
    setVerifyStatus('loading')
    setAddressDirty(false)
    const c = await geocodeAddress(addr)
    setCoords(c)
    const matched = findMatchedBuildings(addr, c, buildings)
    setMatchedBuildings(matched)
    setSelectedMatchId(matched.length > 0 ? matched[0].id : 'new')
    setVerifyStatus('done')
  }

  const buildingSearchResults = useMemo(() => {
    if (!buildingSearch.trim()) return []
    const norm = (s: string) => s.replace(/\s+/g, '').toLowerCase()
    const q = norm(buildingSearch)
    return buildings.filter((b) => norm(`${b.name}${b.address}`).includes(q)).slice(0, 8)
  }, [buildings, buildingSearch])

  const selectedBuilding = matchedBuildings.find((b) => b.id === selectedMatchId)
    ?? buildingSearchResults.find((b) => b.id === selectedMatchId)

  const handleApprove = async () => {
    setProcessing('approve')
    await onApprove(req.id, {
      name,
      address,
      reviewer: currentVisitor,
      existingBuildingId: selectedMatchId === 'new' ? null : (selectedMatchId as number),
      lat: coords?.lat,
      lng: coords?.lng,
    })
    setProcessing(null)
  }

  const handleReject = async () => {
    setProcessing('reject')
    await onReject(req.id, currentVisitor)
    setProcessing(null)
  }

  const sharedInputStyle: React.CSSProperties = {
    padding: '8px 10px', borderRadius: 8,
    border: '1.5px solid var(--line)', fontSize: 14,
    background: 'var(--surface)', color: 'var(--ink)',
    outline: 'none', width: '100%', boxSizing: 'border-box',
  }

  return (
    <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--line, #e5e4e0)' }}>

      {/* 이름 */}
      <div style={{ marginBottom: 6 }}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="식당 이름"
          autoComplete="new-password"
          style={sharedInputStyle}
        />
      </div>

      {/* 주소 + 🔍 재확인 버튼 (깔끔한 이너 버튼 형태의 flex 컨테이너) */}
      <div style={{
        display: 'flex', alignItems: 'center',
        padding: '3px 4px 3px 10px',
        border: `1.5px solid ${addressDirty ? 'var(--primary-400, #818cf8)' : 'var(--line)'}`,
        borderRadius: 8,
        background: 'var(--surface)',
        marginBottom: 6,
        transition: 'border-color 0.15s',
      }}>
        <input
          value={address}
          onChange={(e) => { setAddress(e.target.value); setAddressDirty(true) }}
          placeholder="주소"
          autoComplete="new-password"
          style={{
            flex: 1, minWidth: 0,
            padding: '5px 0', fontSize: 14,
            border: 'none', outline: 'none',
            background: 'transparent', color: 'var(--ink)',
          }}
        />
        <button
          type="button"
          onClick={() => runVerify(address)}
          disabled={verifyStatus === 'loading'}
          title="주소 재확인"
          style={{
            flexShrink: 0, width: 28, height: 28,
            borderRadius: 6,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: addressDirty ? 'var(--primary-500, #6366f1)' : 'var(--tint)',
            color: addressDirty ? '#fff' : 'var(--muted)',
            border: 'none',
            cursor: verifyStatus === 'loading' ? 'default' : 'pointer',
            transition: 'background 0.15s, color 0.15s',
          }}
        >
          {verifyStatus === 'loading' ? <Spinner /> : <SearchIcon />}
        </button>
      </div>

      {/* 주소 수정 안내 */}
      {addressDirty && (
        <div style={{ fontSize: 11, color: '#d97706', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
          🔍 주소를 수정했습니다. 오른쪽 버튼을 눌러 재확인하세요.
        </div>
      )}

      {/* 신청자 */}
      <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>
        신청: {req.requestedBy}
        {req.memo && <> · <em style={{ fontStyle: 'normal', color: 'var(--ink-light, #666)' }}>"{req.memo}"</em></>}
      </div>

      {/* 주소 검증 결과 */}
      {verifyStatus === 'loading' && (
        <div style={{ fontSize: 12, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, padding: '8px 10px', background: 'var(--tint)', borderRadius: 8 }}>
          <Spinner /> 주소 위치 확인 중...
        </div>
      )}

      {verifyStatus === 'done' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12, padding: '10px 12px', background: 'var(--tint)', borderRadius: 10 }}>
          {/* 위치 확인 결과 */}
          {coords ? (
            <div style={{ fontSize: 12, color: '#16a34a', display: 'flex', alignItems: 'center', gap: 5, fontWeight: 600 }}>
              <span>📍</span> 위치 확인됨
            </div>
          ) : (
            matchedBuildings.length === 0 && (
              <div style={{ fontSize: 12, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 5 }}>
                <span>📍</span> 위치를 찾지 못했습니다. 아래에서 건물을 직접 선택하세요.
              </div>
            )
          )}

          {/* 자동 매칭된 건물 */}
          {matchedBuildings.length > 0 && (
            <div>
              <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                같은 위치의 기존 건물
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {matchedBuildings.map((b) => {
                  const cardName = cards.find((c) => c.id === b.cardId)?.name
                  return (
                    <label key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 8, border: `1.5px solid ${selectedMatchId === b.id ? 'var(--ink)' : 'var(--line)'}`, cursor: 'pointer', background: selectedMatchId === b.id ? 'var(--bg-subtle)' : 'var(--surface)' }}>
                      <input type="radio" name={`match-${req.id}`} value={b.id} checked={selectedMatchId === b.id} onChange={() => setSelectedMatchId(b.id)} style={{ accentColor: 'var(--ink)', flexShrink: 0 }} />
                      <div style={{ minWidth: 0 }}>
                        <strong style={{ fontSize: 13 }}>{b.name || b.address}</strong>
                        <div style={{ fontSize: 11, color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {cardName ? `${cardName} · ` : ''}{b.address} · 세대 {b.units.length}개
                        </div>
                      </div>
                    </label>
                  )
                })}
              </div>
            </div>
          )}

          {/* 건물 직접 검색 */}
          <div>
            <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              건물 직접 검색
            </p>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', display: 'flex', pointerEvents: 'none' }}>
                <SearchIcon size={13} />
              </span>
              <input
                value={buildingSearch}
                onChange={(e) => setBuildingSearch(e.target.value)}
                placeholder="건물 이름 또는 주소"
                autoComplete="off"
                style={{ width: '100%', boxSizing: 'border-box', padding: '7px 10px 7px 26px', borderRadius: 8, border: '1.5px solid var(--line)', fontSize: 13, background: 'var(--surface)', color: 'var(--ink)', outline: 'none' }}
              />
            </div>
            {buildingSearchResults.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 5 }}>
                {buildingSearchResults.map((b) => {
                  const cardName = cards.find((c) => c.id === b.cardId)?.name
                  return (
                    <label key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 8, border: `1.5px solid ${selectedMatchId === b.id ? 'var(--ink)' : 'var(--line)'}`, cursor: 'pointer', background: selectedMatchId === b.id ? 'var(--bg-subtle)' : 'var(--surface)' }}>
                      <input type="radio" name={`match-${req.id}`} value={b.id} checked={selectedMatchId === b.id} onChange={() => setSelectedMatchId(b.id)} style={{ accentColor: 'var(--ink)', flexShrink: 0 }} />
                      <div style={{ minWidth: 0 }}>
                        <strong style={{ fontSize: 13 }}>{b.name || b.address}</strong>
                        <div style={{ fontSize: 11, color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {cardName ? `${cardName} · ` : ''}{b.address}
                        </div>
                      </div>
                    </label>
                  )
                })}
              </div>
            )}
          </div>

          {/* 새 건물로 추가 */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 8, border: `1.5px solid ${selectedMatchId === 'new' ? 'var(--ink)' : 'var(--line)'}`, cursor: 'pointer', background: selectedMatchId === 'new' ? 'var(--bg-subtle)' : 'var(--surface)' }}>
            <input type="radio" name={`match-${req.id}`} value="new" checked={selectedMatchId === 'new'} onChange={() => setSelectedMatchId('new')} style={{ accentColor: 'var(--ink)', flexShrink: 0 }} />
            <div>
              <strong style={{ fontSize: 13 }}>새 건물로 추가</strong>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>미배정 건물 카드에 새로 생성</div>
            </div>
          </label>

          {/* 선택 요약 */}
          {selectedMatchId !== 'new' && selectedBuilding && (
            <div style={{ fontSize: 11, color: 'var(--ink)', background: 'var(--bg-subtle)', borderRadius: 6, padding: '5px 8px', border: '1px solid var(--line)' }}>
              ✓ {selectedBuilding.name || selectedBuilding.address} 건물에 식당으로 등록됩니다
            </div>
          )}
          {selectedMatchId === 'new' && (
            <div style={{ fontSize: 11, color: 'var(--ink)', background: 'var(--bg-subtle)', borderRadius: 6, padding: '5px 8px', border: '1px solid var(--line)' }}>
              ✓ 미배정 건물 카드에 새 건물로 추가됩니다
            </div>
          )}
        </div>
      )}

      {/* 액션 버튼 */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          type="button"
          onClick={handleApprove}
          disabled={!!processing || verifyStatus === 'loading'}
          style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: 'none', background: processing === 'approve' ? 'var(--muted)' : 'var(--ink)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
        >
          {processing === 'approve' ? '처리 중...' : '승인 확정'}
        </button>
        <button
          type="button"
          onClick={handleReject}
          disabled={!!processing}
          style={{ padding: '9px 16px', borderRadius: 8, border: '1px solid #fca5a5', background: '#fff', color: '#ef4444', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
        >
          {processing === 'reject' ? '...' : '거절'}
        </button>
      </div>
    </div>
  )
}

// ── 메인 탭 컴포넌트 ─────────────────────────────────────────────────
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

export function RestaurantsTab({
  role, buildings, cards, currentVisitor = '', restaurantRequests = [],
  onToggleRestaurantFlag, onApproveRestaurantRequest, onRejectRestaurantRequest, onOpenMap,
}: Props) {
  const canManage = isLeaderOrAdmin(role)
  const [search, setSearch] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [openMenuId, setOpenMenuId] = useState<number | null>(null)

  const pendingRequests = useMemo(
    () => restaurantRequests.filter((r) => r.status === 'pending'),
    [restaurantRequests],
  )

  const restaurants = useMemo(
    () => buildings.filter((b) => b.type === '상가' && b.isRestaurant),
    [buildings],
  )

  const filtered = useMemo(() => {
    const q = normalizeCardSearch(search)
    if (!q) return restaurants
    return restaurants.filter((b) =>
      normalizeCardSearch(`${b.name}${b.address}`).includes(q),
    )
  }, [restaurants, search])

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
            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink)' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 13h18"></path>
                <path d="M4 13a8 8 0 0 0 16 0"></path>
                <path d="M8 21h8"></path>
                <path d="M9 9v-3"></path>
                <path d="M12 9v-4"></path>
                <path d="M15 9v-3"></path>
              </svg>
            </span>
            <span style={{ fontSize: 14, color: 'var(--ink)', fontWeight: 600 }}>식당봉사 추가 신청</span>
            <span style={{
              marginLeft: 'auto',
              background: '#ef4444', color: '#fff',
              borderRadius: 10, padding: '1px 7px', fontSize: 11, fontWeight: 700,
            }}>{pendingRequests.length}</span>
          </div>
          {pendingRequests.map((req) => (
            <PendingRequestCard
              key={req.id}
              req={req}
              buildings={buildings}
              cards={cards}
              currentVisitor={currentVisitor}
              onApprove={async (id, opts) => { await onApproveRestaurantRequest?.(id, opts) }}
              onReject={async (id, reviewer) => { await onRejectRestaurantRequest?.(id, reviewer) }}
            />
          ))}
        </div>
      )}

      {/* 상단 카운트 + 추가 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px' }}>
        <span style={{ fontSize: 13, color: 'var(--muted)' }}>전체 {restaurants.length}개</span>
        {canManage && (
          <button type="button" onClick={() => setAddOpen(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, height: 32, minHeight: 32, padding: '0 12px', border: 'none', borderRadius: 8, background: 'var(--ink)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', letterSpacing: '-0.005em' }}>
            <PlusIcon /> 식당 추가
          </button>
        )}
      </div>

      {/* 검색 */}
      <label style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 10, padding: '11px 14px', fontSize: 14, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8, cursor: 'text' }}>
        <span style={{ color: 'var(--muted-2)', display: 'inline-flex' }}><SearchIconLg /></span>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="식당 이름 또는 주소 검색"
          style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', font: 'inherit', color: 'inherit', padding: 0 }}
        />
      </label>

      {/* 빈 상태 */}
      {restaurants.length === 0 ? (
        <div style={{ padding: '40px 16px', textAlign: 'center', fontSize: 13, color: 'var(--muted)', lineHeight: 1.6, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 12 }}>
          {canManage ? <>아직 등록된 식당이 없습니다.<br />위 + 식당 추가로 시작하세요.</> : <>아직 등록된 식당이 없습니다.</>}
        </div>
      ) : grouped.length === 0 ? (
        <div style={{ padding: '32px 16px', textAlign: 'center', fontSize: 13, color: 'var(--muted)' }}>검색 결과가 없습니다.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {grouped.map(([region, list]) => (
            <section key={region}>
              <div style={{ display: 'flex', alignItems: 'center', padding: '0 4px', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <ChevD />
                  <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>{region}</span>
                  <span style={{ fontSize: 12, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>{list.length}</span>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {list.map((b) => {
                  const card = cards.find((c) => c.id === b.cardId)
                  return (
                    <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 12 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--tint)', display: 'grid', placeItems: 'center', color: 'var(--muted)', flexShrink: 0 }}>
                        <ForkIcon />
                      </div>
                      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.name || b.address}</span>
                        <span style={{ fontSize: 12.5, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{card?.name ? `${card.name} · ` : ''}{b.address}</span>
                      </div>
                      <button type="button" onClick={() => onOpenMap(b.cardId)}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 5, height: 34, minHeight: 34, padding: '0 12px', fontSize: 13, fontWeight: 600, border: '1px solid var(--line-2)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text)', cursor: 'pointer' }}>
                        <MapIcon /> 지도
                      </button>
                      {canManage && onToggleRestaurantFlag && (
                        <div style={{ position: 'relative' }}>
                          <button type="button" onClick={() => setOpenMenuId(openMenuId === b.id ? null : b.id)}
                            style={{ width: 28, height: 28, minHeight: 28, display: 'grid', placeItems: 'center', background: 'transparent', border: 'none', color: 'var(--text)', cursor: 'pointer', borderRadius: 6 }}
                            aria-label="더보기">
                            <DotsIcon />
                          </button>
                          {openMenuId === b.id && (
                            <>
                              <div onClick={() => setOpenMenuId(null)} style={{ position: 'fixed', inset: 0, zIndex: 30 }} />
                              <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4, zIndex: 31, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.08)', minWidth: 140, padding: 4 }}>
                                <button type="button"
                                  onClick={async () => { setOpenMenuId(null); if (confirm(`"${b.name || b.address}" 식당 표시를 해제할까요?`)) { await onToggleRestaurantFlag(b.id, false) } }}
                                  style={{ width: '100%', textAlign: 'left', padding: '8px 10px', minHeight: 0, background: 'transparent', border: 'none', fontSize: 13, color: 'var(--status-danger)', cursor: 'pointer', borderRadius: 6 }}>
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
          {canManage && (
            <button type="button" onClick={() => setAddOpen(true)}
              style={{ padding: '18px 14px', border: '1px dashed var(--line-2)', background: 'transparent', color: 'var(--muted)', borderRadius: 12, display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center', font: 'inherit', fontSize: 13, fontWeight: 500, cursor: 'pointer', minHeight: 0 }}>
              <PlusIcon /> 다음 식당 추가하기
            </button>
          )}
        </div>
      )}

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
