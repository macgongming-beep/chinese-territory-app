import re

with open('src/App.css', 'r') as f:
    css = f.read()

css = re.sub(
    r'grid-template-columns:\s*34px minmax\(130px, 1\.5fr\) minmax\(200px, 2fr\) minmax\(150px, 1\.5fr\) minmax\(60px, 1fr\) 60px 70px 60px 60px minmax\(120px, 1fr\) 120px;',
    r'grid-template-columns: 34px minmax(130px, 1.5fr) minmax(200px, 2fr) minmax(150px, 1.5fr) minmax(60px, 1fr) 60px 70px 60px 120px;',
    css
)

css = re.sub(
    r'(\.building-management-head,\s*\.building-management-row\s*{[^}]*min-width:)\s*1150px;',
    r'\1 950px;',
    css
)

with open('src/App.css', 'w') as f:
    f.write(css)

print("Updated App.css")
