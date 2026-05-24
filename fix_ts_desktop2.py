with open('src/components/DesktopHome.tsx', 'r') as f:
    content = f.read()

content = content.replace("  onOpenCalendar,\n", "")
content = content.replace("  onOpenCalendar: () => void\n", "")

with open('src/components/DesktopHome.tsx', 'w') as f:
    f.write(content)
