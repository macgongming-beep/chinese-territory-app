import { describe, expect, it } from 'vitest'
import { placeDeletionCopy } from './placeDeletion'

describe('역할별 장소 삭제 안내', () => {
  it('일반 사용자에게 실제 삭제라고 말하지 않는다', () => {
    const copy = placeDeletionCopy('user', 'building')
    expect(copy.actionLabel).toBe('삭제 요청')
    expect(copy.description).toContain('직접 삭제하지 않고')
  })

  it('인도자에게 기록 유무에 따른 결과를 설명한다', () => {
    const copy = placeDeletionCopy('leader', 'unit')
    expect(copy.description).toContain('기록이 없으면')
    expect(copy.description).toContain('관리자에게 삭제 요청')
  })

  it('관리자에게 영구 삭제 위험을 알린다', () => {
    expect(placeDeletionCopy('admin', 'building', 3).description).toContain('영구 삭제')
  })
})
