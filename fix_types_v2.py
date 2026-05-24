import re

with open('src/types.ts', 'r') as f:
    content = f.read()

# Remove badge from SuggestionBlock
content = re.sub(r'badge: string\s*\n', '', content)

content = content.replace(
    """export interface ServiceSuggestion {
  id: number
  title: string
  show_title_on_home: boolean
  start_date: string // YYYY-MM-DD
  end_date: string // YYYY-MM-DD
  is_visible: boolean
  view_mode: 'carousel' | 'list'
  content: SuggestionBlock[]
  created_at?: string
}""",
    """export interface ServiceSuggestion {
  id: number
  title: string
  show_title_on_home: boolean
  tags: string[]
  last_used_at?: string | null
  is_visible: boolean
  content: SuggestionBlock[]
  created_at?: string
}"""
)

with open('src/types.ts', 'w') as f:
    f.write(content)

