with open('src/components/DesktopCalendar.tsx', 'r') as f:
    content = f.read()

content = content.replace(
    "  onAddParticipant: (eventId: number, participantName: string) => void\n}",
    "  onAddParticipant: (eventId: number, participantName: string) => void\n  globalSettings?: Record<string, string>\n}"
)

content = content.replace(
    "  onAddParticipant,\n}: DesktopCalendarProps)",
    "  onAddParticipant,\n  globalSettings = {},\n}: DesktopCalendarProps)"
)

# Render Participants
content = content.replace(
    "  const appliedCount = selectedEvent.applicants.length",
    "  const appliedCount = selectedEvent.applicants.length\n  const hideParticipants = globalSettings.hide_participants_from_users === 'true' && role === 'user'"
)

content = content.replace(
    "                    <section className=\"desk-cal-sheet-section\">\n                      <h3 className=\"desk-cal-sheet-subtitle\">\n                        참가자\n                        <span className=\"desk-cal-sheet-count\">{appliedCount}명</span>\n                      </h3>\n                      <div className=\"desk-cal-sheet-applicants\">\n                        {selectedEvent.applicants.length > 0 ? (",
    "                    {!hideParticipants && (\n                    <section className=\"desk-cal-sheet-section\">\n                      <h3 className=\"desk-cal-sheet-subtitle\">\n                        참가자\n                        <span className=\"desk-cal-sheet-count\">{appliedCount}명</span>\n                      </h3>\n                      <div className=\"desk-cal-sheet-applicants\">\n                        {selectedEvent.applicants.length > 0 ? ("
)

content = content.replace(
    "                          <span className=\"desk-cal-sheet-empty\">아직 신청자가 없습니다.</span>\n                        )}\n                      </div>\n                    </section>",
    "                          <span className=\"desk-cal-sheet-empty\">아직 신청자가 없습니다.</span>\n                        )}\n                      </div>\n                    </section>\n                    )}"
)

# Render card participants
card_hide_logic = """
                    const hideCardParticipants = globalSettings.hide_participants_from_users === 'true' && role === 'user'
                    return (
"""

content = content.replace(
    "                  return (\n                    <div\n                      key={event.id}\n                      className={`desk-cal-event desk-cal-event--${event.type === '비공식' ? 'informal' : 'default'}`}",
    card_hide_logic + "                    <div\n                      key={event.id}\n                      className={`desk-cal-event desk-cal-event--${event.type === '비공식' ? 'informal' : 'default'}`}"
)

content = content.replace(
    "                          {event.allowApplications && (\n                            <span className=\"desk-cal-event-badge\">신청 {event.applicants.length}명</span>\n                          )}\n                        </div>",
    "                          {event.allowApplications && !hideCardParticipants && (\n                            <span className=\"desk-cal-event-badge\">신청 {event.applicants.length}명</span>\n                          )}\n                        </div>"
)

with open('src/components/DesktopCalendar.tsx', 'w') as f:
    f.write(content)
