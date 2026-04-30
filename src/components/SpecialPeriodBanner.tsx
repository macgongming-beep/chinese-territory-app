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
  variant?: 'card' | 'compact' | 'inline'  // card: 큰 박스, compact: 한 줄 띠, inline: 페이지 헤드 칩
  onClick?: () => void
}) {
  const todayStr = new Date().toISOString().slice(0, 10)
  const active = specialPeriods.find((p) => todayStr >= p.startDate && todayStr <= p.endDate)
  if (!active) return null

  const end = new Date(active.endDate)
  const today = new Date(todayStr)
  const diff = Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  const dDayLabel = diff > 0 ? `D-${diff}` : diff === 0 ? '오늘 마지막 날' : `D+${Math.abs(diff)}`

  if (variant === 'inline') {
    return (
      <div
        onClick={onClick}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '12px 14px',
          background: '#FFFBEB',
          border: '1px solid #FEF3C7',
          borderLeft: '3px solid #F59E0B',
          borderRadius: '12px',
          cursor: onClick ? 'pointer' : 'default',
          flex: 1,
          maxWidth: 560,
          flexShrink: 0,
        }}
      >
        {/* 도트 */}
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#F59E0B', flexShrink: 0, display: 'inline-block' }} />
        {/* 텍스트 */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: '#B45309', lineHeight: 1.4 }}>
            {active.label}
          </div>
          <div style={{ fontSize: '12px', color: '#D97706', marginTop: '1px' }}>
            {active.startDate} ~ {active.endDate} · 이 기간의 모든 방문은 시즌으로 자동 기록됩니다
          </div>
        </div>
        {/* D-day 뱃지 */}
        <span style={{
          flexShrink: 0,
          padding: '2px 8px',
          borderRadius: '6px',
          background: '#F59E0B',
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
          padding: '6px 12px',
          background: 'linear-gradient(90deg, #fef3c7, #fffbeb)',
          border: '1px solid #fbbf24',
          borderRadius: '8px',
          fontSize: '12px',
          fontWeight: 700,
          color: '#92400e',
          cursor: onClick ? 'pointer' : 'default',
        }}
      >
        <span>🟠</span>
        <span>{active.label}</span>
        <span style={{ marginLeft: 'auto', padding: '2px 8px', borderRadius: '10px', background: '#f59e0b', color: '#fff', fontSize: '11px' }}>
          {dDayLabel}
        </span>
      </div>
    )
  }

  return (
    <div
      className="special-period-banner-card"
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        padding: '14px 18px',
        marginBottom: '14px',
        background: 'linear-gradient(135deg, #fef3c7, #fffbeb)',
        border: '1px solid #fbbf24',
        borderLeft: '4px solid #f59e0b',
        borderRadius: '10px',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'box-shadow .12s',
      }}
    >
      <span style={{ fontSize: '24px' }}>🟠</span>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', flexWrap: 'wrap' }}>
          <strong style={{ fontSize: '14px', fontWeight: 700, color: '#92400e' }}>특별봉사 진행 중</strong>
          <span style={{ fontSize: '15px', fontWeight: 700, color: '#1e293b' }}>{active.label}</span>
        </div>
        <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#78716c' }}>
          {active.startDate} ~ {active.endDate}
          <span style={{ marginLeft: '8px', color: '#92400e' }}>· 이 기간의 모든 방문은 시즌으로 자동 기록됩니다</span>
        </p>
      </div>
      <span
        style={{
          flexShrink: 0,
          padding: '6px 14px',
          borderRadius: '20px',
          background: '#f59e0b',
          color: '#fff',
          fontSize: '13px',
          fontWeight: 800,
          letterSpacing: '0.02em',
        }}
      >
        {dDayLabel}
      </span>
    </div>
  )
}
