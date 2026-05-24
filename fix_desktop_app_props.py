import re

with open('src/components/DesktopApp.tsx', 'r') as f:
    content = f.read()

content = re.sub(
    r'onFetchMyLoginLogs: \(limit\?: number\) => Promise<LoginLogRecord\[\]>\n}',
    r'onFetchMyLoginLogs: (limit?: number) => Promise<LoginLogRecord[]>\n  globalSettings?: Record<string, string>\n}',
    content
)

with open('src/components/DesktopApp.tsx', 'w') as f:
    f.write(content)
