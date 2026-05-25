export function PlacePresetEditor({ language, 
  presets,
  onChange,
}: {
  presets: PlacePreset[]
  onChange: (presets: PlacePreset[]) => void
; language: AppLanguage }) {
  const updatePreset = (index: number, patch: Partial<PlacePreset>) => {
    onChange(presets.map((preset, i) => i === index ? { ...preset, ...patch } : preset))
  }

  const addPreset = () => {
    if (presets.length >= PLACE_PRESETS_MAX) return
    onChange([
      ...presets,
      {
        name: t(language, 'calendar.placePresetLabel', { count: presets.length + 1 }),
        mapLink: '',
      },
    ])
  }

  const removePreset = (index: number) => {
    if (presets.length <= 1) return
    onChange(presets.filter((_, i) => i !== index))
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        padding: 8,
        border: '1px solid var(--line)',
        borderRadius: 12,
        background: 'var(--bg)',
        minWidth: 0,
        boxSizing: 'border-box',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 750, color: 'var(--ink)' }}>{t(language, 'calendar.editPlaceSettings')}</span>
        <button
          type="button"
          disabled={presets.length >= PLACE_PRESETS_MAX}
          onClick={addPreset}
          style={{
            minHeight: 0,
            border: '1px solid var(--line)',
            borderRadius: 8,
            background: presets.length >= PLACE_PRESETS_MAX ? 'var(--surface)' : '#fff',
            color: presets.length >= PLACE_PRESETS_MAX ? 'var(--muted-2)' : 'var(--text)',
            cursor: presets.length >= PLACE_PRESETS_MAX ? 'not-allowed' : 'pointer',
            fontSize: 12,
            fontWeight: 750,
            padding: '6px 9px',
          }}
        >
          {t(language, 'common.add')}
        </button>
      </div>

      {presets.map((preset, index) => (
        <div
          key={`${index}-${preset.name}`}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 5,
            minWidth: 0,
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr) 24px',
              gap: 5,
              alignItems: 'center',
              minWidth: 0,
            }}
          >
            <MiniInput
              ariaLabel={t(language, 'calendar.location')}
              value={preset.name}
              onChange={(value) => updatePreset(index, { name: value })}
              placeholder={t(language, 'calendar.location')}
            />
            <button
              type="button"
              disabled={presets.length <= 1}
              onClick={() => removePreset(index)}
              style={{
                width: 24,
                height: 24,
                minHeight: 24,
                border: 'none',
                borderRadius: 6,
                background: 'transparent',
                color: presets.length <= 1 ? 'var(--muted-2)' : 'var(--status-danger)',
                cursor: presets.length <= 1 ? 'not-allowed' : 'pointer',
                fontSize: 16,
                lineHeight: 1,
                padding: 0,
                display: 'grid',
                placeItems: 'center',
              }}
              aria-label={t(language, 'common.delete')}
            >
              ×
            </button>
          </div>
          <MiniInput
            ariaLabel={t(language, 'calendar.mapLinkPlaceholder')}
            value={preset.mapLink}
            onChange={(value) => updatePreset(index, { mapLink: value })}
            placeholder={t(language, 'calendar.mapLinkPlaceholder')}
            type="url"
          />
        </div>
      ))}
    </div>
  )
}
