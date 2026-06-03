import { supabase } from '../../lib/supabase'
import type { SuggestionBlock } from '../../types'

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
    content: input.content,
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
