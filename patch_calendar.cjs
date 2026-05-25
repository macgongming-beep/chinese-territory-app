const fs = require('fs');
let code = fs.readFileSync('src/components/DesktopCalendar.tsx', 'utf-8');

// Imports
const newImports = `import { ExportEventsModal } from './calendar/ExportEventsModal'
import { ImportEventsModal } from './calendar/ImportEventsModal'
`;
code = code.replace(`import { PlacePresetEditor } from './admin/AdminMobileCalendar'`, `import { PlacePresetEditor } from './admin/AdminMobileCalendar'\n${newImports}`);

// States
const stateHook = `  const [isPlacePresetOpen, setIsPlacePresetOpen] = useState(false)`;
const newStates = `  const [isExportOpen, setIsExportOpen] = useState(false)
  const [isImportOpen, setIsImportOpen] = useState(false)
${stateHook}`;
code = code.replace(stateHook, newStates);

// Buttons
const oldButtons = `<button className="cal-today-btn" type="button">신청내역</button>
              <button className="cal-today-btn" type="button">일괄 업로드</button>`;
const newButtons = `<button className="cal-today-btn" type="button" onClick={() => setIsExportOpen(true)}>일정 내보내기</button>
              <button className="cal-today-btn" type="button" onClick={() => setIsImportOpen(true)}>일정 가져오기</button>`;
code = code.replace(oldButtons, newButtons);

// Modals rendering
const modalRender = `      {isPlacePresetOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)' }}>
          <div style={{ background: 'var(--bg)', borderRadius: 16, width: '100%', maxWidth: 400, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 10px 30px rgba(0,0,0,0.2)' }}>
            <PlacePresetEditor onClose={() => setIsPlacePresetOpen(false)} />
          </div>
        </div>
      )}`;

const newModalsRender = `      <ExportEventsModal isOpen={isExportOpen} onClose={() => setIsExportOpen(false)} events={events} />
      <ImportEventsModal isOpen={isImportOpen} onClose={() => setIsImportOpen(false)} onCreateEvent={onCreateEvent} />

${modalRender}`;

code = code.replace(modalRender, newModalsRender);

fs.writeFileSync('src/components/DesktopCalendar.tsx', code);
