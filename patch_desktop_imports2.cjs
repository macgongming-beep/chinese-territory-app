const fs = require('fs');
let code = fs.readFileSync('src/components/DesktopCalendar.tsx', 'utf-8');

code = code.replace(
  "import { CommentSection, type MentionUser } from './CommentSection'",
  "import { CommentSection, type MentionUser } from './CommentSection'\nimport { loadPlacePresets, savePlacePresets, normalizePlacePresets, PLACE_PRESETS_MAX } from '../lib/placePresets'\nimport type { PlacePreset } from '../lib/placePresets'\nimport { PlacePresetEditor } from './admin/AdminMobileCalendar'"
);

fs.writeFileSync('src/components/DesktopCalendar.tsx', code);
