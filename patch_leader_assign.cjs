const fs = require('fs');
let code = fs.readFileSync('src/components/MobileLeaderAssignment.tsx', 'utf-8');

// 1. Add removeCardFromTeam function
if (!code.includes('removeCardFromTeam')) {
  code = code.replace(
    '  const removeMemberFromTeam = (teamId: string, participantName: string) => {',
    `  const removeCardFromTeam = (teamId: string, cardId: number) => {
    if (!canEditSelectedEvent) return
    updateTeam(teamId, (team) => ({ ...team, cardIds: team.cardIds.filter((id) => id !== cardId) }))
  }

  const removeMemberFromTeam = (teamId: string, participantName: string) => {`
  );
}

// 2. Add an 'X' button to each card stack
// We need to find the <div className="ma-team-card-stack"> block and add the button.
// Currently it is:
// <div className="ma-team-card-stack" key={card.id}>
//   <button ... className={`ma-team-card-item${...}`}>...</button>
//   {isPreviewOpen && ...}
// </div>
// We can wrap the inner <button> and an 'X' button in a flex container, or just position it absolute if there's space, or since .ma-team-card-stack is just a wrapper, we can make .ma-team-card-stack position:relative and add an X button on the right.
// Wait, actually, let's just make the top row of the card item have a delete button.

const oldStack = /<div className="ma-team-card-stack" key=\{card\.id\}>\s*<button/g;
const newStack = `<div className="ma-team-card-stack" key={card.id} style={{ position: 'relative' }}>
                                {canEditSelectedEvent && (
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); removeCardFromTeam(team.id, card.id); }}
                                    style={{
                                      position: 'absolute',
                                      top: -6,
                                      right: -6,
                                      width: 22,
                                      height: 22,
                                      borderRadius: '50%',
                                      background: 'var(--status-danger)',
                                      color: 'white',
                                      border: '2px solid var(--surface)',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      zIndex: 2,
                                      cursor: 'pointer',
                                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                                    }}
                                  >
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                                  </button>
                                )}
                                <button`;

code = code.replace(oldStack, newStack);

fs.writeFileSync('src/components/MobileLeaderAssignment.tsx', code);
