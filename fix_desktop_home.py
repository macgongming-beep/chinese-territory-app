import re

with open('src/components/DesktopHome.tsx', 'r') as f:
    code = f.read()

# Remove unused props in DesktopHome
code = re.sub(r'\s*notices: Notice\[\]\n', '\n', code)
code = re.sub(r'\s*onOpenNotices: \(\) => void\n', '\n', code)
code = re.sub(r'\s*notices,\n', '\n', code)
code = re.sub(r'\s*onOpenNotices,\n', '\n', code)

code = re.sub(r'\s*const \[selectedWeekDate, setSelectedWeekDate\] = useState<string \| null>\(null\)\n', '\n', code)
code = re.sub(r'\s*const weekDays = [^\n]+\n', '\n', code)
code = re.sub(r'\s*const selectedDateEvents = [^\n]+\n', '\n', code)

with open('src/components/DesktopHome.tsx', 'w') as f:
    f.write(code)

print("DesktopHome.tsx fixed")
