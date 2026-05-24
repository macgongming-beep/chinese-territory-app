with open('src/components/MobileHome.tsx', 'r') as f:
    content = f.read()

content = content.replace(
    "  onApproveRestaurantRequest,\n  onRejectRestaurantRequest,\n}: {",
    "  onApproveRestaurantRequest,\n  onRejectRestaurantRequest,\n  globalSettings = {},\n}: {"
)

content = content.replace(
    "                actualRole={actualRole}",
    "                actualRole={actualRole}\n                globalSettings={globalSettings}"
)

with open('src/components/MobileHome.tsx', 'w') as f:
    f.write(content)
