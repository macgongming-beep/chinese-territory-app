import re

with open('src/App.css', 'r') as f:
    css = f.read()

css = re.sub(r'\.building-management-table\s*{[^}]*}', '.building-management-table { overflow-x: auto; border: 1px solid var(--line); border-radius: var(--radius-lg, 12px); }', css)

# add min-width: 1150px to .building-management-head, .building-management-row
css = re.sub(
    r'(\.building-management-head,\s*\.building-management-row\s*{[^}]*grid-template-columns:[^;]+;\n)',
    r'\1    min-width: 1150px;\n',
    css
)

css = re.sub(r'\.point-management-table\s*{[^}]*}', '.point-management-table { overflow-x: auto; border: 1px solid var(--line); border-radius: var(--radius-lg, 12px); background: var(--surface); }', css)

# add min-width: 1000px to .point-management-head, .point-management-row
css = re.sub(
    r'(\.point-management-head,\s*\.point-management-row\s*{[^}]*grid-template-columns:[^;]+;\n)',
    r'\1    min-width: 1000px;\n',
    css
)

with open('src/App.css', 'w') as f:
    f.write(css)

print("Table scroll fixed")
