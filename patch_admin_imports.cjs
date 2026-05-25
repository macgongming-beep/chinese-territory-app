const fs = require('fs');
let code = fs.readFileSync('src/components/admin/AdminMobileCalendar.tsx', 'utf-8');

// 1. Remove the local PlacePreset definitions
code = code.replace(/const PLACE_PRESET_STORAGE_KEY[\s\S]*?export function savePlacePresets[\s\S]*?\n}\n/, '');

// 2. Add imports
code = code.replace(
  "import type { AppLanguage } from '../../i18n'",
  "import type { AppLanguage } from '../../i18n'\nimport { loadPlacePresets, savePlacePresets, normalizePlacePresets, PLACE_PRESETS_MAX } from '../../lib/placePresets'\nimport type { PlacePreset } from '../../lib/placePresets'"
);

fs.writeFileSync('src/components/admin/AdminMobileCalendar.tsx', code);
