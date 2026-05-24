import re

# --- Fix AdminMobileHome.tsx ---
with open('src/components/admin/AdminMobileHome.tsx', 'r') as f:
    code = f.read()

code = code.replace(
    '''import { t, formatLeaderOf, formatJoined, formatPeriod, weekdayShortLabels } from '../../i18n' ''',
    '''import { t, formatPeriod } from '../../i18n' '''
)
code = code.replace(
    '''import { t, formatLeaderOf, formatJoined, formatPeriod, weekdayShortLabels } from '../../i18n' ''',
    '''import { t, formatPeriod } from '../../i18n''''
)
code = code.replace(
    '''import { t, formatLeaderOf, formatJoined, formatPeriod, weekdayShortLabels } from '../../i18n'
''',
    '''import { t, formatPeriod } from '../../i18n'
'''
)

code = re.sub(
    r'''import \{ t, formatLeaderOf, formatJoined, formatPeriod, weekdayShortLabels \} from '\.\./\.\./i18n'''',
    r"import { t, formatPeriod } from '../../i18n'",
    code
)

# Remove unused variables from AdminMobileHome props
code = re.sub(r'\s*onOpenNotices,\n', '\n', code)
code = re.sub(r'\s*weekDays,\n', '\n', code)
code = re.sub(r'\s*today,\n', '\n', code)
code = re.sub(r'\s*selectedWeekDate,\n', '\n', code)
code = re.sub(r'\s*selectedDateEvents,\n', '\n', code)
code = re.sub(r'\s*onSelectWeekDate,\n', '\n', code)

# Remove latestNotice
code = re.sub(r'\s*const latestNotice = [^\n]+\n', '\n', code)

with open('src/components/admin/AdminMobileHome.tsx', 'w') as f:
    f.write(code)

# --- Fix UserMobileHome.tsx ---
with open('src/components/UserMobileHome.tsx', 'r') as f:
    code = f.read()

code = re.sub(
    r'''import \{ t, formatPeriod, formatLeadSub, formatLeaderOf, formatApplied, formatJoined, weekdayShortLabels \} from '\.\./i18n'''',
    r"import { t, formatPeriod, formatLeadSub, formatLeaderOf, formatApplied } from '../i18n'",
    code
)

# Remove unused variables from UserMobileHome props
code = re.sub(r'\s*notices: Notice\[\]\n', '\n', code)
code = re.sub(r'\s*weekDays: Array<\{[^\n]+\n', '\n', code)
code = re.sub(r'\s*selectedDateEvents: CalendarEvent\[\]\n', '\n', code)
code = re.sub(r'\s*onSelectWeekDate: \([^\n]+\n', '\n', code)
code = re.sub(r'\s*onOpenNotices: \([^\n]+\n', '\n', code)

code = re.sub(r'\s*notices,\n', '\n', code)
code = re.sub(r'\s*weekDays,\n', '\n', code)
code = re.sub(r'\s*selectedDateEvents,\n', '\n', code)
code = re.sub(r'\s*onSelectWeekDate,\n', '\n', code)
code = re.sub(r'\s*onOpenNotices,\n', '\n', code)

# Remove activeDate and wdShort
code = re.sub(r'\s*const activeDate = selectedWeekDate \?\? today\n', '\n', code)
code = re.sub(r'\s*const wdShort = weekdayShortLabels\[language\]\n', '\n', code)

with open('src/components/UserMobileHome.tsx', 'w') as f:
    f.write(code)

