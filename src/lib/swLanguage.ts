// 서비스 워커에 현재 언어를 알려 준다.
//
// 왜 필요한가: 푸시 알림을 그리는 건 서비스 워커인데, 워커는 앱의 메모리도
// localStorage 도 읽을 수 없다. 그래서 Cache Storage 에 언어를 적어 두고
// 워커가 알림을 띄울 때 읽어 간다. (워커는 언제든 종료·재시작되므로
// 메모리에 들고 있으면 안 된다)

import type { AppLanguage } from '../i18n'

export const LANG_CACHE = 'app-language'
export const LANG_KEY = 'https://app.local/language'

let lastWritten: AppLanguage | null = null

export function syncLanguageToServiceWorker(lang: AppLanguage): void {
  if (lastWritten === lang) return
  lastWritten = lang
  if (typeof caches === 'undefined') return
  void caches
    .open(LANG_CACHE)
    .then((cache) => cache.put(LANG_KEY, new Response(lang)))
    .catch(() => {
      /* 캐시를 못 써도 알림은 한국어로 나올 뿐이라 앱 동작에는 지장 없음 */
    })
}
