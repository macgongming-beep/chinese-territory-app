import type { Building, ReturnVisit, TerritoryCard } from '../../types'
import { supabase, showToast, reportMutationError, requireVisitor } from './shared'

export function makeRegularVisitMutations(deps: {
  fetchAll: () => Promise<void>
  buildings: Building[]
  cards: TerritoryCard[]
  returnVisits: ReturnVisit[]
}) {
  const { fetchAll, buildings, returnVisits } = deps

  // 표시 이름: 건물명 + 호수 (이전에는 카드에서 동 이름을 추출했는데 불필요하게 앞에 붙음)
  const getReturnVisitDisplayName = (building: Building, unitNumber: string) => {
    return `${building.name} ${unitNumber}`
  }

  const syncReturnVisitForUnit = async (building: Building, unitId: number, visitorName: string) => {
    const unit = building.units.find((u) => u.id === unitId)
    if (!unit) return

    const existing = returnVisits.find((rv) => rv.unitId === unitId)
    const payload = {
      unit_id: unitId,
      building_id: building.id,
      display_name: existing?.displayName || getReturnVisitDisplayName(building, unit.number),
      address: building.address,
      unit_number: unit.number,
      assigned_user_name: visitorName,
      created_by: existing?.createdBy || visitorName,
    }

    const result = existing
      ? await supabase.from('return_visits').update(payload).eq('id', existing.id)
      : await supabase.from('return_visits').insert(payload)

    if (result.error) {
      reportMutationError('활동 정기방문 목록을 동기화하지 못했습니다.', result.error)
    }
  }

  const toggleRegularVisit = async (buildingId: number, unitId: number, visitorName?: string) => {
    const building = buildings.find((b) => b.id === buildingId)
    const unit = building?.units.find((u) => u.id === unitId)
    if (!building || !unit) return

    if (unit.isRegularVisit) {
      const result = await supabase.from('regular_visits').delete().eq('unit_id', unitId)
      if (result.error) {
        reportMutationError('정기방문을 해제하지 못했습니다.', result.error)
        return
      }
      await fetchAll()
      showToast('정기방문이 해제됐습니다')
    } else {
      const name = visitorName || requireVisitor()
      if (!name) return
      const result = await supabase.from('regular_visits').insert({ unit_id: unitId, visitor_name: name, registered_at: new Date().toISOString() })
      if (result.error) {
        reportMutationError('정기방문을 등록하지 못했습니다.', result.error)
        return
      }

      await syncReturnVisitForUnit(building, unitId, name)
      await fetchAll()
      showToast('정기방문이 등록됐습니다')
    }
  }

  const setRegularVisitor = async (unitId: number, visitorName: string, registeredAt?: string) => {
    const building = buildings.find((item) => item.units.some((unit) => unit.id === unitId))
    const name = visitorName.trim()
    if (!name) {
      const result = await supabase.from('regular_visits').delete().eq('unit_id', unitId)
      if (result.error) {
        reportMutationError('정기방문자를 해제하지 못했습니다.', result.error)
        return
      }
      await fetchAll()
      showToast('정기방문자가 해제됐습니다')
      return
    }

    const upsertData: Record<string, unknown> = { unit_id: unitId, visitor_name: name }
    if (registeredAt) upsertData.registered_at = registeredAt

    const result = await supabase
      .from('regular_visits')
      .upsert(upsertData, { onConflict: 'unit_id' })

    if (result.error) {
      reportMutationError('정기방문자를 저장하지 못했습니다.', result.error)
      return
    }
    if (building) {
      await syncReturnVisitForUnit(building, unitId, name)
    }
    await fetchAll()
    showToast('정기방문자가 저장됐습니다')
  }

  const toggleChinese = async (buildingId: number, unitId: number) => {
    const building = buildings.find((b) => b.id === buildingId)
    const unit = building?.units.find((u) => u.id === unitId)
    if (!building || !unit) return

    const newValue = !unit.isChinese
    const result = await supabase.from('units').update({ is_chinese: newValue }).eq('id', unitId)
    if (result.error) {
      reportMutationError('중국인 거주 여부를 저장하지 못했습니다.', result.error)
      return
    }
    await fetchAll()
    showToast(newValue ? '중국인 거주가 등록됐습니다' : '중국인 거주가 해제됐습니다')
  }

  const addReturnVisitLog = async (
    returnVisitId: number,
    result: '만남' | '부재' | null,
    memo: string,
  ) => {
    const visitor = requireVisitor()
    if (!visitor) return
    const now = new Date().toISOString()
    const logRes = await supabase.from('return_visit_logs').insert({
      return_visit_id: returnVisitId,
      result: result ?? null,
      memo,
      created_by: visitor,
      visited_at: now,
    })
    if (logRes.error) {
      reportMutationError('기록을 저장하지 못했습니다.', logRes.error)
      return
    }
    if (result) {
      const updRes = await supabase.from('return_visits')
        .update({ last_visited_at: now, last_result: result })
        .eq('id', returnVisitId)
      if (updRes.error) {
        // 로그는 저장됐지만 요약 갱신 실패 → 조용히 stale 되지 않게 알림
        console.warn('정기방문 요약(last_*) 갱신 실패:', updRes.error)
        showToast('기록은 저장됐지만 요약 갱신에 실패했어요. 새로고침 해주세요.', 'info')
        await fetchAll()
        return
      }
    }
    await fetchAll()
    showToast('기록이 저장됐습니다')
  }

  const createManualReturnVisit = async (input: {
    displayName: string
    address: string
    memo: string
    unitId?: number | null
    buildingId?: number | null
  }) => {
    const visitor = requireVisitor()
    if (!visitor) return
    const res = await supabase.from('return_visits').insert({
      unit_id: input.unitId ?? null,
      building_id: input.buildingId ?? null,
      display_name: input.displayName,
      nickname: input.displayName,
      address: input.address,
      unit_number: '',
      assigned_user_name: visitor,
      created_by: visitor,
    })
    if (res.error) { reportMutationError('정기방문을 추가하지 못했습니다.', res.error); return }
    await fetchAll()
    showToast('정기방문이 추가됐습니다')
  }

  const updateReturnVisitLog = async (id: number, result: '만남' | '부재' | null, memo: string) => {
    const res = await supabase.from('return_visit_logs').update({ result: result ?? null, memo }).eq('id', id)
    if (res.error) { reportMutationError('기록을 수정하지 못했습니다.', res.error); return }
    await fetchAll()
    showToast('기록이 수정됐습니다')
  }

  const deleteReturnVisitLog = async (id: number) => {
    const res = await supabase.from('return_visit_logs').delete().eq('id', id)
    if (res.error) {
      reportMutationError('기록을 삭제하지 못했습니다.', res.error)
      return
    }
    await fetchAll()
    showToast('기록이 삭제됐습니다')
  }

  const deleteReturnVisit = async (id: number) => {
    const res = await supabase.from('return_visits').delete().eq('id', id)
    if (res.error) {
      reportMutationError('정기방문을 삭제하지 못했습니다.', res.error)
      return
    }
    await fetchAll()
    showToast('정기방문이 삭제됐습니다')
  }

  const updateReturnVisitNickname = async (id: number, nickname: string) => {
    const res = await supabase.from('return_visits').update({ nickname: nickname.trim() }).eq('id', id)
    if (res.error) { reportMutationError('별칭을 저장하지 못했습니다.', res.error); return }
    await fetchAll()
    showToast('별칭이 저장됐습니다')
  }

  const updateReturnVisitAddress = async (id: number, address: string) => {
    const res = await supabase.from('return_visits').update({ address: address.trim() }).eq('id', id)
    if (res.error) { reportMutationError('주소를 저장하지 못했습니다.', res.error); return }
    await fetchAll()
    showToast('주소가 저장됐습니다')
  }

  // 정기방문 담당자 재배정 (전출/삭제로 끊긴 정기방문을 다른 봉사자에게)
  const reassignReturnVisit = async (id: number, newAssignee: string) => {
    const res = await supabase.from('return_visits').update({ assigned_user_name: newAssignee.trim() }).eq('id', id)
    if (res.error) { reportMutationError('담당자를 변경하지 못했습니다.', res.error); return }
    await fetchAll()
    showToast(`담당자가 ${newAssignee.trim()}님으로 변경됐습니다`)
  }

  return {
    reassignReturnVisit,
    toggleRegularVisit,
    setRegularVisitor,
    toggleChinese,
    addReturnVisitLog,
    createManualReturnVisit,
    updateReturnVisitLog,
    deleteReturnVisitLog,
    deleteReturnVisit,
    updateReturnVisitNickname,
    updateReturnVisitAddress,
  }
}
