import re

with open('src/App.css', 'r') as f:
    css = f.read()

css = css.replace(
'''  .building-row-actions button { padding: 5px 12px; background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius-md, 8px); color: var(--text); font-size: 13px; font-weight: 600; cursor: pointer; transition: background 0.15s; }
  .building-row-actions button:hover { background: var(--tint); color: var(--ink); }''',
'''  .building-row-actions button { padding: 4px 10px; background: transparent; border: 1px solid var(--line); border-radius: 6px; color: var(--gray-600); font-size: 12px; font-weight: 500; cursor: pointer; transition: all 0.2s ease; }
  .building-row-actions button:hover { background: var(--gray-100); color: var(--ink); border-color: var(--gray-300); }'''
)

with open('src/App.css', 'w') as f:
    f.write(css)

print("App.css fixed")
