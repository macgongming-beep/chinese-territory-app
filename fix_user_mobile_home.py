with open('src/components/UserMobileHome.tsx', 'r') as f:
    content = f.read()

content = content.replace(
    "actualRole: Role\n}",
    "actualRole: Role\n  globalSettings?: Record<string, string>\n}"
)

content = content.replace(
    "  actualRole,\n}: UserMobileHomeProps)",
    "  actualRole,\n  globalSettings = {},\n}: UserMobileHomeProps)"
)

# hide participant count conditionally
hide_logic = """
                      const hideParticipants = globalSettings.hide_participants_from_users === 'true' && actualRole === 'user'
                      return (
"""
content = content.replace(
    "                    return (\n                      <li",
    hide_logic + "                      <li"
)

content = content.replace(
    "                        <span className={`mh-today-badge mh-today-badge-${event.applicants.length > 0 ? 'blue' : 'gray'}`}>\n                          신청 {event.applicants.length}명\n                        </span>",
    "{!hideParticipants && (\n                        <span className={`mh-today-badge mh-today-badge-${event.applicants.length > 0 ? 'blue' : 'gray'}`}>\n                          신청 {event.applicants.length}명\n                        </span>\n                        )}"
)

with open('src/components/UserMobileHome.tsx', 'w') as f:
    f.write(content)
