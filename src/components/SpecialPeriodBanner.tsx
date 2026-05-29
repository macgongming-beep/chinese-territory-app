import type { SpecialPeriod } from '../types'

/**
 * 활성화된 특별봉사 시즌 배너 (모든 사용자에게 노출)
 * 활성 시즌이 없으면 null 반환
 */
export function SpecialPeriodBanner({
  specialPeriods,
  variant = 'card',
  onClick,
}: {
  specialPeriods: SpecialPeriod[]
  variant?: 'card' | 'compact' | 'inline'
  onClick?: () => void
}) {
  const todayStr = new Date().toISOString().slice(0, 10)
  const active = specialPeriods.find((p) => todayStr >= p.startDate && todayStr <= p.endDate)
  if (!active) return null

  const color = active.color || '#5D5B54'
  const end = new Date(active.endDate)
  const today = new Date(todayStr)
  const diff = Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  const dDayLabel = diff > 0 ? `D-${diff}` : diff === 0 ? '오늘 마지막' : `D+${Math.abs(diff)}`

  if (variant === 'inline') {
    return (
      <div
        onClick={onClick}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '12px 14px',
          background: 'var(--surface)',
          border: '1px solid var(--line)',
          borderLeft: `3px solid ${color}`,
          borderRadius: '10px',
          cursor: onClick ? 'pointer' : 'default',
          flex: 1,
          maxWidth: 560,
          flexShrink: 0,
        }}
      >
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0, display: 'inline-block' }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--ink)', lineHeight: 1.4 }}>
            {active.label}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
            {active.startDate} ~ {active.endDate} · 이 기간의 모든 방문은 시즌으로 자동 기록됩니다
          </div>
        </div>
        <span style={{
          flexShrink: 0,
          padding: '2px 8px',
          borderRadius: '6px',
          background: color,
          color: '#fff',
          fontSize: '11px',
          fontWeight: 700,
        }}>
          {dDayLabel}
        </span>
      </div>
    )
  }

  if (variant === 'compact') {
    return (
      <div
        className="special-period-banner-compact"
        onClick={onClick}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 14px',
          background: `color-mix(in srgb, ${color} 10%, transparent)`,
          border: `1px solid color-mix(in srgb, ${color} 20%, transparent)`,
          borderRadius: '12px',
          fontSize: '13px',
          fontWeight: 600,
          color: color,
          cursor: onClick ? 'pointer' : 'default',
          width: '100%',
          boxSizing: 'border-box',
        }}
      >
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0, display: 'inline-block' }} />
        <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{active.label}</span>
        <span style={{ flexShrink: 0, marginLeft: 'auto', padding: '2px 8px', borderRadius: '8px', background: `color-mix(in srgb, ${color} 15%, transparent)`, color: color, fontSize: '12px', fontWeight: 700 }}>
          {dDayLabel}
        </span>
      </div>
    )
  }

  // card (default)
  return (
    <div
      className="special-period-banner-card"
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        padding: '14px 16px',
        marginBottom: '14px',
        background: 'var(--surface)',
        border: '1px solid var(--line)',
        borderLeft: `4px solid ${color}`,
        borderRadius: '10px',
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', flexWrap: 'wrap' }}>
          <strong style={{ fontSize: '13px', fontWeight: 600, color: 'var(--muted)' }}>특별봉사 진행 중</strong>
          <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--ink)' }}>{active.label}</span>
        </div>
        <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--muted)' }}>
          {active.startDate} ~ {active.endDate}
          <span style={{ marginLeft: '8px' }}>· 이 기간의 모든 방문은 시즌으로 자동 기록됩니다</span>
        </p>
      </div>
      <span style={{
        flexShrink: 0,
        padding: '5px 12px',
        borderRadius: '20px',
        background: color,
        color: '#fff',
        fontSize: '12px',
        fontWeight: 700,
        letterSpacing: '0.02em',
      }}>
        {dDayLabel}
      </span>
    </div>
  )
}
