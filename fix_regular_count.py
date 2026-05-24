import re

with open('src/components/DesktopTerritory.tsx', 'r') as f:
    code = f.read()

# Add it back to the handleExportBuildings function
code = code.replace(
'''          const card = cardMap.get(building.cardId)
          const chineseCount = building.units.filter((unit) => unit.isChinese).length
          const unitMemos = building.units''',
'''          const card = cardMap.get(building.cardId)
          const chineseCount = building.units.filter((unit) => unit.isChinese).length
          const regularCount = building.units.filter((unit) => unit.isRegularVisit).length
          const unitMemos = building.units'''
)

with open('src/components/DesktopTerritory.tsx', 'w') as f:
    f.write(code)

print("regularCount fixed")
