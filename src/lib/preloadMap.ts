/**
 * Naver Maps SDK 미리 로드
 * 앱 시작 시 호출하여 지도 진입 시 로딩 대기 시간을 없앰
 */
export function preloadNaverMapSDK() {
  const clientId = import.meta.env.VITE_NAVER_MAP_CLIENT_ID as string | undefined
  if (!clientId) return

  const scriptId = 'naver-map-script'
  if (document.getElementById(scriptId)) return

  const script = document.createElement('script')
  script.id = scriptId
  script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${clientId}&submodules=geocoder`
  script.async = true
  document.head.appendChild(script)
}
