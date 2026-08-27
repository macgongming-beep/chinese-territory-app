import { confirmDialog } from './confirm'
import { willNotifyOnEventChange, isNotifiableDate, type NotifiableEventFields } from '../utils/eventNotify'
import { getLocalDateString } from '../utils/dateUtils'

/**
 * 일정을 고치기 직전에 "알림 보낼까요?" 를 묻는다.
 *
 * **실제로 알림이 나갈 때만** 묻는다:
 *   · 알림 대상 칸(날짜·시간·장소·지도링크·인도자·제목)이 바뀌었고
 *   · 지난 일정이 아니고
 *   · 받을 사람이 있을 때
 * 메모만 고치면 묻지 않고 조용히 저장한다 — 물어봐야 성가시기만 하다.
 *
 * 두 화면(PC·모바일)이 같은 걸 쓰게 하려고 여기 모았다.
 * 각자 만들면 한쪽만 고쳐지고 갈라진다 — 이 앱에서 여러 번 그랬다.
 */
export async function askNotifyOnEventEdit(opts: {
  before: NotifiableEventFields
  after: NotifiableEventFields
  /** 알림을 받을 사람 수 (신청자 + 인도자). 0이면 묻지 않는다 */
  recipientCount: number
  /** 반복 일정이면 몇 개가 바뀌는지 */
  seriesCount?: number
}): Promise<boolean> {
  if (!willNotifyOnEventChange(opts.before, opts.after)) return false
  if (opts.after.date && !isNotifiableDate(opts.after.date, getLocalDateString())) return false
  if (opts.recipientCount <= 0) return false

  const who = `참여자 ${opts.recipientCount}명`
  const what = opts.seriesCount && opts.seriesCount > 1
    ? `반복 일정 ${opts.seriesCount}개의 시간·장소·인도자가 바뀝니다.`
    : '일정의 시간·장소·인도자가 바뀝니다.'
  return confirmDialog({
    message: `${what}\n${who}에게 알림을 보낼까요?\n\n('보내지 않기' 를 눌러도 수정은 저장됩니다.)`,
    confirmLabel: '알림 보내기',
    cancelLabel: '보내지 않기',
  })
}
