const ACTIVE_CHAT_EVENT_KEY = 'active_chat_event_id'

export function extractChatEventId(link?: string | null): number | null {
  if (!link) return null
  const match = link.match(/[?&]openChat=(\d+)/)
  if (!match) return null
  const eventId = Number(match[1])
  return Number.isFinite(eventId) ? eventId : null
}

export function getActiveChatEventId(): number | null {
  if (typeof window === 'undefined') return null
  const raw = sessionStorage.getItem(ACTIVE_CHAT_EVENT_KEY)
  if (!raw) return null
  const eventId = Number(raw)
  return Number.isFinite(eventId) ? eventId : null
}

export function setActiveChatEventId(eventId: number | null) {
  if (typeof window === 'undefined') return
  if (eventId) {
    sessionStorage.setItem(ACTIVE_CHAT_EVENT_KEY, String(eventId))
  } else {
    sessionStorage.removeItem(ACTIVE_CHAT_EVENT_KEY)
  }

  window.dispatchEvent(new CustomEvent('active-chat-change', { detail: { eventId } }))

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.controller?.postMessage({
      type: 'ACTIVE_CHAT',
      eventId,
    })
  }
}

export function isActiveChatLink(link?: string | null) {
  const eventId = extractChatEventId(link)
  return eventId !== null && eventId === getActiveChatEventId()
}
