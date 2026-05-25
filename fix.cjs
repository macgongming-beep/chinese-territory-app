const fs = require('fs');

// Fix AdminMobileCalendar
let adminCode = fs.readFileSync('src/components/admin/AdminMobileCalendar.tsx', 'utf-8');
adminCode = adminCode.replace('export export function PlacePresetEditor', 'export function PlacePresetEditor');
fs.writeFileSync('src/components/admin/AdminMobileCalendar.tsx', adminCode);

// Fix DesktopCalendar
let desktopCode = fs.readFileSync('src/components/DesktopCalendar.tsx', 'utf-8');

// I'll manually ensure imports are there
if (!desktopCode.includes('import { loadPlacePresets')) {
  desktopCode = desktopCode.replace(
    "import { ChevronLeft, ChevronRight, X } from 'lucide-react'",
    "import { ChevronLeft, ChevronRight, X } from 'lucide-react'\nimport { loadPlacePresets, savePlacePresets, normalizePlacePresets, PLACE_PRESETS_MAX } from '../lib/placePresets'\nimport type { PlacePreset } from '../lib/placePresets'\nimport { PlacePresetEditor } from './admin/AdminMobileCalendar'"
  );
}
// Fix language prop
desktopCode = desktopCode.replace('language={language}', 'language={language ?? \'ko\'}');

fs.writeFileSync('src/components/DesktopCalendar.tsx', desktopCode);
