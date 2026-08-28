// app_settings 읽기 — 화면 컴포넌트는 lib/supabase 를 직접 import 할 수 없다.
import { supabase } from '../../lib/supabase'

export type MaintenanceNotice = {
  /** 사람에게 보여줄 본문. 비어 있으면 안 띄운다 */
  message: string
  /** 같은 공지를 다시 띄우고 싶을 때 바꾸는 값. 사용자별 '봤음' 기억이 여기에 묶인다 */
  id: string
}

export const MAINTENANCE_KEYS = ['maintenance_notice', 'maintenance_notice_id'] as const

/**
 * 점검 공지를 읽는다. 없거나 못 읽으면 null (공지 때문에 앱이 막히면 안 된다).
 *
 * ⚠ 읽기 전용이다. 켜고 끄는 것은 관리자가 app_settings 를 고쳐서 한다
 *   (`supabase/tools/_점검공지_켜고끄기.sql`). 전환 뒤 app_settings 쓰기는 관리자만 된다.
 */
export async function fetchMaintenanceNotice(): Promise<MaintenanceNotice | null> {
  const { data, error } = await supabase
    .from('app_settings')
    .select('key, value')
    .in('key', MAINTENANCE_KEYS as unknown as string[])
  if (error || !data) return null

  const get = (k: string) => data.find((r) => r.key === k)?.value?.trim() ?? ''
  const message = get('maintenance_notice')
  if (!message) return null
  return { message, id: get('maintenance_notice_id') || 'default' }
}
