import re

with open('src/hooks/storeTransforms.ts', 'r') as f:
    content = f.read()

content = content.replace(
    """export function toServiceSuggestion(row: any): import('../types').ServiceSuggestion {
  return {
    id: row.id,
    title: row.title || '',
    show_title_on_home: row.show_title_on_home ?? false,
    start_date: row.start_date,
    end_date: row.end_date,
    is_visible: row.is_visible ?? true,
    view_mode: row.view_mode,
    content: row.content || [],
    created_at: row.created_at,
  }
}""",
    """export function toServiceSuggestion(row: any): import('../types').ServiceSuggestion {
  return {
    id: row.id,
    title: row.title || '',
    show_title_on_home: row.show_title_on_home ?? false,
    tags: row.tags || [],
    last_used_at: row.last_used_at,
    is_visible: row.is_visible ?? false,
    content: row.content || [],
    created_at: row.created_at,
  }
}"""
)

with open('src/hooks/storeTransforms.ts', 'w') as f:
    f.write(content)

