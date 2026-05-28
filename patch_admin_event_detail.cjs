const fs = require('fs');
let code = fs.readFileSync('src/components/admin/AdminEventDetailSheet.tsx', 'utf-8');

// 1. Add prop onAddParticipant?: (userName: string) => void
code = code.replace(
  "onCancelApply?: () => void\n  globalSettings?: Record<string, string>",
  "onCancelApply?: () => void\n  onAddParticipant?: (userName: string) => void\n  globalSettings?: Record<string, string>"
);

// 2. Add state for the add participant modal
if (!code.includes('const [isAddParticipantModalOpen')) {
  code = code.replace(
    "const applicants = event.applicants || []",
    "const applicants = event.applicants || []\n  const [isAddParticipantModalOpen, setIsAddParticipantModalOpen] = useState(false)\n  const [participantSearchText, setParticipantSearchText] = useState('')"
  );
}

// 3. Remove previewApplicants logic
code = code.replace(
  "const previewApplicants = applicants.slice(0, 6)\n  const overflow = applicants.length - previewApplicants.length",
  ""
);

// 4. Update the section head to include +추가 button
code = code.replace(
  /<SectionHead\s*title=\{\s*<>\s*\{t\(language \?\? 'ko', 'calendar\.applicantSection'\)\}\s*<span style=\{\{ fontWeight: 500, color: 'var\(--muted\)', fontSize: 13, marginLeft: 6 \}\}>\s*\{applicants\.length\}\s*<\/span>\s*<\/>\s*\}\s*\/>/g,
  `<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <SectionHead
              title={
                <>
                  {t(language ?? 'ko', 'calendar.applicantSection')}
                  <span style={{ fontWeight: 500, color: 'var(--muted)', fontSize: 13, marginLeft: 6 }}>
                    {applicants.length}
                  </span>
                </>
              }
            />
            {(role === 'admin' || role === 'leader') && (
              <button
                type="button"
                onClick={() => setIsAddParticipantModalOpen(true)}
                style={{
                  padding: '4px 10px',
                  borderRadius: 99,
                  border: '1px solid var(--line-muted)',
                  background: 'var(--surface)',
                  fontSize: 12,
                  fontWeight: 600,
                  color: 'var(--text)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4
                }}
              >
                + 추가
              </button>
            )}
          </div>`
);

// 5. Update the applicants rendering
const oldListPattern = /<div\s*style=\{\{\s*display: 'flex',\s*gap: 8,\s*overflowX: 'auto',\s*paddingBottom: 4,\s*marginLeft: -16,\s*marginRight: -16,\s*paddingLeft: 16,\s*paddingRight: 16,\s*\}\}\s*>\s*\{previewApplicants\.map\(\(name\) => \([\s\S]*?<\/span>\s*\)\}\s*\{overflow > 0 && \([\s\S]*?<\/span>\s*\)\}/;

const newListLogic = `<div
            style={{
              display: 'flex',
              gap: 8,
              flexWrap: 'wrap',
              maxHeight: 150,
              overflowY: 'auto',
              paddingBottom: 4,
            }}
          >
            {applicants.map((name) => (
              <span
                key={name}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '5px 12px 5px 5px',
                  background: 'var(--surface)',
                  border: '1px solid var(--line)',
                  borderRadius: 99,
                  flexShrink: 0,
                }}
              >
                <Avatar name={name} size={22} />
                <span style={{ fontSize: 13, fontWeight: 600 }}>{name}</span>
              </span>
            ))}`;

code = code.replace(oldListPattern, newListLogic);

// 6. Add modal rendering at the bottom before final closing tags
const modalLogic = `
      {isAddParticipantModalOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }} onClick={() => setIsAddParticipantModalOpen(false)} />
          <div style={{ background: 'var(--bg)', borderRadius: 16, width: '90%', maxWidth: 400, maxHeight: '80%', display: 'flex', flexDirection: 'column', zIndex: 1, overflow: 'hidden' }}>
            <div style={{ padding: 16, borderBottom: '1px solid var(--line-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>신청자 수동 추가</h3>
              <button onClick={() => setIsAddParticipantModalOpen(false)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', padding: 4 }}>×</button>
            </div>
            <div style={{ padding: 12, borderBottom: '1px solid var(--line-muted)' }}>
              <input 
                type="text" 
                placeholder="이름 검색..." 
                value={participantSearchText}
                onChange={e => setParticipantSearchText(e.target.value)}
                style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--line-muted)', background: 'var(--surface)', fontSize: 14 }}
              />
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {(mentionUsers || [])
                .filter(u => !applicants.includes(u.name))
                .filter(u => participantSearchText ? u.name.includes(participantSearchText) : true)
                .map(u => (
                  <div 
                    key={u.id}
                    onClick={() => {
                      if (onAddParticipant) onAddParticipant(u.name);
                      setIsAddParticipantModalOpen(false);
                      setParticipantSearchText('');
                    }}
                    style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', borderRadius: 8 }}
                    onMouseOver={e => e.currentTarget.style.background = 'var(--surface)'}
                    onMouseOut={e => e.currentTarget.style.background = 'none'}
                  >
                    <Avatar name={u.name} size={28} />
                    <span style={{ fontSize: 14, fontWeight: 600 }}>{u.name}</span>
                  </div>
              ))}
              {(mentionUsers || []).filter(u => !applicants.includes(u.name)).length === 0 && (
                <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
                  추가할 수 있는 사용자가 없습니다.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
`;

code = code.replace(/(\s*)(<\/div>\s*<\/div>\s*\)\s*\})/g, `$1${modalLogic}$1$2`);

fs.writeFileSync('src/components/admin/AdminEventDetailSheet.tsx', code);
