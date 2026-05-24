with open('src/components/admin/AdminEventDetailSheet.tsx', 'r') as f:
    content = f.read()

content = content.replace(
    "  onUpdate?: (event: Partial<Omit<CalendarEvent, 'id'>>) => void\n}",
    "  onUpdate?: (event: Partial<Omit<CalendarEvent, 'id'>>) => void\n  globalSettings?: Record<string, string>\n}"
)

content = content.replace(
    "  onUpdate,\n}: AdminEventDetailSheetProps)",
    "  onUpdate,\n  globalSettings = {},\n}: AdminEventDetailSheetProps)"
)

# Render Participants
content = content.replace(
    "  const overflow = applicants.length - previewApplicants.length",
    "  const overflow = applicants.length - previewApplicants.length\n  const hideParticipants = globalSettings.hide_participants_from_users === 'true' && role === 'user'"
)

content = content.replace(
    "        <section style={{ marginBottom: 24 }}>\n          <DetailLabel\n            icon=\"users\"\n            label={t(language ?? 'ko', 'calendar.applicantsLabel')}\n            suffix={\n              <>\n                <span\n                  style={{\n                    display: 'inline-block',\n                    width: 16,\n                    height: 16,\n                    borderRadius: '50%',\n                    background: 'var(--brand)',\n                    color: '#fff',\n                    fontSize: 10,\n                    fontWeight: 800,\n                    textAlign: 'center',\n                    lineHeight: '16px',\n                  }}\n                >\n                  {applicants.length}\n                </span>\n              </>\n            }\n          />\n          <div",
    "        {!hideParticipants && (\n        <section style={{ marginBottom: 24 }}>\n          <DetailLabel\n            icon=\"users\"\n            label={t(language ?? 'ko', 'calendar.applicantsLabel')}\n            suffix={\n              <>\n                <span\n                  style={{\n                    display: 'inline-block',\n                    width: 16,\n                    height: 16,\n                    borderRadius: '50%',\n                    background: 'var(--brand)',\n                    color: '#fff',\n                    fontSize: 10,\n                    fontWeight: 800,\n                    textAlign: 'center',\n                    lineHeight: '16px',\n                  }}\n                >\n                  {applicants.length}\n                </span>\n              </>\n            }\n          />\n          <div"
)

content = content.replace(
    "            {applicants.length === 0 && !canApply && (\n              <span style={{ fontSize: 13, color: 'var(--muted-2)', padding: '6px 4px', flexShrink: 0 }}>\n                {t(language ?? 'ko', 'calendar.noApplicants')}\n              </span>\n            )}\n          </div>\n        </section>",
    "            {applicants.length === 0 && !canApply && (\n              <span style={{ fontSize: 13, color: 'var(--muted-2)', padding: '6px 4px', flexShrink: 0 }}>\n                {t(language ?? 'ko', 'calendar.noApplicants')}\n              </span>\n            )}\n          </div>\n        </section>\n        )}"
)

with open('src/components/admin/AdminEventDetailSheet.tsx', 'w') as f:
    f.write(content)
