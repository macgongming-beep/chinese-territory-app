import type { TerritoryCard } from '../../types'
import { supabase, showToast, reportMutationError } from './shared'

export function makeCardMutations(deps: {
  fetchAll: () => Promise<void>
  cards: TerritoryCard[]
}) {
  const { fetchAll, cards } = deps

  const assignLeaderToCard = async (cardId: number, leaderName: string) => {
    const trimmedLeader = leaderName.trim()
    const targetCard = cards.find((c) => c.id === cardId)
    const hasAssignedUsers = (targetCard?.assignedUsers?.length ?? 0) > 0
    const nextLeader = trimmedLeader.length > 0 ? trimmedLeader : null
    const newStatus =
      nextLeader
        ? targetCard?.status === '미배정' ? '진행중' : undefined
        : !hasAssignedUsers ? '미배정' : undefined

    await supabase
      .from('cards')
      .update({ leader_name: nextLeader, ...(newStatus ? { status: newStatus } : {}) })
      .eq('id', cardId)
    await fetchAll()
    showToast(nextLeader ? '인도자가 배정됐습니다' : '인도자 배정이 해제됐습니다')
  }

  const setCardLeaders = async (
    cardId: number,
    leaderNames: string[],
    options?: { silentSuccess?: boolean },
  ) => {
    const silentSuccess = options?.silentSuccess === true
    const normalizedLeaders = Array.from(new Set(leaderNames.map((name) => name.trim()).filter(Boolean)))
    const primaryLeader = normalizedLeaders[0] ?? null
    const targetCard = cards.find((card) => card.id === cardId)
    const hasAssignedUsers = (targetCard?.assignedUsers.length ?? 0) > 0
    const newStatus = primaryLeader ? (targetCard?.status === '미배정' ? '진행중' : undefined) : (!hasAssignedUsers ? '미배정' : undefined)

    const cardUpdateResult = await supabase
      .from('cards')
      .update({ leader_name: primaryLeader, ...(newStatus ? { status: newStatus } : {}) })
      .eq('id', cardId)

    if (cardUpdateResult.error) {
      reportMutationError('인도자 정보를 저장하지 못했습니다.', cardUpdateResult.error)
      return
    }

    const deleteResult = await supabase
      .from('card_leader_assignments')
      .delete()
      .eq('card_id', cardId)

    if (deleteResult.error) {
      if (deleteResult.error.message.includes('card_leader_assignments')) {
        await fetchAll()
        if (normalizedLeaders.length > 1) {
          showToast('다수 인도자 저장을 위해 SQL 마이그레이션을 실행해 주세요.', 'error')
        } else if (!silentSuccess) {
          showToast(primaryLeader ? '인도자가 배정됐습니다' : '인도자 배정이 해제됐습니다')
        }
        return
      }
      reportMutationError('기존 인도자 배정을 정리하지 못했습니다.', deleteResult.error)
      return
    }

    if (normalizedLeaders.length > 0) {
      const insertResult = await supabase
        .from('card_leader_assignments')
        .insert(normalizedLeaders.map((name) => ({ card_id: cardId, user_name: name })))
      if (insertResult.error) {
        reportMutationError('다수 인도자 배정을 저장하지 못했습니다.', insertResult.error)
        return
      }
    }

    await fetchAll()
    if (!silentSuccess) {
      showToast(normalizedLeaders.length > 0 ? '인도자 배정을 저장했습니다' : '인도자 배정을 해제했습니다')
    }
  }

  const setMultipleCardLeaders = async (
    cardIds: number[],
    leaderNames: string[],
    options?: { silentSuccess?: boolean },
  ) => {
    const normalizedCardIds = Array.from(new Set(cardIds)).filter(Boolean)
    if (normalizedCardIds.length === 0) return

    const silentSuccess = options?.silentSuccess === true
    const normalizedLeaders = Array.from(new Set(leaderNames.map((name) => name.trim()).filter(Boolean)))
    const primaryLeader = normalizedLeaders[0] ?? null
    const targetCards = cards.filter((card) => normalizedCardIds.includes(card.id))
    const idsToProgress = targetCards
      .filter((card) => primaryLeader && card.status === '미배정')
      .map((card) => card.id)
    const idsToUnassign = targetCards
      .filter((card) => !primaryLeader && card.assignedUsers.length === 0)
      .map((card) => card.id)

    const leaderUpdateResult = await supabase
      .from('cards')
      .update({ leader_name: primaryLeader })
      .in('id', normalizedCardIds)

    if (leaderUpdateResult.error) {
      reportMutationError('인도자 정보를 저장하지 못했습니다.', leaderUpdateResult.error)
      return
    }

    if (idsToProgress.length > 0) {
      const progressResult = await supabase
        .from('cards')
        .update({ status: '진행중' })
        .in('id', idsToProgress)
      if (progressResult.error) {
        reportMutationError('카드 진행 상태를 저장하지 못했습니다.', progressResult.error)
        return
      }
    }

    if (idsToUnassign.length > 0) {
      const unassignResult = await supabase
        .from('cards')
        .update({ status: '미배정' })
        .in('id', idsToUnassign)
      if (unassignResult.error) {
        reportMutationError('카드 배정 상태를 저장하지 못했습니다.', unassignResult.error)
        return
      }
    }

    const deleteResult = await supabase
      .from('card_leader_assignments')
      .delete()
      .in('card_id', normalizedCardIds)

    if (deleteResult.error) {
      if (deleteResult.error.message.includes('card_leader_assignments')) {
        await fetchAll()
        if (normalizedLeaders.length > 1) {
          showToast('다수 인도자 저장을 위해 SQL 마이그레이션을 실행해 주세요.', 'error')
        } else if (!silentSuccess) {
          showToast(primaryLeader ? '인도자 배정을 저장했습니다' : '인도자 배정을 해제했습니다')
        }
        return
      }
      reportMutationError('기존 인도자 배정을 정리하지 못했습니다.', deleteResult.error)
      return
    }

    if (normalizedLeaders.length > 0) {
      const rows = normalizedCardIds.flatMap((cardId) =>
        normalizedLeaders.map((name) => ({ card_id: cardId, user_name: name })),
      )
      const insertResult = await supabase
        .from('card_leader_assignments')
        .insert(rows)
      if (insertResult.error) {
        reportMutationError('다수 인도자 배정을 저장하지 못했습니다.', insertResult.error)
        return
      }
    }

    await fetchAll()
    if (!silentSuccess) {
      showToast(
        normalizedLeaders.length > 0
          ? `카드 ${normalizedCardIds.length}개 인도자 배정을 저장했습니다`
          : `카드 ${normalizedCardIds.length}개 인도자 배정을 해제했습니다`,
      )
    }
  }

  const toggleUserOnCard = async (cardId: number, userName: string) => {
    const card = cards.find((c) => c.id === cardId)
    if (!card) return
    if (card.assignedUsers.includes(userName)) {
      await supabase
        .from('card_assignments')
        .delete()
        .eq('card_id', cardId)
        .eq('user_name', userName)
    } else {
      await supabase.from('card_assignments').insert({ card_id: cardId, user_name: userName })
    }
    await fetchAll()
  }

  const createCard = async (input: {
    area: string
    region: string
    index: number
    pinCount: number
  }) => {
    const cardName = `${input.region} ${input.area} ${input.index}`
    if (cards.some((card) => card.name === cardName)) {
      showToast(`이미 "${cardName}" 카드가 있습니다`, 'error')
      return null
    }
    const result = await supabase
      .from('cards')
      .insert({
        name: cardName,
        area: input.area,
        region: input.region,
        type: '전체',
        status: '미배정',
      })
      .select('id')
      .single()
    if (result.error) {
      reportMutationError('카드를 생성하지 못했습니다.', result.error)
      return null
    }
    await fetchAll()
    showToast(`카드 "${cardName}"이 생성됐습니다`)
    return result.data.id as number
  }

  const deleteCards = async (cardIds: number[]) => {
    const ids = Array.from(new Set(cardIds)).filter(Number.isFinite)
    if (ids.length === 0) {
      showToast('삭제할 카드가 없습니다.', 'info')
      return
    }

    const buildingDeleteResult = await supabase.from('buildings').delete().in('card_id', ids)
    if (buildingDeleteResult.error) {
      reportMutationError('카드에 속한 건물을 삭제하지 못했습니다.', buildingDeleteResult.error)
      return
    }

    await supabase.from('card_boundaries').delete().in('card_id', ids)
    await supabase.from('card_assignments').delete().in('card_id', ids)

    const result = await supabase.from('cards').delete().in('id', ids)
    if (result.error) {
      reportMutationError('카드를 삭제하지 못했습니다.', result.error)
      return
    }
    await fetchAll()
    showToast(`카드 ${ids.length}개가 삭제됐습니다`)
  }

  return {
    assignLeaderToCard,
    setCardLeaders,
    setMultipleCardLeaders,
    toggleUserOnCard,
    createCard,
    deleteCards,
  }
}
