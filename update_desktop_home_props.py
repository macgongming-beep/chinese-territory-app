with open('src/components/DesktopApp.tsx', 'r') as f:
    content = f.read()

content = content.replace(
    "onStartServiceSession={(input) => startServiceSessionAndOpenMap({ ...input, role: viewMode })}",
    "onStartServiceSession={(input) => startServiceSessionAndOpenMap({ ...input, role: viewMode })}\n            globalSettings={globalSettings}"
)

with open('src/components/DesktopApp.tsx', 'w') as f:
    f.write(content)

with open('src/components/DesktopHome.tsx', 'r') as f:
    content = f.read()

content = content.replace(
    "  onOpenCalendar?: () => void\n}",
    "  onOpenCalendar?: () => void\n  globalSettings?: Record<string, string>\n}"
)

content = content.replace(
    "  onStartServiceSession,\n}: DesktopHomeProps)",
    "  onStartServiceSession,\n  globalSettings = {},\n}: DesktopHomeProps)"
)

# hide participant count conditionally
hide_logic = """
                const hideParticipants = globalSettings.hide_participants_from_users === 'true' && role === 'user'
                return (
"""
content = content.replace(
    "              return (\n                <div",
    hide_logic + "                <div"
)

content = content.replace(
    "                  {event.allowApplications ? (\n                    <div className=\"desk-home-today-badge\">\n                      신청 {event.applicants.length}명\n                    </div>\n                  ) : (",
    "                  {event.allowApplications ? (\n                    !hideParticipants && (\n                    <div className=\"desk-home-today-badge\">\n                      신청 {event.applicants.length}명\n                    </div>\n                    )\n                  ) : ("
)

with open('src/components/DesktopHome.tsx', 'w') as f:
    f.write(content)
