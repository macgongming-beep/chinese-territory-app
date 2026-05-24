import re

def remove_from_user():
    with open('src/components/UserMobileHome.tsx', 'r') as f:
        content = f.read()
    content = content.replace("  _onOpenCalendar?: () => void\n", "")
    content = content.replace("  _onOpenCalendar,\n", "")
    with open('src/components/UserMobileHome.tsx', 'w') as f:
        f.write(content)

def remove_from_admin():
    with open('src/components/admin/AdminMobileHome.tsx', 'r') as f:
        content = f.read()
    content = content.replace("  _onOpenCalendar?: () => void\n", "")
    content = content.replace("  _onOpenCalendar,\n", "")
    with open('src/components/admin/AdminMobileHome.tsx', 'w') as f:
        f.write(content)

def remove_from_mobile():
    with open('src/components/MobileHome.tsx', 'r') as f:
        content = f.read()
    content = content.replace("                    _onOpenCalendar={() => navigate('/calendar')}\n", "")
    with open('src/components/MobileHome.tsx', 'w') as f:
        f.write(content)

def remove_from_desktop():
    with open('src/components/DesktopHome.tsx', 'r') as f:
        content = f.read()
    content = content.replace("                    onOpenCalendar={() => {}}\n", "")
    with open('src/components/DesktopHome.tsx', 'w') as f:
        f.write(content)

remove_from_user()
remove_from_admin()
remove_from_mobile()
remove_from_desktop()
