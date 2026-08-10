import { ko } from './locales/ko'
import { zh } from './locales/zh'
import { en } from './locales/en'

export type AppLanguage = 'ko' | 'zh' | 'en'

export const languageLabels: Record<AppLanguage, string> = {
  ko: '한국어',
  zh: '简体中文',
  en: 'English',
}

const dictionary = { ko, zh, en } satisfies Record<AppLanguage, Record<string, string>>

// 현재 화면 언어 — App 이 언어를 바꿀 때마다 여기에 반영한다.
// ⚠ localStorage 를 직접 읽지 않는다: 언어는 사용자별 키(chsLanguage:<userId>)에
//   저장되어 있어서, 'language' 같은 키를 읽으면 항상 한국어로 떨어진다.
let activeLanguage: AppLanguage = 'ko'

export function setCurrentLang(language: AppLanguage): void {
  activeLanguage = language
}

/**
 * 컴포넌트 밖(이벤트 핸들러·mutation·모듈 상수)에서 t() 를 부를 때 쓰는 현재 언어.
 * props 로 language 를 받을 수 있는 곳에서는 그걸 그대로 쓰는 편이 낫다.
 */
export function currentLang(): AppLanguage {
  return activeLanguage
}

export function t(language: AppLanguage, key: keyof typeof dictionary.ko, vars?: Record<string, string | number>): string {
  const raw = dictionary[language][key] ?? dictionary.ko[key] ?? key
  if (!vars) return raw
  return raw.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''))
}

export function formatLeaderOf(lang: AppLanguage, name: string): string {
  if (lang === 'en') return `Leader: ${name}`
  if (lang === 'zh') return `带头人 ${name}`
  return `${name} 인도자`
}

export function formatJoined(lang: AppLanguage, count: number): string {
  if (lang === 'en') return `${count} joined`
  if (lang === 'zh') return `参与 ${count}人`
  return `참여 ${count}명`
}

export function formatApplied(lang: AppLanguage, count: number): string {
  if (lang === 'en') return `${count} applied`
  if (lang === 'zh') return `申请 ${count}人`
  return `신청 ${count}명`
}

export function formatCardCount(lang: AppLanguage, count: number): string {
  if (lang === 'en') return `${count} cards`
  if (lang === 'zh') return `${count}张卡片`
  return `카드 ${count}개`
}

export function formatLeadSub(lang: AppLanguage, applied: number, _cards: number): string {
  return formatApplied(lang, applied)
}

export function formatPeriod(lang: AppLanguage, hour: number): string {
  if (lang === 'en') return hour < 12 ? 'AM' : hour < 18 ? 'PM' : 'Eve'
  if (lang === 'zh') return hour < 12 ? '上午' : hour < 18 ? '下午' : '晚上'
  return hour < 12 ? '오전' : hour < 18 ? '오후' : '저녁'
}

export const weekdayShortLabels: Record<AppLanguage, string[]> = {
  ko: ['일', '월', '화', '수', '목', '금', '토'],
  zh: ['日', '一', '二', '三', '四', '五', '六'],
  en: ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'],
}

// 한국 지명 번역 테이블 [한국어, 중국어, 영어]
const PLACE_NAME_TABLE: [string, string, string][] = [
  // 광역/시 단위
  ['경기도', '京畿道', 'Gyeonggi-do'],
  ['서울특별시', '首尔特别市', 'Seoul'],
  ['용인시', '龙仁市', 'Yongin-si'],
  ['화성시', '华城市', 'Hwaseong-si'],
  ['수원시', '水原市', 'Suwon-si'],
  // 구
  ['처인구', '处仁区', 'Cheoin-gu'],
  ['기흥구', '器兴区', 'Giheung-gu'],
  ['수지구', '水枝区', 'Suji-gu'],
  ['영통구', '灵通区', 'Yeongton-gu'],
  // 처인구 동·읍·면
  ['김량장동', '金良场洞', 'Gimnyangjiang-dong'],
  ['고림동', '古林洞', 'Gorim-dong'],
  ['해곡동', '海谷洞', 'Haegok-dong'],
  ['포곡읍', '蒲谷邑', 'Pogok-eup'],
  ['모현읍', '慕贤邑', 'Mohyeon-eup'],
  ['이동읍', '二东邑', 'Idong-eup'],
  ['남사읍', '南沙邑', 'Namsa-eup'],
  ['원삼면', '元三面', 'Wonsam-myeon'],
  ['백암면', '白岩面', 'Baegam-myeon'],
  ['양지면', '阳智面', 'Yangji-myeon'],
  // 기흥구 동
  ['동백동', '冬柏洞', 'Dongbaek-dong'],
  ['마북동', '麻北洞', 'Mabuk-dong'],
  ['보라동', '宝罗洞', 'Bora-dong'],
  ['상하동', '上下洞', 'Sangha-dong'],
  ['서천동', '西川洞', 'Seocheon-dong'],
  ['신갈동', '新葛洞', 'Singal-dong'],
  ['영덕동', '永德洞', 'Yeongdeok-dong'],
  ['지곡동', '芝谷洞', 'Jigok-dong'],
  ['청덕동', '清德洞', 'Cheongdeok-dong'],
  ['공세동', '贡税洞', 'Gongse-dong'],
  ['고매동', '古梅洞', 'Gomae-dong'],
  ['언남동', '彦南洞', 'Eonnam-dong'],
  ['구갈동', '旧葛洞', 'Gugal-dong'],
  ['기흥동', '器兴洞', 'Giheung-dong'],
  ['농서동', '农书洞', 'Nongseo-dong'],
  ['하갈동', '下葛洞', 'Hagal-dong'],
  ['중동', '中洞', 'Jung-dong'],
  // 수지구 동
  ['풍덕천동', '丰德川洞', 'Pungdeokcheon-dong'],
  ['성복동', '星福洞', 'Seongbok-dong'],
  ['신봉동', '新凤洞', 'Sinbong-dong'],
  ['죽전동', '竹田洞', 'Jukjeon-dong'],
  ['동천동', '洞川洞', 'Dongcheon-dong'],
  ['상현동', '上峴洞', 'Sanghyeon-dong'],
  ['손곡동', '孙谷洞', 'Songok-dong'],
  // 기타
  ['기타', '其他', 'Other'],
]

/**
 * 한국어 주소/지명 문자열을 대상 언어로 번역.
 * ko면 그대로 반환. translatePlaceNames=false 면 그대로 반환.
 */
export function translateKoreanAddress(
  address: string,
  lang: AppLanguage,
  enabled = true,
): string {
  if (lang === 'ko' || !enabled) return address
  let result = address
  for (const [ko, zh, en] of PLACE_NAME_TABLE) {
    result = result.replaceAll(ko, lang === 'zh' ? zh : en)
  }
  return result
}

export function isAppLanguage(value: unknown): value is AppLanguage {
  return value === 'ko' || value === 'zh' || value === 'en'
}
