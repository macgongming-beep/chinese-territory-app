import { supabase } from '../../lib/supabase'
import type { SuggestionBlock } from '../../types'
import { sanitizeRichText } from '../../lib/richText'

// 자유양식 본문의 리치텍스트를 저장 전 정제 (XSS 방지 + 클린 저장)
function sanitizeContent(content: SuggestionBlock[]): SuggestionBlock[] {
  return content.map((block) =>
    block.format === 'free_text'
      ? { ...block, body: sanitizeRichText(block.body) }
      : block,
  )
}

export async function saveServiceSuggestion(input: {
  id?: number
  title: string
  show_title_on_home: boolean
  tags: string[]
  is_visible: boolean
  content: SuggestionBlock[]
}) {
  const payload: Record<string, unknown> = {
    title: input.title,
    show_title_on_home: input.show_title_on_home,
    tags: input.tags,
    is_visible: input.is_visible,
    content: sanitizeContent(input.content),
  }
  if (input.is_visible) {
    // If we are turning it on, update last_used_at
    payload.last_used_at = new Date().toISOString()
  }

  if (input.id) {
    const { error } = await supabase.from('service_suggestions').update(payload).eq('id', input.id)
    if (error) throw error
  } else {
    const { error } = await supabase.from('service_suggestions').insert(payload)
    if (error) throw error
  }
}

export async function deleteServiceSuggestion(id: number) {
  const { error } = await supabase.from('service_suggestions').delete().eq('id', id)
  if (error) throw error
}
