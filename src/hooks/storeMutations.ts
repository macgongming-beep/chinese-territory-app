/**
 * useStore 의 도메인별 mutation factory 모음
 *
 * 패턴:
 *   const { createNotice, deleteNotice } = makeXxxMutations({ fetchAll, setXxx })
 *
 * 의존성을 명시적으로 받아 useStore 내부에서 호출하면, 각 도메인의
 * 비즈니스 로직이 별도 파일에 정리되면서도 useStore 의 state 와 fetchAll 을
 * 공유할 수 있다.
 */
import type { Dispatch, SetStateAction } from 'react'
import { supabase } from '../lib/supabase'
import { showToast } from '../lib/toast'
import type { CardBoundary, GeoPoint, Notice, ReviewTask } from '../types'

function reportMutationError(message: string, error: unknown) {
  console.error(message, error)
  showToast(message, 'error')
}

// ===============================================================
// 공지사항 (Notice)
// ===============================================================
export function makeNoticeMutations(deps: { fetchAll: () => Promise<void> }) {
  const { fetchAll } = deps

  const createNotice = async (input: {
    title: string
    content: string
    priority: Notice['priority']
    author: string
  }) => {
    const result = await supabase.from('notices').insert({
      title: input.title.trim(),
      content: input.content.trim(),
      priority: input.priority,
      author: input.author.trim(),
    })
    if (result.error) {
      reportMutationError('공지를 등록하지 못했습니다. notices 테이블이 있는지 확인해 주세요.', result.error)
      return
    }
    await fetchAll()
    showToast('공지가 등록됐습니다')
  }

  const deleteNotice = async (id: number) => {
    const result = await supabase.from('notices').delete().eq('id', id)
    if (result.error) {
      reportMutationError('공지를 삭제하지 못했습니다.', result.error)
      return
    }
    await fetchAll()
    showToast('공지가 삭제됐습니다')
  }

  return { createNotice, deleteNotice }
}

// ===============================================================
// 특별봉사 시즌 (SpecialPeriod)
// ===============================================================
export function makeSpecialPeriodMutations(deps: { fetchAll: () => Promise<void> }) {
  const { fetchAll } = deps

  const createSpecialPeriod = async (input: {
    label: string
    startDate: string
    endDate: string
    color: string
  }) => {
    const result = await supabase.from('special_periods').insert({
      label: input.label.trim(),
      start_date: input.startDate,
      end_date: input.endDate,
      color: input.color,
    })
    if (result.error) {
      reportMutationError('특별기간을 등록하지 못했습니다. special_periods 테이블이 있는지 확인해 주세요.', result.error)
      return
    }
    await fetchAll()
    showToast('특별기간이 등록됐습니다')
  }

  const deleteSpecialPeriod = async (id: number) => {
    const result = await supabase.from('special_periods').delete().eq('id', id)
    if (result.error) {
      reportMutationError('특별기간을 삭제하지 못했습니다.', result.error)
      return
    }
    await fetchAll()
    showToast('특별기간이 삭제됐습니다')
  }

  return { createSpecialPeriod, deleteSpecialPeriod }
}

// ===============================================================
// 카드 구역선 (CardBoundary)
// ===============================================================
export function makeCardBoundaryMutations(deps: {
  fetchAll: () => Promise<void>
  cardBoundaries: CardBoundary[]
}) {
  const { fetchAll, cardBoundaries } = deps

  const saveCardBoundary = async (cardId: number, points: GeoPoint[]) => {
    if (points.length < 3) {
      showToast('카드 구역선은 최소 3개 점이 필요합니다.', 'error')
      return
    }
    const result = await supabase.from('card_boundaries').upsert(
      {
        card_id: cardId,
        points,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'card_id' },
    )
    if (result.error) {
      reportMutationError('카드 구역선을 저장하지 못했습니다. Supabase에 card_boundaries 테이블이 있는지 확인해 주세요.', result.error)
      return
    }
    await fetchAll()
    showToast('구역선이 저장됐습니다')
  }

  const deleteCardBoundary = async (cardId: number) => {
    // 삭제 전 현재 데이터 백업 (복구용)
    const originalBoundary = cardBoundaries.find((b) => b.cardId === cardId)
    const originalPoints = originalBoundary ? [...originalBoundary.points] : null

    const result = await supabase.from('card_boundaries').delete().eq('card_id', cardId)
    if (result.error) {
      reportMutationError('카드 구역선을 삭제하지 못했습니다.', result.error)
      return
    }
    await fetchAll()

    if (originalPoints) {
      showToast('구역선이 삭제됐습니다', 'info', {
        label: '삭제 취소',
        onClick: () => {
          saveCardBoundary(cardId, originalPoints)
        },
      })
    } else {
      showToast('구역선이 삭제됐습니다')
    }
  }

  return { saveCardBoundary, deleteCardBoundary }
}

// ===============================================================
// 검토 항목 (ReviewTask)
// ===============================================================
export function makeReviewTaskMutations(deps: {
  fetchAll: () => Promise<void>
  setReviewTasks: Dispatch<SetStateAction<ReviewTask[]>>
}) {
  const { fetchAll, setReviewTasks } = deps

  const createReviewTask = async (title: string, content: string, createdBy: string) => {
    const { error } = await supabase.from('review_tasks').insert({
      title,
      content: content || null,
      status: 'pending',
      created_by: createdBy,
    })
    if (error) { showToast('항목 추가에 실패했습니다.', 'error'); return }
    showToast('검토 항목이 추가됐습니다.', 'success')
    await fetchAll()
  }

  const completeReviewTask = async (id: number) => {
    const now = new Date().toISOString()
    const { error } = await supabase.from('review_tasks').update({ status: 'done', completed_at: now }).eq('id', id)
    if (error) { showToast('완료 처리에 실패했습니다.', 'error'); return }
    setReviewTasks((prev) => prev.map((t) => t.id === id ? { ...t, status: 'done' as const, completedAt: now } : t))
  }

  const uncompleteReviewTask = async (id: number) => {
    const { error } = await supabase.from('review_tasks').update({ status: 'pending', completed_at: null }).eq('id', id)
    if (error) { showToast('완료 취소에 실패했습니다.', 'error'); return }
    setReviewTasks((prev) => prev.map((t) => t.id === id ? { ...t, status: 'pending' as const, completedAt: null } : t))
  }

  const updateReviewTask = async (id: number, title: string, content: string) => {
    const { error } = await supabase.from('review_tasks').update({ title, content: content || null }).eq('id', id)
    if (error) { showToast('수정에 실패했습니다.', 'error'); return }
    showToast('항목이 수정됐습니다.', 'success')
    setReviewTasks((prev) => prev.map((t) => t.id === id ? { ...t, title, content } : t))
  }

  const deleteReviewTask = async (id: number) => {
    const { error } = await supabase.from('review_tasks').update({ status: 'deleted' }).eq('id', id)
    if (error) { showToast('삭제에 실패했습니다.', 'error'); return }
    setReviewTasks((prev) => prev.filter((t) => t.id !== id))
  }

  return {
    createReviewTask,
    completeReviewTask,
    uncompleteReviewTask,
    updateReviewTask,
    deleteReviewTask,
  }
}
