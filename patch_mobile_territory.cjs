const fs = require('fs');
let code = fs.readFileSync('src/components/MobileTerritory.tsx', 'utf-8');

// The activeSession block
const activeSessionRegex = /\{\s*activeSession\s*&&\s*\(\s*<section className="mobile-territory-section">\s*<div className="mobile-active-session-card">[\s\S]*?<\/section>\s*\)\s*\}/;

const match = code.match(activeSessionRegex);
if (!match) {
  console.log("Could not find activeSession block");
  process.exit(1);
}

let activeSessionBlock = match[0];

// Remove it from its original position
code = code.replace(activeSessionBlock, '');

// Update the text inside activeSessionBlock
activeSessionBlock = activeSessionBlock.replace(
  /<span>\{timeSlotLabel\(activeSession\.timeSlot\)\} · \{t\(language, 'map\.servicing'\)\}<\/span>/,
  `<span>
                    {(() => {
                      const evt = activeSession.calendarEventId ? calendarEvents.find((e) => e.id === activeSession.calendarEventId) : null
                      if (evt) return \`\${evt.time} \${evt.title} · \${t(language, 'map.servicing')}\`
                      return \`\${timeSlotLabel(activeSession.timeSlot)} · \${t(language, 'map.servicing')}\`
                    })()}
                  </span>`
);

// Insert it above mobile-today-service-section
const targetRegex = /<section className="mobile-territory-section mobile-today-service-section">/;
code = code.replace(targetRegex, activeSessionBlock + '\n\n          <section className="mobile-territory-section mobile-today-service-section">');

fs.writeFileSync('src/components/MobileTerritory.tsx', code);
