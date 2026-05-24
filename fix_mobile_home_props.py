import re

with open('src/components/MobileHome.tsx', 'r') as f:
    content = f.read()

content = re.sub(
    r'onRejectRestaurantRequest\?: \(id: number, reviewer: string\) => Promise<void>\n}',
    r'onRejectRestaurantRequest?: (id: number, reviewer: string) => Promise<void>\n  globalSettings?: Record<string, string>\n}',
    content
)

with open('src/components/MobileHome.tsx', 'w') as f:
    f.write(content)
