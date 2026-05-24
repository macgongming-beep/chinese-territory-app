with open('src/App.tsx', 'r') as f:
    content = f.read()

content = content.replace(
    "informalGroups,",
    "informalGroups,\n    globalSettings,"
)

content = content.replace(
    "            restaurantRequests={restaurantRequests}",
    "            restaurantRequests={restaurantRequests}\n            globalSettings={globalSettings}"
)

with open('src/App.tsx', 'w') as f:
    f.write(content)
