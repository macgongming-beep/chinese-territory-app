import re

# 1. DesktopApp.tsx
with open('src/components/DesktopApp.tsx', 'r') as f:
    content = f.read()

# Fix interface export type DesktopAppProps
content = content.replace(
    "  onRejectRestaurantRequest?: (requestId: number, reviewer: string) => Promise<void>\n}",
    "  onRejectRestaurantRequest?: (requestId: number, reviewer: string) => Promise<void>\n  globalSettings?: Record<string, string>\n}"
)

# Wait, the interface might not have been matched if it's named something else. Let's see.
# Ah, in DesktopApp.tsx, it might be `export type DesktopAppProps = {`
# The error says `{ language: AppLanguage; ... }` so it's probably missing from DesktopAppProps interface.

with open('src/components/DesktopApp.tsx', 'w') as f:
    f.write(content)


# 2. AdminMobileCalendar.tsx - DayEventCard
with open('src/components/admin/AdminMobileCalendar.tsx', 'r') as f:
    content = f.read()

# Replace all occurrences of DayEventCard where role and globalSettings are missing
content = re.sub(
    r'<DayEventCard key={ev.id} event={ev} language={language} onClick=\{\(\) => setSheetEvent\(ev\)\} />',
    r'<DayEventCard key={ev.id} event={ev} language={language} role={role} globalSettings={globalSettings} onClick={() => setSheetEvent(ev)} />',
    content
)

with open('src/components/admin/AdminMobileCalendar.tsx', 'w') as f:
    f.write(content)

# 3. MobileHome.tsx
with open('src/components/MobileHome.tsx', 'r') as f:
    content = f.read()

# It seems `Props` definition in MobileHome.tsx was never matched correctly.
# I will use re to find `onRejectRestaurantRequest` and add globalSettings
content = re.sub(
    r'onRejectRestaurantRequest\?: \(\(requestId: number, reviewer: string\) => Promise<void>\) \| undefined\n}',
    r'onRejectRestaurantRequest?: (requestId: number, reviewer: string) => Promise<void>\n  globalSettings?: Record<string, string>\n}',
    content
)

content = re.sub(
    r'onRejectRestaurantRequest\?: \(requestId: number, reviewer: string\) => Promise<void>\n}',
    r'onRejectRestaurantRequest?: (requestId: number, reviewer: string) => Promise<void>\n  globalSettings?: Record<string, string>\n}',
    content
)

# AdminMobileZone doesn't take globalSettings but we passed it?
# Let's remove globalSettings from AdminMobileZone if it was passed.
# Error: src/components/MobileHome.tsx(1040,17): Type '{ ... globalSettings: any; }' is not assignable to AdminMobileZone props.
content = re.sub(
    r'<AdminMobileZone(.*?)globalSettings=\{globalSettings\}(.*?)/?>',
    r'<AdminMobileZone\1\2/>',
    content,
    flags=re.DOTALL
)

with open('src/components/MobileHome.tsx', 'w') as f:
    f.write(content)


# 4. AdminEventDetailSheet.tsx Props
with open('src/components/admin/AdminEventDetailSheet.tsx', 'r') as f:
    content = f.read()

content = re.sub(
    r'onCancelApply\?: \(\) => void\n\}',
    r'onCancelApply?: () => void\n  globalSettings?: Record<string, string>\n}',
    content
)

with open('src/components/admin/AdminEventDetailSheet.tsx', 'w') as f:
    f.write(content)

