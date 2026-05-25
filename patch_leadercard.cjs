const fs = require('fs');
let code = fs.readFileSync('src/components/MobileAdminAssignment.tsx', 'utf-8');

const regex = /function LeaderCard\(\{[\s\S]*?\}\) \{\n  return \([\s\S]*?<\/button>\n  \)\n\}/m;

const newLeaderCard = `function LeaderCard({
  name,
  stats,
  isSelected,
  onClick,
  muted,
  isMe,
}: {
  name: string
  stats: { assigned: number; inProgress: number; done: number }
  isSelected: boolean
  onClick: () => void
  muted?: boolean
  isMe?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
        padding: '14px 10px', width: '100%', minHeight: 0,
        background: 'var(--surface)',
        border: isSelected
          ? '1.5px solid var(--ink)'
          : isMe
            ? '1.5px solid var(--ink)'
            : '1px solid var(--line-2)',
        borderRadius: 12,
        cursor: 'pointer', textAlign: 'center',
        transition: 'all 0.15s ease',
        position: 'relative'
      }}
    >
      {isSelected && (
        <span style={{
          position: 'absolute', top: 10, right: 10,
          width: 20, height: 20, borderRadius: '50%',
          background: 'var(--ink)', display: 'grid', placeItems: 'center',
          flexShrink: 0
        }}>
          <Check color="#fff" size={12} strokeWidth={3} />
        </span>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>{name}</span>
        {isMe && <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 500 }}>(나)</span>}
      </div>
      {!muted ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '2px 8px', fontSize: 11.5, color: 'var(--muted)' }}>
           <span style={{ whiteSpace: 'nowrap' }}>담당 <b style={{ color: 'var(--ink)', fontWeight: 650 }}>{stats.assigned}</b></span>
           <span style={{ whiteSpace: 'nowrap' }}>진행 <b style={{ color: 'var(--ink)', fontWeight: 650 }}>{stats.inProgress}</b></span>
           <span style={{ whiteSpace: 'nowrap' }}>완료 <b style={{ color: 'var(--ink)', fontWeight: 650 }}>{stats.done}</b></span>
        </div>
      ) : (
        <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>담당 없음</span>
      )}
    </button>
  )
}`;

code = code.replace(regex, newLeaderCard);
fs.writeFileSync('src/components/MobileAdminAssignment.tsx', code);
