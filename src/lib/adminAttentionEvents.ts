export const ADMIN_ATTENTION_CHANGED_EVENT = 'admin-attention-changed'

export function notifyAdminAttentionChanged(): void {
  window.dispatchEvent(new Event(ADMIN_ATTENTION_CHANGED_EVENT))
}
