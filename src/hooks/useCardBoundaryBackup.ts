// 구역선 백업 내보내기 · 복구.
//
// 복구는 **덮어쓰기**다. 잘못 읽은 파일을 그대로 넣으면 진짜 구역선이 사라지고,
// 되돌리려면 카드마다 수십 개 꼭짓점을 다시 찍어야 한다. 그래서
//   · 파일이 깨졌으면 아무것도 안 한다 (일부만 복구하지 않는다)
//   · **숫자 id 만 믿지 않는다.** 다른 회중 백업이나 오래된 백업은 id 가 우연히
//     겹칠 수 있고, 그러면 엉뚱한 카드를 덮는다. 이름까지 맞는 것만 넣는다
//   · 넣기 전에 몇 개를 넣고 몇 개를 건너뛰는지 보여 주고 확인을 받는다
//   · 실패 단계를 나눠서 알린다 (파일 못 읽음 vs 복구 실패)
import type { ChangeEvent } from 'react'
import { downloadCardBoundaryBackup, parseCardBoundaryBackup, planBoundaryRestore } from '../utils/boundaryMerge'
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

    let entries
    try {
      entries = parseCardBoundaryBackup(await file.text())
    } catch (error) {
      console.error(error)
      showToast(msg('구역선 백업 파일을 읽지 못했습니다.'), 'error')
      return
    }

    // 숫자 id 만 믿으면 다른 회중 백업이 엉뚱한 카드를 덮는다
    const { apply, refused } = planBoundaryRestore(entries, cards)

    if (apply.length === 0) {
      showToast(
        refused.length > 0
          ? msg('이 백업의 카드 {n}개가 지금 카드와 맞지 않습니다. 복구하지 않았습니다.', { n: refused.length })
          : msg('가져올 구역선이 없습니다.'),
        'error',
      )
      return
    }

    const confirmed = await confirmDialog({
      message: refused.length > 0
        ? msg('구역선 {n}개를 복구합니다.\n{skipped}개는 지금 카드와 맞지 않아 건너뜁니다.', { n: apply.length, skipped: refused.length })
        : msg('백업 파일의 구역선 {length}개를 현재 카드에 복구할까요?', { length: apply.length }),
    })
    if (!confirmed) return

    try {
      await Promise.resolve(onRestore(apply))
    } catch (error) {
      console.error(error)
      showToast(msg('구역선을 복구하지 못했습니다.'), 'error')
    }
  }

  return { exportBackup, importBackup }
}
