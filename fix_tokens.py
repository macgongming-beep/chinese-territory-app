import re

with open('src/App.css', 'r') as f:
    css = f.read()

# Fix .desk-kpi
css = re.sub(r'\.desk-kpi\s*{[^}]*}', '.desk-kpi { background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius-lg, 12px); box-shadow: var(--shadow-xs); padding: 18px 20px; }', css)
css = re.sub(r'\.desk-kpi__num\s*{[^}]*}', '.desk-kpi__num { font-size: 32px; font-weight: 700; letter-spacing: -0.03em; color: var(--ink); line-height: 1; }', css)
css = re.sub(r'\.desk-kpi__label\s*{[^}]*}', '.desk-kpi__label { font-size: 12px; color: var(--muted); margin-top: 6px; }', css)
css = re.sub(r'\.desk-kpi__delta\s*{[^}]*}', '.desk-kpi__delta { font-size: 11px; color: var(--status-ok); margin-top: 4px; }', css)

# Fix .tbl-seg-tab
css = re.sub(r'\.tbl-seg-tab\s*{([^}]*)}', lambda m: '.tbl-seg-tab {' + m.group(1).replace('background: #f1f5f9', 'background: var(--tint)').replace('border: 1px solid #e2e8f0', 'border: 1px solid var(--line)') + '}', css)
css = re.sub(r'\.tbl-seg-tab button\s*{([^}]*)}', lambda m: '.tbl-seg-tab button {' + m.group(1).replace('color: #64748b', 'color: var(--muted)') + '}', css)
css = re.sub(r'\.tbl-seg-tab button:hover\s*{([^}]*)}', lambda m: '.tbl-seg-tab button:hover {' + m.group(1).replace('color: #1e293b', 'color: var(--text)') + '}', css)
css = re.sub(r'\.tbl-seg-tab button\.active\s*{([^}]*)}', lambda m: '.tbl-seg-tab button.active {' + m.group(1).replace('background: #fff', 'background: var(--surface)').replace('color: #0f172a', 'color: var(--ink)').replace('box-shadow: 0 1px 3px rgba(0,0,0,0.06)', 'box-shadow: var(--shadow-xs)') + '}', css)

# Fix .tbl-chip
css = re.sub(r'\.tbl-chip\s*{([^}]*)}', lambda m: '.tbl-chip {' + m.group(1).replace('background: #fff', 'background: var(--surface)').replace('border: 1px solid #d8dde3', 'border: 1px solid var(--line)').replace('color: #4b5563', 'color: var(--text)') + '}', css)
css = re.sub(r'\.tbl-chip:hover\s*{[^}]*}', '.tbl-chip:hover { background: var(--tint); }', css)
css = re.sub(r'\.tbl-chip\.active\s*{([^}]*)}', lambda m: '.tbl-chip.active {' + m.group(1).replace('background: var(--brand-50)', 'background: var(--ink)').replace('border-color: var(--brand-300)', 'border-color: var(--ink)').replace('color: var(--brand-700)', 'color: #fff') + '}', css)
css = re.sub(r'\.tbl-chip__count\s*{([^}]*)}', lambda m: '.tbl-chip__count {' + m.group(1).replace('background: #f1f5f9', 'background: var(--tint)').replace('color: #64748b', 'color: var(--muted)') + '}', css)
css = re.sub(r'\.tbl-chip\.active \.tbl-chip__count\s*{([^}]*)}', lambda m: '.tbl-chip.active .tbl-chip__count {' + m.group(1).replace('background: #fff', 'background: rgba(255,255,255,0.2)').replace('color: var(--brand-700)', 'color: #fff') + '}', css)

# Fix .tbl-ghost-btn
css = re.sub(r'\.tbl-ghost-btn\s*{([^}]*)}', lambda m: '.tbl-ghost-btn {' + m.group(1).replace('color: #475569', 'color: var(--text)').replace('background: transparent', 'background: transparent') + '}', css)
css = re.sub(r'\.tbl-ghost-btn:hover:not\(:disabled\)\s*{([^}]*)}', lambda m: '.tbl-ghost-btn:hover:not(:disabled) {' + m.group(1).replace('background: var(--bg-muted)', 'background: var(--tint)') + '}', css)

# Fix .tbl-primary-btn
css = re.sub(r'\.tbl-primary-btn\s*{([^}]*)}', lambda m: '.tbl-primary-btn {' + m.group(1).replace('background: var(--brand-700)', 'background: var(--ink)').replace('color: #fff', 'color: #fff') + '}', css)
css = re.sub(r'\.tbl-primary-btn:hover\s*{([^}]*)}', lambda m: '.tbl-primary-btn:hover {' + m.group(1).replace('background: var(--ink-900)', 'background: var(--text)') + '}', css)

with open('src/App.css', 'w') as f:
    f.write(css)

print("Tokens updated")
