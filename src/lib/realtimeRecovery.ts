// Realtime 채널 구독 + 끊김 복구 (P3-2)
//
// 배경: Supabase realtime-js 는 웹소켓이 끊기면 stepped backoff 로 소켓을
//   자동 재연결하고 채널을 다시 join 한다. 하지만 "끊겨 있던 동안 발생한
//   DB 변경"은 다시 전달되지 않으므로, 재연결 직후 화면이 stale 해진다.
//
// 이 헬퍼는 채널이 재구독(재연결)되는 순간 onRecover() 를 호출해
//   놓친 변경을 한 번 catch-up refetch 하게 한다.
//   (최초 구독 시에는 호출 안 함 — hook 들이 이미 mount 시 fetch 하므로 중복 방지)

import type { RealtimeChannel } from '@supabase/supabase-js'

export function subscribeWithRecovery(
  channel: RealtimeChannel,
  onRecover?: () => void,
): RealtimeChannel {
  let subscribedOnce = false
  channel.subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      if (subscribedOnce) {
        // 재연결됨 → 끊긴 동안 놓친 변경을 catch-up
        onRecover?.()
      }
      subscribedOnce = true
    } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
      // CLOSED 는 정상 unmount(removeChannel) 시에도 발생하므로 로깅 제외
      if (import.meta.env.DEV) {
        console.warn('[realtime] channel status:', status, channel.topic)
      }
    }
  })
  return channel
}
