// 구역선 백업 내보내기 · 복구.
//
// 복구는 **덮어쓰기**다. 잘못 읽은 파일을 그대로 넣으면 진짜 구역선이 사라지고,
// 되돌리려면 카드마다 수십 개 꼭짓점을 다시 찍어야 한다. 그래서
//   · 파일이 깨졌으면 아무것도 안 한다 (일부만 복구하지 않는다)
//   · 넣기 전에 몇 개인지 보여 주고 확인을 받는다
import type { ChangeEvent } from 'react'
import { downloadCardBoundaryBackup, parseCardBoundaryBackup } from '../utils/boundaryMerge'
import { confirmDialog } from '../lib/confirm'
import { showToast } from '../lib/toast'
import { msg } from '../lib/msg'
import type { CardBoundary } from '../types'

type BackupCard = { id: number; name: string; region: string; area: string }

export function useCardBoundaryBackup(
  cards: BackupCard[],
  cardBoundaries: CardBoundary[],
  onRestore?: (boundaries: CardBoundary[]) => Promise<void> | void,
) {
  const exportBackup = () => {
    downloadCardBoundaryBackup(cards, cardBoundaries)
    showToast(msg('구역선 백업 파일을 내보냈습니다.'), 'success')
  }

  const importBackup = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    // 같은 파일을 다시 골라도 change 가 나게 비운다
    event.target.value = ''
    if (!file || !onRestore) return
    try {
      const boundaries = parseCardBoundaryBackup(await file.text())
      if (boundaries.length === 0) {
        showToast(msg('가져올 구역선이 없습니다.'), 'error')
        return
      }
      const confirmed = await confirmDialog({
        message: msg('백업 파일의 구역선 {length}개를 현재 카드에 복구할까요?', { length: boundaries.length }),
      })
      if (!confirmed) return
      await Promise.resolve(onRestore(boundaries))
    } catch (error) {
      console.error(error)
      showToast(msg('구역선 백업 파일을 읽지 못했습니다.'), 'error')
    }
  }

  return { exportBackup, importBackup }
}
