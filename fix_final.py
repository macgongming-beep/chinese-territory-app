import re

with open('src/components/admin/AdminMobileHome.tsx', 'r') as f:
    code = f.read()

code = re.sub(r'\s*notices,\n', '\n', code)
code = re.sub(r'\s*onOpenNotices,\n', '\n', code)
code = re.sub(r'\s*weekDays,\n', '\n', code)
code = re.sub(r'\s*today,\n', '\n', code)
code = re.sub(r'\s*selectedWeekDate,\n', '\n', code)
code = re.sub(r'\s*selectedDateEvents,\n', '\n', code)
code = re.sub(r'\s*onSelectWeekDate,\n', '\n', code)

with open('src/components/admin/AdminMobileHome.tsx', 'w') as f:
    f.write(code)


with open('src/components/DesktopHome.tsx', 'r') as f:
    code = f.read()

code = re.sub(r'\s*import \{ useState[^\n]*\n', '\n', code)
code = re.sub(r'\s*import type \{ Notice[^\n]*\n', '\nimport type { TerritoryCard, CalendarEvent, Role, PeriodConfig } from \'../types\'\n', code)

with open('src/components/DesktopHome.tsx', 'w') as f:
    f.write(code)

print("done")
