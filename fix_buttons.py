import re

with open('src/App.css', 'r') as f:
    css = f.read()

# Fix .building-name-link
css = re.sub(
    r'\.building-management-row \.building-name-link\s*{[^}]*}',
    r'.building-management-row .building-name-link { background: transparent; border: none; padding: 0; text-align: left; font-size: 14px; font-weight: 700; color: var(--ink); text-decoration: none; cursor: pointer; }',
    css
)

css = re.sub(
    r'\.building-row-actions\s*{[^}]*}',
    r'.building-row-actions { display: flex; justify-content: flex-start; gap: 6px; }',
    css
)

css = re.sub(
    r'\.building-row-actions button\s*{[^}]*}',
    r'.building-row-actions button { padding: 5px 12px; background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius-md, 8px); color: var(--text); font-size: 13px; font-weight: 600; cursor: pointer; transition: background 0.15s; }\n  .building-row-actions button:hover { background: var(--tint); color: var(--ink); }',
    css
)

# Fix .tbl-soft-btn to match the new vibe
css = re.sub(
    r'\.tbl-soft-btn\s*{[^}]*}',
    r'.tbl-soft-btn { padding: 5px 12px; background: var(--tint); border: 1px solid var(--line); border-radius: var(--radius-md, 8px); color: var(--ink); font-size: 13px; font-weight: 600; cursor: pointer; transition: background 0.15s; }',
    css
)
css = re.sub(
    r'\.tbl-soft-btn:hover:not\(:disabled\)\s*{[^}]*}',
    r'.tbl-soft-btn:hover:not(:disabled) { background: var(--line); }',
    css
)

with open('src/App.css', 'w') as f:
    f.write(css)

print("Buttons fixed")
