with open('src/components/admin/AdminSuggestions.tsx', 'r') as f:
    content = f.read()

content = content.replace("await refresh()", "await fetchSuggestions()")

with open('src/components/admin/AdminSuggestions.tsx', 'w') as f:
    f.write(content)
