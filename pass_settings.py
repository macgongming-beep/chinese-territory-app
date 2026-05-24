with open('src/components/MobileHome.tsx', 'r') as f:
    content = f.read()

content = content.replace(
    "onApplyToEvent={onApplyToEvent}\n                  specialPeriods={specialPeriods}",
    "onApplyToEvent={onApplyToEvent}\n                  specialPeriods={specialPeriods}\n                  globalSettings={globalSettings}"
)

with open('src/components/MobileHome.tsx', 'w') as f:
    f.write(content)

with open('src/components/DesktopApp.tsx', 'r') as f:
    content = f.read()

content = content.replace(
    "onAddParticipant={onAddParticipantToEvent}",
    "onAddParticipant={onAddParticipantToEvent}\n            globalSettings={globalSettings}"
)

content = content.replace(
    "            onOpenTerritory={() => navigate('/territory')}",
    "            onOpenTerritory={() => navigate('/territory')}\n            globalSettings={globalSettings}"
)

with open('src/components/DesktopApp.tsx', 'w') as f:
    f.write(content)
