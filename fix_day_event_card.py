with open('src/components/admin/AdminMobileCalendar.tsx', 'r') as f:
    content = f.read()

content = content.replace(
    "function DayEventCard({ language,  event, onClick }: { event: CalendarEvent; onClick?: () => void ; language: AppLanguage }) {",
    "function DayEventCard({ language, event, role, globalSettings, onClick }: { event: CalendarEvent; role: Role; globalSettings: Record<string, string>; onClick?: () => void ; language: AppLanguage }) {"
)

hide_logic = """
  const hideParticipants = globalSettings.hide_participants_from_users === 'true' && role === 'user'
  if (!hideParticipants && event.applicants && event.applicants.length > 0) {
"""

content = content.replace(
    "  if (event.applicants && event.applicants.length > 0) {",
    hide_logic
)

content = content.replace(
    "            <DayEventCard key={ev.id} event={ev} language={language} onClick={() => setSheetEvent(ev)} />",
    "            <DayEventCard key={ev.id} event={ev} language={language} role={role} globalSettings={globalSettings} onClick={() => setSheetEvent(ev)} />"
)

content = content.replace(
    "                  <DayEventCard key={ev.id} event={ev} language={language} onClick={() => setSheetEvent(ev)} />",
    "                  <DayEventCard key={ev.id} event={ev} language={language} role={role} globalSettings={globalSettings} onClick={() => setSheetEvent(ev)} />"
)

with open('src/components/admin/AdminMobileCalendar.tsx', 'w') as f:
    f.write(content)
