import type { TerritoryRegion, VisitTargetType } from '../types'

export const territoryRegions: TerritoryRegion[] = ['처인구', '기흥구', '수지구', '영통구', '화성시']

export const territoryAreasByRegion: Record<TerritoryRegion, string[]> = {
  처인구: ['고림동', '김량장동', '역북동', '유방동', '포곡읍'],
  기흥구: ['신갈동', '상하동', '구갈동', '보정동', '동백동'],
  수지구: ['풍덕천동', '죽전동', '상현동', '성복동'],
  영통구: ['매탄동', '영통동', '원천동'],
  화성시: ['병점동', '동탄동', '진안동', '봉담읍'],
}

export const visitTargetTypes: VisitTargetType[] = ['전체', '상가', '주택']
