import re

with open('src/components/DesktopTerritory.tsx', 'r') as f:
    code = f.read()

# Replace <label className="bulk-check"> with a simpler div wrapper for building management table
# Head checkbox
code = code.replace(
    '''<label className="bulk-check">
                <input
                  checked={filteredBuildings.length > 0 && filteredBuildings.every((building) => checkedBuildingIds.has(building.id))}
                  onChange={toggleAllFilteredBuildings}
                  type="checkbox"
                />
              </label>''',
    '''<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', paddingLeft: 6 }}>
                <input
                  checked={filteredBuildings.length > 0 && filteredBuildings.every((building) => checkedBuildingIds.has(building.id))}
                  onChange={toggleAllFilteredBuildings}
                  type="checkbox"
                />
              </div>'''
)

# Row checkbox
code = code.replace(
    '''<label className="bulk-check">
                      <input
                        checked={checkedBuildingIds.has(building.id)}
                        onChange={() => toggleCheckedBuilding(building.id)}
                        type="checkbox"
                      />
                    </label>''',
    '''<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', paddingLeft: 6 }}>
                      <input
                        checked={checkedBuildingIds.has(building.id)}
                        onChange={() => toggleCheckedBuilding(building.id)}
                        type="checkbox"
                      />
                    </div>'''
)

with open('src/components/DesktopTerritory.tsx', 'w') as f:
    f.write(code)

print("Checkbox HTML updated")
