import type { Role } from '../types'

export function placeDeletionCopy(role: Role, target: 'building' | 'unit', count = 1) {
  const noun = target === 'building' ? '건물' : '세대'
  const counted = count > 1 ? `${noun} ${count}개` : `이 ${noun}`
  if (role === 'admin' || role === 'developer') {
    return {
      actionLabel: '삭제',
      title: `${noun} 삭제`,
      confirmLabel: '삭제',
      description: `${counted}를 삭제하면 연결된 방문 기록도 영구 삭제될 수 있습니다.`,
    }
  }
  if (role === 'leader') {
    return {
      actionLabel: '삭제',
      title: `${noun} 정리`,
      confirmLabel: '확인',
      description: `연결된 기록이 없으면 ${counted}를 삭제합니다. 기록이 있으면 관리자에게 삭제 요청을 보냅니다.`,
    }
  }
  return {
    actionLabel: '삭제 요청',
    title: `${noun} 삭제 요청`,
    confirmLabel: '요청 보내기',
    description: `${counted}를 직접 삭제하지 않고 관리자에게 확인 요청을 보냅니다.`,
  }
}
