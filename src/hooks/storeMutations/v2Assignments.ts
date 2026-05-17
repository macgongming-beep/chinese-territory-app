// v2 신 배정 모델 mutations
// - 비공식 자료 풀 관리 (informal_assets)
// - event_informal_assignments / event_restaurant_assignments
// - buildings.is_restaurant 마킹
import { supabase } from '../../lib/supabase'
import { showToast } from '../../lib/toast'

export function makeV2AssignmentMutations(deps: { fetchAll: () => Promise<void> }) {
  const { fetchAll } = deps

  // ── 비공식 자료 풀 ────────────────────────────────
  const uploadInformalAsset = async (input: {
    file: File
    name: string
    uploadedBy: string
    groupId?: number | null
  }): Promise<{ ok: boolean; assetId?: number; error?: string }> => {
    const ext = input.file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`
    const path = `${id}.${ext}`

    // Storage 업로드
    const { error: uploadError } = await supabase.storage
      .from('informal-assets')
      .upload(path, input.file, {
        cacheControl: '31536000',
        upsert: false,
        contentType: input.file.type || `image/${ext}`,
      })
    if (uploadError) {
      showToast(`업로드 실패: ${uploadError.message}`, 'error')
      return { ok: false, error: uploadError.message }
    }

    const { data: pub } = supabase.storage.from('informal-assets').getPublicUrl(path)
    const imageUrl = pub.publicUrl

    // DB INSERT
    const { data, error } = await supabase
      .from('informal_assets')
      .insert({
        name: input.name.trim() || '비공식 증거 카드',
        image_url: imageUrl,
        image_path: path,
        uploaded_by: input.uploadedBy,
        archived: false,
        group_id: input.groupId ?? null,
      })
      .select('id')
      .single()
    if (error) {
      // Storage 롤백
      await supabase.storage.from('informal-assets').remove([path])
      showToast(`등록 실패: ${error.message}`, 'error')
      return { ok: false, error: error.message }
    }
    await fetchAll()
    return { ok: true, assetId: data?.id }
  }

  // ── 비공식 그룹 ────────────────────────────────────
  const createInformalGroup = async (input: { name: string; createdBy: string }) => {
    const { data, error } = await supabase
      .from('informal_groups')
      .insert({ name: input.name.trim() || '새 그룹', created_by: input.createdBy })
      .select('id')
      .single()
    if (error) {
      showToast(`그룹 생성 실패: ${error.message}`, 'error')
      return null
    }
    await fetchAll()
    return data?.id ?? null
  }

  const renameInformalGroup = async (groupId: number, name: string) => {
    const { error } = await supabase
      .from('informal_groups')
      .update({ name: name.trim() || '새 그룹' })
      .eq('id', groupId)
    if (error) showToast(`그룹 이름 변경 실패: ${error.message}`, 'error')
    else await fetchAll()
  }

  const deleteInformalGroup = async (groupId: number) => {
    // 그룹 내 자료는 group_id 가 NULL 로 풀림 (FK on delete set null)
    const { error } = await supabase.from('informal_groups').delete().eq('id', groupId)
    if (error) showToast(`그룹 삭제 실패: ${error.message}`, 'error')
    else await fetchAll()
  }

  const moveAssetToGroup = async (assetId: number, groupId: number | null) => {
    const { error } = await supabase
      .from('informal_assets')
      .update({ group_id: groupId })
      .eq('id', assetId)
    if (error) showToast(`자료 이동 실패: ${error.message}`, 'error')
    else await fetchAll()
  }

  const deleteInformalAsset = async (assetId: number) => {
    // 자료 행 + storage 파일 둘 다 삭제
    const { data: row } = await supabase
      .from('informal_assets')
      .select('image_path')
      .eq('id', assetId)
      .maybeSingle()
    if (row?.image_path) {
      await supabase.storage.from('informal-assets').remove([row.image_path]).catch(() => {})
    }
    const { error } = await supabase.from('informal_assets').delete().eq('id', assetId)
    if (error) showToast(`자료 삭제 실패: ${error.message}`, 'error')
    else await fetchAll()
  }

  // ── 비공식 배정 ────────────────────────────────────
  const assignInformalToUser = async (input: {
    eventId: number
    userName: string
    assetId: number
    assignedBy: string
  }) => {
    const { error } = await supabase.from('event_informal_assignments').insert({
      event_id: input.eventId,
      user_name: input.userName,
      asset_id: input.assetId,
      assigned_by: input.assignedBy,
    })
    if (error) {
      if (error.code === '23505') {
        showToast('이미 배정된 자료입니다.', 'info')
      } else {
        showToast(`비공식 배정 실패: ${error.message}`, 'error')
      }
      return false
    }
    await fetchAll()
    return true
  }

  const removeInformalAssignment = async (assignmentId: number) => {
    const { error } = await supabase
      .from('event_informal_assignments')
      .delete()
      .eq('id', assignmentId)
    if (error) showToast(`배정 해제 실패: ${error.message}`, 'error')
    else await fetchAll()
  }

  // ── 식당 배정 ──────────────────────────────────────
  const assignRestaurantToUser = async (input: {
    eventId: number
    userName: string
    buildingId: number
    assignedBy: string
  }) => {
    const { error } = await supabase.from('event_restaurant_assignments').insert({
      event_id: input.eventId,
      user_name: input.userName,
      building_id: input.buildingId,
      assigned_by: input.assignedBy,
    })
    if (error) {
      showToast(`식당 배정 실패: ${error.message}`, 'error')
      return false
    }
    await fetchAll()
    return true
  }

  const removeRestaurantAssignment = async (assignmentId: number) => {
    const { error } = await supabase
      .from('event_restaurant_assignments')
      .delete()
      .eq('id', assignmentId)
    if (error) showToast(`식당 배정 해제 실패: ${error.message}`, 'error')
    else await fetchAll()
  }

  // ── 식당 마킹 (buildings.is_restaurant) ────────────
  const toggleBuildingRestaurant = async (buildingId: number, isRestaurant: boolean) => {
    const { error } = await supabase
      .from('buildings')
      .update({ is_restaurant: isRestaurant })
      .eq('id', buildingId)
    if (error) showToast(`식당 표시 변경 실패: ${error.message}`, 'error')
    else await fetchAll()
  }

  return {
    uploadInformalAsset,
    deleteInformalAsset,
    createInformalGroup,
    renameInformalGroup,
    deleteInformalGroup,
    moveAssetToGroup,
    assignInformalToUser,
    removeInformalAssignment,
    assignRestaurantToUser,
    removeRestaurantAssignment,
    toggleBuildingRestaurant,
  }
}
