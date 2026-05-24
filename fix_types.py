import re

with open('src/types.ts', 'r') as f:
    content = f.read()

content = content.replace(
    """export interface ServiceSuggestion {
  id: number
  week_start_date: string // YYYY-MM-DD
  is_visible: boolean
  view_mode: 'carousel' | 'list'
  content: SuggestionBlock[]
}""",
    """export interface ServiceSuggestion {
  id: number
  title: string
  show_title_on_home: boolean
  start_date: string // YYYY-MM-DD
  end_date: string // YYYY-MM-DD
  is_visible: boolean
  view_mode: 'carousel' | 'list'
  content: SuggestionBlock[]
}"""
)

with open('src/types.ts', 'w') as f:
    f.write(content)

