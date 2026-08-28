// app_settings 읽기 — 화면 컴포넌트는 lib/supabase 를 직접 import 할 수 없다.
import { supabase } from '../../lib/supabase'

export type MaintenanceNotice = {
  /** 사람에게 보여줄 본문. 비어 있으면 안 띄운다 */
  message: string
  /** 같은 공지를 다시 띄우고 싶을 때 바꾸는 값. 사용자별 '봤음' 기억이 여기에 묶인다 */
  id: string
}

// ⚠ 본문은 **언어마다 따로** 담는다. 이 회중은 중국어 봉사라 중국어·영어를 쓰는
//   사람이 있다. 한 칸만 두면 그 사람들은 한국어 안내를 받는다.
//   번역을 안 넣으면 한국어로 떨어진다 (문구가 없어 화면이 비는 것보다 낫다).
export const MAINTENANCE_KEYS = [
  'maintenance_notice', 'maintenance_notice_zh', 'maintenance_notice_en', 'maintenance_notice_id',
] as const

/**
 * 점검 공지를 읽는다. 없거나 못 읽으면 null (공지 때문에 앱이 막히면 안 된다).
 *
 * ⚠ 읽기 전용이다. 켜고 끄는 것은 관리자가 app_settings 를 고쳐서 한다
 *   (`supabase/tools/_점검공지_켜고끄기.sql`). 전환 뒤 app_settings 쓰기는 관리자만 된다.
 */
export async function fetchMaintenanceNotice(language = 'ko'): Promise<MaintenanceNotice | null> {
  const { data, error } = await supabase
    .from('app_settings')
    .select('key, value')
    .in('key', MAINTENANCE_KEYS as unknown as string[])
  if (error || !data) return null

  const get = (k: string) => data.find((r) => r.key === k)?.value?.trim() ?? ''
  // 한국어가 비어 있으면 공지 자체가 꺼진 것으로 본다 (끄기는 한 칸만 비우면 된다)
  const ko = get('maintenance_notice')
  if (!ko) return null
  const translated = language === 'zh' ? get('maintenance_notice_zh')
    : language === 'en' ? get('maintenance_notice_en')
    : ''
  return { message: translated || ko, id: get('maintenance_notice_id') || 'default' }
}
