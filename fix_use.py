with open('src/hooks/useServiceSuggestions.ts', 'r') as f:
    content = f.read()

content = content.replace(
    ".order('week_start_date', { ascending: false })",
    ".order('start_date', { ascending: false })"
)

with open('src/hooks/useServiceSuggestions.ts', 'w') as f:
    f.write(content)
