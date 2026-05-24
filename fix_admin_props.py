import re

with open('src/components/admin/AdminMobileHome.tsx', 'r') as f:
    code = f.read()

code = re.sub(r'\s*notices: Notice\[\]\n', '\n', code)
code = re.sub(r'\s*noticeReadCount\?: \{ read: number; total: number \} \| null\n', '\n', code)
code = re.sub(r'\s*onOpenNotices: \(\) => void\n', '\n', code)
code = re.sub(r'\s*// A안\n', '\n', code)
code = re.sub(r'\s*weekDays: WeekDay\[\]\n', '\n', code)
code = re.sub(r'\s*today: string\n', '\n', code)
code = re.sub(r'\s*selectedWeekDate: string \| null\n', '\n', code)
code = re.sub(r'\s*selectedDateEvents: CalendarEvent\[\]\n', '\n', code)
code = re.sub(r'\s*onSelectWeekDate: \(date: string\) => void\n', '\n', code)

with open('src/components/admin/AdminMobileHome.tsx', 'w') as f:
    f.write(code)

print("AdminMobileHome.tsx props fixed")
