const fs = require('fs');
let code = fs.readFileSync('src/components/admin/AdminMobileCalendar.tsx', 'utf-8');

// 1. Add state variables
code = code.replace(
  '  const [timeSettingsOpen, setTimeSettingsOpen] = useState(false)',
  '  const [timeSettingsOpen, setTimeSettingsOpen] = useState(false)\n  const [placePresets, setPlacePresets] = useState<PlacePreset[]>(loadPlacePresets)\n  const [placeSettingsOpen, setPlaceSettingsOpen] = useState(false)'
);

// 2. Add updatePlacePresets function
code = code.replace(
  '  const applyTimePreset = (preset: TimePreset) => {',
  '  const updatePlacePresets = (next: PlacePreset[]) => {\n    const normalized = normalizePlacePresets(next)\n    setPlacePresets(normalized)\n    savePlacePresets(normalized)\n  }\n\n  const applyPlacePreset = (preset: PlacePreset) => {\n    setPlace(preset.name)\n    setMapLink(preset.mapLink)\n  }\n\n  const applyTimePreset = (preset: TimePreset) => {'
);

// 3. Inject place presets UI
const placeUi = `
          <Field label={t(language, 'calendar.location')}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 2 }}>
              <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4, flex: 1, minWidth: 0, scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
                {placePresets.map((preset, idx) => (
                  <button
                    key={\`\${idx}-\${preset.name}\`}
                    type="button"
                    onClick={() => applyPlacePreset(preset)}
                    style={{
                      flex: '0 0 auto',
                      padding: '5px 12px',
                      background: place === preset.name ? 'var(--ink)' : 'var(--tint)',
                      color: place === preset.name ? '#fff' : 'var(--text)',
                      border: place === preset.name ? '1px solid var(--ink)' : '1px solid var(--line-2)',
                      borderRadius: 999,
                      fontSize: 12,
                      fontWeight: 650,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {preset.name}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setPlaceSettingsOpen((v) => !v)}
                style={{
                  minHeight: 0,
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--text)',
                  fontSize: 12,
                  fontWeight: 700,
                  padding: '4px 2px',
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                {placeSettingsOpen ? t(language, 'calendar.closeSettings') : t(language, 'calendar.editPlaceSettings')}
              </button>
            </div>
            
            {placeSettingsOpen && (
              <PlacePresetEditor language={language} presets={placePresets} onChange={updatePlacePresets} />
            )}

            <TextInput value={place} onChange={setPlace} placeholder={t(language, 'calendar.location')} />
            <TextInput value={mapLink} onChange={setMapLink} placeholder={t(language, 'calendar.mapLinkPlaceholder')} type="url" />
          </Field>
`;

code = code.replace(
  '          <Field label={t(language, \'calendar.location\')}>\n            <TextInput value={place} onChange={setPlace} placeholder={t(language, \'calendar.location\')} />\n            <TextInput value={mapLink} onChange={setMapLink} placeholder={t(language, \'calendar.mapLinkPlaceholder\')} />\n          </Field>',
  placeUi
);

fs.writeFileSync('src/components/admin/AdminMobileCalendar.tsx', code);
