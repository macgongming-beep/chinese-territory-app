const fs = require('fs');
let code = fs.readFileSync('src/components/MobileLeaderAssignment.tsx', 'utf-8');

// 1. Change the button to a div and move it inside
const oldBtnRegex = /<button[\s\S]*?onClick=\{\(e\) => \{ e\.stopPropagation\(\); removeCardFromTeam\(team\.id, card\.id\); \}\}[\s\S]*?<\/button>/;
const newBtn = `<div
                                    role="button"
                                    onClick={(e) => { e.stopPropagation(); removeCardFromTeam(team.id, card.id); }}
                                    style={{
                                      position: 'absolute',
                                      top: '50%',
                                      right: 10,
                                      transform: 'translateY(-50%)',
                                      width: 20,
                                      height: 20,
                                      minWidth: 20,
                                      minHeight: 20,
                                      padding: 0,
                                      borderRadius: '50%',
                                      background: 'var(--status-danger)',
                                      color: 'white',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      zIndex: 2,
                                      cursor: 'pointer',
                                    }}
                                  >
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                                  </div>`;
code = code.replace(oldBtnRegex, newBtn);

// 2. Add paddingRight to the ma-team-card-item
code = code.replace(
  /<button\s*className=\{\`ma-team-card-item\$\{isPreviewOpen \? ' is-expanded' : ''\}\`\}\s*type="button"\s*aria-expanded=\{isPreviewOpen\}\s*onClick=\{\(\) => setPreviewCardId\(\(current\) => current === card\.id \? null : card\.id\)\}\s*>/,
  `<button
                                  className={\`ma-team-card-item\${isPreviewOpen ? ' is-expanded' : ''}\`}
                                  type="button"
                                  aria-expanded={isPreviewOpen}
                                  onClick={() => setPreviewCardId((current) => current === card.id ? null : card.id)}
                                  style={{ paddingRight: canEditSelectedEvent ? 38 : undefined }}
                                >`
);

fs.writeFileSync('src/components/MobileLeaderAssignment.tsx', code);
console.log("Fixed!");
