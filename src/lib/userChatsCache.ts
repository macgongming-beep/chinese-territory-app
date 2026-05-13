export type UserChat = {
  eventId: number
  eventTitle: string
  eventDate: string
  eventTime: string | null
  participantCount: number
  lastMessageAt: string | null
  unreadCount: number
  isLocked: boolean
  hasEnded: boolean
}

export type UserChatsCacheEntry = {
  chats: UserChat[]
  fetchedAt: number
}

export const USER_CHATS_CACHE_TTL = 15 * 1000

export const userChatsCache = new Map<string, UserChatsCacheEntry>()
export const userChatsInflight = new Map<string, Promise<UserChat[]>>()

export function getUserChatsCacheKey(userId: number | null | undefined, userName: string | null | undefined) {
  if (!userId || !userName) return null
  return `${userId}:${userName}`
}

export function getCachedUserChats(cacheKey: string | null) {
  if (!cacheKey) return null
  return userChatsCache.get(cacheKey) ?? null
}

export function setCachedUserChats(cacheKey: string | null, chats: UserChat[]) {
  if (!cacheKey) return
  userChatsCache.set(cacheKey, { chats, fetchedAt: Date.now() })
}

export function getInflightUserChats(cacheKey: string | null) {
  if (!cacheKey) return null
  return userChatsInflight.get(cacheKey) ?? null
}

export function setInflightUserChats(cacheKey: string | null, request: Promise<UserChat[]>) {
  if (!cacheKey) return
  userChatsInflight.set(cacheKey, request)
}

export function clearInflightUserChats(cacheKey: string | null) {
  if (!cacheKey) return
  userChatsInflight.delete(cacheKey)
}

export function clearUserChatsCache() {
  userChatsCache.clear()
  userChatsInflight.clear()
}
