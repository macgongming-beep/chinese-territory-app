import re

with open('src/App.css', 'r') as f:
    css = f.read()

# Add width: 100% to tables if not present
def add_width_100(table_class, css_str):
    pattern = r'(\.' + table_class + r'\s*{)([^}]*)}'
    def repl(m):
        content = m.group(2)
        if 'width: 100%;' not in content:
            return m.group(1) + ' width: 100%;' + content + '}'
        return m.group(0)
    return re.sub(pattern, repl, css_str)

css = add_width_100('card-table', css)
css = add_width_100('building-management-table', css)
css = add_width_100('point-management-table', css)

# Make sure desk-card has min-width: 0 so it can shrink
css = re.sub(r'(\.desk-card\s*{)', r'\1 min-width: 0;', css)

with open('src/App.css', 'w') as f:
    f.write(css)

print("Width added")
