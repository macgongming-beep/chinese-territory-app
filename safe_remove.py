import re

def modify_file(filepath, replacements):
    with open(filepath, 'r') as f:
        content = f.read()
    for target, repl in replacements:
        content = content.replace(target, repl)
    with open(filepath, 'w') as f:
        f.write(content)

# 1. UserMobileHome.tsx
user_home_replacements = [
    ("import { t, formatPeriod, formatLeadSub, formatLeaderOf, formatApplied, formatJoined, weekdayShortLabels } from '../i18n'", 
     "import { t, formatPeriod, formatLeadSub, formatLeaderOf, formatApplied } from '../i18n'"),
    ("  language,\n  notices,\n  myTodayEvents,\n  today,\n  selectedWeekDate,\n  weekDays,\n  selectedDateEvents,\n  leaderCards,\n  role,\n  onSelectWeekDate,\n  onOpenNotices,\n  onOpenCalendar,\n  onOpenEventDetail,\n  onOpenZone,", 
     "  language,\n  myTodayEvents,\n  leaderCards,\n  role,\n  onOpenCalendar,\n  onOpenEventDetail,\n  onOpenZone,"),
    ("  notices: Notice[]\n  myTodayEvents: Array<{ event: CalendarEvent; kind: 'lead' | 'join' | 'avail' }>\n  today: string\n  selectedWeekDate: string | null\n  weekDays: Array<{ date: Date; iso: string; hasEvent: boolean }>\n  selectedDateEvents: CalendarEvent[]\n  leaderCards: TerritoryCard[]\n  role: Role\n  onSelectWeekDate: (iso: string) => void\n  onOpenNotices: () => void\n  onOpenCalendar: () => void\n  onOpenEventDetail: (eventId: number) => void\n  onOpenZone: () => void", 
     "  myTodayEvents: Array<{ event: CalendarEvent; kind: 'lead' | 'join' | 'avail' }>\n  leaderCards: TerritoryCard[]\n  role: Role\n  onOpenCalendar: () => void\n  onOpenEventDetail: (eventId: number) => void\n  onOpenZone: () => void"),
    ("  const activeDate = selectedWeekDate ?? today\n  const wdShort = weekdayShortLabels[language]", ""),
    ("import type { Notice, TerritoryCard, CalendarEvent, Role } from '../types'", 
     "import type { TerritoryCard, CalendarEvent, Role } from '../types'")
]
modify_file('src/components/UserMobileHome.tsx', user_home_replacements)

# Remove the sections using regex for UserMobileHome
with open('src/components/UserMobileHome.tsx', 'r') as f:
    content = f.read()
content = re.sub(r'\s*\{\/\* ─── 공지 \(최상단\) ─── \*\/\}.*?\{\/\* ─── 오늘 봉사 — 디자인 24/25 ─── \*\/\}', '\n\n      {/* ─── 오늘 봉사 — 디자인 24/25 ─── */}', content, flags=re.DOTALL)
content = re.sub(r'\s*\{\/\* ─── 이번 주 일정 \(A안\) ─── \*\/\}.*?\{\/\* ─── 인도자 전용 — 담당 카드 진행 \(미니 카드 그리드\) ─── \*\/\}', '\n\n      {/* ─── 인도자 전용 — 담당 카드 진행 (미니 카드 그리드) ─── */}', content, flags=re.DOTALL)
with open('src/components/UserMobileHome.tsx', 'w') as f:
    f.write(content)

# 2. AdminMobileHome.tsx
admin_home_replacements = [
    ("import { t, formatLeaderOf, formatJoined, formatPeriod, weekdayShortLabels } from '../../i18n'", 
     "import { t, formatPeriod } from '../../i18n'"),
    ("  language,\n  notices,\n  todayEvents,\n  cards,\n  totalUnits,\n  completedUnits,\n  inProgressCount,\n  unassignedCount,\n  noticeReadCount,\n  onOpenNotices,\n  onOpenCalendar,\n  onOpenZone,\n  weekDays,\n  today,\n  selectedWeekDate,\n  selectedDateEvents,\n  onSelectWeekDate,\n  onOpenEventDetail,",
     "  language,\n  todayEvents,\n  cards,\n  totalUnits,\n  completedUnits,\n  inProgressCount,\n  unassignedCount,\n  onOpenCalendar,\n  onOpenZone,\n  onOpenEventDetail,"),
    ("  notices: Notice[]\n  todayEvents: CalendarEvent[]\n  cards: TerritoryCard[]\n  totalUnits: number\n  completedUnits: number\n  inProgressCount: number\n  unassignedCount: number\n  noticeReadCount?: { read: number; total: number } | null\n  onOpenNotices: () => void\n  onOpenCalendar: () => void\n  onOpenZone: () => void\n  // A안\n  weekDays: WeekDay[]\n  today: string\n  selectedWeekDate: string | null\n  selectedDateEvents: CalendarEvent[]\n  onSelectWeekDate: (date: string) => void\n  onOpenEventDetail: (eventId: number) => void",
     "  todayEvents: CalendarEvent[]\n  cards: TerritoryCard[]\n  totalUnits: number\n  completedUnits: number\n  inProgressCount: number\n  unassignedCount: number\n  onOpenCalendar: () => void\n  onOpenZone: () => void\n  onOpenEventDetail: (eventId: number) => void"),
    ("  const latestNotice = notices.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null", ""),
    ("import type { CalendarEvent, Notice, TerritoryCard } from '../../types'", 
     "import type { CalendarEvent, TerritoryCard } from '../../types'"),
    ("type WeekDay = { date: Date; iso: string; hasEvent: boolean }\n\n", "")
]
modify_file('src/components/admin/AdminMobileHome.tsx', admin_home_replacements)

# Remove the sections using regex for AdminMobileHome
with open('src/components/admin/AdminMobileHome.tsx', 'r') as f:
    content = f.read()
content = re.sub(r'\s*\{\/\* ── 공지 ────────────────────────── \*\/\}.*?\{\/\* ── 오늘의 봉사 ──────────────────── \*\/\}', '\n\n      {/* ── 오늘의 봉사 ──────────────────── */}', content, flags=re.DOTALL)
content = re.sub(r'\s*\{\/\* ── 이번 주 일정 \(A안\) ────────────── \*\/\}.*?\{\/\* ── 운영 현황 ────────────────────── \*\/\}', '\n\n      {/* ── 운영 현황 ────────────────────── */}', content, flags=re.DOTALL)
with open('src/components/admin/AdminMobileHome.tsx', 'w') as f:
    f.write(content)

# 3. DesktopHome.tsx
with open('src/components/DesktopHome.tsx', 'r') as f:
    content = f.read()

# Remove unused props in DesktopHome
content = re.sub(r'\s*notices: Notice\[\]', '', content)
content = re.sub(r'\s*onOpenNotices: \(\) => void', '', content)
content = re.sub(r'\s*notices,', '', content)
content = re.sub(r'\s*onOpenNotices,', '', content)

content = re.sub(r'\s*const \[selectedWeekDate, setSelectedWeekDate\] = useState<string \| null>\(null\)\n', '\n', content)
content = re.sub(r'\s*const weekDays = useMemo\(\(\) => \{.*?\}, \[calendarEvents, today\]\)\n', '\n', content, flags=re.DOTALL)
content = re.sub(r'\s*const selectedDateEvents = useMemo\(\(\) => \{.*?\}, \[calendarEvents, selectedWeekDate, today\]\)\n', '\n', content, flags=re.DOTALL)

# Remove props from UserMobileHome and AdminMobileHome calls
content = re.sub(r'\s*notices=\{notices\}', '', content)
content = re.sub(r'\s*onOpenNotices=\{onOpenNotices\}', '', content)
content = re.sub(r'\s*weekDays=\{weekDays\}', '', content)
content = re.sub(r'\s*today=\{today\}', '', content)
content = re.sub(r'\s*selectedWeekDate=\{selectedWeekDate\}', '', content)
content = re.sub(r'\s*selectedDateEvents=\{selectedDateEvents\}', '', content)
content = re.sub(r'\s*onSelectWeekDate=\{setSelectedWeekDate\}', '', content)

with open('src/components/DesktopHome.tsx', 'w') as f:
    f.write(content)

# 4. MobileHome.tsx
with open('src/components/MobileHome.tsx', 'r') as f:
    content = f.read()

content = re.sub(r'\s*const \[selectedWeekDate, setSelectedWeekDate\] = useState<string \| null>\(null\)\n', '\n', content)
content = re.sub(r'\s*const weekDays = useMemo\(\(\) => \{.*?\}, \[calendarEvents, today\]\)\n', '\n', content, flags=re.DOTALL)
content = re.sub(r'\s*const selectedDateEvents = useMemo\(\(\) => \{.*?\}, \[calendarEvents, selectedWeekDate, today\]\)\n', '\n', content, flags=re.DOTALL)

# Remove props from UserMobileHome and AdminMobileHome calls ONLY (not MobileNotices!)
content = re.sub(r'(<AdminMobileHome.*?)notices=\{notices\}(.*?\/>)', r'\1\2', content, flags=re.DOTALL)
content = re.sub(r'(<(?:UserMobileHome|AdminMobileHome).*?)onOpenNotices=\{[^\}]+\}(.*?\/>)', r'\1\2', content, flags=re.DOTALL)
content = re.sub(r'(<(?:UserMobileHome|AdminMobileHome).*?)weekDays=\{weekDays\}(.*?\/>)', r'\1\2', content, flags=re.DOTALL)
content = re.sub(r'(<(?:UserMobileHome|AdminMobileHome).*?)today=\{today\}(.*?\/>)', r'\1\2', content, flags=re.DOTALL)
content = re.sub(r'(<(?:UserMobileHome|AdminMobileHome).*?)selectedWeekDate=\{selectedWeekDate\}(.*?\/>)', r'\1\2', content, flags=re.DOTALL)
content = re.sub(r'(<(?:UserMobileHome|AdminMobileHome).*?)selectedDateEvents=\{selectedDateEvents\}(.*?\/>)', r'\1\2', content, flags=re.DOTALL)
content = re.sub(r'(<(?:UserMobileHome|AdminMobileHome).*?)onSelectWeekDate=\{setSelectedWeekDate\}(.*?\/>)', r'\1\2', content, flags=re.DOTALL)
content = re.sub(r'(<UserMobileHome.*?)notices=\{notices\}(.*?\/>)', r'\1\2', content, flags=re.DOTALL)

with open('src/components/MobileHome.tsx', 'w') as f:
    f.write(content)

print("done")
