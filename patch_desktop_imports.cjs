const fs = require('fs');
let code = fs.readFileSync('src/components/DesktopCalendar.tsx', 'utf-8');

// Add imports
code = code.replace(
  "import { ChevronLeft, ChevronRight, X } from 'lucide-react'",
  "import { ChevronLeft, ChevronRight, X } from 'lucide-react'\nimport { loadPlacePresets, savePlacePresets, normalizePlacePresets, PLACE_PRESETS_MAX } from '../lib/placePresets'\nimport type { PlacePreset } from '../lib/placePresets'\nimport { PlacePresetEditor } from './admin/AdminMobileCalendar'"
);

// Add PlacePresetEditor export to AdminMobileCalendar
let adminCode = fs.readFileSync('src/components/admin/AdminMobileCalendar.tsx', 'utf-8');
adminCode = adminCode.replace('function PlacePresetEditor', 'export function PlacePresetEditor');
fs.writeFileSync('src/components/admin/AdminMobileCalendar.tsx', adminCode);

// Add state to DesktopCalendar
code = code.replace(
  '  const [newTitle, setNewTitle] = useState(\'传道\')',
  '  const [newTitle, setNewTitle] = useState(\'传道\')\n  const [placePresets, setPlacePresets] = useState<PlacePreset[]>(loadPlacePresets)\n  const [placeSettingsOpen, setPlaceSettingsOpen] = useState(false)'
);

// Add handlers
code = code.replace(
  '  const resetCreateForm = () => {',
  '  const updatePlacePresets = (next: PlacePreset[]) => {\n    const normalized = normalizePlacePresets(next)\n    setPlacePresets(normalized)\n    savePlacePresets(normalized)\n  }\n\n  const applyPlacePreset = (preset: PlacePreset) => {\n    setNewPlace(preset.name)\n    setNewMapLink(preset.mapLink)\n  }\n\n  const resetCreateForm = () => {'
);

const placeUi = `
              {/* 장소 + 지도 링크 */}
              <div className="cal-field">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <label style={{ marginBottom: 0 }}>모임 장소</label>
                  <button
                    type="button"
                    onClick={() => setPlaceSettingsOpen(v => !v)}
                    style={{
                      border: 'none', background: 'transparent',
                      color: 'var(--ink)', fontSize: 13, fontWeight: 600,
                      cursor: 'pointer', padding: 0
                    }}
                  >
                    {placeSettingsOpen ? '설정 닫기' : '장소 설정'}
                  </button>
                </div>

                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                  {placePresets.map((preset, idx) => (
                    <button
                      key={\`\${idx}-\${preset.name}\`}
                      type="button"
                      onClick={() => applyPlacePreset(preset)}
                      className={\`cal-time-preset-btn\${newPlace === preset.name ? ' active' : ''}\`}
                    >
                      {preset.name}
                    </button>
                  ))}
                </div>

                {placeSettingsOpen && (
                  <div style={{ marginBottom: 12 }}>
                    <PlacePresetEditor language={language} presets={placePresets} onChange={updatePlacePresets} />
                  </div>
                )}

                <input className="cal-input" placeholder="장소 입력" value={newPlace} onChange={(e) => setNewPlace(e.target.value)} style={{ marginBottom: 8 }} />
                <input className="cal-input" inputMode="url" placeholder="네이버 지도 링크 (선택)" value={newMapLink} onChange={(e) => setNewMapLink(e.target.value)} />
              </div>
`;

code = code.replace(
  '              {/* 장소 + 지도 링크 */}\n              <div className="cal-field">\n                <label>모임 장소</label>\n                <input className="cal-input" placeholder="장소 입력" value={newPlace} onChange={(e) => setNewPlace(e.target.value)} style={{ marginBottom: 8 }} />\n                <input className="cal-input" inputMode="url" placeholder="네이버 지도 링크 (선택)" value={newMapLink} onChange={(e) => setNewMapLink(e.target.value)} />\n              </div>',
  placeUi
);

fs.writeFileSync('src/components/DesktopCalendar.tsx', code);
