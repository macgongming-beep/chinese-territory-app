import re

def update_user_mobile_home():
    with open('src/components/UserMobileHome.tsx', 'r') as f:
        content = f.read()

    content = content.replace(
        "<h2>\n            {t(language, 'home.todayServiceShort')}\n            {myTodayEvents.length > 0 && <span className=\"mh-cnt\">{myTodayEvents.length}</span>}\n          </h2>\n          <button className=\"mh-all\" onClick={onOpenCalendar} type=\"button\">\n            {t(language, 'home.viewAllBtn')}\n            <svg width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" strokeWidth=\"2.2\" aria-hidden><polyline points=\"9 6 15 12 9 18\"/></svg>\n          </button>",
        "<h2>\n            오늘의 봉사\n            {myTodayEvents.length > 0 && <span className=\"mh-cnt\">{myTodayEvents.length}</span>}\n          </h2>"
    )

    content = content.replace(
        """<span className="mh-today-time">
                    <span className="mh-today-time-hour">{event.time.split(':')[0]}</span>
                    <span className="mh-today-time-period">{period}</span>
                  </span>""",
        """<span className="mh-today-time" style={{ width: 'auto', minWidth: 64, padding: '0 8px' }}>
                    <span className="mh-today-time-hour" style={{ fontSize: event.time.includes(':') ? 14 : 18 }}>{event.time}</span>
                    {event.endTime ? (
                      <span className="mh-today-time-period" style={{ fontSize: 11, marginTop: 4, opacity: 0.8 }}>~ {event.endTime}</span>
                    ) : (
                      <span className="mh-today-time-period">{period}</span>
                    )}
                  </span>"""
    )
    with open('src/components/UserMobileHome.tsx', 'w') as f:
        f.write(content)

def update_admin_mobile_home():
    with open('src/components/admin/AdminMobileHome.tsx', 'r') as f:
        content = f.read()

    content = content.replace(
        "<h2>\n            {t(language, 'home.todayServiceShort')}\n            <span className=\"mh-cnt\">{todayEvents.length}</span>\n          </h2>\n          <button type=\"button\" onClick={onOpenCalendar} className=\"mh-all\">\n            {t(language, 'home.viewAllBtn')} <ChevR size={14} color=\"currentColor\" />\n          </button>",
        "<h2>\n            오늘의 봉사\n            <span className=\"mh-cnt\">{todayEvents.length}</span>\n          </h2>"
    )

    content = content.replace(
        """<span className="mh-today-time">
                    <span className="mh-today-time-hour">{tb.display}</span>
                    <span className="mh-today-time-period">{tb.period}</span>
                  </span>""",
        """<span className="mh-today-time" style={{ width: 'auto', minWidth: 64, padding: '0 8px' }}>
                    <span className="mh-today-time-hour" style={{ fontSize: event.time.includes(':') ? 14 : 18 }}>{event.time}</span>
                    {event.endTime ? (
                      <span className="mh-today-time-period" style={{ fontSize: 11, marginTop: 4, opacity: 0.8 }}>~ {event.endTime}</span>
                    ) : (
                      <span className="mh-today-time-period">{tb.period}</span>
                    )}
                  </span>"""
    )
    with open('src/components/admin/AdminMobileHome.tsx', 'w') as f:
        f.write(content)

update_user_mobile_home()
update_admin_mobile_home()
