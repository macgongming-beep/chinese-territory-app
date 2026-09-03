import { reportMutationError, supabase } from './shared'

export type PhoneSurveyWriteRow = {
  place_id: string
  name: string
  address: string | null
  category: string | null
  phone: string | null
  restaurant?: string | null
  result: '있음' | '없음' | '미확인'
  checked_at: string | null
  checked_by: string | null
  memo: string | null
  unit_id: number | null
  uploaded_by: string | null
}

async function upsertRows(rows: PhoneSurveyWriteRow[]) {
  return supabase
    .from('phone_surveys')
    .upsert(rows, { onConflict: 'place_id' })
    .select('id, place_id')
}

export async function savePhoneSurveyRows(rows: PhoneSurveyWriteRow[]): Promise<boolean> {
  if (rows.length === 0) return false

  let result = await upsertRows(rows)

  // 이전 설치본에 restaurant 컬럼이 없더라도 조사 결과 자체는 보존한다.
  if (result.error && /restaurant/.test(result.error.message)) {
    result = await upsertRows(rows.map(({ restaurant: _restaurant, ...row }) => row))
  }

  if (result.error) {
    reportMutationError('전화 조사 기록을 저장하지 못했습니다.', result.error)
    return false
  }

  if (!Array.isArray(result.data) || result.data.length !== rows.length) {
    reportMutationError('전화 조사 기록을 저장하지 못했습니다.', {
      code: 'P0001',
      message: `요청 ${rows.length}건 중 ${result.data?.length ?? 0}건만 확인되었습니다.`,
    })
    return false
  }

  return true
}
