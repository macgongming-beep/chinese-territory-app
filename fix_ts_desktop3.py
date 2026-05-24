with open('src/components/DesktopApp.tsx', 'r') as f:
    content = f.read()

content = content.replace("            onOpenCalendar={() => setCurrentPage('캘린더')}\n", "")

with open('src/components/DesktopApp.tsx', 'w') as f:
    f.write(content)
