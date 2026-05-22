import type { ServiceSession, TimeSlot, Unit, UnitStatus, VisitHistory } from '../../types'
import { getCurrentTimeSlot } from '../../utils/timeUtils'
import { supabase, showToast, reportMutationError, getLocalDateString } from './shared'

export function makeVisitMutations(deps: {
  fetchAll: () => Promise<void>
  visitHistories: VisitHistory[]
  /** 봉사 세션 기록을 위한 헬퍼 (useStore 내부에서 주입) */
  getRecordServiceSession: (buildingId?: number, visitedAt?: string) => ServiceSession | undefined
  /** 활성 특별봉사 시즌 ID 반환 */
  getActiveSpecialPeriodIdForDate: (dateStr: string) => number | null
}) {
  const { fetchAll, visitHistories, getRecordServiceSession, getActiveSpecialPeriodIdForDate } = deps

  const updateUnitStatus = async (
    buildingId: number,
    unitId: number,
    status: UnitStatus,
    memo?: string,
    timeSlot: TimeSlot = getCurrentTimeSlot(),
    invitationLeft: boolean = false,
  ) => {
    const recordSession = getRecordServiceSession(buildingId)
    const effectiveTimeSlot = recordSession?.timeSlot ?? timeSlot
    const statusResult = await supabase.from('units').update({ status }).eq('id', unitId)
    if (statusResult.error) {
      reportMutationError('호수 상태를 저장하지 못했습니다.', statusResult.error)
      return
    }

    const visitedAt = getLocalDateString()
    const visitor = localStorage.getItem('currentVisitor') ?? '김민준'
    const existingAttemptResult = await supabase
      .from('visit_histories')
      .select('id')
      .eq('unit_id', unitId)
      .eq('visitor_name', visitor)
      .eq('visited_at', visitedAt)
      .eq('time_slot', effectiveTimeSlot)
      .order('created_at', { ascending: false })
      .limit(1)

    if (existingAttemptResult.error) {
      reportMutationError('기존 방문 이력을 확인하지 못했습니다. 호수 상태는 변경됐을 수 있습니다.', existingAttemptResult.error)
      return
    }

    const existingAttempt = existingAttemptResult.data?.[0]
    const activePeriodId = getActiveSpecialPeriodIdForDate(visitedAt)
    const historyPayload = {
      result: status,
      memo: memo?.trim() || null,
      ...(recordSession ? { service_session_id: recordSession.id } : {}),
      special_period_id: activePeriodId,
      invitation_left: invitationLeft,
    }
    const historyResult = existingAttempt
      ? await supabase.from('visit_histories').update(historyPayload).eq('id', existingAttempt.id)
      : await supabase.from('visit_histories').insert({
          unit_id: unitId,
          visitor_name: visitor,
          result: status,
          time_slot: effectiveTimeSlot,
          ...(recordSession ? { service_session_id: recordSession.id } : {}),
          memo: memo?.trim() || null,
          visited_at: visitedAt,
          special_period_id: activePeriodId,
          invitation_left: invitationLeft,
        })

    if (historyResult.error) {
      reportMutationError('방문 이력을 저장하지 못했습니다. 호수 상태는 변경됐을 수 있습니다.', historyResult.error)
      return
    }
    await fetchAll()
  }

  // mode: 'direct' = 직접 전달(만남), 'door' = 문 앞에 남김(부재)
  // mode 없이 호출하면 기존 레코드 토글(끄기)만 동작
  const toggleInvitationLeft = async (buildingId: number, unitId: number, mode?: 'direct' | 'door') => {
    const todayStr = getLocalDateString()
    const recordSession = getRecordServiceSession(buildingId)
    const slot = recordSession?.timeSlot ?? getCurrentTimeSlot()
    const visitor = localStorage.getItem('currentVisitor') ?? '김민준'

    const existingResult = await supabase
      .from('visit_histories')
      .select('id, invitation_left, result')
      .eq('unit_id', unitId)
      .eq('visitor_name', visitor)
      .eq('visited_at', todayStr)
      .eq('time_slot', slot)
      .order('created_at', { ascending: false })
      .limit(1)

    if (existingResult.error) {
      reportMutationError('기존 방문 기록 확인에 실패했습니다.', existingResult.error)
      return
    }

    const existing = existingResult.data?.[0]

    if (existing) {
      // 이미 초대장 켜져 있으면 끄기 (mode 무관)
      if (existing.invitation_left) {
        const updateResult = await supabase
          .from('visit_histories')
          .update({ invitation_left: false })
          .eq('id', existing.id)
        if (updateResult.error) {
          reportMutationError('초대장 표시를 업데이트하지 못했습니다.', updateResult.error)
          return
        }
      } else if (mode) {
        // 초대장 켜기 + 결과 업데이트
        const newResult = mode === 'direct' ? '만남' : '부재'
        const updateResult = await supabase
          .from('visit_histories')
          .update({ invitation_left: true, result: newResult })
          .eq('id', existing.id)
        if (updateResult.error) {
          reportMutationError('초대장 표시를 업데이트하지 못했습니다.', updateResult.error)
          return
        }
      }
    } else if (mode) {
      // 오늘 기록 없음 → 새 기록 생성
      const activePeriodId = getActiveSpecialPeriodIdForDate(todayStr)
      const newResult = mode === 'direct' ? '만남' : '부재'
      const insertResult = await supabase.from('visit_histories').insert({
        unit_id: unitId,
        visitor_name: visitor,
        result: newResult,
        visited_at: todayStr,
        time_slot: slot,
        ...(recordSession ? { service_session_id: recordSession.id } : {}),
        special_period_id: activePeriodId,
        invitation_left: true,
      })
      if (insertResult.error) {
        reportMutationError('초대장 기록을 저장하지 못했습니다.', insertResult.error)
        return
      }
    }
    await fetchAll()
  }

  const quickLogVisit = async (
    buildingId: number,
    unitId: number,
    result: UnitStatus,
    invitationLeft: boolean = false,
  ) => {
    const todayStr = getLocalDateString()
    const recordSession = getRecordServiceSession(buildingId)
    const slot = recordSession?.timeSlot ?? getCurrentTimeSlot()
    const visitor = localStorage.getItem('currentVisitor') ?? '김민준'

    const unitUpdate = await supabase.from('units').update({ status: result }).eq('id', unitId)
    if (unitUpdate.error) {
      reportMutationError('세대 상태를 업데이트하지 못했습니다.', unitUpdate.error)
      return
    }

    const existingResult = await supabase
      .from('visit_histories')
      .select('id')
      .eq('unit_id', unitId)
      .eq('visitor_name', visitor)
      .eq('visited_at', todayStr)
      .eq('time_slot', slot)
      .order('created_at', { ascending: false })
      .limit(1)

    if (existingResult.error) {
      reportMutationError('기존 방문 기록 확인에 실패했습니다.', existingResult.error)
      return
    }

    const existing = existingResult.data?.[0]
    let historyStatus = ''

    if (existing) {
      const updateResult = await supabase
        .from('visit_histories')
        .update({
          result,
          ...(recordSession ? { service_session_id: recordSession.id } : {}),
          ...(invitationLeft ? { invitation_left: true } : {}),
        })
        .eq('id', existing.id)
      if (updateResult.error) {
        reportMutationError('방문 기록을 업데이트하지 못했습니다.', updateResult.error)
        return
      }
      historyStatus = '업데이트됨'
    } else {
      const activePeriodId = getActiveSpecialPeriodIdForDate(todayStr)
      const insertResult = await supabase.from('visit_histories').insert({
        unit_id: unitId,
        visitor_name: visitor,
        result,
        visited_at: todayStr,
        time_slot: slot,
        ...(recordSession ? { service_session_id: recordSession.id } : {}),
        special_period_id: activePeriodId,
        invitation_left: invitationLeft,
      })
      if (insertResult.error) {
        reportMutationError('방문 기록을 저장하지 못했습니다.', insertResult.error)
        return
      }
      historyStatus = '기록됨'
    }

    await fetchAll()
    showToast(`${slot} ${result} ${historyStatus}`, 'success')
  }

  const updateUnitFlags = async (unitId: number, flags: Partial<Unit>) => {
    const dbFlags: Record<string, unknown> = {}
    if (flags.isChinese !== undefined) dbFlags.is_chinese = flags.isChinese
    if (flags.isKorean !== undefined) dbFlags.is_korean = flags.isKorean
    if (flags.memo !== undefined) dbFlags.memo = flags.memo
    if (flags.number !== undefined) dbFlags.number = flags.number

    if (Object.keys(dbFlags).length > 0) {
      const result = await supabase.from('units').update(dbFlags).eq('id', unitId)
      if (result.error) {
        reportMutationError('세대 정보를 수정하지 못했습니다.', result.error)
        return
      }
    }

    if (flags.isForbidden !== undefined) {
      const statusResult = await supabase
        .from('units')
        .update({ status: flags.isForbidden ? '거절' : '미방문' })
        .eq('id', unitId)
      if (statusResult.error) {
        reportMutationError('방문금지 상태를 수정하지 못했습니다.', statusResult.error)
        return
      }
    }
    await fetchAll()
  }

  const undoLatestVisit = async (_buildingId: number, unitId: number) => {
    const unitHistories = visitHistories.filter((h) => h.unitId === unitId)
    const latestHistory = unitHistories[0]
    const previousHistory = unitHistories[1]
    if (!latestHistory) return

    const deleteResult = await supabase.from('visit_histories').delete().eq('id', latestHistory.id)
    if (deleteResult.error) {
      reportMutationError('최근 방문 이력을 취소하지 못했습니다.', deleteResult.error)
      return
    }

    const restoreStatus: UnitStatus = previousHistory?.result ?? '미방문'
    const statusResult = await supabase.from('units').update({ status: restoreStatus }).eq('id', unitId)
    if (statusResult.error) {
      reportMutationError('방문 이력은 취소됐지만 호수 상태를 되돌리지 못했습니다.', statusResult.error)
      return
    }

    await fetchAll()
    showToast('최근 입력이 취소됐습니다')
  }

  const updateVisitHistory = async (
    historyId: number,
    unitId: number,
    input: { result: UnitStatus; timeSlot: TimeSlot; memo: string; visitedAt: string },
  ) => {
    const historyResult = await supabase
      .from('visit_histories')
      .update({
        result: input.result,
        time_slot: input.timeSlot,
        memo: input.memo.trim() || null,
        visited_at: input.visitedAt,
      })
      .eq('id', historyId)

    if (historyResult.error) {
      reportMutationError('방문 이력을 수정하지 못했습니다.', historyResult.error)
      return
    }

    const latestHistory = visitHistories.find((h) => h.unitId === unitId)
    if (latestHistory?.id === historyId) {
      const statusResult = await supabase.from('units').update({ status: input.result }).eq('id', unitId)
      if (statusResult.error) {
        reportMutationError('방문 이력은 수정됐지만 호수 대표 상태를 맞추지 못했습니다.', statusResult.error)
        return
      }
    }
    await fetchAll()
  }

  const addVisitHistory = async (
    buildingId: number,
    unitId: number,
    input: { result: UnitStatus; timeSlot: TimeSlot; memo: string; visitedAt: string; invitationLeft?: boolean },
  ) => {
    const recordSession = getRecordServiceSession(buildingId, input.visitedAt)
    const activePeriodId = getActiveSpecialPeriodIdForDate(input.visitedAt)
    const visitor = localStorage.getItem('currentVisitor') ?? '김민준'

    const insertResult = await supabase.from('visit_histories').insert({
      unit_id: unitId,
      visitor_name: visitor,
      result: input.result,
      time_slot: input.timeSlot,
      ...(recordSession ? { service_session_id: recordSession.id, time_slot: recordSession.timeSlot } : {}),
      memo: input.memo.trim() || null,
      visited_at: input.visitedAt,
      special_period_id: activePeriodId,
      invitation_left: input.invitationLeft ?? false,
    })

    if (insertResult.error) {
      reportMutationError('방문 이력을 추가하지 못했습니다.', insertResult.error)
      return
    }

    const unitHistories = visitHistories.filter((h) => h.unitId === unitId)
    const latestExistingDate = unitHistories[0]?.visitedAt ?? ''
    if (!latestExistingDate || input.visitedAt >= latestExistingDate) {
      const statusResult = await supabase.from('units').update({ status: input.result }).eq('id', unitId)
      if (statusResult.error) {
        reportMutationError('방문 이력은 추가됐지만 호수 대표 상태를 맞추지 못했습니다.', statusResult.error)
        return
      }
    }
    await fetchAll()
    showToast('방문 기록이 추가됐습니다')
  }

  const deleteVisitHistory = async (historyId: number, unitId: number) => {
    const result = await supabase.from('visit_histories').delete().eq('id', historyId)
    if (result.error) {
      reportMutationError('방문 히스토리 삭제를 실패했습니다.', result.error)
      return
    }

    const remainingHistories = visitHistories.filter((h) => h.unitId === unitId && h.id !== historyId)
    const latestRemaining = remainingHistories[0]
    const newStatus = latestRemaining?.result ?? '미방문'

    const statusUpdate = await supabase.from('units').update({ status: newStatus }).eq('id', unitId)
    if (statusUpdate.error) {
      reportMutationError('호수 상태 동기화에 실패했습니다.', statusUpdate.error)
    }

    await fetchAll()
    showToast('방문 기록이 삭제되었습니다.')
  }

  return {
    updateUnitStatus,
    toggleInvitationLeft,
    quickLogVisit,
    updateUnitFlags,
    undoLatestVisit,
    updateVisitHistory,
    addVisitHistory,
    deleteVisitHistory,
  }
}
