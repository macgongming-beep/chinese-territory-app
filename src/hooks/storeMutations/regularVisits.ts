import type { Building, ReturnVisit, TerritoryCard } from '../../types'
import { supabase, showToast, reportMutationError } from './shared'

export function makeRegularVisitMutations(deps: {
  fetchAll: () => Promise<void>
  buildings: Building[]
  cards: TerritoryCard[]
  returnVisits: ReturnVisit[]
}) {
  const { fetchAll, buildings, cards, returnVisits } = deps

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
      const name = visitorName || (localStorage.getItem('currentVisitor') ?? '김민준')
      const result = await supabase.from('regular_visits').insert({ unit_id: unitId, visitor_name: name, registered_at: new Date().toISOString() })
      if (result.error) {
        reportMutationError('정기방문을 등록하지 못했습니다.', result.error)
        return
      }

      // return_visits 생성 (중복 방지: 같은 unit_id 존재 시 skip)
      const existing = returnVisits.find((rv) => rv.unitId === unitId)
      if (!existing) {
        const card = cards.find((c) => c.id === building.cardId)
        const region = (card?.region as string) ?? ''
        const cardName = card?.name ?? ''
        let nameWithoutRegion = cardName
        for (const r of ['처인구', '기흥구', '수지구', '영통구', '화성시']) {
          if (cardName.startsWith(r)) { nameWithoutRegion = cardName.slice(r.length).trim(); break }
        }
        if (region && nameWithoutRegion === cardName && cardName.startsWith(region)) {
          nameWithoutRegion = cardName.slice(region.length).trim()
        }
        const dong = nameWithoutRegion.split(' ')[0] || building.name
        const displayName = `${dong} ${unit.number}`
        await supabase.from('return_visits').insert({
          unit_id: unitId,
          building_id: buildingId,
          display_name: displayName,
          address: building.address,
          unit_number: unit.number,
          assigned_user_name: name,
          created_by: name,
        })
      }
      await fetchAll()
      showToast('정기방문이 등록됐습니다')
    }
  }

  const setRegularVisitor = async (unitId: number, visitorName: string) => {
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

    const result = await supabase
      .from('regular_visits')
      .upsert({ unit_id: unitId, visitor_name: name }, { onConflict: 'unit_id' })

    if (result.error) {
      reportMutationError('정기방문자를 저장하지 못했습니다.', result.error)
      return
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
    const visitor = localStorage.getItem('currentVisitor') ?? '김민준'
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
      await supabase.from('return_visits')
        .update({ last_visited_at: now, last_result: result })
        .eq('id', returnVisitId)
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
    const visitor = localStorage.getItem('currentVisitor') ?? '김민준'
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

  return {
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
