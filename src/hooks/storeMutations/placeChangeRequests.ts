import type { PlaceChangeRequest, PlaceImpactSnapshot, PlaceIssueType } from '../../types'
import { getAuthToken } from '../../lib/authToken'
import { reportMutationError, showToast, supabase } from './shared'

type RequestRow = {
  id: number
  request_type: PlaceIssueType
  building_id: number | null
  unit_id: number | null
  return_visit_id: number | null
  building_name: string | null
  address: string | null
  unit_number: string | null
  note: string | null
  requested_by_name: string
  status: PlaceChangeRequest['status']
  reviewed_by_name: string | null
  review_note: string | null
  created_at: string
  reviewed_at: string | null
  impact_snapshot?: Record<string, unknown> | null
}

function impactNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function toImpact(value: RequestRow['impact_snapshot']): PlaceImpactSnapshot {
  return {
    unitCount: impactNumber(value?.unit_count),
    visitHistoryCount: impactNumber(value?.visit_history_count),
    regularVisitCount: impactNumber(value?.regular_visit_count),
    returnVisitCount: impactNumber(value?.return_visit_count),
    phoneSurveyCount: impactNumber(value?.phone_survey_count),
    assignmentCount: impactNumber(value?.assignment_count),
  }
}

function toRequest(row: RequestRow): PlaceChangeRequest {
  return {
    id: row.id,
    requestType: row.request_type,
    buildingId: row.building_id,
    unitId: row.unit_id,
    returnVisitId: row.return_visit_id,
    buildingName: row.building_name ?? '',
    address: row.address ?? '',
    unitNumber: row.unit_number ?? '',
    note: row.note ?? '',
    requestedByName: row.requested_by_name,
    status: row.status,
    reviewedByName: row.reviewed_by_name ?? '',
    reviewNote: row.review_note ?? '',
    createdAt: row.created_at,
    reviewedAt: row.reviewed_at,
    impact: toImpact(row.impact_snapshot),
  }
}

export async function fetchPlaceChangeRequests(showClosed: boolean): Promise<PlaceChangeRequest[] | null> {
  const token = getAuthToken()
  if (token) {
    const refresh = await supabase.rpc('refresh_place_change_request_impacts_tx', { p_token: token })
    if (refresh.error) {
      reportMutationError('연결 자료를 확인하지 못했습니다.', refresh.error)
      return null
    }
  }
  const query = supabase.from('place_change_requests').select('*').order('created_at', { ascending: false })
  const result = showClosed ? await query.limit(100) : await query.eq('status', 'pending').limit(100)
  if (result.error) {
    reportMutationError('자료 수정 요청을 불러오지 못했습니다.', result.error)
    return null
  }
  return ((result.data ?? []) as RequestRow[]).map(toRequest)
}

export async function fetchPendingPlaceChangeRequestCount(): Promise<number | null> {
  const result = await supabase
    .from('place_change_requests')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending')
  if (result.error) {
    console.warn('자료 수정 요청 수를 확인하지 못했습니다.', result.error)
    return null
  }
  return result.count ?? 0
}

export async function reviewPlaceChangeRequest(
  id: number,
  status: 'completed' | 'rejected',
): Promise<boolean> {
  const token = getAuthToken()
  if (!token) {
    showToast('다시 로그인해 주세요.', 'error')
    return false
  }
  const result = await supabase.rpc('review_place_change_request_tx', {
    p_token: token,
    p_request_id: id,
    p_status: status,
    p_review_note: '',
  })
  if (result.error || result.data?.ok !== true) {
    reportMutationError('요청 상태를 저장하지 못했습니다.', result.error ?? new Error('Missing review result'))
    return false
  }
  showToast(status === 'completed' ? '처리 완료로 표시했습니다.' : '요청을 반려했습니다.')
  return true
}

export async function executePlaceDeletionRequest(id: number): Promise<boolean> {
  const token = getAuthToken()
  if (!token) {
    showToast('다시 로그인해 주세요.', 'error')
    return false
  }
  const result = await supabase.rpc('execute_place_deletion_request_tx', {
    p_token: token,
    p_request_id: id,
  })
  if (result.error || result.data?.ok !== true || result.data?.action !== 'deleted') {
    reportMutationError('장소를 삭제하지 못했습니다.', result.error ?? new Error('Missing deletion result'))
    return false
  }
  showToast('장소와 연결 자료를 삭제했습니다')
  return true
}

export async function submitPlaceChangeRequest(input: {
  requestType: PlaceIssueType
  buildingId: number
  unitId?: number | null
  note?: string
}): Promise<boolean> {
  const token = getAuthToken()
  if (!token) {
    showToast('다시 로그인해 주세요.', 'error')
    return false
  }
  const result = await supabase.rpc('submit_place_change_request_tx', {
    p_token: token,
    p_request_type: input.requestType,
    p_building_id: input.buildingId,
    p_unit_id: input.unitId ?? null,
    p_return_visit_id: null,
    p_note: input.note?.trim() ?? '',
  })
  if (result.error || result.data?.ok !== true) {
    reportMutationError('자료 수정 요청을 보내지 못했습니다.', result.error ?? new Error('Missing request result'))
    return false
  }
  showToast('관리자에게 자료 수정 요청을 보냈습니다')
  return true
}
