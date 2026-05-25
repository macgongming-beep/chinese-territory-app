import { supabase, showToast, reportMutationError, getCurrentVisitor } from './shared'

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
        reportMutationError('카드 배정을 해제하지 못했습니다.', deleteResult.error)
        return
      }
      await fetchAll()
      showToast('카드 배정을 해제했습니다')
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
      reportMutationError('참여자 카드 배정을 저장하지 못했습니다. event_card_assignments SQL을 먼저 실행해 주세요.', result.error)
      return
    }

    await supabase
      .from('event_card_assignment_cards')
      .delete()
      .eq('event_id', eventId)
      .eq('user_name', userName)
    await supabase
      .from('event_card_assignment_cards')
      .insert({ event_id: eventId, user_name: userName, card_id: cardId })

    await fetchAll()
    showToast('참여자 카드가 배정됐습니다')
  }

  const assignCardsToEventParticipantsBulk = async (
    eventId: number,
    assignments: Array<{ userName: string; cardId?: number | null; cardIds?: number[] | null }>,
    options?: { silentSuccess?: boolean; status?: 'confirmed' | 'shared' },
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
            }
          })
          .filter((item) => item.userName.length > 0)
          .map((item) => [item.userName, item]),
      ).values(),
    )

    await supabase.from('event_card_assignment_cards').delete().eq('event_id', eventId)

    const deleteResult = await supabase
      .from('event_card_assignments')
      .delete()
      .eq('event_id', eventId)

    if (deleteResult.error) {
      reportMutationError('기존 참여자 카드 배정을 정리하지 못했습니다.', deleteResult.error)
      return
    }

    const rows = normalizedAssignments
      .filter((item) => item.cardId)
      .map((item) => ({
        event_id: eventId,
        user_name: item.userName,
        assigned_card_id: item.cardId as number,
        assigned_by: getCurrentVisitor(),
      }))

    if (rows.length > 0) {
      const insertResult = await supabase.from('event_card_assignments').insert(rows)
      if (insertResult.error) {
        reportMutationError('참여자 카드 일괄 배정을 저장하지 못했습니다. event_card_assignments SQL을 먼저 실행해 주세요.', insertResult.error)
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
        showToast('대표 카드 배정은 저장됐지만, 여러 카드 동기화는 SQL 실행 후 완전하게 사용됩니다.')
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
        reportMutationError('배정 공유 상태를 저장하지 못했습니다. event_assignment_status SQL을 먼저 실행해 주세요.', statusResult.error)
        return
      }
    }

    await fetchAll()
    if (!silentSuccess) {
      showToast(`참여자 카드 배정 ${normalizedAssignments.length}건을 저장했습니다`)
    }
  }

  return { assignCardToEventParticipant, assignCardsToEventParticipantsBulk }
}
