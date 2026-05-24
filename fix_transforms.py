with open('src/hooks/storeTransforms.ts', 'r') as f:
    content = f.read()

content = content.replace(
    """export function toServiceSuggestion(row: any): ServiceSuggestion {
  return {
    id: row.id,
    week_start_date: row.week_start_date,
    is_visible: row.is_visible ?? true,
    view_mode: row.view_mode,
    content: row.content || []
  }
}""",
    """export function toServiceSuggestion(row: any): ServiceSuggestion {
  return {
    id: row.id,
    title: row.title || '',
    show_title_on_home: row.show_title_on_home ?? false,
    start_date: row.start_date,
    end_date: row.end_date,
    is_visible: row.is_visible ?? true,
    view_mode: row.view_mode,
    content: row.content || []
  }
}"""
)

with open('src/hooks/storeTransforms.ts', 'w') as f:
    f.write(content)

