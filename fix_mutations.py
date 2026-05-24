with open('src/hooks/storeMutations/serviceSuggestions.ts', 'r') as f:
    content = f.read()

content = content.replace(
    """export async function saveServiceSuggestion(input: {
  id?: number
  week_start_date: string
  is_visible: boolean
  view_mode: 'carousel' | 'list'
  content: SuggestionBlock[]
}) {""",
    """export async function saveServiceSuggestion(input: {
  id?: number
  title: string
  show_title_on_home: boolean
  start_date: string
  end_date: string
  is_visible: boolean
  view_mode: 'carousel' | 'list'
  content: SuggestionBlock[]
}) {"""
)

content = content.replace(
    """  const payload = {
    week_start_date: input.week_start_date,
    is_visible: input.is_visible,
    view_mode: input.view_mode,
    content: input.content
  }""",
    """  const payload = {
    title: input.title,
    show_title_on_home: input.show_title_on_home,
    start_date: input.start_date,
    end_date: input.end_date,
    is_visible: input.is_visible,
    view_mode: input.view_mode,
    content: input.content
  }"""
)

with open('src/hooks/storeMutations/serviceSuggestions.ts', 'w') as f:
    f.write(content)
