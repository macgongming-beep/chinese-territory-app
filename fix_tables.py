import re

with open('src/App.css', 'r') as f:
    css = f.read()

# Replace colors in card-table
css = re.sub(r'\.card-table\s*{[^}]*}', '.card-table { overflow-x: auto; border: 1px solid var(--line); border-radius: var(--radius-lg, 12px); background: var(--surface); }', css)
css = re.sub(r'\.card-table-head\s*{[^}]*}', '.card-table-head { min-height: 52px; padding: 0 20px; background: var(--tint); color: var(--muted); font-size: 12px; font-weight: 600; border-bottom: 1px solid var(--line); }', css)
css = re.sub(r'\.card-row\s*{([^}]*)}', lambda m: '.card-row {' + m.group(1).replace('border-top: 1px solid #e6e9ee;', 'border-top: 1px solid var(--line);') + '}', css)
css = re.sub(r'\.card-row:hover,\s*\.card-row\.selected\s*{[^}]*}', '.card-row:hover, .card-row.selected { background: var(--tint); }', css)
css = re.sub(r'\.card-row\s*\.card-name-link\s*{[^}]*}', '.card-row .card-name-link { font-size: 14px; font-weight: 700; color: var(--ink); text-decoration: none; }', css)
css = re.sub(r'\.card-row\s*\.card-name-link:hover\s*{[^}]*}', '.card-row .card-name-link:hover { text-decoration: underline; }', css)

# Replace colors in building-management-table
css = re.sub(r'\.building-management-table\s*{[^}]*}', '.building-management-table { overflow: visible; border: 1px solid var(--line); border-radius: var(--radius-lg, 12px); }', css)
css = re.sub(r'\.building-management-head\s*{[^}]*}', '.building-management-head { min-height: 52px; background: var(--tint); color: var(--muted); font-size: 12px; font-weight: 600; border-bottom: 1px solid var(--line); padding: 0 20px; }', css)
css = re.sub(r'\.building-management-row\s*{([^}]*)}', lambda m: '.building-management-row {' + m.group(1).replace('border-top: 1px solid #e6e9ee;', 'border-top: 1px solid var(--line);').replace('overflow: hidden;', '') + '}', css)
css = re.sub(r'\.building-management-row:hover\s*{[^}]*}', '.building-management-row:hover { background: var(--tint); }', css)
css = re.sub(r'\.building-name-link\s*{[^}]*}', '.building-name-link { font-size: 14px; font-weight: 700; color: var(--ink); text-decoration: none; }', css)
css = re.sub(r'\.building-name-link:hover\s*{[^}]*}', '.building-name-link:hover { text-decoration: underline; }', css)

# Replace colors in point-management-table
css = re.sub(r'\.point-management-table\s*{[^}]*}', '.point-management-table { overflow: visible; border: 1px solid var(--line); border-radius: var(--radius-lg, 12px); background: var(--surface); }', css)
css = re.sub(r'\.point-management-head\s*{[^}]*}', '.point-management-head { min-height: 52px; background: var(--tint); color: var(--muted); font-size: 12px; font-weight: 600; border-bottom: 1px solid var(--line); padding: 0 18px; }', css)
css = re.sub(r'\.point-management-row\s*{([^}]*)}', lambda m: '.point-management-row {' + m.group(1).replace('border-top: 1px solid #e6e9ee;', 'border-top: 1px solid var(--line);') + '}', css)
css = re.sub(r'\.point-management-row:hover\s*{[^}]*}', '.point-management-row:hover { background: var(--tint); }', css)
css = re.sub(r'\.point-management-row\.selected\s*{[^}]*}', '.point-management-row.selected { background: var(--tint); box-shadow: inset 3px 0 0 var(--ink); }', css)

with open('src/App.css', 'w') as f:
    f.write(css)

print("Tables updated")
