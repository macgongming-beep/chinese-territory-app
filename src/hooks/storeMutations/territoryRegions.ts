// 지역(구·시) 만들기·고치기.
//
// 지역 이름은 구역 카드 이름의 맨 앞이다 ('처인구 백암면 1').
// 그래서 오타로 갈라지면 동이 갈리는 것보다 아프다 — 카드가 통째로
// 다른 지역에 속하게 되고, 필터·통계·배정이 다 어긋난다.
// 만드는 건 관리자·개발자만 하도록 화면에서 막는다.
import { supabase, showToast, reportMutationError } from './shared'
import { msg } from '../../lib/msg'
import { normalizeName } from '../../utils/nameSimilarity'

export type RegionInput = {
  name: string
  /** 구를 품은 시 ('수지구' → '용인시'). 시 자체면 빈 값 */
  city?: string
  nameZh?: string
  nameEn?: string
}

export function makeTerritoryRegionMutations(deps: { fetchAll: () => Promise<void> }) {
  const { fetchAll } = deps

  const createTerritoryRegion = async (input: RegionInput): Promise<boolean> => {
    const name = normalizeName(input.name)
    if (!name) {
      showToast(msg('지역 이름을 입력해 주세요'), 'error')
      return false
    }

    // 맨 뒤 순서로. 몇 번째인지는 나중에 설정에서 바꾼다
    const last = await supabase
      .from('territory_regions')
      .select('sort_order')
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle()
    const nextOrder = (last.data?.sort_order ?? 0) + 1

    const result = await supabase.from('territory_regions').insert({
      name,
      city: normalizeName(input.city ?? '') || null,
      sort_order: nextOrder,
      name_zh: normalizeName(input.nameZh ?? '') || null,
      name_en: normalizeName(input.nameEn ?? '') || null,
    })
    if (result.error) {
      const message = (result.error as { message?: string }).message ?? ''
      if (message.includes('duplicate') || message.includes('unique')) {
        showToast(msg('이미 있는 지역입니다'), 'error')
        return false
      }
      reportMutationError(msg('지역을 추가하지 못했습니다. v3_territory_regions.sql 을 실행했는지 확인해 주세요.'), result.error)
      return false
    }
    await fetchAll()
    showToast(msg('지역을 추가했습니다'))
    return true
  }

  /** 이름은 바꾸지 않는다 — 카드 608장의 region 과 이름까지 함께 고쳐야 해서 별도 작업이다 */
  const updateTerritoryRegion = async (
    id: number,
    input: { city?: string; nameZh?: string; nameEn?: string },
  ) => {
    const result = await supabase.from('territory_regions').update({
      city: normalizeName(input.city ?? '') || null,
      name_zh: normalizeName(input.nameZh ?? '') || null,
      name_en: normalizeName(input.nameEn ?? '') || null,
    }).eq('id', id)
    if (result.error) {
      reportMutationError(msg('지역을 수정하지 못했습니다.'), result.error)
      return
    }
    await fetchAll()
    showToast(msg('저장했습니다'))
  }

  /** 위/아래로 한 칸. 짝과 순서 값을 맞바꾼다 */
  const moveTerritoryRegion = async (id: number, direction: 'up' | 'down') => {
    const all = await supabase
      .from('territory_regions')
      .select('id, sort_order')
      .order('sort_order')
    if (all.error || !all.data) {
      reportMutationError(msg('지역 순서를 불러오지 못했습니다.'), all.error)
      return
    }
    const list = all.data
    const index = list.findIndex((r) => r.id === id)
    const swapWith = direction === 'up' ? index - 1 : index + 1
    if (index < 0 || swapWith < 0 || swapWith >= list.length) return

    const a = list[index]
    const b = list[swapWith]
    // 순서 값이 같거나 비어 있으면 맞바꿔도 자리가 안 바뀐다. 자리 번호로 다시 매긴다
    const results = await Promise.all([
      supabase.from('territory_regions').update({ sort_order: swapWith + 1 }).eq('id', a.id),
      supabase.from('territory_regions').update({ sort_order: index + 1 }).eq('id', b.id),
    ])
    const failed = results.find((r) => r.error)
    if (failed) {
      reportMutationError(msg('지역 순서를 바꾸지 못했습니다.'), failed.error)
      return
    }
    await fetchAll()
  }

  /** 카드가 한 장이라도 있으면 지우지 않는다 — 그 카드들이 갈 곳이 없어진다 */
  const deleteTerritoryRegion = async (id: number, name: string) => {
    const used = await supabase
      .from('cards')
      .select('id', { count: 'exact', head: true })
      .eq('region', name)
    if (used.error) {
      reportMutationError(msg('지역을 삭제하지 못했습니다.'), used.error)
      return
    }
    if ((used.count ?? 0) > 0) {
      showToast(msg('구역 카드 {n}장이 이 지역에 있어 삭제할 수 없습니다', { n: used.count ?? 0 }), 'error')
      return
    }
    const result = await supabase.from('territory_regions').delete().eq('id', id)
    if (result.error) {
      reportMutationError(msg('지역을 삭제하지 못했습니다.'), result.error)
      return
    }
    await fetchAll()
    showToast(msg('지역을 삭제했습니다'))
  }

  return {
    createTerritoryRegion,
    updateTerritoryRegion,
    moveTerritoryRegion,
    deleteTerritoryRegion,
  }
}
