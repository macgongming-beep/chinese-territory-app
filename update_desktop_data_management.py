import re

with open('src/components/DesktopDataManagement.tsx', 'r') as f:
    content = f.read()

# Add state
content = content.replace(
    "const [resetDays, setResetDays] = useState(90)",
    "const [resetDays, setResetDays] = useState(90)\n  const [hideParticipants, setHideParticipants] = useState(false)"
)

# Fetch state
content = content.replace(
    "if (row.key === 'visit_reset_days_met') setResetDays(Number(row.value) || 90)",
    "if (row.key === 'visit_reset_days_met') setResetDays(Number(row.value) || 90)\n          if (row.key === 'hide_participants_from_users') setHideParticipants(row.value === 'true')"
)

content = content.replace(
    "['visit_reset_enabled', 'visit_reset_days_met']",
    "['visit_reset_enabled', 'visit_reset_days_met', 'hide_participants_from_users']"
)

# Save state
content = content.replace(
    "{ key: 'visit_reset_days_met', value: String(resetDays) },",
    "{ key: 'visit_reset_days_met', value: String(resetDays) },\n      { key: 'hide_participants_from_users', value: String(hideParticipants) },"
)

# Render
new_ui = """
        <section className="desk-card ds-card">
          <h2 className="desk-card__title" style={{ marginBottom: 12 }}>봉사자 참가 권한 설정</h2>
          <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--gray-500)', lineHeight: 1.6 }}>
            일반 봉사자에게 일정의 참가자 목록과 참가 인원을 숨길 수 있습니다. (인도자/관리자는 항상 볼 수 있습니다)
          </p>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, cursor: 'pointer' }}>
            <input type="checkbox" checked={hideParticipants} onChange={(e) => setHideParticipants(e.target.checked)}
              style={{ width: 15, height: 15, accentColor: 'var(--ink)' }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--gray-800)' }}>일반 봉사자에게 참가자 목록 및 인원 숨기기</span>
          </label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="ds-btn ds-btn-primary" onClick={saveResetSettings} disabled={resetSaving} type="button" style={{ opacity: resetSaving ? 0.6 : 1 }}>
              {resetSaving ? '저장 중…' : '설정 저장'}
            </button>
          </div>
        </section>

        <section className="desk-card ds-card">
"""

content = content.replace(
    "        <section className=\"desk-card ds-card\">\n          <h2 className=\"desk-card__title\" style={{ marginBottom: 12 }}>방문기록 영구 삭제</h2>",
    new_ui + "          <h2 className=\"desk-card__title\" style={{ marginBottom: 12 }}>방문기록 영구 삭제</h2>"
)

with open('src/components/DesktopDataManagement.tsx', 'w') as f:
    f.write(content)
