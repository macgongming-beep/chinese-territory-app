import React, { useMemo, useState } from 'react'
import type { Building, Role, ServiceSession, SpecialPeriod, TerritoryCard, TimeSlot, VisitHistory } from '../types'

const TIME_SLOTS: TimeSlot[] = ['오전', '오후', '저녁']
type ScopeFilter = 'all' | 'regular' | number
type TrendMode = 'monthly' | 'weekly'

// ── SVG 꺾은선 차트 ────────────────────────────────────────────
function LineChart({
  data,
  meetColor = '#22c55e',
  totalColor = '#94a3b8',
}: {
  data: Array<{ label: string; total: number; meetings: number }>
  meetColor?: string
  totalColor?: string
}) {
  const W = 560, H = 90, PX = 10, PY = 8
  const maxV = Math.max(1, ...data.map(d => d.total))
  const n = data.length
  const tx = (i: number) => PX + (i / (n - 1)) * (W - PX * 2)
  const ty = (v: number) => PY + ((maxV - v) / maxV) * (H - PY * 2)
  const totalPts = data.map((d, i) => `${tx(i)},${ty(d.total)}`).join(' ')
  const meetPts  = data.map((d, i) => `${tx(i)},${ty(d.meetings)}`).join(' ')

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: H }} preserveAspectRatio="none">
      <polygon points={`${tx(0)},${H} ${totalPts} ${tx(n-1)},${H}`} fill={`${totalColor}20`} />
      <polyline points={totalPts} fill="none" stroke={totalColor} strokeWidth="2" strokeLinejoin="round" />
      <polygon points={`${tx(0)},${H} ${meetPts} ${tx(n-1)},${H}`} fill={`${meetColor}30`} />
      <polyline points={meetPts}  fill="none" stroke={meetColor}  strokeWidth="2.5" strokeLinejoin="round" />
      {data.map((d, i) => (
        <React.Fragment key={i}>
          <circle cx={tx(i)} cy={ty(d.total)}    r="3.5" fill={totalColor} />
          <circle cx={tx(i)} cy={ty(d.meetings)} r="3"   fill={meetColor} />
        </React.Fragment>
      ))}
    </svg>
  )
}

// ── 미니 진행바 ─────────────────────────────────────────────────
function MiniBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div style={{ height: 5, background: '#f1f5f9', borderRadius: 3, overflow: 'hidden', marginTop: 6 }}>
      <div style={{ width: `${Math.min(100, pct)}%`, height: '100%', background: color, borderRadius: 3, transition: 'width .4s' }} />
    </div>
  )
}

export function DesktopStats({
  cards,
  buildings,
  visitHistories,
  serviceSessions,
  specialPeriods,
  actualRole,
}: {
  cards: TerritoryCard[]
  buildings: Building[]
  visitHistories: VisitHistory[]
  serviceSessions: ServiceSession[]
  specialPeriods: SpecialPeriod[]
  actualRole: Role
}) {
  const isDeveloper = actualRole === 'developer'
  const [scope, setScope]               = useState<ScopeFilter>('all')
  const [trendMode, setTrendMode]       = useState<TrendMode>('monthly')
  const [cardTableOpen, setCardTableOpen]       = useState(false)
  const [selectedRegion, setSelectedRegion]     = useState<string | null>(null)
  const [selectedArea, setSelectedArea]         = useState<string | null>(null)

  // ── 필터 ────────────────────────────────────────────────────
  const filteredHistories = useMemo(() => {
    if (scope === 'all') return visitHistories
    if (scope === 'regular') return visitHistories.filter(h => !h.specialPeriodId)
    return visitHistories.filter(h => h.specialPeriodId === scope)
  }, [visitHistories, scope])

  // ── 1. 전체 요약 ─────────────────────────────────────────────
  const summary = useMemo(() => {
    const total     = filteredHistories.length
    const meetings  = filteredHistories.filter(h => h.result === '만남').length
    const absences  = filteredHistories.filter(h => h.result === '부재').length
    const koreans   = filteredHistories.filter(h => h.result === '한국인').length
    const invitations = filteredHistories.filter(h => h.invitationLeft).length
    const meetingRate = total > 0 ? (meetings / total) * 100 : 0
    return { total, meetings, absences, koreans, invitations, meetingRate }
  }, [filteredHistories])

  // ── 2. 이번달 vs 지난달 비교 ─────────────────────────────────
  const monthComparison = useMemo(() => {
    const now = new Date()
    const thisKey  = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const prevKey  = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`
    const rate = (arr: VisitHistory[]) => arr.length > 0 ? arr.filter(h => h.result === '만남').length / arr.length * 100 : 0
    const thisH = filteredHistories.filter(h => h.visitedAt.startsWith(thisKey))
    const prevH = filteredHistories.filter(h => h.visitedAt.startsWith(prevKey))
    return {
      this: { label: `${now.getMonth() + 1}월`, total: thisH.length, meetings: thisH.filter(h => h.result === '만남').length, rate: rate(thisH) },
      prev: { label: `${prevDate.getMonth() + 1}월`, total: prevH.length, meetings: prevH.filter(h => h.result === '만남').length, rate: rate(prevH) },
    }
  }, [filteredHistories])

  // ── 3. 중국인 세대 통계 ──────────────────────────────────────
  const chineseStats = useMemo(() => {
    const ids = new Set<number>()
    for (const b of buildings) for (const u of b.units) if (u.isChinese) ids.add(u.id)
    const cH = filteredHistories.filter(h => ids.has(h.unitId))
    const total    = cH.length
    const meetings = cH.filter(h => h.result === '만남').length
    const absences = cH.filter(h => h.result === '부재').length
    const rate = total > 0 ? meetings / total * 100 : 0
    const slots = TIME_SLOTS.map(slot => {
      const sh = cH.filter(h => h.timeSlot === slot)
      const sm = sh.filter(h => h.result === '만남').length
      return { slot, total: sh.length, meetings: sm, rate: sh.length > 0 ? sm / sh.length * 100 : 0 }
    })
    return { totalUnits: ids.size, total, meetings, absences, rate, slots }
  }, [buildings, filteredHistories])

  // ── 4. 시간대별 통계 ─────────────────────────────────────────
  const slotStats = useMemo(() => TIME_SLOTS.map(slot => {
    const sh = filteredHistories.filter(h => h.timeSlot === slot)
    const meetings = sh.filter(h => h.result === '만남').length
    const absences = sh.filter(h => h.result === '부재').length
    return { slot, total: sh.length, meetings, absences, meetingRate: sh.length > 0 ? meetings / sh.length * 100 : 0, absenceRate: sh.length > 0 ? absences / sh.length * 100 : 0 }
  }), [filteredHistories])

  // ── 5. 결과 분포 ─────────────────────────────────────────────
  const resultDistribution = useMemo(() => (
    ['만남', '부재', '한국인'] as const
  ).map(result => {
    const count = filteredHistories.filter(h => h.result === result).length
    const pct = filteredHistories.length > 0 ? count / filteredHistories.length * 100 : 0
    return { result, count, pct }
  }), [filteredHistories])

  // ── 7. 월별 추이 (12개월) ────────────────────────────────────
  const monthlyTrend = useMemo(() => {
    const now = new Date()
    return Array.from({ length: 12 }, (_, idx) => {
      const i = 11 - idx
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const mh = filteredHistories.filter(h => h.visitedAt.startsWith(key))
      return { label: `${d.getMonth() + 1}월`, total: mh.length, meetings: mh.filter(h => h.result === '만남').length }
    })
  }, [filteredHistories])

  // ── 8. 주간 추이 (8주) ───────────────────────────────────────
  const weeklyTrend = useMemo(() => {
    const today = new Date()
    return Array.from({ length: 8 }, (_, idx) => {
      const w = 7 - idx
      const endDate = new Date(today); endDate.setDate(today.getDate() - w * 7)
      const startDate = new Date(endDate); startDate.setDate(endDate.getDate() - 6)
      const start = startDate.toISOString().slice(0, 10)
      const end   = endDate.toISOString().slice(0, 10)
      const wh = filteredHistories.filter(h => h.visitedAt >= start && h.visitedAt <= end)
      return { label: `${startDate.getMonth() + 1}/${startDate.getDate()}`, total: wh.length, meetings: wh.filter(h => h.result === '만남').length }
    })
  }, [filteredHistories])

  // ── 9. 카드별 통계 ───────────────────────────────────────────
  const cardStats = useMemo(() => {
    const byCard = new Map<number, Set<number>>()
    for (const b of buildings) {
      if (!byCard.has(b.cardId)) byCard.set(b.cardId, new Set())
      for (const u of b.units) byCard.get(b.cardId)!.add(u.id)
    }
    return cards.map(card => {
      const ids = byCard.get(card.id) ?? new Set()
      const ch  = filteredHistories.filter(h => ids.has(h.unitId))
      const visited  = new Set(ch.map(h => h.unitId)).size
      const meetings = ch.filter(h => h.result === '만남').length
      const absences = ch.filter(h => h.result === '부재').length
      const totalUnits = ids.size
      const visitRate   = totalUnits > 0 ? visited / totalUnits * 100 : 0
      const meetingRate = ch.length > 0 ? meetings / ch.length * 100 : 0
      return { cardId: card.id, name: card.name, region: card.region, area: card.area, totalUnits, visited, visitRate, meetings, absences, meetingRate, totalVisits: ch.length }
    }).sort((a, b) => b.visitRate - a.visitRate)
  }, [cards, buildings, filteredHistories])

  // 구역/동 필터 파생
  const allRegions = useMemo(() => [...new Set(cardStats.map(c => c.region))].filter(Boolean).sort(), [cardStats])
  const areasForRegion = useMemo(() =>
    selectedRegion ? [...new Set(cardStats.filter(c => c.region === selectedRegion).map(c => c.area))].filter(Boolean).sort() : [],
    [cardStats, selectedRegion]
  )
  const filteredCardStats = useMemo(() => cardStats.filter(c => {
    if (selectedRegion && c.region !== selectedRegion) return false
    if (selectedArea && c.area !== selectedArea) return false
    return true
  }), [cardStats, selectedRegion, selectedArea])

  // ── 10. 요일별 통계 ─────────────────────────────────────────
  const dayOfWeekStats = useMemo(() => {
    const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']
    const IS_WEEKEND  = [true, false, false, false, false, false, true]
    const map = Array.from({ length: 7 }, () => ({ total: 0, meetings: 0, absences: 0 }))
    for (const h of filteredHistories) {
      const dow = new Date(h.visitedAt).getDay()
      map[dow].total++
      if (h.result === '만남') map[dow].meetings++
      if (h.result === '부재') map[dow].absences++
    }
    // 월~일 순 (1,2,3,4,5,6,0)
    const ordered = [1, 2, 3, 4, 5, 6, 0].map((dow) => ({
      label: DAY_LABELS[dow],
      isWeekend: IS_WEEKEND[dow],
      ...map[dow],
      meetingRate: map[dow].total > 0 ? map[dow].meetings / map[dow].total * 100 : 0,
      absenceRate: map[dow].total > 0 ? map[dow].absences / map[dow].total * 100 : 0,
    }))
    const weekdays = ordered.filter((d) => !d.isWeekend)
    const weekends = ordered.filter((d) => d.isWeekend)
    const wdTotal = weekdays.reduce((s, d) => s + d.total, 0)
    const wdMeetings = weekdays.reduce((s, d) => s + d.meetings, 0)
    const weTotal = weekends.reduce((s, d) => s + d.total, 0)
    const weMeetings = weekends.reduce((s, d) => s + d.meetings, 0)
    return {
      days: ordered,
      weekday: { total: wdTotal, meetings: wdMeetings, rate: wdTotal > 0 ? wdMeetings / wdTotal * 100 : 0 },
      weekend: { total: weTotal, meetings: weMeetings, rate: weTotal > 0 ? weMeetings / weTotal * 100 : 0 },
    }
  }, [filteredHistories])

  // ── 10-b. 요일×시간대 부재율 매트릭스 ───────────────────────
  const daySlotMatrix = useMemo(() => {
    // map[dow][slot] = { total, absences }
    const map: Record<number, Record<string, { total: number; absences: number; meetings: number }>> = {}
    for (let d = 0; d < 7; d++) {
      map[d] = {}
      for (const slot of TIME_SLOTS) map[d][slot] = { total: 0, absences: 0, meetings: 0 }
    }
    for (const h of filteredHistories) {
      if (!h.timeSlot) continue
      const dow = new Date(h.visitedAt).getDay()
      const cell = map[dow][h.timeSlot]
      if (!cell) continue
      cell.total++
      if (h.result === '부재') cell.absences++
      if (h.result === '만남') cell.meetings++
    }
    // 월~일 순 (1,2,3,4,5,6,0)
    const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']
    const IS_WEEKEND  = [true, false, false, false, false, false, true]
    const days = [1, 2, 3, 4, 5, 6, 0].map((dow) => ({
      label: DAY_LABELS[dow],
      isWeekend: IS_WEEKEND[dow],
      slots: TIME_SLOTS.map((slot) => {
        const c = map[dow][slot]
        return {
          slot,
          total: c.total,
          absences: c.absences,
          meetings: c.meetings,
          absenceRate: c.total > 0 ? c.absences / c.total * 100 : null,
          meetingRate: c.total > 0 ? c.meetings / c.total * 100 : null,
        }
      }),
    }))
    // 전체 최고 부재율 (색상 기준용)
    const allRates = days.flatMap((d) => d.slots.map((s) => s.absenceRate ?? 0))
    const maxAbsence = Math.max(1, ...allRates)
    return { days, maxAbsence }
  }, [filteredHistories])

  // ── 11. 미방문 세대 현황 ────────────────────────────────────
  const unvisitedStats = useMemo(() => {
    const allIds = new Set<number>()
    const chineseIds = new Set<number>()
    for (const b of buildings) {
      for (const u of b.units) {
        allIds.add(u.id)
        if (u.isChinese) chineseIds.add(u.id)
      }
    }
    const visitedIds = new Set(visitHistories.map((h) => h.unitId).filter((id) => allIds.has(id)))
    const total      = allIds.size
    const visited    = visitedIds.size
    const unvisited  = total - visited
    const chVisited  = [...chineseIds].filter((id) => visitedIds.has(id)).length
    const chUnvisited = chineseIds.size - chVisited
    return {
      total, visited, unvisited,
      visitedRate: total > 0 ? visited / total * 100 : 0,
      unvisitedRate: total > 0 ? unvisited / total * 100 : 0,
      chTotal: chineseIds.size, chVisited, chUnvisited,
      chVisitedRate: chineseIds.size > 0 ? chVisited / chineseIds.size * 100 : 0,
    }
  }, [buildings, visitHistories])

  // ── 12. 봉사자별 통계 (개발자만) ────────────────────────────
  const visitorStats = useMemo(() => {
    if (!isDeveloper) return []
    const map = new Map<string, { total: number; meetings: number; absences: number; invitations: number }>()
    for (const h of filteredHistories) {
      if (!map.has(h.visitor)) map.set(h.visitor, { total: 0, meetings: 0, absences: 0, invitations: 0 })
      const s = map.get(h.visitor)!
      s.total++
      if (h.result === '만남') s.meetings++
      if (h.result === '부재') s.absences++
      if (h.invitationLeft) s.invitations++
    }
    return Array.from(map.entries())
      .map(([visitor, s]) => ({ visitor, ...s, meetingRate: s.total > 0 ? s.meetings / s.total * 100 : 0 }))
      .sort((a, b) => b.total - a.total)
  }, [filteredHistories, isDeveloper])

  const sessionTimeStats = useMemo(() => {
    if (!isDeveloper) return []
    const map = new Map<string, { sessions: number; minutes: number }>()
    for (const s of serviceSessions) {
      if (!s.endedAt || !s.startedAt) continue
      const dur = (new Date(s.endedAt).getTime() - new Date(s.startedAt).getTime()) / 60000
      if (!map.has(s.userName)) map.set(s.userName, { sessions: 0, minutes: 0 })
      const x = map.get(s.userName)!; x.sessions++; x.minutes += dur
    }
    return Array.from(map.entries())
      .map(([visitor, s]) => ({ visitor, sessions: s.sessions, hours: Math.round(s.minutes / 60 * 10) / 10 }))
      .sort((a, b) => b.hours - a.hours)
  }, [serviceSessions, isDeveloper])

  // ── 스타일 상수 ──────────────────────────────────────────────
  const card: React.CSSProperties = { background: '#fff', borderRadius: 12, padding: '20px', marginBottom: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.04)', border: '1px solid #f1f5f9' }
  const ttl: React.CSSProperties  = { fontSize: 15, fontWeight: 700, color: '#1e293b', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 8 }
  const trendData = trendMode === 'monthly' ? monthlyTrend : weeklyTrend
  const diff = monthComparison.this.rate - monthComparison.prev.rate
  const diffColor = diff > 0 ? '#16a34a' : diff < 0 ? '#dc2626' : '#64748b'

  return (
    <section className="desktop-content" style={{ padding: '32px', maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ marginBottom: 20 }}>
        <p style={{ fontSize: 13, color: 'var(--ink-500)', margin: '0 0 4px' }}>분석</p>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>통계 대시보드</h1>
      </div>

      {/* ── 분석 범위 ── */}
      <div style={card}>
        <h2 style={ttl}>📊 분석 범위</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[
            { key: 'all' as ScopeFilter, label: '전체', accent: '#2563eb' },
            { key: 'regular' as ScopeFilter, label: '일반 봉사만', accent: '#2563eb' },
            ...specialPeriods.map(p => ({ key: p.id as ScopeFilter, label: `🟠 ${p.label}`, accent: '#f59e0b' })),
          ].map(({ key, label, accent }) => {
            const active = scope === key
            return (
              <button key={String(key)} onClick={() => setScope(key)} type="button" style={{
                padding: '6px 14px', borderRadius: 7, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                border: `1px solid ${active ? accent : '#e2e8f0'}`,
                background: active ? `${accent}18` : '#fff',
                color: active ? accent : '#475569',
              }}>{label}</button>
            )
          })}
        </div>
      </div>

      {/* ── 이번달 vs 지난달 ── */}
      <div style={card}>
        <h2 style={ttl}>📆 이번달 vs 지난달</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 16, alignItems: 'center' }}>
          {/* 지난달 */}
          <div style={{ padding: '14px 16px', background: '#f8fafc', borderRadius: 10 }}>
            <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600, marginBottom: 4 }}>{monthComparison.prev.label}</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#1e293b' }}>{monthComparison.prev.rate.toFixed(1)}<span style={{ fontSize: 14, fontWeight: 600, color: '#64748b' }}>%</span></div>
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 3 }}>만남 {monthComparison.prev.meetings} / 방문 {monthComparison.prev.total}</div>
            <MiniBar pct={monthComparison.prev.rate} color="#94a3b8" />
          </div>
          {/* 화살표 */}
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 22, color: diffColor }}>{diff > 0 ? '↑' : diff < 0 ? '↓' : '→'}</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: diffColor }}>{diff === 0 ? '동일' : `${Math.abs(diff).toFixed(1)}%p`}</div>
          </div>
          {/* 이번달 */}
          <div style={{ padding: '14px 16px', background: '#f0fdf4', borderRadius: 10, border: '1px solid #bbf7d0' }}>
            <div style={{ fontSize: 12, color: '#16a34a', fontWeight: 600, marginBottom: 4 }}>{monthComparison.this.label} (이번달)</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#14532d' }}>{monthComparison.this.rate.toFixed(1)}<span style={{ fontSize: 14, fontWeight: 600, color: '#16a34a' }}>%</span></div>
            <div style={{ fontSize: 11, color: '#86efac', marginTop: 3 }}>만남 {monthComparison.this.meetings} / 방문 {monthComparison.this.total}</div>
            <MiniBar pct={monthComparison.this.rate} color="#22c55e" />
          </div>
        </div>
      </div>

      {/* ── 미방문 세대 현황 ── */}
      <div style={card}>
        <h2 style={ttl}>🚪 미방문 세대 현황</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
          {/* 전체 */}
          <div style={{ padding: '14px 16px', background: '#f8fafc', borderRadius: 10 }}>
            <div style={{ fontSize: 11, color: '#64748b', fontWeight: 700, marginBottom: 4 }}>전체 세대</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span style={{ fontSize: 26, fontWeight: 800, color: '#dc2626' }}>{unvisitedStats.unvisited.toLocaleString()}</span>
              <span style={{ fontSize: 13, color: '#94a3b8' }}>/ {unvisitedStats.total.toLocaleString()}세대</span>
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 3 }}>
              미방문 {unvisitedStats.unvisitedRate.toFixed(1)}% · 방문완료 {unvisitedStats.visitedRate.toFixed(1)}%
            </div>
            <div style={{ marginTop: 8, height: 7, background: '#fee2e2', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ width: `${unvisitedStats.visitedRate}%`, height: '100%', background: '#22c55e', borderRadius: 4, transition: 'width .4s' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3, fontSize: 10, color: '#94a3b8' }}>
              <span>방문완료 {unvisitedStats.visited}</span><span>미방문 {unvisitedStats.unvisited}</span>
            </div>
          </div>
          {/* 중국인 */}
          {unvisitedStats.chTotal > 0 && (
            <div style={{ padding: '14px 16px', background: '#fffbeb', borderRadius: 10, border: '1px solid #fde68a' }}>
              <div style={{ fontSize: 11, color: '#92400e', fontWeight: 700, marginBottom: 4 }}>중국인 세대</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span style={{ fontSize: 26, fontWeight: 800, color: '#b45309' }}>{unvisitedStats.chUnvisited.toLocaleString()}</span>
                <span style={{ fontSize: 13, color: '#d97706' }}>/ {unvisitedStats.chTotal}세대</span>
              </div>
              <div style={{ fontSize: 11, color: '#b45309', marginTop: 3 }}>
                미방문 {unvisitedStats.chTotal > 0 ? ((unvisitedStats.chUnvisited / unvisitedStats.chTotal) * 100).toFixed(1) : 0}%
              </div>
              <div style={{ marginTop: 8, height: 7, background: '#fef3c7', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ width: `${unvisitedStats.chVisitedRate}%`, height: '100%', background: '#f59e0b', borderRadius: 4, transition: 'width .4s' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3, fontSize: 10, color: '#b45309' }}>
                <span>방문완료 {unvisitedStats.chVisited}</span><span>미방문 {unvisitedStats.chUnvisited}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── 전체 요약 ── */}
      <div style={card}>
        <h2 style={ttl}>전체 요약</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 10 }}>
          {[
            { label: '총 방문', value: summary.total, color: '#1e293b', pct: null },
            { label: '만남',   value: summary.meetings, color: '#16a34a', pct: summary.meetingRate },
            { label: '부재',   value: summary.absences, color: '#ca8a04', pct: summary.total > 0 ? summary.absences / summary.total * 100 : 0 },
            { label: '한국인', value: summary.koreans,  color: '#3730a3', pct: summary.total > 0 ? summary.koreans / summary.total * 100 : 0 },
            { label: '만남률', value: `${summary.meetingRate.toFixed(1)}%`, color: '#2563eb', pct: summary.meetingRate },
            ...(scope !== 'regular' && scope !== 'all' ? [{ label: '초대장', value: summary.invitations, color: '#f59e0b', pct: summary.total > 0 ? summary.invitations / summary.total * 100 : 0 }] : []),
          ].map(s => (
            <div key={s.label} style={{ padding: '12px 14px', background: '#f8fafc', borderRadius: 9 }}>
              <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>{s.label}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: s.color, marginTop: 3 }}>{s.value}</div>
              {s.pct != null && <MiniBar pct={s.pct} color={s.color} />}
            </div>
          ))}
        </div>
      </div>

      {/* ── 결과 분포 ── */}
      <div style={card}>
        <h2 style={ttl}>결과 분포</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {resultDistribution.map(r => (
            <div key={r.result} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 52, fontSize: 12, fontWeight: 700, color: '#475569' }}>{r.result}</div>
              <div style={{ flex: 1, height: 18, background: '#f1f5f9', borderRadius: 9, overflow: 'hidden' }}>
                <div style={{
                  width: `${r.pct}%`, height: '100%', transition: 'width .3s',
                  background: r.result === '만남' ? '#22c55e' : r.result === '부재' ? '#eab308' : '#6366f1',
                }} />
              </div>
              <div style={{ width: 96, fontSize: 12, textAlign: 'right', color: '#475569' }}>
                <strong>{r.count}건</strong> ({r.pct.toFixed(1)}%)
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── 시간대별 분석 ── */}
      <div style={card}>
        <h2 style={ttl}>⏰ 시간대별 분석</h2>
        <div style={{ display: 'flex', gap: 12 }}>
          {slotStats.map(s => {
            const best = slotStats.reduce((a, b) => a.meetingRate > b.meetingRate ? a : b)
            const worst = slotStats.reduce((a, b) => a.absenceRate > b.absenceRate ? a : b)
            const isBest  = s.slot === best.slot && s.total > 0
            const isWorst = s.slot === worst.slot && s.total > 0 && s !== best
            return (
              <div key={s.slot} style={{
                flex: 1, padding: '14px 16px', borderRadius: 10,
                background: isBest ? '#f0fdf4' : isWorst ? '#fff7ed' : '#f8fafc',
                border: `1px solid ${isBest ? '#bbf7d0' : isWorst ? '#fed7aa' : '#f1f5f9'}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#475569' }}>{s.slot}</div>
                  {isBest  && <span style={{ fontSize: 10, fontWeight: 700, color: '#16a34a', background: '#dcfce7', padding: '2px 7px', borderRadius: 10 }}>✓ 최고</span>}
                  {isWorst && <span style={{ fontSize: 10, fontWeight: 700, color: '#ea580c', background: '#ffedd5', padding: '2px 7px', borderRadius: 10 }}>주의</span>}
                </div>
                {/* 만남률 */}
                <div style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#16a34a', fontWeight: 700, marginBottom: 3 }}>
                    <span>만남률</span><span>{s.meetingRate.toFixed(1)}% <span style={{ fontWeight: 400, color: '#86efac' }}>({s.meetings}건)</span></span>
                  </div>
                  <div style={{ height: 7, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ width: `${s.meetingRate}%`, height: '100%', background: '#22c55e', borderRadius: 4 }} />
                  </div>
                </div>
                {/* 부재율 */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#dc2626', fontWeight: 700, marginBottom: 3 }}>
                    <span>부재율</span><span>{s.absenceRate.toFixed(1)}% <span style={{ fontWeight: 400, color: '#fca5a5' }}>({s.absences}건)</span></span>
                  </div>
                  <div style={{ height: 7, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ width: `${s.absenceRate}%`, height: '100%', background: '#f87171', borderRadius: 4 }} />
                  </div>
                </div>
                <div style={{ marginTop: 8, fontSize: 10, color: '#94a3b8' }}>총 {s.total}회 방문</div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── 요일별 만남률 ── */}
      <div style={card}>
        <h2 style={ttl}>📅 요일별 만남률</h2>
        {/* 평일/주말 요약 */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          {[
            { label: '평일 평균', ...dayOfWeekStats.weekday, color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
            { label: '주말 평균', ...dayOfWeekStats.weekend, color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe' },
          ].map(g => (
            <div key={g.label} style={{ flex: 1, padding: '12px 14px', background: g.bg, borderRadius: 10, border: `1px solid ${g.border}` }}>
              <div style={{ fontSize: 11, color: g.color, fontWeight: 700, marginBottom: 4 }}>{g.label}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: g.color }}>{g.rate.toFixed(1)}<span style={{ fontSize: 13 }}>%</span></div>
              <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>만남 {g.meetings} / {g.total}회</div>
            </div>
          ))}
        </div>
        {/* 요일별 바 차트 */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', height: 100 }}>
          {dayOfWeekStats.days.map((d) => {
            const maxRate = Math.max(1, ...dayOfWeekStats.days.map(x => x.meetingRate))
            const barH = d.total > 0 ? Math.max(8, (d.meetingRate / maxRate) * 80) : 4
            return (
              <div key={d.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: d.meetingRate >= maxRate * 0.8 ? '#16a34a' : '#94a3b8' }}>
                  {d.total > 0 ? `${d.meetingRate.toFixed(0)}%` : '-'}
                </div>
                <div style={{
                  width: '100%', borderRadius: '4px 4px 0 0',
                  height: barH,
                  background: d.isWeekend
                    ? (d.meetingRate >= maxRate * 0.8 ? '#7c3aed' : '#c4b5fd')
                    : (d.meetingRate >= maxRate * 0.8 ? '#16a34a' : '#93c5fd'),
                  transition: 'height .3s',
                }} />
                <div style={{ fontSize: 12, fontWeight: 700, color: d.isWeekend ? '#7c3aed' : '#475569' }}>{d.label}</div>
                <div style={{ fontSize: 9, color: '#cbd5e1' }}>{d.total > 0 ? `${d.total}회` : '없음'}</div>
              </div>
            )
          })}
        </div>

        {/* ── 요일×시간대 부재율 히트맵 ── */}
        <div style={{ marginTop: 20, borderTop: '1px solid #f1f5f9', paddingTop: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#475569', marginBottom: 10 }}>
            시간대별 부재율 <span style={{ fontSize: 11, fontWeight: 400, color: '#94a3b8' }}>— 빨갈수록 부재 많음 (피하면 좋은 시간)</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 3, fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={{ width: 44, textAlign: 'left', fontSize: 11, color: '#94a3b8', fontWeight: 600, paddingBottom: 4 }} />
                  {daySlotMatrix.days.map((d) => (
                    <th key={d.label} style={{ textAlign: 'center', fontSize: 12, fontWeight: 700, color: d.isWeekend ? '#7c3aed' : '#475569', paddingBottom: 4 }}>
                      {d.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {TIME_SLOTS.map((slot) => (
                  <tr key={slot}>
                    <td style={{ fontSize: 11, color: '#64748b', fontWeight: 700, paddingRight: 6, whiteSpace: 'nowrap' }}>{slot}</td>
                    {daySlotMatrix.days.map((d) => {
                      const cell = d.slots.find((s) => s.slot === slot)!
                      const rate = cell.absenceRate
                      const intensity = rate !== null ? rate / daySlotMatrix.maxAbsence : 0
                      // null = 데이터 없음 → 회색
                      const bg = rate === null
                        ? '#f8fafc'
                        : rate === 0
                          ? '#f0fdf4'
                          : `rgba(239,68,68,${Math.max(0.08, intensity * 0.85)})`
                      const textColor = rate === null ? '#cbd5e1' : intensity > 0.6 ? '#fff' : '#1e293b'
                      return (
                        <td key={slot + d.label} style={{ textAlign: 'center', padding: '7px 4px', borderRadius: 6, background: bg, transition: 'background .2s' }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: textColor }}>
                            {rate === null ? '–' : `${rate.toFixed(0)}%`}
                          </div>
                          {cell.total > 0 && (
                            <div style={{ fontSize: 9, color: intensity > 0.6 ? 'rgba(255,255,255,0.7)' : '#94a3b8', marginTop: 1 }}>
                              {cell.absences}/{cell.total}
                            </div>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── 중국인 세대 특화 ── */}
      {chineseStats.totalUnits > 0 && (
        <div style={card}>
          <h2 style={ttl}>🇨🇳 중국인 세대 분석</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {/* 전체 접촉률 */}
            <div style={{ padding: '14px 16px', background: '#fffbeb', borderRadius: 10, border: '1px solid #fde68a' }}>
              <div style={{ fontSize: 12, color: '#92400e', fontWeight: 700, marginBottom: 6 }}>전체 접촉률</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#92400e' }}>{chineseStats.rate.toFixed(1)}<span style={{ fontSize: 14 }}>%</span></div>
              <div style={{ fontSize: 11, color: '#b45309', marginTop: 3 }}>만남 {chineseStats.meetings} / 방문 {chineseStats.total} · 중국인 세대 {chineseStats.totalUnits}개</div>
              <MiniBar pct={chineseStats.rate} color="#f59e0b" />
              <div style={{ marginTop: 8, fontSize: 12, color: '#92400e' }}>부재 {chineseStats.absences}회</div>
            </div>
            {/* 시간대별 */}
            <div>
              <div style={{ fontSize: 12, color: '#64748b', fontWeight: 700, marginBottom: 8 }}>시간대별 만남률</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {chineseStats.slots.map(sl => (
                  <div key={sl.slot} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 36, fontSize: 12, fontWeight: 700, color: '#475569' }}>{sl.slot}</div>
                    <div style={{ flex: 1, height: 14, background: '#f1f5f9', borderRadius: 7, overflow: 'hidden' }}>
                      <div style={{ width: `${sl.rate}%`, height: '100%', background: '#f59e0b', transition: 'width .3s' }} />
                    </div>
                    <div style={{ width: 60, fontSize: 12, textAlign: 'right', fontWeight: 700, color: '#92400e' }}>
                      {sl.rate.toFixed(1)}% <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 400 }}>({sl.total})</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}


      {/* ── 방문 추이 꺾은선 ── */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ ...ttl, margin: 0 }}>📈 방문 추이</h2>
          <div style={{ display: 'flex', gap: 6 }}>
            {(['monthly', 'weekly'] as TrendMode[]).map(m => (
              <button key={m} onClick={() => setTrendMode(m)} type="button" style={{
                padding: '4px 12px', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                border: `1px solid ${trendMode === m ? '#2563eb' : '#e2e8f0'}`,
                background: trendMode === m ? '#eff6ff' : '#fff',
                color: trendMode === m ? '#1d4ed8' : '#475569',
              }}>{m === 'monthly' ? '월별' : '주별'}</button>
            ))}
          </div>
        </div>
        <LineChart data={trendData} />
        {/* X축 레이블 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, padding: '0 8px' }}>
          {trendData.map((d, i) => (
            <div key={i} style={{ fontSize: 10, color: '#94a3b8', flex: 1, textAlign: 'center' }}>{d.label}</div>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 14, marginTop: 10, fontSize: 11, color: '#64748b' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ display: 'inline-block', width: 10, height: 3, background: '#22c55e', borderRadius: 2 }} />만남</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ display: 'inline-block', width: 10, height: 3, background: '#94a3b8', borderRadius: 2 }} />총 방문</span>
        </div>
      </div>

      {/* ── 카드별 테이블 (접기/펼치기 + 구역 필터) ── */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: cardTableOpen ? 14 : 0 }}>
          <h2 style={{ ...ttl, margin: 0 }}>📋 카드별 상세</h2>
          <button
            onClick={() => setCardTableOpen(v => !v)}
            style={{ fontSize: 12, color: '#64748b', background: '#f1f5f9', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontWeight: 600 }}
          >
            {cardTableOpen ? '닫기 ▲' : '열기 ▼'}
          </button>
        </div>

        {cardTableOpen && (
          <>
            {/* 구(Region) 필터 */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
              <button
                onClick={() => { setSelectedRegion(null); setSelectedArea(null) }}
                style={{ fontSize: 12, padding: '4px 10px', borderRadius: 20, border: 'none', cursor: 'pointer', fontWeight: 600, background: selectedRegion === null ? '#2563eb' : '#f1f5f9', color: selectedRegion === null ? '#fff' : '#64748b' }}
              >전체</button>
              {allRegions.map(r => (
                <button key={r}
                  onClick={() => { setSelectedRegion(r); setSelectedArea(null) }}
                  style={{ fontSize: 12, padding: '4px 10px', borderRadius: 20, border: 'none', cursor: 'pointer', fontWeight: 600, background: selectedRegion === r ? '#2563eb' : '#f1f5f9', color: selectedRegion === r ? '#fff' : '#64748b' }}
                >{r}</button>
              ))}
            </div>

            {/* 동(Area) 필터 — 구 선택 시만 표시 */}
            {selectedRegion && areasForRegion.length > 0 && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10, paddingLeft: 8, borderLeft: '2px solid #e2e8f0' }}>
                <button
                  onClick={() => setSelectedArea(null)}
                  style={{ fontSize: 11, padding: '3px 9px', borderRadius: 20, border: 'none', cursor: 'pointer', background: selectedArea === null ? '#0ea5e9' : '#f1f5f9', color: selectedArea === null ? '#fff' : '#64748b' }}
                >전체</button>
                {areasForRegion.map(a => (
                  <button key={a}
                    onClick={() => setSelectedArea(a)}
                    style={{ fontSize: 11, padding: '3px 9px', borderRadius: 20, border: 'none', cursor: 'pointer', background: selectedArea === a ? '#0ea5e9' : '#f1f5f9', color: selectedArea === a ? '#fff' : '#64748b' }}
                  >{a}</button>
                ))}
              </div>
            )}

            {/* 테이블 */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                    {['카드', '방문률', '방문/세대', '만남률', '만남/총방문'].map(h => (
                      <th key={h} style={{ padding: '10px 8px', fontSize: 11, color: '#64748b', fontWeight: 700, textAlign: h === '카드' ? 'left' : 'right' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredCardStats.map(c => (
                    <tr key={c.cardId} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '9px 8px', fontWeight: 600 }}>
                        <div>{c.name}</div>
                        {(c.region || c.area) && (
                          <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 1 }}>{[c.region, c.area].filter(Boolean).join(' · ')}</div>
                        )}
                      </td>
                      <td style={{ padding: '9px 8px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
                          <div style={{ width: 56, height: 5, background: '#f1f5f9', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{ width: `${c.visitRate}%`, height: '100%', background: c.visitRate >= 80 ? '#22c55e' : c.visitRate >= 50 ? '#3b82f6' : '#94a3b8' }} />
                          </div>
                          <strong style={{ minWidth: 38 }}>{c.visitRate.toFixed(0)}%</strong>
                        </div>
                      </td>
                      <td style={{ padding: '9px 8px', textAlign: 'right', color: '#64748b' }}>{c.visited} / {c.totalUnits}</td>
                      <td style={{ padding: '9px 8px', textAlign: 'right', fontWeight: 700, color: c.meetingRate >= 30 ? '#16a34a' : '#94a3b8' }}>{c.meetingRate.toFixed(1)}%</td>
                      <td style={{ padding: '9px 8px', textAlign: 'right', color: '#64748b' }}>{c.meetings} / {c.totalVisits}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredCardStats.length === 0 && (
                <p style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', padding: '20px 0' }}>해당 구역의 카드가 없습니다</p>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── 봉사자별 (개발자 전용) ── */}
      {isDeveloper && visitorStats.length > 0 && (
        <div style={card}>
          <h2 style={ttl}>👤 봉사자별 활동량</h2>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                  {['봉사자','방문','만남','부재','만남률','초대장'].map(h => (
                    <th key={h} style={{ padding: '10px 8px', fontSize: 11, color: '#64748b', fontWeight: 700, textAlign: h === '봉사자' ? 'left' : 'right' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visitorStats.map(v => (
                  <tr key={v.visitor} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '9px 8px', fontWeight: 600 }}>{v.visitor}</td>
                    <td style={{ padding: '9px 8px', textAlign: 'right' }}><strong>{v.total}</strong></td>
                    <td style={{ padding: '9px 8px', textAlign: 'right', color: '#16a34a' }}>{v.meetings}</td>
                    <td style={{ padding: '9px 8px', textAlign: 'right', color: '#ca8a04' }}>{v.absences}</td>
                    <td style={{ padding: '9px 8px', textAlign: 'right', fontWeight: 700, color: v.meetingRate >= 30 ? '#16a34a' : '#94a3b8' }}>{v.meetingRate.toFixed(1)}%</td>
                    <td style={{ padding: '9px 8px', textAlign: 'right', color: '#f59e0b' }}>{v.invitations}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {isDeveloper && sessionTimeStats.length > 0 && (
        <div style={card}>
          <h2 style={ttl}>⏱️ 봉사자별 누적 시간</h2>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                  {['봉사자','세션','누적 시간'].map(h => (
                    <th key={h} style={{ padding: '10px 8px', fontSize: 11, color: '#64748b', fontWeight: 700, textAlign: h === '봉사자' ? 'left' : 'right' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sessionTimeStats.map(s => (
                  <tr key={s.visitor} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '9px 8px', fontWeight: 600 }}>{s.visitor}</td>
                    <td style={{ padding: '9px 8px', textAlign: 'right', color: '#64748b' }}>{s.sessions}회</td>
                    <td style={{ padding: '9px 8px', textAlign: 'right', fontWeight: 700, color: '#2563eb' }}>{s.hours}시간</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  )
}
