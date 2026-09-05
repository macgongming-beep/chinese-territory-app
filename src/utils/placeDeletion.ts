import type { Role } from '../types'
import { msg } from '../lib/msg'

export function placeDeletionCopy(role: Role, target: 'building' | 'unit', count = 1) {
  const isBuilding = target === 'building'
  const counted = count > 1
    ? msg(isBuilding ? '건물 {count}개' : '세대 {count}개', { count })
    : msg(isBuilding ? '이 건물' : '이 세대')
  if (role === 'admin' || role === 'developer') {
    return {
      actionLabel: msg('삭제'),
      title: msg(isBuilding ? '건물 삭제' : '세대 삭제'),
      confirmLabel: msg('확인'),
      description: msg('연결된 기록이 없으면 {counted}를 삭제합니다. 기록이 있으면 요청함에서 영향 범위를 확인한 뒤 영구 삭제할 수 있습니다.', { counted }),
    }
  }
  if (role === 'leader') {
    return {
      actionLabel: msg('삭제'),
      title: msg(isBuilding ? '건물 정리' : '세대 정리'),
      confirmLabel: msg('확인'),
      description: msg('연결된 기록이 없으면 {counted}를 삭제합니다. 기록이 있으면 관리자에게 삭제 요청을 보냅니다.', { counted }),
    }
  }
  return {
    actionLabel: msg('삭제 요청'),
    title: msg(isBuilding ? '건물 삭제 요청' : '세대 삭제 요청'),
    confirmLabel: msg('요청 보내기'),
    description: msg('{counted}를 직접 삭제하지 않고 관리자에게 확인 요청을 보냅니다.', { counted }),
  }
}
