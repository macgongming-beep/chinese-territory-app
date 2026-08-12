import type { Building, ServiceSession, TerritoryCard, TimeSlot, Unit, UnitStatus, VisitHistory } from '../../types'
import { getCurrentTimeSlot } from '../../utils/timeUtils'
import { supabase, showToast, reportMutationError, getLocalDateString, requireVisitor } from './shared'
import { logServiceAction } from './serviceLog'
import { t, currentLang } from '../../i18n'
import { msg } from '../../lib/msg'

export function makeVisitMutations(deps: {
  fetchAll: () => Promise<void>
  visitHistories: VisitHistory[]
  buildings: Building[]
  cards: TerritoryCard[]
  /** 봉사 세션 기록을 위한 헬퍼 (useStore 내부에서 주입) */
  getRecordServiceSession: (buildingId?: number, visitedAt?: string) => ServiceSession | undefined
  /** 활성 특별봉사 시즌 ID 반환 */
  getActiveSpecialPeriodIdForDate: (dateStr: string) => number | null
  /**
   * 저장 성공한 세대 변경을 화면 상태에 바로 반영한다.
   * 이게 없으면 건물 전체(1,000여 개 · 440KB)를 매번 다시 받아야 해서
   * 기록 하나 남길 때마다 눈에 띄게 느려진다.
   */
  patchUnit: (unitId: number, patch: Partial<Unit>) => void
}) {
  const { fetchAll, visitHistories, buildings, cards, getRecordServiceSession, getActiveSpecialPeriodIdForDate, patchUnit } = deps

  /** buildingId 로 카드·건물 컨텍스트 반환 */
  function getBuildingContext(buildingId: number) {
    const building = buildings.find((b) => b.id === buildingId)
    const card = building ? cards.find((c) => c.id === building.cardId) : undefined
    return {
      cardId: card?.id ?? null,
      cardName: card?.name ?? null,
      buildingName: building?.name ?? null,
    }
  }

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
      reportMutationError(msg('호수 상태를 저장하지 못했습니다.'), statusResult.error)
      return
    }
    patchUnit(unitId, { status })

    const visitedAt = getLocalDateString()
    const visitor = requireVisitor()
    if (!visitor) return
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
      reportMutationError(msg('기존 방문 이력을 확인하지 못했습니다. 호수 상태는 변경됐을 수 있습니다.'), existingAttemptResult.error)
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
      reportMutationError(msg('방문 이력을 저장하지 못했습니다. 호수 상태는 변경됐을 수 있습니다.'), historyResult.error)
      return
    }
    // 봉사 로그: 상태 직접 변경
    const ctxUs = getBuildingContext(buildingId)
    void logServiceAction({
      sessionId: recordSession?.id ?? null,
      cardId: ctxUs.cardId,
      action: 'visit_recorded',
      targetType: 'unit',
      targetId: unitId,
      details: {
        building_name: ctxUs.buildingName,
        card_name: ctxUs.cardName,
        result: status,
        time_slot: effectiveTimeSlot,
      },
    })

    await fetchAll()
  }

  // mode: 'direct' = 직접 전달(만남), 'door' = 문 앞에 남김(부재)
  // mode 없이 호출하면 기존 레코드 토글(끄기)만 동작
  const toggleInvitationLeft = async (buildingId: number, unitId: number, mode?: 'direct' | 'door') => {
    const todayStr = getLocalDateString()
    const recordSession = getRecordServiceSession(buildingId)
    const slot = recordSession?.timeSlot ?? getCurrentTimeSlot()
    const visitor = requireVisitor()
    if (!visitor) return

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
      reportMutationError(msg('기존 방문 기록 확인에 실패했습니다.'), existingResult.error)
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
          reportMutationError(msg('초대장 표시를 업데이트하지 못했습니다.'), updateResult.error)
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
          reportMutationError(msg('초대장 표시를 업데이트하지 못했습니다.'), updateResult.error)
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
        reportMutationError(msg('초대장 기록을 저장하지 못했습니다.'), insertResult.error)
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
    const visitor = requireVisitor()
    if (!visitor) return

    const unitUpdate = await supabase.from('units').update({ status: result }).eq('id', unitId)
    if (unitUpdate.error) {
      reportMutationError(msg('세대 상태를 업데이트하지 못했습니다.'), unitUpdate.error)
      return
    }
    patchUnit(unitId, { status: result })

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
      reportMutationError(msg('기존 방문 기록 확인에 실패했습니다.'), existingResult.error)
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
        reportMutationError(msg('방문 기록을 업데이트하지 못했습니다.'), updateResult.error)
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
        reportMutationError(msg('방문 기록을 저장하지 못했습니다.'), insertResult.error)
        return
      }
      historyStatus = '기록됨'
    }

    // 봉사 로그: 퀵 방문 기록
    const ctx = getBuildingContext(buildingId)
    void logServiceAction({
      sessionId: recordSession?.id ?? null,
      cardId: ctx.cardId,
      action: 'visit_recorded',
      targetType: 'unit',
      targetId: unitId,
      details: {
        building_name: ctx.buildingName,
        card_name: ctx.cardName,
        result,
        time_slot: slot,
        visited_at: todayStr,
      },
    })

    await fetchAll()
    showToast(`${slot} ${result} ${historyStatus}`, 'success')
  }

  const updateUnitFlags = async (unitId: number, flags: Partial<Unit>) => {
    const dbFlags: Record<string, unknown> = {}
    if (flags.isChinese !== undefined) dbFlags.is_chinese = flags.isChinese
    // 식당 여부(업종) — 중국어 사용 여부와 별개로 저장한다
    if (flags.isRestaurant !== undefined) dbFlags.is_restaurant = flags.isRestaurant
    if (flags.isKorean !== undefined) dbFlags.is_korean = flags.isKorean
    if (flags.memo !== undefined) dbFlags.memo = flags.memo
    if (flags.number !== undefined) dbFlags.number = flags.number

    if (Object.keys(dbFlags).length > 0) {
      const result = await supabase.from('units').update(dbFlags).eq('id', unitId)
      if (result.error) {
        reportMutationError(msg('세대 정보를 수정하지 못했습니다.'), result.error)
        return
      }
      patchUnit(unitId, flags)
    }

    if (flags.isForbidden !== undefined) {
      const statusResult = await supabase
        .from('units')
        .update({ status: flags.isForbidden ? '거절' : '미방문' })
        .eq('id', unitId)
      if (statusResult.error) {
        reportMutationError(msg('방문금지 상태를 수정하지 못했습니다.'), statusResult.error)
        return
      }
      patchUnit(unitId, { isForbidden: flags.isForbidden, status: flags.isForbidden ? '거절' : '미방문' })
    }

    // 봉사 로그: 호수 플래그 변경
    const buildingForFlag = buildings.find((b) => b.units.some((u) => u.id === unitId))
    const ctxFlag = buildingForFlag ? getBuildingContext(buildingForFlag.id) : { cardId: null, cardName: null, buildingName: null }
    void logServiceAction({
      cardId: ctxFlag.cardId,
      action: 'unit_flag_changed',
      targetType: 'unit',
      targetId: unitId,
      details: {
        building_name: ctxFlag.buildingName,
        card_name: ctxFlag.cardName,
        ...Object.fromEntries(Object.entries(flags).map(([k, v]) => [k, v])),
      },
    })

    await fetchAll()
  }

  const undoLatestVisit = async (buildingId: number, unitId: number) => {
    const unitHistories = visitHistories.filter((h) => h.unitId === unitId)
    const latestHistory = unitHistories[0]
    const previousHistory = unitHistories[1]
    if (!latestHistory) return

    const deleteResult = await supabase.from('visit_histories').delete().eq('id', latestHistory.id)
    if (deleteResult.error) {
      reportMutationError(msg('최근 방문 이력을 취소하지 못했습니다.'), deleteResult.error)
      return
    }

    const restoreStatus: UnitStatus = previousHistory?.result ?? '미방문'
    const statusResult = await supabase.from('units').update({ status: restoreStatus }).eq('id', unitId)
    if (statusResult.error) {
      reportMutationError(msg('방문 이력은 취소됐지만 호수 상태를 되돌리지 못했습니다.'), statusResult.error)
      return
    }
    patchUnit(unitId, { status: restoreStatus })

    // 봉사 로그: 최근 방문 취소
    const ctx = getBuildingContext(buildingId)
    void logServiceAction({
      cardId: ctx.cardId,
      action: 'visit_deleted',
      targetType: 'visit_history',
      targetId: latestHistory.id,
      details: {
        building_name: ctx.buildingName,
        card_name: ctx.cardName,
        unit_id: unitId,
        result: latestHistory.result,
        visited_at: latestHistory.visitedAt,
        undo: true,
      },
    })

    await fetchAll()
    showToast(msg('최근 입력이 취소됐습니다'))
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
      reportMutationError(msg('방문 이력을 수정하지 못했습니다.'), historyResult.error)
      return
    }

    const latestHistory = visitHistories.find((h) => h.unitId === unitId)
    if (latestHistory?.id === historyId) {
      const statusResult = await supabase.from('units').update({ status: input.result }).eq('id', unitId)
      if (statusResult.error) {
        reportMutationError(msg('방문 이력은 수정됐지만 호수 대표 상태를 맞추지 못했습니다.'), statusResult.error)
        return
      }
      patchUnit(unitId, { status: input.result })
    }

    // 봉사 로그: 방문 기록 수정 (건물은 units 테이블 경유 → 기존 로그에서 building_id 역추적)
    const prevLog = visitHistories.find((h) => h.id === historyId)
    const buildingForUpdate = prevLog
      ? buildings.find((b) => b.id === prevLog.buildingId)
      : undefined
    const cardForUpdate = buildingForUpdate ? cards.find((c) => c.id === buildingForUpdate.cardId) : undefined
    void logServiceAction({
      cardId: cardForUpdate?.id ?? null,
      action: 'visit_updated',
      targetType: 'visit_history',
      targetId: historyId,
      details: {
        building_name: buildingForUpdate?.name ?? null,
        card_name: cardForUpdate?.name ?? null,
        unit_id: unitId,
        result: input.result,
        time_slot: input.timeSlot,
        visited_at: input.visitedAt,
        memo: input.memo?.trim() || null,
      },
    })

    await fetchAll()
  }

  const addVisitHistory = async (
    buildingId: number,
    unitId: number,
    input: { result: UnitStatus; timeSlot: TimeSlot; memo: string; visitedAt: string; invitationLeft?: boolean },
  ) => {
    const recordSession = getRecordServiceSession(buildingId, input.visitedAt)
    const activePeriodId = getActiveSpecialPeriodIdForDate(input.visitedAt)
    const visitor = requireVisitor()
    if (!visitor) return

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
      reportMutationError(msg('방문 이력을 추가하지 못했습니다.'), insertResult.error)
      return
    }

    const unitHistories = visitHistories.filter((h) => h.unitId === unitId)
    const latestExistingDate = unitHistories[0]?.visitedAt ?? ''
    if (!latestExistingDate || input.visitedAt >= latestExistingDate) {
      const statusResult = await supabase.from('units').update({ status: input.result }).eq('id', unitId)
      if (statusResult.error) {
        reportMutationError(msg('방문 이력은 추가됐지만 호수 대표 상태를 맞추지 못했습니다.'), statusResult.error)
        return
      }
      patchUnit(unitId, { status: input.result })
    }

    // 봉사 로그: 방문 기록 추가
    const ctx = getBuildingContext(buildingId)
    void logServiceAction({
      sessionId: recordSession?.id ?? null,
      cardId: ctx.cardId,
      action: 'visit_recorded',
      targetType: 'unit',
      targetId: unitId,
      details: {
        building_name: ctx.buildingName,
        card_name: ctx.cardName,
        result: input.result,
        time_slot: recordSession?.timeSlot ?? input.timeSlot,
        visited_at: input.visitedAt,
        memo: input.memo?.trim() || null,
        invitation_left: input.invitationLeft ?? false,
      },
    })

    await fetchAll()
    showToast(msg('방문 기록이 추가됐습니다'))
  }

  const deleteVisitHistory = async (historyId: number, unitId: number) => {
    const prevLog = visitHistories.find((h) => h.id === historyId)
    const result = await supabase.from('visit_histories').delete().eq('id', historyId)
    if (result.error) {
      reportMutationError(msg('방문 히스토리 삭제를 실패했습니다.'), result.error)
      return
    }

    const remainingHistories = visitHistories.filter((h) => h.unitId === unitId && h.id !== historyId)
    const latestRemaining = remainingHistories[0]
    const newStatus = latestRemaining?.result ?? '미방문'

    const statusUpdate = await supabase.from('units').update({ status: newStatus }).eq('id', unitId)
    if (statusUpdate.error) {
      reportMutationError(msg('호수 상태 동기화에 실패했습니다.'), statusUpdate.error)
    } else {
      patchUnit(unitId, { status: newStatus })
    }

    // 봉사 로그: 방문 기록 삭제
    if (prevLog) {
      const ctx = getBuildingContext(prevLog.buildingId)
      void logServiceAction({
        cardId: ctx.cardId,
        action: 'visit_deleted',
        targetType: 'visit_history',
        targetId: historyId,
        details: {
          building_name: ctx.buildingName,
          card_name: ctx.cardName,
          unit_id: unitId,
          result: prevLog.result,
          visited_at: prevLog.visitedAt,
        },
      })
    }

    await fetchAll()
    showToast(t(currentLang(), 'toast.deleted'))
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
