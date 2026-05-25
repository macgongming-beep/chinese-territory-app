const fs = require('fs');
let desktopCode = fs.readFileSync('src/components/DesktopCalendar.tsx', 'utf-8');

desktopCode = desktopCode.replace('language={language ?? \\\'ko\\\'}', "language={'ko'}");
desktopCode = desktopCode.replace(', PLACE_PRESETS_MAX', '');

fs.writeFileSync('src/components/DesktopCalendar.tsx', desktopCode);
