import re

with open('src/App.css', 'r') as f:
    css = f.read()

# Make sure territory-main and any grid items can shrink
css = re.sub(
    r'(\.territory-main,\s*\.territory-side\s*{)',
    r'\1 min-width: 0; max-width: 100%;',
    css
)

css = re.sub(
    r'(\.desk-card\s*{)',
    r'\1 min-width: 0; max-width: 100%;',
    css
)

# Also ensure .card-table and related tables don't exceed 100% width
css = re.sub(r'(\.card-table\s*{[^}]*)}', r'\1 max-width: 100%; }', css)
css = re.sub(r'(\.building-management-table\s*{[^}]*)}', r'\1 max-width: 100%; }', css)
css = re.sub(r'(\.point-management-table\s*{[^}]*)}', r'\1 max-width: 100%; }', css)

with open('src/App.css', 'w') as f:
    f.write(css)

print("Layout overflow safeguards added")
