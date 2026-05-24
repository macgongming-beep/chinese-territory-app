import re

# Read MobileHome.tsx to fix the header
with open('src/components/MobileHome.tsx', 'r') as f:
    content = f.read()

# Replace the /suggestions route in MobileHome.tsx
route_pattern = r"""(\{\/\* 봉사 제안 관리 \*\/\}\s*<Route path="\/suggestions" element=\{\s*role === 'admin' \? \(\s*<div className="mobile-settings-page" style=\{\{ paddingBottom: 60 \}\}>\s*)<AdminSuggestions onBack=\{\(\) => navigate\('\/settings'\)\} \/>(\s*<\/div>\s*\)\s*:\s*\(\s*<Navigate to="\/settings" replace \/>\s*\)\s*\} \/>)"""

new_route = r"""\1<AppHeader
                    pageTitle="대화 방법 제안 관리"
                    language={language}
                    showBack
                    onBack={() => navigate('/settings')}
                    userId={currentUser.id}
                    userName={currentVisitor}
                    role={role}
                    chatUsers={headerChatUsers}
                    onOpenMenu={() => navigate('/settings')}
                  />
                  <div style={{ padding: '0 16px' }}>
                    <AdminSuggestions />
                  </div>\2"""

content = re.sub(route_pattern, new_route, content)

with open('src/components/MobileHome.tsx', 'w') as f:
    f.write(content)

