import re

with open('src/components/InformalCardsTab.tsx', 'r') as f:
    code = f.read()

# Replace hard-coded colors with DESIGN.md variables
code = code.replace("color: '#94a3b8'", "color: 'var(--muted)'")
code = code.replace("color: '#64748b'", "color: 'var(--muted)'")
code = code.replace("color: '#475569'", "color: 'var(--text)'")
code = code.replace("color: '#1e293b'", "color: 'var(--ink)'")
code = code.replace("border: '1px solid #e5e7eb'", "border: '1px solid var(--line)'")
code = code.replace("border: '1px solid #d8dbe0'", "border: '1px solid var(--line)'")
code = code.replace("border: '1px solid #e2e8f0'", "border: '1px solid var(--line)'")
code = code.replace("borderBottom: '1px solid #f1f5f9'", "borderBottom: '1px solid var(--line)'")
code = code.replace("borderBottom: '1px solid #e2e8f0'", "borderBottom: '1px solid var(--line)'")
code = code.replace("background: '#fafafa'", "background: 'var(--surface)'")
code = code.replace("background: '#fff'", "background: 'var(--surface)'")
code = code.replace("background: '#f1f5f9'", "background: 'var(--tint)'")
code = code.replace("background: '#7c3aed'", "background: 'var(--ink)'")
code = code.replace("color: '#7c3aed'", "color: 'var(--ink)'")
code = code.replace("background: '#dc2626'", "background: 'var(--status-danger)'")

with open('src/components/InformalCardsTab.tsx', 'w') as f:
    f.write(code)

print("Informal colors updated")
