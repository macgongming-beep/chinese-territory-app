import re

# Fix DesktopApp.tsx
with open('src/components/DesktopApp.tsx', 'r') as f:
    code = f.read()

code = re.sub(r'\s*notices=\{notices\}\n', '\n', code)
code = re.sub(r'\s*onOpenNotices=\{[^\n]+\n', '\n', code)

with open('src/components/DesktopApp.tsx', 'w') as f:
    f.write(code)

# Fix DesktopHome.tsx imports
with open('src/components/DesktopHome.tsx', 'r') as f:
    code = f.read()

code = re.sub(r'import \{ useState, useMemo \} from \'react\'', 'import { useMemo } from \'react\'', code)
code = re.sub(r'import type \{ TerritoryCard, CalendarEvent, Role, PeriodConfig, Notice \} from \'../types\'', 'import type { TerritoryCard, CalendarEvent, Role, PeriodConfig } from \'../types\'', code)

with open('src/components/DesktopHome.tsx', 'w') as f:
    f.write(code)

print("done")
