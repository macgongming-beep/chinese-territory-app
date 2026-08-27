import type { Notice } from '../../types'
import { supabase, showToast, reportMutationError } from './shared'
import { msg } from '../../lib/msg'
import { getAuthToken } from '../../lib/authToken'
import { askNotifyOnNotice } from '../../lib/askNotify'

export function makeNoticeMutations(deps: { fetchAll: () => Promise<void> }) {
  const { fetchAll } = deps

  const createNotice = async (input: {
    title: string
    content: string
    priority: Notice['priority']
    author: string
  }) => {
    // 여기서 묻는다 — PC·모바일 두 화면이 각자 물으면 한쪽만 고쳐져 갈라진다.
    // (이 앱에서 여러 번 그랬다) 공지는 회중 전원에게 가고 되돌릴 수 없다.
    const notify = await askNotifyOnNotice()

    const token = getAuthToken()
    if (token) {
      const rpc = await supabase.rpc('create_notice_tx', {
        p_token: token, p_title: input.title, p_content: input.content,
        p_priority: input.priority, p_notify: notify,
      })
      if (!rpc.error) {
        await fetchAll()
        showToast(msg('공지가 등록됐습니다'))
        return
      }
      console.warn('[createNotice] RPC 실패 — 레거시 경로', rpc.error)
    }

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
