import type { Notice } from '../../types'
import { supabase, showToast, reportMutationError } from './shared'
import { msg } from '../../lib/msg'

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
      reportMutationError(msg('공지를 등록하지 못했습니다. notices 테이블이 있는지 확인해 주세요.'), result.error)
      return
    }
    await fetchAll()
    showToast(msg('공지가 등록됐습니다'))
  }

  const deleteNotice = async (id: number) => {
    const result = await supabase.from('notices').delete().eq('id', id)
    if (result.error) {
      reportMutationError(msg('공지를 삭제하지 못했습니다.'), result.error)
      return
    }
    await fetchAll()
    showToast(msg('공지가 삭제됐습니다'))
  }

  return { createNotice, deleteNotice }
}
