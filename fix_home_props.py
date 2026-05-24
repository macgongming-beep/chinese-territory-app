import re

def fix_file(filename):
    with open(filename, 'r') as f:
        code = f.read()

    code = re.sub(r'\s*notices=\{notices\}\n', '\n', code)
    code = re.sub(r'\s*onOpenNotices=\{[^\n]+\n', '\n', code)
    code = re.sub(r'\s*weekDays=\{weekDays\}\n', '\n', code)
    code = re.sub(r'\s*today=\{today\}\n', '\n', code)
    code = re.sub(r'\s*selectedWeekDate=\{selectedWeekDate\}\n', '\n', code)
    code = re.sub(r'\s*selectedDateEvents=\{selectedDateEvents\}\n', '\n', code)
    code = re.sub(r'\s*onSelectWeekDate=\{[^\n]+\n', '\n', code)

    with open(filename, 'w') as f:
        f.write(code)

fix_file('src/components/DesktopHome.tsx')
fix_file('src/components/MobileHome.tsx')
