import { supabase, showToast, reportMutationError, getCurrentVisitor } from './shared'
import { msg } from '../../lib/msg'

export function makeEventAssignmentMutations(deps: { fetchAll: () => Promise<void> }) {
  const { fetchAll } = deps

  const assignCardToEventParticipant = async (eventId: number, userName: string, cardId: number | null) => {
    if (!cardId) {
      await supabase
        .from('event_card_assignment_cards')
        .delete()
        .eq('event_id', eventId)
        .eq('user_name', userName)
      const deleteResult = await supabase
        .from('event_card_assignments')
        .delete()
        .eq('event_id', eventId)
        .eq('user_name', userName)
      if (deleteResult.error) {
        reportMutationError(msg('카드 배정을 해제하지 못했습니다.'), deleteResult.error)
        return
      }
      await fetchAll()
      showToast(msg('카드 배정을 해제했습니다'))
      return
    }

    const result = await supabase
      .from('event_card_assignments')
      .upsert(
        {
          event_id: eventId,
          user_name: userName,
          assigned_card_id: cardId,
          assigned_by: getCurrentVisitor(),
        },
        { onConflict: 'event_id,user_name' },
      )

    if (result.error) {
      reportMutationError(msg('참여자 카드 배정을 저장하지 못했습니다. event_card_assignments SQL을 먼저 실행해 주세요.'), result.error)
      return
    }

    await supabase
      .from('event_card_assignment_cards')
      .delete()
      .eq('event_id', eventId)
      .eq('user_name', userName)
    const cardsInsert = await supabase
      .from('event_card_assignment_cards')
      .insert({ event_id: eventId, user_name: userName, card_id: cardId })

    await fetchAll()
    if (cardsInsert.error) {
      // 대표 카드는 저장됐지만 다중 카드 테이블 동기화 실패 → 조용히 넘어가지 않게
      console.warn('event_card_assignment_cards 동기화 실패:', cardsInsert.error)
      showToast(msg('대표 카드는 배정됐지만 다중 카드 동기화는 SQL 실행 후 완전해집니다.'), 'info')
    } else {
      showToast(msg('참여자 카드가 배정됐습니다'))
    }
  }

  const assignCardsToEventParticipantsBulk = async (
    eventId: number,
    assignments: Array<{ userName: string; cardId?: number | null; cardIds?: number[] | null; teamKey?: string | null }>,
    options?: {
      silentSuccess?: boolean
      status?: 'confirmed' | 'shared'
      expectedSharedAt?: string | null      // 편집 시작 때 본 공유시각 (충돌 감지)
      onConflict?: (serverSharedAt: string | null) => void  // 충돌 시 호출
    },
  ) => {
    const silentSuccess = options?.silentSuccess === true
    const normalizedAssignments = Array.from(
      new Map(
        assignments
          .map((item) => {
            const rawCardIds = Array.isArray(item.cardIds)
              ? item.cardIds
              : item.cardId
                ? [item.cardId]
                : []
            const cardIds = Array.from(
              new Set(rawCardIds.filter((value): value is number => typeof value === 'number' && value > 0)),
            )
            return {
              userName: item.userName.trim(),
              cardId: cardIds[0] ?? null,
              cardIds,
              teamKey: item.teamKey ?? null,
            }
          })
          .filter((item) => item.userName.length > 0)
          .map((item) => [item.userName, item]),
      ).values(),
    )

    // ── 1순위: 트랜잭션 RPC (원자적 + 충돌 감지) ──
    const rpcPayload = normalizedAssignments
      .filter((item) => item.cardIds.length > 0)
      .map((item) => ({ userName: item.userName, cardIds: item.cardIds, teamKey: item.teamKey }))
    const token = (await import('../../lib/authToken')).getAuthToken()
    if (token) {
      const rpcRes = await supabase.rpc('assign_cards_bulk_tx', {
        p_token: token,
        p_event_id: eventId,
        p_assignments: rpcPayload,
        p_status: options?.status ?? null,
        p_expected_shared_at: options?.expectedSharedAt ?? null,
      })
      if (!rpcRes.error) {
        const result = rpcRes.data as { ok: boolean; conflict?: boolean; server_shared_at?: string | null; count?: number }
        if (result && result.conflict) {
          options?.onConflict?.(result.server_shared_at ?? null)
          return
        }
        await fetchAll()
        if (!silentSuccess) showToast(msg('참여자 카드 배정 {v1}건을 저장했습니다', { v1: result?.count ?? 0 }))
        return
      }
      // RPC 미적용(함수 없음) 등은 아래 폴백으로
      if (!String(rpcRes.error.message ?? '').includes('Could not find the function')) {
        console.warn('[assign_cards_bulk_tx] RPC 실패, 폴백 사용:', rpcRes.error)
      }
    }

    // ── 폴백: 기존 방식 (RPC 미적용 환경 호환) ──
    await supabase.from('event_card_assignment_cards').delete().eq('event_id', eventId)

    const deleteResult = await supabase
      .from('event_card_assignments')
      .delete()
      .eq('event_id', eventId)

    if (deleteResult.error) {
      reportMutationError(msg('기존 참여자 카드 배정을 정리하지 못했습니다.'), deleteResult.error)
      return
    }

    const rows = normalizedAssignments
      .filter((item) => item.cardId)
      .map((item) => ({
        event_id: eventId,
        user_name: item.userName,
        assigned_card_id: item.cardId as number,
        assigned_by: getCurrentVisitor(),
        team_key: item.teamKey,
      }))

    if (rows.length > 0) {
      let insertResult = await supabase.from('event_card_assignments').insert(rows)
      if (insertResult.error && String(insertResult.error.message ?? '').includes('team_key')) {
        const legacyRows = rows.map(({ team_key: _teamKey, ...row }) => row)
        insertResult = await supabase.from('event_card_assignments').insert(legacyRows)
      }
      if (insertResult.error) {
        reportMutationError(msg('참여자 카드 일괄 배정을 저장하지 못했습니다. event_card_assignments SQL을 먼저 실행해 주세요.'), insertResult.error)
        return
      }
    }

    const multiCardRows = normalizedAssignments.flatMap((item) =>
      item.cardIds.map((cardId) => ({
        event_id: eventId,
        user_name: item.userName,
        card_id: cardId,
      })),
    )

    if (multiCardRows.length > 0) {
      const multiCardResult = await supabase.from('event_card_assignment_cards').insert(multiCardRows)
      if (multiCardResult.error) {
        console.warn('여러 카드 배정 저장에 실패했습니다. event_card_assignment_cards SQL이 필요할 수 있습니다.', multiCardResult.error)
        showToast(msg('대표 카드 배정은 저장됐지만, 여러 카드 동기화는 SQL 실행 후 완전하게 사용됩니다.'))
      }
    }

    if (options?.status) {
      const statusResult = await supabase
        .from('calendar_events')
        .update({
          assignment_status: options.status,
          assignment_shared_at: options.status === 'shared' ? new Date().toISOString() : null,
          assignment_shared_by: options.status === 'shared' ? getCurrentVisitor() : null,
        })
        .eq('id', eventId)

      if (statusResult.error) {
        reportMutationError(msg('배정 공유 상태를 저장하지 못했습니다. event_assignment_status SQL을 먼저 실행해 주세요.'), statusResult.error)
        return
      }
    }

    await fetchAll()
    if (!silentSuccess) {
      showToast(msg('참여자 카드 배정 {length}건을 저장했습니다', { length: normalizedAssignments.length }))
    }
  }

  return { assignCardToEventParticipant, assignCardsToEventParticipantsBulk }
}
