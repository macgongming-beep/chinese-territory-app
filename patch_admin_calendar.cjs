const fs = require('fs');
let code = fs.readFileSync('src/components/admin/AdminMobileCalendar.tsx', 'utf-8');

// We need to import useStore to get addParticipantToEvent
if (!code.includes('addParticipantToEvent')) {
  code = code.replace(
    /const \{\s*calendarEvents,\s*createCalendarEvent,[\s\S]*?\} = useStore\(\)/,
    match => {
      if (match.includes('addParticipantToEvent')) return match;
      return match.replace('} = useStore()', '  addParticipantToEvent,\n} = useStore()');
    }
  );
}

// And pass it to AdminEventDetailSheet
code = code.replace(
  /<AdminEventDetailSheet\s*language=\{language\}\s*event=\{detailEvent\}\s*cards=\{cards\}\s*role=\{role\}\s*currentVisitor=\{currentVisitor\}\s*currentUserId=\{currentUserId\}\s*mentionUsers=\{mentionUsers\}\s*onClose=\{/g,
  `<AdminEventDetailSheet
          language={language}
          event={detailEvent}
          cards={cards}
          role={role}
          currentVisitor={currentVisitor}
          currentUserId={currentUserId}
          mentionUsers={mentionUsers}
          onAddParticipant={(userName) => addParticipantToEvent(detailEvent.id, userName)}
          onClose={`
);

fs.writeFileSync('src/components/admin/AdminMobileCalendar.tsx', code);
