// 일정을 고쳤을 때 **알림이 실제로 나가는가**.
//
// 트리거(on_calendar_event_update)는 여섯 칸만 본다.
// 메모만 고치면 알림이 안 나가는데, 화면은 그걸 몰라서
// "알림 보낼까요?" 를 물으면 성가시고, 안 물으면 모르게 나간다.
// 트리거와 **같은 조건**을 여기에 둔다. 한쪽만 바뀌면 어긋나므로 주석으로 묶어 둔다.
//
// SQL 쪽: notify_on_calendar_event_change 의 이른 return 조건
//   event_date / time / place / meeting_map_url / leader_name / title

export type NotifiableEventFields = {
  date?: string
  time?: string
  place?: string
  mapLink?: string | null
  leader?: string
  title?: string
}

const norm = (v: string | null | undefined) => (v ?? '').trim()

/** 알림이 나갈 만한 칸이 하나라도 바뀌었나 */
export function willNotifyOnEventChange(
  before: NotifiableEventFields,
  after: NotifiableEventFields,
): boolean {
  return (
    norm(before.date) !== norm(after.date) ||
    norm(before.time) !== norm(after.time) ||
    norm(before.place) !== norm(after.place) ||
    norm(before.mapLink) !== norm(after.mapLink) ||
    norm(before.leader) !== norm(after.leader) ||
    norm(before.title) !== norm(after.title)
  )
}

/**
 * 지난 일정은 알리지 않는다 (트리거도 그렇게 한다).
 * 오늘은 알린다.
 */
export function isNotifiableDate(eventDate: string, today: string): boolean {
  return eventDate >= today
}

/**
 * 그 일정 변경으로 알림을 받을 사람 수 (신청자 + 인도자, 중복 제거).
 * 정확한 수는 서버가 정하지만, 물어볼지 말지 판단하고 문구에 쓸 정도면 된다.
 */
export function countEventNotifyTargets(event: {
  participants?: { userName: string }[] | string[]
  leaders?: string[]
  leader?: string
}): number {
  const names = new Set<string>()
  for (const p of event.participants ?? []) {
    names.add(typeof p === 'string' ? p : p.userName)
  }
  for (const l of event.leaders ?? []) names.add(l)
  if (event.leader) {
    for (const l of event.leader.split(',')) {
      const n = l.trim()
      if (n) names.add(n)
    }
  }
  names.delete('')
  return names.size
}
