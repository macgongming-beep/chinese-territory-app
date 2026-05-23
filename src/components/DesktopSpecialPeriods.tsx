import { useNavigate } from 'react-router-dom'
import type { SpecialPeriod } from '../types'
import { SpecialPeriodSettings } from './SpecialPeriodSettings'

export function DesktopSpecialPeriods({
  specialPeriods,
  onCreateSpecialPeriod,
  onUpdateSpecialPeriod,
  onDeleteSpecialPeriod,
}: {
  specialPeriods: SpecialPeriod[]
  onCreateSpecialPeriod: (input: { label: string; startDate: string; endDate: string; color: string; hasInvitation?: boolean }) => Promise<void> | void
  onUpdateSpecialPeriod: (id: number, input: { label: string; startDate: string; endDate: string; color: string; hasInvitation?: boolean }) => Promise<void> | void
  onDeleteSpecialPeriod: (id: number) => Promise<void> | void
}) {
  const navigate = useNavigate()

  return (
    <div className="desk-settings-subpage" style={{ maxWidth: 640 }}>
      <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--gray-900)', marginBottom: 24 }}>특별 봉사 시즌 관리</h2>
      <div className="desktop-profile-stack" style={{ display: 'grid', gap: 24 }}>
        <SpecialPeriodSettings
          isAdmin
          specialPeriods={specialPeriods}
          onCreateSpecialPeriod={onCreateSpecialPeriod}
          onUpdateSpecialPeriod={onUpdateSpecialPeriod}
          onDeleteSpecialPeriod={onDeleteSpecialPeriod}
        />
      </div>
    </div>
  )
}
