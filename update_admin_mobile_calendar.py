with open('src/components/admin/AdminMobileCalendar.tsx', 'r') as f:
    content = f.read()

content = content.replace(
    "  onApplyToEvent?: (eventId: number, userName: string, isJoining: boolean) => void\n  specialPeriods?: SpecialPeriod[]\n}",
    "  onApplyToEvent?: (eventId: number, userName: string, isJoining: boolean) => void\n  specialPeriods?: SpecialPeriod[]\n  globalSettings?: Record<string, string>\n}"
)

content = content.replace(
    "  specialPeriods = [],\n}: AdminMobileCalendarProps)",
    "  specialPeriods = [],\n  globalSettings = {},\n}: AdminMobileCalendarProps)"
)

# Render AdminEventDetailSheet
content = content.replace(
    "            specialPeriods={specialPeriods}",
    "            specialPeriods={specialPeriods}\n            globalSettings={globalSettings}"
)

with open('src/components/admin/AdminMobileCalendar.tsx', 'w') as f:
    f.write(content)
