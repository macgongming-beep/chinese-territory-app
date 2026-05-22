import type { Building, CardBoundary, GeoPoint } from '../../types'

export type CardMergeUndoSnapshot = {
  boundaries: Array<{ cardId: number; points: GeoPoint[] | null }>
  buildingCards: Array<{ buildingId: number; cardId: number }>
  targetCardName: string
}
import { supabase, showToast, reportMutationError } from './shared'

export function makeCardBoundaryMutations(deps: {
  fetchAll: () => Promise<void>
  cardBoundaries: CardBoundary[]
  buildings: Building[]
}) {
  const { fetchAll, cardBoundaries } = deps

  const saveCardBoundary = async (cardId: number, points: GeoPoint[]) => {
    if (points.length < 3) {
      showToast('카드 구역선은 최소 3개 점이 필요합니다.', 'error')
      return
    }
    const result = await supabase.from('card_boundaries').upsert(
      {
        card_id: cardId,
        points,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'card_id' },
    )
    if (result.error) {
      reportMutationError('카드 구역선을 저장하지 못했습니다. Supabase에 card_boundaries 테이블이 있는지 확인해 주세요.', result.error)
      return
    }
    await fetchAll()
    showToast('구역선이 저장됐습니다')
  }

  const deleteCardBoundary = async (cardId: number) => {
    // 삭제 전 현재 데이터 백업 (복구용)
    const originalBoundary = cardBoundaries.find((b) => b.cardId === cardId)
    const originalPoints = originalBoundary ? [...originalBoundary.points] : null

    const result = await supabase.from('card_boundaries').delete().eq('card_id', cardId)
    if (result.error) {
      reportMutationError('카드 구역선을 삭제하지 못했습니다.', result.error)
      return
    }
    await fetchAll()

    if (originalPoints) {
      showToast('구역선이 삭제됐습니다', 'info', {
        label: '삭제 취소',
        onClick: () => {
          saveCardBoundary(cardId, originalPoints)
        },
      })
    } else {
      showToast('구역선이 삭제됐습니다')
    }
  }

  const restoreCardBoundaries = async (boundaries: CardBoundary[]) => {
    const validBoundaries = boundaries.filter((boundary) => boundary.cardId && boundary.points.length >= 3)
    if (validBoundaries.length === 0) {
      showToast('복구할 구역선이 없습니다.', 'error')
      return
    }

    const result = await supabase.from('card_boundaries').upsert(
      validBoundaries.map((boundary) => ({
        card_id: boundary.cardId,
        points: boundary.points,
        updated_at: new Date().toISOString(),
      })),
      { onConflict: 'card_id' },
    )
    if (result.error) {
      reportMutationError('구역선 백업을 가져오지 못했습니다.', result.error)
      return
    }
    await fetchAll()
    showToast(`구역선 ${validBoundaries.length}개를 복구했습니다`)
  }

  const mergeCardBoundaries = async (input: {
    targetCardId: number
    sourceCardIds: number[]
    mergedPoints: GeoPoint[]
  }) => {
    const sourceIds = Array.from(new Set(input.sourceCardIds.filter((id) => id !== input.targetCardId)))
    const allCardIds = [input.targetCardId, ...sourceIds]
    if (sourceIds.length === 0 || input.mergedPoints.length < 3) {
      showToast('병합할 카드와 구역선을 확인해 주세요.', 'error')
      return
    }

    const buildingResult = await supabase
      .from('buildings')
      .update({ card_id: input.targetCardId })
      .in('card_id', sourceIds)

    if (buildingResult.error) {
      reportMutationError('카드 병합 중 건물을 이동하지 못했습니다.', buildingResult.error)
      return
    }

    const boundaryResult = await supabase.from('card_boundaries').upsert(
      {
        card_id: input.targetCardId,
        points: input.mergedPoints,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'card_id' },
    )
    if (boundaryResult.error) {
      reportMutationError('병합된 구역선을 저장하지 못했습니다.', boundaryResult.error)
      return
    }

    const deleteResult = await supabase.from('card_boundaries').delete().in('card_id', sourceIds)
    if (deleteResult.error) {
      reportMutationError('기존 구역선을 정리하지 못했습니다.', deleteResult.error)
      return
    }

    await fetchAll()
    showToast(`카드 ${allCardIds.length}개 구역선을 병합했습니다`)
  }

  const undoMergeCardBoundaries = async (snapshot: CardMergeUndoSnapshot) => {
    // 건물 원래 카드로 복원
    if (snapshot.buildingCards.length > 0) {
      const buildingResults = await Promise.all(
        snapshot.buildingCards.map((item) =>
          supabase.from('buildings').update({ card_id: item.cardId }).eq('id', item.buildingId),
        ),
      )
      if (buildingResults.some((r) => r.error)) {
        showToast('건물 배정을 되돌리는 중 일부 실패했습니다.', 'error')
        return
      }
    }

    // 구역선 복원: 원본 있으면 upsert, 원본 없으면 delete (merged 경계선 제거)
    for (const boundary of snapshot.boundaries) {
      if (boundary.points && boundary.points.length >= 3) {
        const result = await supabase.from('card_boundaries').upsert(
          { card_id: boundary.cardId, points: boundary.points, updated_at: new Date().toISOString() },
          { onConflict: 'card_id' },
        )
        if (result.error) {
          reportMutationError('구역선 되돌리기 중 오류가 발생했습니다.', result.error)
          return
        }
      } else {
        const result = await supabase.from('card_boundaries').delete().eq('card_id', boundary.cardId)
        if (result.error) {
          reportMutationError('구역선 되돌리기 중 오류가 발생했습니다.', result.error)
          return
        }
      }
    }

    await fetchAll()
    showToast('카드 병합을 되돌렸습니다')
  }

  return { saveCardBoundary, deleteCardBoundary, restoreCardBoundaries, mergeCardBoundaries, undoMergeCardBoundaries }
}
