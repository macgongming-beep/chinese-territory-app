// DB 가 왜 거절했는지를 사람 말로 바꾼다.
//
// 지금까지는 "일정을 등록하지 못했습니다" 만 띄우고 진짜 이유는 콘솔에만 남겼다.
// 실제로 그것 때문에 한참 헤맸다 — 등록이 안 되는데 무엇이 문제인지 알 수가 없었다.
// 개발자가 아닌 사람도 스스로 고칠 수 있게 이유를 붙인다.

/** DB 컬럼 이름 → 화면에서 부르는 이름 */
const COLUMN_LABELS: Record<string, string> = {
  event_date: '날짜',
  time: '시간',
  end_time: '종료 시간',
  title: '제목',
  place: '장소',
  leader_name: '인도자',
  address: '주소',
  name: '이름',
  number: '호수',
  content: '내용',
  card_id: '구역 카드',
  building_id: '건물',
  unit_id: '세대',
  user_name: '사람',
  visitor_name: '방문자',
  login_id: '아이디',
  pin: '비밀번호',
}

type PgError = { code?: string; message?: string; details?: string; hint?: string }

const labelOf = (raw: string | undefined) => {
  if (!raw) return null
  return COLUMN_LABELS[raw] ?? raw
}

/** 오류 메시지에서 컬럼 이름을 뽑는다 (`null value in column "time"` 같은 모양) */
function columnFrom(e: PgError): string | null {
  const m = /column "([^"]+)"/.exec(`${e.message ?? ''} ${e.details ?? ''}`)
  return m ? m[1] : null
}

/**
 * 붙일 이유 한 줄. 짐작할 수 없으면 null 을 돌려준다
 * (그때는 원래 메시지만 띄운다 — 엉뚱한 이유를 지어내는 것보다 낫다).
 */
export function explainDbError(error: unknown): string | null {
  if (!error || typeof error !== 'object') return null
  const e = error as PgError
  const col = labelOf(columnFrom(e) ?? undefined)

  switch (e.code) {
    case '23502':   // not null
      return col ? `${col}을(를) 입력해 주세요.` : '빠뜨린 칸이 있습니다.'
    case '23505':   // unique
      return '이미 같은 것이 있습니다.'
    case '23503':   // foreign key
      return '연결된 자료를 찾지 못했습니다. 새로고침 후 다시 시도해 주세요.'
    case '23514':   // check
      return '값이 허용된 범위를 벗어났습니다.'
    case '22P02':   // invalid input syntax
      return '값의 형식이 맞지 않습니다.'
    case '42501':   // permission denied
      return '권한이 없습니다.'
    case 'P0001':   // raise exception — 우리가 쓴 한국어 메시지가 이미 들어 있다
      return e.message?.trim() || null
    case '42883':
    case 'PGRST202':
      return '서버 기능이 아직 준비되지 않았습니다. 관리자에게 알려 주세요.'
    case 'PGRST301':
      return '로그인이 만료됐습니다. 다시 로그인해 주세요.'
    default:
      return null
  }
}

/** 화면에 띄울 최종 문구 */
export function describeDbError(base: string, error: unknown): string {
  const why = explainDbError(error)
  return why ? `${base}\n${why}` : base
}
