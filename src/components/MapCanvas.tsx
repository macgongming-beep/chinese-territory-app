import { useEffect, useMemo, useRef } from 'react'
import type { MouseEvent } from 'react'
import type { Building, BuildingStatus, CardBoundary, GeoPoint, TerritoryCard } from '../types'
import { getBuildingStatus, getCardName, getMockPosition, isValidMapCoordinate } from '../utils/mapUtils'
import { TERRITORY_BOUNDARY } from '../data/territoryBoundary'
import { showToast } from '../lib/toast'

const STATUS_COLORS: Record<BuildingStatus, string> = {
  방문필요: '#2D6CDF',
  방문완료: '#4F7A4B',
  방문금지: '#1A1A18',
  정기방문: '#B8862A',
}

function cssVar(name: string, fallback: string): string {
  return `var(${name}, ${fallback})`
}

function resolveCssColor(name: string, fallback: string): string {
  if (typeof window === 'undefined' || typeof document === 'undefined') return fallback
  const value = window.getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return value || fallback
}

function getMapPalette() {
  return {
    brand: resolveCssColor('--brand-700', '#4267a5'),
    info: resolveCssColor('--info-700', '#3b82f6'),
    accent: resolveCssColor('--accent-700', '#1f6b43'),
    danger: resolveCssColor('--danger-600', '#d73b4a'),
    cardDraft: '#ed9407',
    preview: '#f97316',
  }
}

function getBoundaryBox() {
  return TERRITORY_BOUNDARY.reduce(
    (box, [lng, lat]) => ({
      minLng: Math.min(box.minLng, lng),
      maxLng: Math.max(box.maxLng, lng),
      minLat: Math.min(box.minLat, lat),
      maxLat: Math.max(box.maxLat, lat),
    }),
    {
      minLng: Number.POSITIVE_INFINITY,
      maxLng: Number.NEGATIVE_INFINITY,
      minLat: Number.POSITIVE_INFINITY,
      maxLat: Number.NEGATIVE_INFINITY,
    },
  )
}

function getMockBoundaryPoints() {
  const box = getBoundaryBox()
  const lngRange = box.maxLng - box.minLng || 1
  const latRange = box.maxLat - box.minLat || 1

  return TERRITORY_BOUNDARY.map(([lng, lat]) => {
    const x = ((lng - box.minLng) / lngRange) * 100
    const y = (1 - (lat - box.minLat) / latRange) * 100
    return `${x.toFixed(2)},${y.toFixed(2)}`
  }).join(' ')
}

function getMockPolygonPoints(points: GeoPoint[]) {
  const box = getBoundaryBox()
  const lngRange = box.maxLng - box.minLng || 1
  const latRange = box.maxLat - box.minLat || 1

  return points.map(({ lng, lat }) => {
    const x = ((lng - box.minLng) / lngRange) * 100
    const y = (1 - (lat - box.minLat) / latRange) * 100
    return `${x.toFixed(2)},${y.toFixed(2)}`
  }).join(' ')
}

function getMockPoint(point: GeoPoint) {
  const box = getBoundaryBox()
  const lngRange = box.maxLng - box.minLng || 1
  const latRange = box.maxLat - box.minLat || 1

  return {
    x: ((point.lng - box.minLng) / lngRange) * 100,
    y: (1 - (point.lat - box.minLat) / latRange) * 100,
  }
}

function getMidPoint(start: GeoPoint, end: GeoPoint): GeoPoint {
  return {
    lat: (start.lat + end.lat) / 2,
    lng: (start.lng + end.lng) / 2,
  }
}

function getPointFromMockEvent(event: MouseEvent<HTMLDivElement>): GeoPoint {
  const rect = event.currentTarget.getBoundingClientRect()
  const x = Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1)
  const y = Math.min(Math.max((event.clientY - rect.top) / rect.height, 0), 1)
  const box = getBoundaryBox()

  return {
    lng: box.minLng + (box.maxLng - box.minLng) * x,
    lat: box.maxLat - (box.maxLat - box.minLat) * y,
  }
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

// ── Clustering ─────────────────────────────────────────────────────────────

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function getClusterThresholdKm(zoom: number): number {
  if (zoom >= 17) return 0
  if (zoom >= 16) return 0.05
  if (zoom >= 15) return 0.1
  if (zoom >= 14) return 0.2
  if (zoom >= 13) return 0.4
  if (zoom >= 12) return 0.8
  return 1.5
}

type BuildingCluster = { buildings: Building[]; lat: number; lng: number }
export type MapAggregateMarker = {
  id: string
  label: string
  count: number
  unitCount: number
  houseCount: number
  shopCount: number
  lat: number
  lng: number
}

function clusterBuildings(buildings: Building[], zoom: number): BuildingCluster[] {
  const validBuildings = buildings.filter((building) => isValidMapCoordinate(Number(building.lat), Number(building.lng)))
  const threshold = getClusterThresholdKm(zoom)
  if (threshold === 0) {
    return validBuildings.map((b) => ({ buildings: [b], lat: b.lat, lng: b.lng }))
  }
  const used = new Set<number>()
  const clusters: BuildingCluster[] = []
  for (let i = 0; i < validBuildings.length; i++) {
    if (used.has(i)) continue
    const group: Building[] = [validBuildings[i]]
    used.add(i)
    for (let j = i + 1; j < validBuildings.length; j++) {
      if (used.has(j)) continue
      if (haversineKm(validBuildings[i].lat, validBuildings[i].lng, validBuildings[j].lat, validBuildings[j].lng) < threshold) {
        group.push(validBuildings[j])
        used.add(j)
      }
    }
    const lat = group.reduce((s, b) => s + b.lat, 0) / group.length
    const lng = group.reduce((s, b) => s + b.lng, 0) / group.length
    clusters.push({ buildings: group, lat, lng })
  }
  return clusters
}

function clusterMarkerHtml(count: number): string {
  const size = count >= 50 ? 52 : count >= 10 ? 44 : 36
  const fontSize = count >= 50 ? 16 : count >= 10 ? 15 : 14
  const clusterColor = '#334155'
  return `<div title="${count}개 건물" style="
    display:grid;
    width:${size}px;
    height:${size}px;
    place-items:center;
    border:3px solid #ffffff;
    border-radius:999px;
    background:${clusterColor};
    box-shadow:0 4px 14px rgba(15,23,42,0.28);
    color:#ffffff;
    cursor:pointer;
    font-size:${fontSize}px;
    font-weight:700;
    font-family:sans-serif;
    user-select:none;
  ">${count}</div>`
}

function aggregateMarkerHtml(marker: MapAggregateMarker): string {
  const safeLabel = escapeAttr(marker.label)
  const safeTitle = escapeAttr(`${marker.label} · 건물 ${marker.count}개 · 세대 ${marker.unitCount}개`)
  return `<div title="${safeTitle}" style="
    display:flex;
    align-items:center;
    gap:7px;
    min-width:84px;
    max-width:128px;
    height:38px;
    padding:0 10px 0 12px;
    border:1.5px solid rgba(0,0,0,0.10);
    border-radius:999px;
    background:rgba(255,255,255,0.92);
    box-shadow:0 2px 10px rgba(0,0,0,0.12);
    color:#37352F;
    cursor:pointer;
    font-family:sans-serif;
    user-select:none;
    box-sizing:border-box;
  ">
    <span style="
      min-width:0;
      overflow:hidden;
      text-overflow:ellipsis;
      white-space:nowrap;
      font-size:13px;
      font-weight:700;
      line-height:1;
    ">${safeLabel}</span>
    <strong style="
      flex:0 0 auto;
      display:grid;
      min-width:24px;
      height:24px;
      place-items:center;
      padding:0 6px;
      border-radius:999px;
      background:rgba(0,0,0,0.07);
      font-size:13px;
      font-weight:800;
      line-height:1;
      box-sizing:border-box;
    ">${marker.count}</strong>
  </div>`
}

function virtualPinHtml(label: string): string {
  const safe = label.replace(/</g, '&lt;').replace(/>/g, '&gt;')
  // 고정 너비 120px 컨테이너 → anchor Point(60, 35)와 정확히 대응
  // pointer-events:auto + cursor:pointer → 클릭 이벤트 정상 수신
  return `<div style="width:120px;display:flex;flex-direction:column;align-items:center;pointer-events:auto;cursor:pointer;">
    <div style="background:#f97316;color:#fff;font-size:12px;font-weight:700;padding:4px 8px;border-radius:8px;white-space:nowrap;box-shadow:0 2px 10px rgba(0,0,0,0.25);max-width:116px;overflow:hidden;text-overflow:ellipsis;text-align:center;">${safe}</div>
    <div style="width:0;height:0;border-left:7px solid transparent;border-right:7px solid transparent;border-top:9px solid #f97316;flex-shrink:0;pointer-events:none;"></div>
  </div>`
}

function previewPinHtml(): string {
  const infoColor = cssVar('--info-700', '#3b82f6')
  return `<div style="position:relative; width:40px; height:40px; display:flex; justify-content:center;">
            <div style="
              width: 26px;
              height: 26px;
              background: ${infoColor};
              border: 2.5px solid white;
              border-radius: 50% 50% 50% 0;
              box-sizing: border-box;
              transform: rotate(-45deg);
              box-shadow: 0 2px 6px rgba(0,0,0,0.3);
              display: flex;
              align-items: center;
              justify-content: center;
            ">
              <div style="
                width: 8px;
                height: 8px;
                background: white;
                border-radius: 50%;
                transform: rotate(45deg);
              "></div>
            </div>
          </div>`
}

// ── Individual marker HTML ─────────────────────────────────────────────────

function markerHtml(
  building: Building,
  cards: TerritoryCard[],
  isSelected: boolean,
  isDimmed: boolean,
): string {
  const status = getBuildingStatus(building)
  const color = STATUS_COLORS[status]
  const cardName = getCardName(cards, building.cardId)
  const hasRegularVisit = building.units.some((unit) => unit.isRegularVisit)
  const hasChineseNeedsReview = building.units.some((unit) => unit.isChinese && !unit.isRegularVisit)
  const strokeColor = '#ffffff'
  const scale = isSelected ? 1.22 : 1
  const opacity = isDimmed ? 0.38 : 1
  const label = escapeAttr(`${building.name} · ${status} · ${cardName}${hasChineseNeedsReview ? ' · 중국인 발견' : hasRegularVisit ? ' · 정기방문 있음' : ''}`)

  return `
    <div
      title="${label}"
      style="
        position: relative;
        cursor: pointer;
        opacity: ${opacity};
        transform: scale(${scale});
        line-height: normal;
        width: 40px;
        height: 40px;
        display: flex;
        justify-content: center;
        align-items: center;
      "
    >
      <div style="
        width: 14px;
        height: 14px;
        background: ${color};
        border: 2px solid ${strokeColor};
        border-radius: 50% 50% 50% 0;
        box-sizing: border-box;
        transform: rotate(-45deg);
        box-shadow: ${isSelected ? '0 0 0 3px rgba(255,255,255,0.72), 0 3px 9px rgba(15,23,42,0.34)' : '0 2px 6px rgba(15,23,42,0.26)'};
        flex-shrink: 0;
      "></div>
    </div>
  `
}

// ── Naver Map Canvas ───────────────────────────────────────────────────────

function NaverMapCanvas({
  buildings,
  aggregateMarkers = [],
  cardBoundaries,
  cards,
  clientId,
  drawingBoundary,
  addingBuilding,
  editingBuildingLocation,
  previewPinLat,
  previewPinLng,
  virtualPinLat,
  virtualPinLng,
  virtualPinLabel,
  draftBoundaryPoints,
  selectedBuildingId,
  focusBuildingId,
  selectedCardId,
  selectedCardIds,
  onAddBoundaryPoint,
  onInsertBoundaryPoint,
  onRemoveBoundaryPoint,
  onSelectBuilding,
  onSelectAggregate,
  onSelectCardBoundary,
  onUpdateBoundaryPoint,
  onMapRightClick,
  onMapClick,
  onMapLongClick,
  highlightedCardIds,
  isMobile = false,
  bottomPadding,
  onToggleAddingBuilding,
  onOpenActionMenu,
  onToggleDrawingBoundary: _onToggleDrawingBoundary,
  onLocationPermissionBlocked,
  onMovePreviewPin,
  onMoveBuilding,
}: {
  buildings: Building[]
  aggregateMarkers?: MapAggregateMarker[]
  cardBoundaries: CardBoundary[]
  cards: TerritoryCard[]
  clientId: string
  drawingBoundary: boolean
  addingBuilding?: boolean
  editingBuildingLocation?: boolean
  previewPinLat?: number | null
  previewPinLng?: number | null
  virtualPinLat?: number | null
  virtualPinLng?: number | null
  virtualPinLabel?: string
  draftBoundaryPoints: GeoPoint[]
  selectedBuildingId: number
  focusBuildingId?: number | null
  selectedCardId: number | '전체' | null
  selectedCardIds?: Set<number>
  onAddBoundaryPoint?: (point: GeoPoint) => void
  onInsertBoundaryPoint?: (index: number, point: GeoPoint) => void
  onRemoveBoundaryPoint?: (index: number) => void
  onSelectBuilding?: (id: number) => void
  onSelectAggregate?: (id: string) => void
  onSelectCardBoundary?: (cardId: number) => void
  onUpdateBoundaryPoint?: (index: number, point: GeoPoint) => void
  onMapRightClick?: (lat: number, lng: number) => void
  onMapClick?: (lat: number, lng: number) => void
  onMapLongClick?: (lat: number, lng: number) => void
  highlightedCardIds?: Set<number>
  isMobile?: boolean
  bottomPadding?: number
  onToggleAddingBuilding?: (val: boolean) => void
  onOpenActionMenu?: () => void
  onToggleDrawingBoundary?: (val: boolean) => void
  onLocationPermissionBlocked?: () => void
  onMovePreviewPin?: (lat: number, lng: number) => void
  onMoveBuilding?: (id: number, lat: number, lng: number) => void
}) {
  const mapRef = useRef<HTMLDivElement | null>(null)
  const mapInstanceRef = useRef<any>(null)
  const markersRef = useRef<any[]>([])
  const boundaryRef = useRef<any>(null)
  const cardPolygonsRef = useRef<Map<number, any>>(new Map())
  const draftBoundaryRef = useRef<any>(null)
  const draftPointMarkerRefs = useRef<any[]>([])
  const draftMidpointMarkerRefs = useRef<any[]>([])
  const clickListenerRef = useRef<any>(null)
  const scriptLoadedRef = useRef(false)
  const hasFitBoundaryRef = useRef(false)
  const prevSelectedBuildingIdRef = useRef(selectedBuildingId)
  const prevSelectedCardIdRef = useRef<number | '전체' | null>(selectedCardId)
  const prevHighlightedCardIdsSignatureRef = useRef('')
  const visibleBuildingSignatureRef = useRef('')
  const selectedCardIdRef = useRef<number | '전체' | null>(selectedCardId)
  selectedCardIdRef.current = selectedCardId
  const aggregateMarkersRef = useRef(aggregateMarkers)
  aggregateMarkersRef.current = aggregateMarkers
  const highlightedCardIdsRef = useRef(highlightedCardIds)
  highlightedCardIdsRef.current = highlightedCardIds
  const selectedCardIdsRef = useRef(selectedCardIds)
  selectedCardIdsRef.current = selectedCardIds

  const onMapRightClickRef = useRef(onMapRightClick)
  onMapRightClickRef.current = onMapRightClick
  const onMapClickRef = useRef(onMapClick)
  onMapClickRef.current = onMapClick
  const onMapLongClickRef = useRef(onMapLongClick)
  onMapLongClickRef.current = onMapLongClick

  // Stable refs for event callbacks (avoids stale closures in zoom_changed listener)
  const buildingsRef = useRef(buildings)
  buildingsRef.current = buildings
  const cardsRef = useRef(cards)
  cardsRef.current = cards
  const selectedBuildingIdRef2 = useRef(selectedBuildingId)
  selectedBuildingIdRef2.current = selectedBuildingId
  const focusBuildingIdRef = useRef(focusBuildingId)
  focusBuildingIdRef.current = focusBuildingId
  const addingBuildingRef = useRef(addingBuilding)
  addingBuildingRef.current = addingBuilding
  const editingBuildingLocationRef = useRef(editingBuildingLocation)
  editingBuildingLocationRef.current = editingBuildingLocation
  const isMobileRef = useRef(isMobile)
  isMobileRef.current = isMobile
  const onSelectBuildingRef = useRef(onSelectBuilding)
  onSelectBuildingRef.current = onSelectBuilding
  const onSelectAggregateRef = useRef(onSelectAggregate)
  onSelectAggregateRef.current = onSelectAggregate
  const onSelectCardBoundaryRef = useRef(onSelectCardBoundary)
  onSelectCardBoundaryRef.current = onSelectCardBoundary
  const previewMarkerRef = useRef<any>(null)
  const userLocationMarkerRef = useRef<any>(null)
  const previewPinLatRef = useRef(previewPinLat)
  previewPinLatRef.current = previewPinLat
  const previewPinLngRef = useRef(previewPinLng)
  previewPinLngRef.current = previewPinLng
  const virtualMarkerRef = useRef<any>(null)
  const virtualPinLatRef = useRef(virtualPinLat)
  virtualPinLatRef.current = virtualPinLat
  const virtualPinLngRef = useRef(virtualPinLng)
  virtualPinLngRef.current = virtualPinLng
  const virtualPinLabelRef = useRef(virtualPinLabel)
  virtualPinLabelRef.current = virtualPinLabel
  // 가상 핀: 최초 배치 시에만 지도 중심/줌 이동 (zoom_changed 때마다 리셋 방지)
  const lastVirtualPinPosRef = useRef<{ lat: number; lng: number } | null>(null)

  const doRebuildMarkers = () => {
    const naver = (window as any).naver
    if (!naver?.maps || !mapInstanceRef.current) return

    ;(window as any).__ctaMarkerClick = onSelectBuildingRef.current

    markersRef.current.forEach((m) => m.setMap(null))
    markersRef.current = []

    if (aggregateMarkersRef.current.length > 0) {
      aggregateMarkersRef.current.forEach((aggregate) => {
        if (!isValidMapCoordinate(Number(aggregate.lat), Number(aggregate.lng))) return
        const marker = new naver.maps.Marker({
          map: mapInstanceRef.current,
          position: new naver.maps.LatLng(aggregate.lat, aggregate.lng),
          icon: {
            content: aggregateMarkerHtml(aggregate),
            anchor: new naver.maps.Point(54, 21),
          },
          zIndex: 8,
        })
        naver.maps.Event.addListener(marker, 'click', () => {
          if (addingBuildingRef.current) return
          onSelectAggregateRef.current?.(aggregate.id)
        })
        markersRef.current.push(marker)
      })
      return
    }

    const zoom = mapInstanceRef.current.getZoom()
    const clusters = clusterBuildings(buildingsRef.current, zoom)

    clusters.forEach((cluster) => {
      if (cluster.buildings.length === 1) {
        const building = cluster.buildings[0]
        const isSelected = building.id === selectedBuildingIdRef2.current
        const isDimmed =
          selectedCardIdRef.current !== null &&
          selectedCardIdRef.current !== '전체' &&
          building.cardId !== selectedCardIdRef.current
        const marker = new naver.maps.Marker({
          map: mapInstanceRef.current,
          position: new naver.maps.LatLng(building.lat, building.lng),
          icon: {
            content: markerHtml(building, cardsRef.current, isSelected, isDimmed),
            anchor: new naver.maps.Point(20, 30),
          },
          zIndex: isSelected ? 10 : isDimmed ? 0 : 1,
          draggable: !!editingBuildingLocationRef.current,
        })
        if (editingBuildingLocationRef.current) {
          naver.maps.Event.addListener(marker, 'dragend', (e: any) => {
            onMoveBuilding?.(building.id, e.coord.lat(), e.coord.lng())
          })
        }
        naver.maps.Event.addListener(marker, 'click', () => {
          if (addingBuildingRef.current) return
          onSelectBuildingRef.current?.(building.id)
        })
        markersRef.current.push(marker)
      } else {
        const count = cluster.buildings.length
        const size = count >= 50 ? 52 : count >= 10 ? 44 : 36
        const marker = new naver.maps.Marker({
          map: mapInstanceRef.current,
          position: new naver.maps.LatLng(cluster.lat, cluster.lng),
          icon: {
            content: clusterMarkerHtml(count),
            anchor: new naver.maps.Point(size / 2, size / 2),
          },
          zIndex: 5,
        })
        naver.maps.Event.addListener(marker, 'click', () => {
          if (addingBuildingRef.current) return
          const curZoom = mapInstanceRef.current.getZoom()
          mapInstanceRef.current.setCenter(new naver.maps.LatLng(cluster.lat, cluster.lng))
          mapInstanceRef.current.setZoom(Math.min(curZoom + 3, 20))
        })
        markersRef.current.push(marker)
      }
    })

    // Preview pin for building add mode
    if (previewMarkerRef.current) {
      previewMarkerRef.current.setMap(null)
      previewMarkerRef.current = null
    }
    const pLat = previewPinLatRef.current
    const pLng = previewPinLngRef.current
    if (pLat != null && pLng != null && !isNaN(pLat) && !isNaN(pLng)) {
      previewMarkerRef.current = new naver.maps.Marker({
        map: mapInstanceRef.current,
        position: new naver.maps.LatLng(pLat, pLng),
        icon: {
          content: previewPinHtml(),
          anchor: new naver.maps.Point(20, 38),
        },
        zIndex: 100,
        draggable: true,
      })
      naver.maps.Event.addListener(previewMarkerRef.current, 'dragend', (e: any) => {
        onMovePreviewPin?.(e.coord.lat(), e.coord.lng())
      })
    }

    // Virtual pin (정기방문 수동 주소 핀)
    if (virtualMarkerRef.current) {
      virtualMarkerRef.current.setMap(null)
      virtualMarkerRef.current = null
    }
    const vLat = virtualPinLatRef.current
    const vLng = virtualPinLngRef.current
    const vLabel = virtualPinLabelRef.current
    if (vLat != null && vLng != null && !isNaN(vLat) && !isNaN(vLng)) {
      virtualMarkerRef.current = new naver.maps.Marker({
        map: mapInstanceRef.current,
        position: new naver.maps.LatLng(vLat, vLng),
        icon: {
          content: virtualPinHtml(vLabel ?? ''),
          anchor: new naver.maps.Point(60, 35), // 120px 컨테이너 중앙, 삼각형 끝
        },
        zIndex: 200,
        draggable: false,
      })
      // 클릭 시 핀 위치로 부드럽게 줌인
      naver.maps.Event.addListener(virtualMarkerRef.current, 'click', () => {
        const curZoom = mapInstanceRef.current.getZoom()
        const targetZoom = curZoom >= 17 ? 19 : 17
        mapInstanceRef.current.morph(new naver.maps.LatLng(vLat, vLng), targetZoom)
      })
      // 위치가 바뀐 경우에만 지도 중심/줌 이동 (zoom_changed 때마다 17로 리셋되는 버그 방지)
      const prev = lastVirtualPinPosRef.current
      if (!prev || prev.lat !== vLat || prev.lng !== vLng) {
        lastVirtualPinPosRef.current = { lat: vLat, lng: vLng }
        mapInstanceRef.current.setCenter(new naver.maps.LatLng(vLat, vLng))
        mapInstanceRef.current.setZoom(17)
      }
    } else {
      lastVirtualPinPosRef.current = null
    }
  }

  // Stable ref so zoom_changed listener always calls the latest version
  const rebuildMarkersCallbackRef = useRef(doRebuildMarkers)
  rebuildMarkersCallbackRef.current = doRebuildMarkers

  const rebuildMarkers = () => rebuildMarkersCallbackRef.current()
 
  const getFitMargin = () => {
    if (!isMobile) return [80, 80, 80, 80]
    // 모바일에서는 바텀 시트 높이에 따라 하단 여백 가변 적용
    // 상단 여백은 헤더(~56) + stats sub 행 정도만 비우면 됨 — 과도하게 잡으면 경계선 짤림
    const bp = bottomPadding ?? 450
    return [90, 24, bp + 16, 24]
  }
 
  const fitTerritoryBoundary = () => {
    const naver = (window as any).naver
    if (!naver?.maps || !mapInstanceRef.current || TERRITORY_BOUNDARY.length === 0) return
    const bounds = new naver.maps.LatLngBounds(
      new naver.maps.LatLng(TERRITORY_BOUNDARY[0][1], TERRITORY_BOUNDARY[0][0]),
      new naver.maps.LatLng(TERRITORY_BOUNDARY[0][1], TERRITORY_BOUNDARY[0][0]),
    )
    TERRITORY_BOUNDARY.forEach((p) => bounds.extend(new naver.maps.LatLng(p[1], p[0])))
    mapInstanceRef.current.fitBounds(bounds, { margin: getFitMargin() })
  }

  const getHighlightedCardIdsSignature = (ids?: Set<number>) =>
    ids ? [...ids].sort((a, b) => a - b).join(',') : ''

  const fitBoundaryPoints = (points: GeoPoint[]) => {
    const naver = (window as any).naver
    if (!naver?.maps || !mapInstanceRef.current) return false

    const latValues = points.map((p) => p.lat).filter((v) => typeof v === 'number' && !isNaN(v))
    const lngValues = points.map((p) => p.lng).filter((v) => typeof v === 'number' && !isNaN(v))
    if (latValues.length === 0 || lngValues.length === 0) return false

    const minLat = Math.min(...latValues)
    const maxLat = Math.max(...latValues)
    const minLng = Math.min(...lngValues)
    const maxLng = Math.max(...lngValues)
    const bounds = new naver.maps.LatLngBounds(
      new naver.maps.LatLng(minLat, minLng),
      new naver.maps.LatLng(maxLat, maxLng),
    )
    mapInstanceRef.current.fitBounds(bounds, { margin: getFitMargin() })
    return true
  }

  const fitHighlightedBoundaries = (ids?: Set<number>) => {
    const hIds = ids || new Set<number>()
    const highlightedBoundaries = cardBoundaries.filter((boundary) => hIds.has(boundary.cardId))
    if (highlightedBoundaries.length === 0) return false
    return fitBoundaryPoints(highlightedBoundaries.flatMap((boundary) => boundary.points))
  }

  const fitVisibleBuildings = (reason: 'data' | 'card' = 'data') => {
    const naver = (window as any).naver
    if (!naver?.maps || !mapInstanceRef.current) return false

    if (aggregateMarkersRef.current.length > 0) {
      const visibleAggregates = aggregateMarkersRef.current.filter((marker) =>
        isValidMapCoordinate(Number(marker.lat), Number(marker.lng)),
      )
      if (visibleAggregates.length === 0) return false
      if (visibleAggregates.length === 1) {
        const marker = visibleAggregates[0]
        mapInstanceRef.current.morph(new naver.maps.LatLng(Number(marker.lat), Number(marker.lng)), reason === 'card' ? 13 : 12)
        return true
      }
      const bounds = new naver.maps.LatLngBounds(
        new naver.maps.LatLng(Number(visibleAggregates[0].lat), Number(visibleAggregates[0].lng)),
        new naver.maps.LatLng(Number(visibleAggregates[0].lat), Number(visibleAggregates[0].lng)),
      )
      visibleAggregates.forEach((marker) => {
        bounds.extend(new naver.maps.LatLng(Number(marker.lat), Number(marker.lng)))
      })
      mapInstanceRef.current.fitBounds(bounds, { margin: getFitMargin() })
      return true
    }

    const visibleBuildings = buildingsRef.current.filter((building) => {
      const lat = Number(building.lat)
      const lng = Number(building.lng)
      if (!isValidMapCoordinate(lat, lng)) return false
      if (selectedCardIdRef.current !== null && selectedCardIdRef.current !== '전체') {
        return building.cardId === selectedCardIdRef.current
      }
      return true
    })

    if (visibleBuildings.length === 0) return false

    if (visibleBuildings.length === 1) {
      const building = visibleBuildings[0]
      mapInstanceRef.current.morph(new naver.maps.LatLng(Number(building.lat), Number(building.lng)), reason === 'card' ? 16 : 15)
      return true
    }

    const bounds = new naver.maps.LatLngBounds(
      new naver.maps.LatLng(Number(visibleBuildings[0].lat), Number(visibleBuildings[0].lng)),
      new naver.maps.LatLng(Number(visibleBuildings[0].lat), Number(visibleBuildings[0].lng)),
    )
    visibleBuildings.forEach((building) => {
      bounds.extend(new naver.maps.LatLng(Number(building.lat), Number(building.lng)))
    })
    mapInstanceRef.current.fitBounds(bounds, { margin: getFitMargin() })
    return true
  }

  const focusBuildingOnMap = (buildingId?: number | null) => {
    if (!buildingId) return false
    const naver = (window as any).naver
    if (!naver?.maps || !mapInstanceRef.current) return false
    const building = buildingsRef.current.find((item) => item.id === buildingId)
    if (!building) return false
    const lat = Number(building.lat)
    const lng = Number(building.lng)
    if (!isValidMapCoordinate(lat, lng)) return false
    mapInstanceRef.current.morph(new naver.maps.LatLng(lat, lng), 17)
    return true
  }

  const toggleSatellite = () => {
    const naver = (window as any).naver
    if (!mapInstanceRef.current || !naver) return
    const current = mapInstanceRef.current.getMapTypeId()
    const satellite = naver.maps.MapTypeId.SATELLITE
    const normal = naver.maps.MapTypeId.NORMAL
    mapInstanceRef.current.setMapTypeId(current === satellite ? normal : satellite)
  }

  const handleZoom = (delta: number) => {
    if (!mapInstanceRef.current) return
    mapInstanceRef.current.setZoom(mapInstanceRef.current.getZoom() + delta)
  }

  const handleGPS = () => {
    if (!mapInstanceRef.current || !navigator.geolocation) {
      showToast('GPS를 사용할 수 없는 환경입니다.', 'error')
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const naver = (window as any).naver
        if (!naver?.maps) return
        const lat = pos.coords.latitude
        const lng = pos.coords.longitude
        const latLng = new naver.maps.LatLng(lat, lng)

        // 네이버지도 스타일: 파란 원 + 흰 테두리 (펄스 애니메이션)
        const html = `
          <div style="position:relative;width:22px;height:22px;">
            <div style="position:absolute;inset:0;border-radius:50%;background:rgba(46,109,255,0.18);animation:userLocPulse 1.6s ease-out infinite;"></div>
            <div style="position:absolute;inset:5px;border-radius:50%;background:#2e6dff;border:2.5px solid #ffffff;box-shadow:0 1px 4px rgba(0,0,0,0.35);"></div>
          </div>
        `
        if (userLocationMarkerRef.current) {
          userLocationMarkerRef.current.setPosition(latLng)
        } else {
          userLocationMarkerRef.current = new naver.maps.Marker({
            position: latLng,
            map: mapInstanceRef.current,
            icon: {
              content: html,
              size: new naver.maps.Size(22, 22),
              anchor: new naver.maps.Point(11, 11),
            },
            zIndex: 999,
          })
        }
        mapInstanceRef.current.morph(latLng, 16)
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          onLocationPermissionBlocked?.()
          return
        }
        showToast('위치 정보를 가져올 수 없습니다.', 'error')
      },
    )
  }

  const updatePolygonStyles = () => {
    const naver = (window as any).naver
    if (!naver?.maps || !mapInstanceRef.current) return
    const palette = getMapPalette()

    const currentCardId = selectedCardIdRef.current
    const hIds = highlightedCardIdsRef.current || new Set()
    const selectedIds = selectedCardIdsRef.current

    cardPolygonsRef.current.forEach((polygon, cardId) => {
      // 해당 구역이 하이라이트(선택됨/필터됨) 대상인지 결정
      const isSelected = 
        selectedIds && selectedIds.size > 0
          ? selectedIds.has(cardId)
        : currentCardId === '전체'
          ? hIds.has(cardId) 
          : cardId === currentCardId

      const isVisible = !(drawingBoundary && cardId === currentCardId)

      polygon.setOptions({
        fillColor: isSelected ? '#5D5B54' : palette.cardDraft,
        fillOpacity: isSelected ? 0.10 : 0.05,
        strokeColor: isSelected ? '#5D5B54' : palette.cardDraft,
        strokeOpacity: isSelected ? 0.85 : 0.5,
        strokeWeight: isSelected ? 3 : 2,
        strokeStyle: isSelected ? 'solid' : 'shortdash',
        zIndex: isSelected ? 20 : 5,
        map: isVisible ? mapInstanceRef.current : null,
        clickable: !addingBuilding,
      })
    })
  }

  const syncCardBoundaries = () => {
    const naver = (window as any).naver
    if (!naver?.maps || !mapInstanceRef.current) return
    const palette = getMapPalette()

    const currentMap = cardPolygonsRef.current
    const boundaryIds = new Set(cardBoundaries.map((b) => b.cardId))

    currentMap.forEach((polygon, cardId) => {
      if (!boundaryIds.has(cardId)) {
        polygon.setMap(null)
        currentMap.delete(cardId)
      }
    })

    cardBoundaries.forEach((boundary) => {
      if (!currentMap.has(boundary.cardId)) {
        try {
          if (!boundary.points || boundary.points.length < 3) return

          const polygon = new naver.maps.Polygon({
            map: mapInstanceRef.current,
            paths: boundary.points.map(({ lat, lng }) => {
              if (typeof lat !== 'number' || typeof lng !== 'number') {
                throw new Error(`Invalid point: ${lat}, ${lng}`)
              }
              return new naver.maps.LatLng(lat, lng)
            }),
            fillColor: palette.cardDraft,
            fillOpacity: 0.08,
            strokeColor: palette.cardDraft,
            strokeOpacity: 0.55,
            strokeWeight: 2,
            strokeStyle: 'shortdash',
            clickable: !addingBuilding,
          })

          naver.maps.Event.addListener(polygon, 'click', () => {
            onSelectCardBoundaryRef.current?.(boundary.cardId)
          })
          naver.maps.Event.addListener(polygon, 'rightclick', (event: any) => {
            onMapRightClickRef.current?.(event.coord.lat(), event.coord.lng())
          })

          currentMap.set(boundary.cardId, polygon)
        } catch (err) {
          console.error(`Error creating polygon for card ${boundary.cardId}:`, err)
        }
      }
    })

    updatePolygonStyles()
  }

  const rebuildDraftBoundary = () => {
    const naver = (window as any).naver
    if (!naver?.maps || !mapInstanceRef.current) return
    const palette = getMapPalette()

    if (draftBoundaryRef.current) {
      draftBoundaryRef.current.setMap(null)
      draftBoundaryRef.current = null
    }
    draftPointMarkerRefs.current.forEach((marker) => marker.setMap(null))
    draftPointMarkerRefs.current = []
    draftMidpointMarkerRefs.current.forEach((marker) => marker.setMap(null))
    draftMidpointMarkerRefs.current = []
    if (draftBoundaryPoints.length === 0) return

    const path = draftBoundaryPoints.map(({ lat, lng }) => new naver.maps.LatLng(lat, lng))
    const common = {
      map: mapInstanceRef.current,
      paths: path,
      strokeColor: palette.info,
      strokeOpacity: 0.95,
      strokeWeight: 2,
      strokeStyle: 'solid',
    }

    draftBoundaryRef.current =
      draftBoundaryPoints.length >= 3
        ? new naver.maps.Polygon({
            ...common,
            fillColor: palette.info,
            fillOpacity: 0.12,
          })
        : new naver.maps.Polyline({ ...common, path })

    draftBoundaryPoints.forEach((point, index) => {
      const marker = new naver.maps.Marker({
        map: mapInstanceRef.current,
        position: new naver.maps.LatLng(point.lat, point.lng),
        draggable: true,
        icon: {
          content: `
            <div
              title="드래그로 이동, 우클릭으로 삭제"
              style="
                width: 14px;
                height: 14px;
                border: 2px solid #ffffff;
                border-radius: 50%;
                background: ${palette.info};
                box-shadow: 0 1px 4px rgba(0,0,0,0.3);
                cursor: grab;
                box-sizing: border-box;
                padding: 0;
                margin: 0;
              "
            ></div>
          `,
          anchor: new naver.maps.Point(7, 7),
        },
        zIndex: 30,
      })
      naver.maps.Event.addListener(marker, 'drag', (event: any) => {
        if (!draftBoundaryRef.current) return
        try {
          const isPolygon = draftBoundaryPoints.length >= 3
          const path = isPolygon
            ? (draftBoundaryRef.current as any).getPaths().getAt(0)
            : (draftBoundaryRef.current as any).getPath()
          path.setAt(index, event.coord)
        } catch (e) {
          // ignore
        }
      })
      naver.maps.Event.addListener(marker, 'dragend', (event: any) => {
        onUpdateBoundaryPoint?.(index, { lat: event.coord.lat(), lng: event.coord.lng() })
      })
      naver.maps.Event.addListener(marker, 'rightclick', () => {
        onRemoveBoundaryPoint?.(index)
      })
      naver.maps.Event.addListener(marker, 'click', (event: any) => {
        event.pointerEvent?.stopPropagation?.()
      })
      draftPointMarkerRefs.current.push(marker)
    })

    if (draftBoundaryPoints.length >= 2) {
      draftBoundaryPoints.forEach((point, index) => {
        const nextPoint = draftBoundaryPoints[(index + 1) % draftBoundaryPoints.length]
        if (!nextPoint || (draftBoundaryPoints.length < 3 && index === draftBoundaryPoints.length - 1)) return
        const middle = getMidPoint(point, nextPoint)
        const marker = new naver.maps.Marker({
          map: mapInstanceRef.current,
          position: new naver.maps.LatLng(middle.lat, middle.lng),
          icon: {
            content: `
              <div
                title="클릭하면 점 추가"
                style="
                  width: 10px;
                  height: 10px;
                  border: 2px solid #ffffff;
                  border-radius: 50%;
                  background: #9ca3af;
                  box-shadow: 0 1px 3px rgba(0,0,0,0.3);
                  cursor: copy;
                  box-sizing: border-box;
                  padding: 0;
                  margin: 0;
                "
              ></div>
            `,
            anchor: new naver.maps.Point(5, 5),
          },
          zIndex: 25,
        })
        naver.maps.Event.addListener(marker, 'click', () => {
          onInsertBoundaryPoint?.(index + 1, middle)
        })
        draftMidpointMarkerRefs.current.push(marker)
      })
    }
  }

  // 지도 초기화
  useEffect(() => {
    if (!mapRef.current) return

    const initMap = () => {
      const naver = (window as any).naver
      if (!naver?.maps || !mapRef.current) return
      scriptLoadedRef.current = true

      const center =
        buildingsRef.current.length > 0
          ? new naver.maps.LatLng(buildingsRef.current[0].lat, buildingsRef.current[0].lng)
          : new naver.maps.LatLng(37.2384, 127.2142)

      mapInstanceRef.current = new naver.maps.Map(mapRef.current, {
        center,
        zoom: 15,
        mapTypeControl: false,
        zoomControl: false,
      })
      if (isMobile) (window as any).__mobileMapInstance = mapInstanceRef.current
      else (window as any).__desktopMapInstance = mapInstanceRef.current

      // ResizeObserver: 컨테이너 크기 변경 시 Naver 지도에 알림 (패널 열림/닫힘 보정)
      if (mapRef.current) {
        const ro = new ResizeObserver(() => {
          if (mapInstanceRef.current) {
            naver.maps.Event.trigger(mapInstanceRef.current, 'resize')
          }
        })
        ro.observe(mapRef.current)
      }

      rebuildMarkers()
      focusBuildingOnMap(focusBuildingIdRef.current)

      // 구역 경계선 폴리곤
      boundaryRef.current = new naver.maps.Polygon({
        map: mapInstanceRef.current,
        paths: TERRITORY_BOUNDARY.map(([lng, lat]) => new naver.maps.LatLng(lat, lng)),
        fillColor: getMapPalette().brand,
        fillOpacity: 0.05,
        strokeColor: getMapPalette().brand,
        strokeOpacity: 0.6,
        strokeWeight: 2,
        strokeStyle: 'shortdash',
      })

      naver.maps.Event.addListener(boundaryRef.current, 'rightclick', (event: any) => {
        onMapRightClickRef.current?.(event.coord.lat(), event.coord.lng())
      })

      // 선택된 카드나 범위가 있으면 해당 경계로 줌인, 없으면 전체 영역
      const initialCardId = selectedCardIdRef.current
      if (initialCardId !== null && initialCardId !== '전체') {
        const boundary = cardBoundaries.find((b: CardBoundary) => b.cardId === initialCardId)
        if (boundary && boundary.points.length >= 3) {
          if (fitBoundaryPoints(boundary.points)) {
            hasFitBoundaryRef.current = true
          } else {
            fitTerritoryBoundary()
          }
        } else {
          fitTerritoryBoundary()
        }
        prevSelectedCardIdRef.current = initialCardId
        prevHighlightedCardIdsSignatureRef.current = getHighlightedCardIdsSignature(highlightedCardIdsRef.current)
      } else if (initialCardId === '전체') {
        if (!fitHighlightedBoundaries(highlightedCardIdsRef.current)) {
          fitTerritoryBoundary()
        }
        prevSelectedCardIdRef.current = initialCardId
        prevHighlightedCardIdsSignatureRef.current = getHighlightedCardIdsSignature(highlightedCardIdsRef.current)
      } else {
        fitTerritoryBoundary()
      }
      syncCardBoundaries()
      rebuildDraftBoundary()

      naver.maps.Event.addListener(mapInstanceRef.current, 'rightclick', (event: any) => {
        onMapRightClickRef.current?.(event.coord.lat(), event.coord.lng())
      })
      naver.maps.Event.addListener(mapInstanceRef.current, 'longclick', (event: any) => {
        onMapLongClickRef.current?.(event.coord.lat(), event.coord.lng())
      })

      // Re-cluster when zoom changes
      naver.maps.Event.addListener(mapInstanceRef.current, 'zoom_changed', () => {
        rebuildMarkersCallbackRef.current()
      })
    }

    const scriptId = 'naver-map-script'
    if (document.getElementById(scriptId)) {
      if ((window as any).naver?.maps) {
        initMap()
      }
      return
    }

    const script = document.createElement('script')
    script.id = scriptId
    script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${clientId}&submodules=geocoder`
    script.async = true
    script.onload = initMap
    document.head.appendChild(script)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId])

  useEffect(() => {
    const naver = (window as any).naver
    if (!scriptLoadedRef.current || !naver?.maps || !mapInstanceRef.current) return

    if (clickListenerRef.current) {
      naver.maps.Event.removeListener(clickListenerRef.current)
      clickListenerRef.current = null
    }

    if (drawingBoundary && onAddBoundaryPoint) {
      clickListenerRef.current = naver.maps.Event.addListener(
        mapInstanceRef.current,
        'click',
        (event: any) => {
          onAddBoundaryPoint({ lat: event.coord.lat(), lng: event.coord.lng() })
        },
      )
    } else if (addingBuilding) {
      clickListenerRef.current = naver.maps.Event.addListener(
        mapInstanceRef.current,
        'click',
        (event: any) => {
          onMapClickRef.current?.(event.coord.lat(), event.coord.lng())
        },
      )
    }

    return () => {
      if (clickListenerRef.current) {
        naver.maps.Event.removeListener(clickListenerRef.current)
        clickListenerRef.current = null
      }
    }
  }, [drawingBoundary, addingBuilding, onAddBoundaryPoint])

  // 가상 핀(정기방문 주소) 변경 시 마커 재생성
  useEffect(() => {
    if (!scriptLoadedRef.current) return
    rebuildMarkers()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [virtualPinLat, virtualPinLng, virtualPinLabel])

  // 건물 목록, 선택, 또는 미리보기 핀 변경 시 마커 재생성
  useEffect(() => {
    if (!scriptLoadedRef.current) return
    rebuildMarkers()

    const naver = (window as any).naver
    if (!naver?.maps || !mapInstanceRef.current) return
    const visibleSignature = buildings
      .filter((building) => isValidMapCoordinate(Number(building.lat), Number(building.lng)))
      .map((building) => `${building.id}:${building.cardId}:${Number(building.lat).toFixed(6)},${Number(building.lng).toFixed(6)}`)
      .sort()
      .join('|')
    const aggregateSignature = aggregateMarkers
      .filter((marker) => isValidMapCoordinate(Number(marker.lat), Number(marker.lng)))
      .map((marker) => `${marker.id}:${marker.count}:${Number(marker.lat).toFixed(6)},${Number(marker.lng).toFixed(6)}`)
      .sort()
      .join('|')
    const visibleMapSignature = aggregateSignature || visibleSignature

    if (visibleMapSignature && visibleBuildingSignatureRef.current !== visibleMapSignature) {
      visibleBuildingSignatureRef.current = visibleMapSignature
      if (!editingBuildingLocationRef.current && !addingBuildingRef.current) {
        fitVisibleBuildings('data')
      }
    }

    // 선택 건물 클릭 때는 자동 이동하지 않음
    prevSelectedBuildingIdRef.current = selectedBuildingId
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildings, aggregateMarkers, selectedBuildingId, previewPinLat, previewPinLng])

  useEffect(() => {
    if (!scriptLoadedRef.current) return
    focusBuildingOnMap(focusBuildingId)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusBuildingId, buildings])

  useEffect(() => {
    if (!scriptLoadedRef.current) return
    syncCardBoundaries()
    rebuildDraftBoundary()

    const naver = (window as any).naver
    if (!naver?.maps || !mapInstanceRef.current) return

    const highlightedCardIdsSignature = getHighlightedCardIdsSignature(highlightedCardIds)
    const cardSelectionChanged = prevSelectedCardIdRef.current !== selectedCardId
    const highlightedScopeChanged = prevHighlightedCardIdsSignatureRef.current !== highlightedCardIdsSignature

    if (cardSelectionChanged || highlightedScopeChanged) {
      if (selectedCardId !== '전체' && selectedCardId !== null) {
        const boundary = cardBoundaries.find((b: CardBoundary) => b.cardId === selectedCardId)
        if (boundary && boundary.points.length >= 3) {
          fitBoundaryPoints(boundary.points)
        } else {
          fitVisibleBuildings('card')
        }
      } else if (selectedCardId === '전체' && cardBoundaries.length > 0) {
        if (!fitHighlightedBoundaries(highlightedCardIds)) {
          fitVisibleBuildings('card')
        }
      } else if (selectedCardId === '전체') {
        fitVisibleBuildings('card')
      }
      prevSelectedCardIdRef.current = selectedCardId
      prevHighlightedCardIdsSignatureRef.current = highlightedCardIdsSignature
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardBoundaries, draftBoundaryPoints, selectedCardId, selectedCardIds, drawingBoundary, addingBuilding, editingBuildingLocation, buildings.length, highlightedCardIds])

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div
        className="naver-map-canvas"
        ref={mapRef}
        onContextMenu={(e) => e.preventDefault()}
        style={addingBuilding ? { cursor: 'crosshair' } : editingBuildingLocation ? { cursor: 'grab' } : undefined}
      />

      {/* Map Toolbar Overlay */}
      <div className="map-toolbar-overlay" style={{
        position: 'absolute',
        top: 'calc(100px - var(--map-chips-push, 0px))',
        right: '12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        zIndex: isMobile ? 40 : 1000
      }}>
        <button className="toolbar-btn" onClick={toggleSatellite} title="위성 지도로 변환" type="button" aria-label="위성 지도 전환">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="currentColor" d="M4.979 9.685C2.993 8.891 2 8.494 2 8s.993-.89 2.979-1.685l2.808-1.123C9.773 4.397 10.767 4 12 4s2.227.397 4.213 1.192l2.808 1.123C21.007 7.109 22 7.506 22 8s-.993.89-2.979 1.685l-2.808 1.124C14.227 11.603 13.233 12 12 12s-2.227-.397-4.213-1.191z"/>
            <path fill="currentColor" fillRule="evenodd" d="M2 8c0 .494.993.89 2.979 1.685l2.808 1.124C9.773 11.603 10.767 12 12 12s2.227-.397 4.213-1.191l2.808-1.124C21.007 8.891 22 8.494 22 8s-.993-.89-2.979-1.685l-2.808-1.123C14.227 4.397 13.233 4 12 4s-2.227.397-4.213 1.192L4.98 6.315C2.993 7.109 2 7.506 2 8" clipRule="evenodd"/>
            <path fill="currentColor" d="m5.766 10l-.787.315C2.993 11.109 2 11.507 2 12s.993.89 2.979 1.685l2.808 1.124C9.773 15.603 10.767 16 12 16s2.227-.397 4.213-1.191l2.808-1.124C21.007 12.891 22 12.493 22 12s-.993-.89-2.979-1.685L18.234 10l-2.021.809C14.227 11.603 13.233 12 12 12s-2.227-.397-4.213-1.191z" opacity="0.7"/>
            <path fill="currentColor" d="m5.766 14l-.787.315C2.993 15.109 2 15.507 2 16s.993.89 2.979 1.685l2.808 1.124C9.773 19.603 10.767 20 12 20s2.227-.397 4.213-1.192l2.808-1.123C21.007 16.891 22 16.494 22 16c0-.493-.993-.89-2.979-1.685L18.234 14l-2.021.809C14.227 15.603 13.233 16 12 16s-2.227-.397-4.213-1.191z" opacity="0.4"/>
          </svg>
        </button>
        <button 
          className={`toolbar-btn${addingBuilding || editingBuildingLocation ? ' active' : ''}`} 
          onClick={() => {
            if (onOpenActionMenu) onOpenActionMenu()
            else onToggleAddingBuilding?.(!addingBuilding)
          }}
          title="지도 작업"
          type="button"
          aria-label="지도 작업"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="currentColor" fillRule="evenodd" d="M2.52 7.823C2 8.77 2 9.915 2 12.203v1.522c0 3.9 0 5.851 1.172 7.063S6.229 22 10 22h4c3.771 0 5.657 0 6.828-1.212S22 17.626 22 13.725v-1.521c0-2.289 0-3.433-.52-4.381c-.518-.949-1.467-1.537-3.364-2.715l-2-1.241C14.111 2.622 13.108 2 12 2s-2.11.622-4.116 1.867l-2 1.241C3.987 6.286 3.038 6.874 2.519 7.823M12.75 11a.75.75 0 0 0-1.5 0v2.25H9a.75.75 0 0 0 0 1.5h2.25V17a.75.75 0 0 0 1.5 0v-2.25H15a.75.75 0 0 0 0-1.5h-2.25z" clipRule="evenodd"/>
          </svg>
        </button>
        <button className="toolbar-btn" onClick={handleGPS} title="현재 위치" type="button" aria-label="현재 위치">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="3"/>
            <path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>
          </svg>
        </button>
        <div style={{ height: '4px' }} />
        <button className="toolbar-btn" onClick={() => handleZoom(1)} title="확대" type="button" aria-label="확대">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
        </button>
        <button className="toolbar-btn" onClick={() => handleZoom(-1)} title="축소" type="button" aria-label="축소">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
        </button>
      </div>

      <style>{`
        @keyframes userLocPulse {
          0%   { transform: scale(0.7); opacity: 1; }
          80%  { transform: scale(2.2); opacity: 0; }
          100% { transform: scale(2.2); opacity: 0; }
        }
        .map-toolbar-overlay {
          z-index: 10000 !important;
        }
        .map-toolbar-overlay .toolbar-btn {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.85);
          backdrop-filter: blur(8px);
          border: 1px solid rgba(0, 0, 0, 0.05);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          padding: 0;
          color: #1a1a1a;
        }
        .map-toolbar-overlay .toolbar-btn:hover {
          background: #ffffff;
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(0, 0, 0, 0.12);
        }
        .map-toolbar-overlay .toolbar-btn:active {
          transform: scale(0.92);
        }
        .map-toolbar-overlay .toolbar-btn.active {
          background: #1a1a1a;
          color: #ffffff;
          border-color: #1a1a1a;
        }
        @media (max-width: 768px) {
          .map-toolbar-overlay {
            top: calc(112px - var(--map-chips-push, 0px)) !important;
            right: 12px !important;
            z-index: 40 !important;
          }
          .map-toolbar-overlay .toolbar-btn {
            width: 40px;
            height: 40px;
            font-size: 16px;
          }
        }
      `}</style>
    </div>
  )
}

// ── Public MapCanvas ───────────────────────────────────────────────────────

export function MapCanvas({
  buildings,
  aggregateMarkers = [],
  cardBoundaries = [],
  cards,
  drawingBoundary = false,
  addingBuilding = false,
  editingBuildingLocation = false,
  previewPinLat,
  previewPinLng,
  virtualPinLat,
  virtualPinLng,
  virtualPinLabel,
  draftBoundaryPoints = [],
  selectedBuildingId,
  focusBuildingId,
  selectedCardId = '전체',
  onAddBoundaryPoint,
  onInsertBoundaryPoint,
  onRemoveBoundaryPoint,
  onSelectBuilding,
  onSelectAggregate,
  onSelectCardBoundary,
  onUpdateBoundaryPoint,
  onMapRightClick,
  onMapClick,
  onMapLongClick,
  highlightedCardIds,
  selectedCardIds,
  isMobile = false,
  bottomPadding,
  onToggleAddingBuilding,
  onOpenActionMenu,
  onToggleDrawingBoundary,
  onLocationPermissionBlocked,
  onMovePreviewPin,
  onMoveBuilding,
}: {
  buildings: Building[]
  aggregateMarkers?: MapAggregateMarker[]
  cardBoundaries?: CardBoundary[]
  cards: TerritoryCard[]
  drawingBoundary?: boolean
  addingBuilding?: boolean
  editingBuildingLocation?: boolean
  previewPinLat?: number | null
  previewPinLng?: number | null
  virtualPinLat?: number | null
  virtualPinLng?: number | null
  virtualPinLabel?: string
  draftBoundaryPoints?: GeoPoint[]
  selectedBuildingId: number
  focusBuildingId?: number | null
  selectedCardId: number | '전체' | null
  onAddBoundaryPoint?: (point: GeoPoint) => void
  onInsertBoundaryPoint?: (index: number, point: GeoPoint) => void
  onRemoveBoundaryPoint?: (index: number) => void
  onSelectBuilding: (buildingId: number) => void
  onSelectAggregate?: (id: string) => void
  onSelectCardBoundary?: (cardId: number) => void
  onUpdateBoundaryPoint?: (index: number, point: GeoPoint) => void
  onMapRightClick?: (lat: number, lng: number) => void
  onMapClick?: (lat: number, lng: number) => void
  onMapLongClick?: (lat: number, lng: number) => void
  highlightedCardIds?: Set<number>
  selectedCardIds?: Set<number>
  isMobile?: boolean
  bottomPadding?: number
  onToggleAddingBuilding?: (val: boolean) => void
  onOpenActionMenu?: () => void
  onToggleDrawingBoundary?: (val: boolean) => void
  onLocationPermissionBlocked?: () => void
  onMovePreviewPin?: (lat: number, lng: number) => void
  onMoveBuilding?: (id: number, lat: number, lng: number) => void
}) {
  const naverMapClientId = import.meta.env.VITE_NAVER_MAP_CLIENT_ID as string | undefined
  const validBuildings = useMemo(
    () => buildings.filter((building) => isValidMapCoordinate(Number(building.lat), Number(building.lng))),
    [buildings],
  )

  if (naverMapClientId) {
    return (
      <div className="map-canvas-container" style={{ width: '100%', height: '100%' }}>
        <NaverMapCanvas
          buildings={validBuildings}
          aggregateMarkers={aggregateMarkers}
          cardBoundaries={cardBoundaries}
          cards={cards}
          clientId={naverMapClientId}
          drawingBoundary={drawingBoundary}
          addingBuilding={addingBuilding}
          editingBuildingLocation={editingBuildingLocation}
          previewPinLat={previewPinLat}
          previewPinLng={previewPinLng}
          virtualPinLat={virtualPinLat}
          virtualPinLng={virtualPinLng}
          virtualPinLabel={virtualPinLabel}
          draftBoundaryPoints={draftBoundaryPoints}
          selectedBuildingId={selectedBuildingId}
          focusBuildingId={focusBuildingId}
          selectedCardId={selectedCardId}
          selectedCardIds={selectedCardIds}
          onAddBoundaryPoint={onAddBoundaryPoint}
          onInsertBoundaryPoint={onInsertBoundaryPoint}
          onRemoveBoundaryPoint={onRemoveBoundaryPoint}
          onSelectBuilding={onSelectBuilding}
          onSelectAggregate={onSelectAggregate}
          onSelectCardBoundary={onSelectCardBoundary}
          onUpdateBoundaryPoint={onUpdateBoundaryPoint}
          onMapRightClick={onMapRightClick}
          onMapClick={onMapClick}
          onMapLongClick={onMapLongClick}
          highlightedCardIds={highlightedCardIds}
          isMobile={isMobile}
          bottomPadding={bottomPadding}
          onToggleAddingBuilding={onToggleAddingBuilding}
          onOpenActionMenu={onOpenActionMenu}
          onToggleDrawingBoundary={onToggleDrawingBoundary}
          onLocationPermissionBlocked={onLocationPermissionBlocked}
          onMovePreviewPin={onMovePreviewPin}
          onMoveBuilding={onMoveBuilding}
        />
      </div>
    )
  }

  // MockMap with clustering simulation at small zoom + preview pin
  return (
    <div
      className={['mock-map', drawingBoundary ? 'drawing-boundary' : '', addingBuilding ? 'adding-building' : '', editingBuildingLocation ? 'editing-building-location' : ''].join(' ')}
      aria-label="샘플 지도"
      style={addingBuilding ? { cursor: 'crosshair' } : editingBuildingLocation ? { cursor: 'grab' } : undefined}
      onClick={(event) => {
        if (drawingBoundary && onAddBoundaryPoint) {
          onAddBoundaryPoint(getPointFromMockEvent(event))
          return
        }
        if (addingBuilding && onMapClick) {
          const pt = getPointFromMockEvent(event)
          onMapClick(pt.lat, pt.lng)
        }
      }}
    >
      <div className="mock-map-grid" />
      <svg className="mock-boundary-overlay" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <polygon points={getMockBoundaryPoints()} />
        {cardBoundaries
          .filter((boundary) => !(drawingBoundary && boundary.cardId === selectedCardId))
          .map((boundary) => {
            const isSelected = 
              selectedCardIds && selectedCardIds.size > 0
                ? selectedCardIds.has(boundary.cardId)
              : selectedCardId === '전체' 
                ? highlightedCardIds?.has(boundary.cardId)
                : boundary.cardId === selectedCardId
            return (
              <polygon
                className={isSelected ? 'selected-card-boundary' : 'card-boundary'}
                key={boundary.cardId}
                points={getMockPolygonPoints(boundary.points)}
              />
            )
          })}
        {draftBoundaryPoints.length > 0 && (
          <polyline className="draft-boundary" points={getMockPolygonPoints(draftBoundaryPoints)} />
        )}
        {drawingBoundary &&
          draftBoundaryPoints.length >= 2 &&
          draftBoundaryPoints.map((point, index) => {
            const nextPoint = draftBoundaryPoints[(index + 1) % draftBoundaryPoints.length]
            if (!nextPoint || (draftBoundaryPoints.length < 3 && index === draftBoundaryPoints.length - 1))
              return null
            const middle = getMockPoint(getMidPoint(point, nextPoint))
            return (
              <circle
                className="draft-midpoint"
                cx={middle.x}
                cy={middle.y}
                key={`mid-${index}`}
                onClick={(event) => {
                  event.stopPropagation()
                  onInsertBoundaryPoint?.(index + 1, getMidPoint(point, nextPoint))
                }}
                r="0.35"
              />
            )
          })}
        {drawingBoundary &&
          draftBoundaryPoints.map((point, index) => {
            const position = getMockPoint(point)
            return (
              <circle
                className="draft-vertex"
                cx={position.x}
                cy={position.y}
                key={`vertex-${index}`}
                onClick={(event) => {
                  event.stopPropagation()
                  onRemoveBoundaryPoint?.(index)
                }}
                r="0.5"
              />
            )
          })}
      </svg>
      <div className="mock-map-road road-one" />
      <div className="mock-map-road road-two" />
      <div className="mock-map-road road-three" />
      <p className="mock-map-label">전체 구역 경계선 · KML {TERRITORY_BOUNDARY.length}개 좌표</p>
      {aggregateMarkers.length > 0 && aggregateMarkers.map((marker) => {
        const pos = getMockPoint({ lat: marker.lat, lng: marker.lng })
        return (
          <button
            className="map-aggregate-marker"
            key={marker.id}
            onClick={(event) => {
              if (drawingBoundary) return
              event.stopPropagation()
              onSelectAggregate?.(marker.id)
            }}
            style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
            type="button"
          >
            <span>{marker.label}</span>
            <strong>{marker.count}</strong>
          </button>
        )
      })}
      {aggregateMarkers.length === 0 && validBuildings.map((building) => {
        const position = getMockPosition(validBuildings, building)
        const status = getBuildingStatus(building)
        const isDimmed = selectedCardId !== null && selectedCardId !== '전체' && building.cardId !== selectedCardId
        const hasRegularVisit = building.units.some((unit) => unit.isRegularVisit)
        const hasChineseNeedsReview = building.units.some((unit) => unit.isChinese && !unit.isRegularVisit)
        return (
          <button
            className={[
              'map-marker',
              `status-${status}`,
              hasChineseNeedsReview ? 'has-chinese' : hasRegularVisit ? 'has-regular' : '',
              selectedBuildingId === building.id ? 'selected' : '',
              isDimmed ? 'dimmed' : '',
            ].join(' ')}
            key={building.id}
            onClick={(event) => {
              if (drawingBoundary) return
              event.stopPropagation()
              onSelectBuilding(building.id)
            }}
            style={{ left: `${position.left}%`, top: `${position.top}%` }}
            type="button"
          >
            <span>{building.units.length}</span>
            <strong>{building.name}</strong>
            <em>{getCardName(cards, building.cardId)}</em>
          </button>
        )
      })}
      {/* Preview pin for building add mode */}
      {previewPinLat != null && previewPinLng != null && (() => {
        const pos = getMockPoint({ lat: previewPinLat, lng: previewPinLng })
        return (
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              left: `${pos.x}%`,
              top: `${pos.y}%`,
              transform: 'translate(-50%, -80%)',
              zIndex: 10,
              pointerEvents: 'none',
              lineHeight: 0,
              filter: 'drop-shadow(0 4px 8px rgba(249,115,22,0.55))',
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24">
              <path fill="#f97316" d="M16.37 12.79a1 1 0 0 0-.74 1.86C17.09 15.23 18 16.13 18 17c0 1.42-2.46 3-6 3s-6-1.58-6-3c0-.87.91-1.77 2.37-2.35a1 1 0 0 0-.74-1.86C5.36 13.69 4 15.26 4 17c0 2.8 3.51 5 8 5s8-2.2 8-5c0-1.74-1.36-3.31-3.63-4.21M11 9.86V17a1 1 0 0 0 2 0V9.86a4 4 0 1 0-2 0M12 4a2 2 0 1 1-2 2a2 2 0 0 1 2-2"/>
            </svg>
          </div>
        )
      })()}
    </div>
  )
}
