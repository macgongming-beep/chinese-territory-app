import re

with open('src/hooks/storeMutations/serviceSuggestions.ts', 'r') as f:
    content = f.read()

content = content.replace(
    """export async function saveServiceSuggestion(input: {
  id?: number
  title: string
  show_title_on_home: boolean
  start_date: string
  end_date: string
  is_visible: boolean
  view_mode: 'carousel' | 'list'
  content: SuggestionBlock[]
}) {""",
    """export async function saveServiceSuggestion(input: {
  id?: number
  title: string
  show_title_on_home: boolean
  tags: string[]
  is_visible: boolean
  content: SuggestionBlock[]
}) {"""
)

content = content.replace(
    """  const payload = {
    title: input.title,
    show_title_on_home: input.show_title_on_home,
    start_date: input.start_date,
    end_date: input.end_date,
    is_visible: input.is_visible,
    view_mode: input.view_mode,
    content: input.content,
  }""",
    """  const payload: any = {
    title: input.title,
    show_title_on_home: input.show_title_on_home,
    tags: input.tags,
    is_visible: input.is_visible,
    content: input.content,
  }
  if (input.is_visible) {
    // If we are turning it on, update last_used_at
    payload.last_used_at = new Date().toISOString()
  }"""
)

with open('src/hooks/storeMutations/serviceSuggestions.ts', 'w') as f:
    f.write(content)

