with open('src/components/DesktopApp.tsx', 'r') as f:
    content = f.read()

# Add globalSettings to Props
content = content.replace(
    "  onRejectRestaurantRequest?: (requestId: number, reviewer: string) => Promise<void>\n}",
    "  onRejectRestaurantRequest?: (requestId: number, reviewer: string) => Promise<void>\n  globalSettings?: Record<string, string>\n}"
)

# Destructure globalSettings
content = content.replace(
    "  onApproveRestaurantRequest,\n  onRejectRestaurantRequest,\n}: DesktopAppProps)",
    "  onApproveRestaurantRequest,\n  onRejectRestaurantRequest,\n  globalSettings = {},\n}: DesktopAppProps)"
)

# Fix double globalSettings on DesktopHome if any
import re
content = re.sub(r'globalSettings=\{globalSettings\}\s*globalSettings=\{globalSettings\}', 'globalSettings={globalSettings}', content)

with open('src/components/DesktopApp.tsx', 'w') as f:
    f.write(content)

with open('src/components/MobileHome.tsx', 'r') as f:
    content = f.read()

content = content.replace(
    "  onRejectRestaurantRequest?: (requestId: number, reviewer: string) => Promise<void>\n}",
    "  onRejectRestaurantRequest?: (requestId: number, reviewer: string) => Promise<void>\n  globalSettings?: Record<string, string>\n}"
)

# Fix line 302 where `globalSettings` doesn't exist on type. I think I already added it to destructured props but not the interface.

with open('src/components/MobileHome.tsx', 'w') as f:
    f.write(content)

with open('src/components/admin/AdminEventDetailSheet.tsx', 'r') as f:
    content = f.read()

content = content.replace(
    "  onCancelApply,\n}: Props)",
    "  onCancelApply,\n  globalSettings = {},\n}: Props)"
)

with open('src/components/admin/AdminEventDetailSheet.tsx', 'w') as f:
    f.write(content)

with open('src/components/admin/AdminMobileCalendar.tsx', 'r') as f:
    content = f.read()

content = content.replace(
    "<DayEventCard key={ev.id} event={ev} language={language} onClick={() => setSheetEvent(ev)} />",
    "<DayEventCard key={ev.id} event={ev} language={language} role={role} globalSettings={globalSettings} onClick={() => setSheetEvent(ev)} />"
)

with open('src/components/admin/AdminMobileCalendar.tsx', 'w') as f:
    f.write(content)

