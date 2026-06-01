// 팀 색상 — draft.team.color 값('blue' 등) → hex. 화면1·화면2·지도 폴리곤 공유.
// 앱 톤에 맞춰 차분한 파스텔 계열 (채도 낮춤). 라벨/도트용 hex.
export const TEAM_COLOR_HEX: Record<string, string> = {
  blue: '#6b9bd1',   // 파스텔 블루
  green: '#7faf7b',  // 파스텔 그린
  orange: '#d9a066', // 파스텔 오렌지
  purple: '#a690c9', // 파스텔 퍼플
  slate: '#8b97a8',  // 파스텔 슬레이트
  rose: '#d98fa3',   // 파스텔 로즈
  teal: '#6fb3ac',   // 파스텔 틸
  amber: '#cdb06a',  // 파스텔 앰버
}

export function teamHex(color: string): string {
  return TEAM_COLOR_HEX[color] ?? '#8b97a8'
}
