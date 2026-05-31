// 팀 색상 — draft.team.color 값('blue' 등) → hex. 화면1·화면2·지도 폴리곤 공유.
export const TEAM_COLOR_HEX: Record<string, string> = {
  blue: '#3b82f6',
  green: '#22c55e',
  orange: '#f97316',
  purple: '#8b5cf6',
  slate: '#64748b',
  rose: '#f43f5e',
  teal: '#14b8a6',
  amber: '#f59e0b',
}

export function teamHex(color: string): string {
  return TEAM_COLOR_HEX[color] ?? '#64748b'
}
