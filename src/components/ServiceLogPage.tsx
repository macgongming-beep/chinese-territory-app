// 봉사 로그 화면 (관리자/인도자)
// - 일정/카드 필터
// - 시간순 그룹 표시
// - CSV 다운로드
import { useMemo, useState } from 'react'
import { useServiceLogs, getActionMeta, logsToCSV, downloadCSV, type ServiceLog } from '../hooks/useServiceLogs'
import type { CalendarEvent, TerritoryCard, Role } from '../types'

type ServiceLogPageProps = {
  cards: TerritoryCard[]
  calendarEvents: CalendarEvent[]
  role: Role
  isEmbedded?: boolean
}

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  const weekdays = ['일', '월', '화', '수', '목', '금', '토']
  return `${d.getMonth() + 1}/${d.getDate()} (${weekdays[d.getDay()]})`
}

function groupByDay(logs: ServiceLog[]): Map<string, ServiceLog[]> {
  const groups = new Map<string, ServiceLog[]>()
  for (const log of logs) {
    const key = log.createdAt.slice(0, 10) // YYYY-MM-DD
    const arr = groups.get(key) ?? []
    arr.push(log)
    groups.set(key, arr)
  }
  return groups
}

// 카드·일정 이름 폴백 조회용 맵
function useContextMaps(cards: TerritoryCard[], calendarEvents: CalendarEvent[]) {
  return useMemo(() => {
    const cardMap = new Map(cards.map((c) => [c.id, c.name]))
    const eventMap = new Map(
      calendarEvents.map((e) => [e.id, `${e.date.slice(5)} ${e.title || e.time}`])
    )
    return { cardMap, eventMap }
  }, [cards, calendarEvents])
}

export function ServiceLogPage({ cards, calendarEvents, role, isEmbedded }: ServiceLogPageProps) {
  const [selectedCardId, setSelectedCardId] = useState<number | null>(null)
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null)

  const { logs, loading, error } = useServiceLogs({
    cardId: selectedCardId,
    eventId: selectedEventId,
    limit: 500,
  })

  const { cardMap, eventMap } = useContextMaps(cards, calendarEvents)

  const grouped = useMemo(() => groupByDay(logs), [logs])
  const sortedDays = useMemo(
    () => Array.from(grouped.keys()).sort((a, b) => b.localeCompare(a)),
    [grouped]
  )

  const handleCSV = () => {
    if (logs.length === 0) return
    const today = new Date().toISOString().slice(0, 10)
    const filterPart = selectedCardId
      ? `_card${selectedCardId}`
      : selectedEventId
      ? `_event${selectedEventId}`
      : '_all'
    downloadCSV(`service-logs_${today}${filterPart}.csv`, logsToCSV(logs))
  }

  // 권한 안내 — developer 전용
  if (role !== 'developer') {
    return (
      <section style={{ padding: 24, width: '100%' }}>
        <p style={{ color: '#94a3b8' }}>봉사 로그는 개발자만 볼 수 있습니다.</p>
      </section>
    )
  }

  return (
    <section style={{ padding: isEmbedded ? '0 4px 32px' : '20px 24px', width: '100%', maxWidth: 1100, margin: '0 auto' }}>
      {!isEmbedded && (
        <header style={{ marginBottom: 20 }}>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: '#94a3b8', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            관리자 메뉴
          </p>
          <h1 style={{ margin: '4px 0 0', fontSize: 22, fontWeight: 800, color: '#1e293b' }}>
            봉사 로그
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: '#64748b' }}>
            회중 전체 봉사 활동을 시간순으로 확인합니다. (90일 보관)
          </p>
        </header>
      )}
      {isEmbedded && (
        <div style={{ paddingBottom: 16 }}>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--gray-900)' }}>봉사 로그</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
            회중 전체 봉사 활동을 시간순으로 확인합니다. (90일 보관)
          </p>
        </div>
      )}

      {/* 필터 */}
      <div style={{
        display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center',
        padding: 12, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10,
        marginBottom: 16,
      }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          <span style={{ color: '#64748b' }}>카드</span>
          <select
            value={selectedCardId ?? ''}
            onChange={(e) => {
              const v = e.target.value
              setSelectedCardId(v ? Number(v) : null)
              setSelectedEventId(null)
            }}
            style={{
              padding: '6px 10px', borderRadius: 7, border: '1px solid #cbd5e1',
              fontSize: 13, background: '#fff', minWidth: 140,
            }}
          >
            <option value="">전체</option>
            {cards.map((card) => (
              <option key={card.id} value={card.id}>{card.name}</option>
            ))}
          </select>
        </label>

        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          <span style={{ color: '#64748b' }}>일정</span>
          <select
            value={selectedEventId ?? ''}
            onChange={(e) => {
              const v = e.target.value
              setSelectedEventId(v ? Number(v) : null)
              setSelectedCardId(null)
            }}
            style={{
              padding: '6px 10px', borderRadius: 7, border: '1px solid #cbd5e1',
              fontSize: 13, background: '#fff', minWidth: 220,
            }}
          >
            <option value="">전체</option>
            {calendarEvents.slice(0, 200).map((event) => (
              <option key={event.id} value={event.id}>
                {event.date.slice(5)} · {event.title || event.time}
              </option>
            ))}
          </select>
        </label>

        <button
          onClick={() => {
            setSelectedCardId(null)
            setSelectedEventId(null)
          }}
          style={{
            padding: '6px 12px', borderRadius: 7, border: '1px solid #e2e8f0',
            background: '#fff', color: '#64748b', fontSize: 13, fontWeight: 600,
            cursor: 'pointer',
          }}
          type="button"
        >초기화</button>

        <span style={{ flex: 1 }} />

        <button
          onClick={handleCSV}
          disabled={logs.length === 0}
          style={{
            padding: '7px 14px', borderRadius: 7, border: '1px solid var(--ink)',
            background: 'var(--ink)', color: 'var(--surface, #fff)', fontSize: 13, fontWeight: 700,
            cursor: logs.length === 0 ? 'not-allowed' : 'pointer',
            opacity: logs.length === 0 ? 0.5 : 1,
          }}
          type="button"
        >CSV 다운로드</button>
      </div>

      {/* 결과 카운트 */}
      <p style={{ margin: '0 0 12px', fontSize: 13, color: '#64748b' }}>
        총 <b style={{ color: '#1e293b' }}>{logs.length}</b>건
        {loading && <span style={{ marginLeft: 8 }}>· 불러오는 중...</span>}
      </p>

      {error && (
        <div style={{
          padding: 14, background: '#fef2f2', border: '1px solid #fecaca',
          borderRadius: 8, color: '#dc2626', fontSize: 13, marginBottom: 16,
        }}>⚠️ {error}</div>
      )}

      {/* 로그 그룹 */}
      {sortedDays.length === 0 && !loading && !error && (
        <div style={{
          padding: '60px 20px', textAlign: 'center', color: '#94a3b8',
          background: '#f8fafc', borderRadius: 10,
        }}>
          <p style={{ margin: 0, fontSize: 14 }}>표시할 로그가 없습니다</p>
        </div>
      )}

      {sortedDays.map((day) => {
        const dayLogs = grouped.get(day) ?? []
        return (
          <div key={day} style={{ marginBottom: 24 }}>
            <h3 style={{
              margin: '0 0 10px', fontSize: 13, fontWeight: 700, color: '#475569',
              padding: '5px 12px', background: '#f1f5f9', borderRadius: 6,
              display: 'inline-block',
            }}>{formatDate(day + 'T00:00:00')}</h3>

            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
              {dayLogs.map((log, idx) => {
                const meta = getActionMeta(log.action)
                // RPC가 join 데이터를 안 줄 경우 props로 폴백
                const cardName = log.cardName ?? (log.cardId ? (cardMap.get(log.cardId) ?? null) : null)
                const eventLabel = log.eventTitle
                  ?? (log.eventId ? (eventMap.get(log.eventId) ?? null) : null)
                return (
                  <div
                    key={log.id}
                    style={{
                      display: 'flex', gap: 10, padding: '10px 14px',
                      borderBottom: idx < dayLogs.length - 1 ? '1px solid #f1f5f9' : 'none',
                      fontSize: 13, alignItems: 'flex-start',
                    }}
                  >
                    {/* 시각 */}
                    <span style={{
                      flexShrink: 0, color: '#94a3b8', fontVariantNumeric: 'tabular-nums',
                      fontSize: 11, paddingTop: 3, width: 56,
                    }}>{formatDateTime(log.createdAt)}</span>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      {/* 액션 배지 + 행위자 */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '2px 8px', borderRadius: 4,
                          fontSize: 12, fontWeight: 700,
                          color: meta.color, background: meta.bg,
                          lineHeight: 1.6,
                        }}>{meta.label}</span>
                        <span style={{ color: '#1e293b', fontWeight: 600, fontSize: 13 }}>
                          {log.actorName}
                        </span>
                      </div>

                      {/* 카드 / 일정 / 건물 컨텍스트 */}
                      {(() => {
                        const detailBuilding = log.details.building_name != null ? String(log.details.building_name) : null
                        if (!cardName && !eventLabel && !detailBuilding) return null
                        return (
                        <div style={{ marginTop: 3, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {cardName && (
                            <span style={{
                              fontSize: 12, color: '#0369a1',
                              background: '#e0f2fe', padding: '1px 7px', borderRadius: 4,
                            }}>카드 {cardName}</span>
                          )}
                          {detailBuilding && (
                            <span style={{
                              fontSize: 12, color: '#0f766e',
                              background: '#ccfbf1', padding: '1px 7px', borderRadius: 4,
                            }}>건물 {detailBuilding}</span>
                          )}
                          {eventLabel && (
                            <span style={{
                              fontSize: 12, color: '#6d28d9',
                              background: '#ede9fe', padding: '1px 7px', borderRadius: 4,
                            }}>일정 {eventLabel}</span>
                          )}
                        </div>
                        )
                      })()}

                      {/* 상세 */}
                      {Object.keys(log.details).length > 0 && (
                        <p style={{
                          margin: '4px 0 0', fontSize: 11, color: '#64748b',
                          fontFamily: 'ui-monospace, monospace',
                          background: '#f8fafc', padding: '3px 8px', borderRadius: 4,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {Object.entries(log.details)
                            .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)
                            .join(' · ')}
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </section>
  )
}
