import type { Building, CardBoundary, GeoPoint } from '../../types'

export type CardMergeUndoSnapshot = {
  boundaries: Array<{ cardId: number; points: GeoPoint[] | null }>
  buildingCards: Array<{ buildingId: number; cardId: number }>
  targetCardName: string
}
import { supabase, showToast, reportMutationError, ensureAffectedRows } from './shared'
import { msg } from '../../lib/msg'

export function makeCardBoundaryMutations(deps: {
  fetchAll: () => Promise<void>
  cardBoundaries: CardBoundary[]
  buildings: Building[]
}) {
  const { fetchAll, cardBoundaries } = deps

  /**
   * ⚠ 성공 여부를 돌려준다. 호출부는 이 값을 보고서야 그린 것을 지운다 —
   * RLS 로 막히면 PostgREST 가 오류가 아니라 0행을 주기 때문에,
   * 결과를 안 보면 저장 실패인데도 화면이 성공처럼 닫힌다.
   */
  const saveCardBoundary = async (cardId: number, points: GeoPoint[]): Promise<boolean> => {
    if (points.length < 3) {
      showToast(msg('카드 구역선은 최소 3개 점이 필요합니다.'), 'error')
      return false
    }
    const result = await supabase.from('card_boundaries').upsert(
      {
        card_id: cardId,
        points,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'card_id' },
    ).select('card_id')
    if (result.error) {
      reportMutationError(msg('카드 구역선을 저장하지 못했습니다. Supabase에 card_boundaries 테이블이 있는지 확인해 주세요.'), result.error)
      return false
    }
    if (!ensureAffectedRows(result.data, msg('카드 구역선을 저장하지 못했습니다.'))) return false
    await fetchAll()
    showToast(msg('구역선이 저장됐습니다'))
    return true
  }

  const deleteCardBoundary = async (cardId: number): Promise<boolean> => {
    // 삭제 전 현재 데이터 백업 (복구용)
    const originalBoundary = cardBoundaries.find((b) => b.cardId === cardId)
    const originalPoints = originalBoundary ? [...originalBoundary.points] : null

    const result = await supabase.from('card_boundaries').delete().eq('card_id', cardId).select('card_id')
    if (result.error) {
      reportMutationError(msg('카드 구역선을 삭제하지 못했습니다.'), result.error)
      return false
    }
    if (!ensureAffectedRows(result.data, msg('카드 구역선을 삭제하지 못했습니다.'))) return false
    await fetchAll()

    if (originalPoints) {
      showToast(msg('구역선이 삭제됐습니다'), 'info', {
        label: '삭제 취소',
        onClick: () => {
          saveCardBoundary(cardId, originalPoints)
        },
      })
    } else {
      showToast(msg('구역선이 삭제됐습니다'))
    }
    return true
  }

  const restoreCardBoundaries = async (boundaries: CardBoundary[]) => {
    const validBoundaries = boundaries.filter((boundary) => boundary.cardId && boundary.points.length >= 3)
    if (validBoundaries.length === 0) {
      showToast(msg('복구할 구역선이 없습니다.'), 'error')
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
      reportMutationError(msg('구역선 백업을 가져오지 못했습니다.'), result.error)
      return
    }
    await fetchAll()
    showToast(msg('구역선 {length}개를 복구했습니다', { length: validBoundaries.length }))
  }

  const mergeCardBoundaries = async (input: {
    targetCardId: number
    sourceCardIds: number[]
    mergedPoints: GeoPoint[]
  }) => {
    const sourceIds = Array.from(new Set(input.sourceCardIds.filter((id) => id !== input.targetCardId)))
    const allCardIds = [input.targetCardId, ...sourceIds]
    if (sourceIds.length === 0 || input.mergedPoints.length < 3) {
      showToast(msg('병합할 카드와 구역선을 확인해 주세요.'), 'error')
      return
    }

    const buildingResult = await supabase
      .from('buildings')
      .update({ card_id: input.targetCardId })
      .in('card_id', sourceIds)

    if (buildingResult.error) {
      reportMutationError(msg('카드 병합 중 건물을 이동하지 못했습니다.'), buildingResult.error)
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
      reportMutationError(msg('병합된 구역선을 저장하지 못했습니다.'), boundaryResult.error)
      return
    }

    const deleteResult = await supabase.from('card_boundaries').delete().in('card_id', sourceIds)
    if (deleteResult.error) {
      reportMutationError(msg('기존 구역선을 정리하지 못했습니다.'), deleteResult.error)
      return
    }

    await fetchAll()
    showToast(msg('카드 {length}개 구역선을 병합했습니다', { length: allCardIds.length }))
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
        showToast(msg('건물 배정을 되돌리는 중 일부 실패했습니다.'), 'error')
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
          reportMutationError(msg('구역선 되돌리기 중 오류가 발생했습니다.'), result.error)
          return
        }
      } else {
        const result = await supabase.from('card_boundaries').delete().eq('card_id', boundary.cardId)
        if (result.error) {
          reportMutationError(msg('구역선 되돌리기 중 오류가 발생했습니다.'), result.error)
          return
        }
      }
    }

    await fetchAll()
    showToast(msg('카드 병합을 되돌렸습니다'))
  }

  return { saveCardBoundary, deleteCardBoundary, restoreCardBoundaries, mergeCardBoundaries, undoMergeCardBoundaries }
}
