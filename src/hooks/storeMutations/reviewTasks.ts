import type { Dispatch, SetStateAction } from 'react'
import type { ReviewTask } from '../../types'
import { supabase, showToast } from './shared'
import { msg } from '../../lib/msg'

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
    if (error) { showToast(msg('항목 추가에 실패했습니다.'), 'error'); return }
    showToast(msg('검토 항목이 추가됐습니다.'), 'success')
    await fetchAll()
  }

  const completeReviewTask = async (id: number) => {
    const now = new Date().toISOString()
    const { error } = await supabase.from('review_tasks').update({ status: 'done', completed_at: now }).eq('id', id)
    if (error) { showToast(msg('완료 처리에 실패했습니다.'), 'error'); return }
    setReviewTasks((prev) => prev.map((t) => t.id === id ? { ...t, status: 'done' as const, completedAt: now } : t))
  }

  const uncompleteReviewTask = async (id: number) => {
    const { error } = await supabase.from('review_tasks').update({ status: 'pending', completed_at: null }).eq('id', id)
    if (error) { showToast(msg('완료 취소에 실패했습니다.'), 'error'); return }
    setReviewTasks((prev) => prev.map((t) => t.id === id ? { ...t, status: 'pending' as const, completedAt: null } : t))
  }

  const updateReviewTask = async (id: number, title: string, content: string) => {
    const { error } = await supabase.from('review_tasks').update({ title, content: content || null }).eq('id', id)
    if (error) { showToast(msg('수정에 실패했습니다.'), 'error'); return }
    showToast(msg('항목이 수정됐습니다.'), 'success')
    setReviewTasks((prev) => prev.map((t) => t.id === id ? { ...t, title, content } : t))
  }

  const deleteReviewTask = async (id: number) => {
    const { error } = await supabase.from('review_tasks').update({ status: 'deleted' }).eq('id', id)
    if (error) { showToast(msg('삭제에 실패했습니다.'), 'error'); return }
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
