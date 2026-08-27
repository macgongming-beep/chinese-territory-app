// CSV 를 '올릴 건물 목록' 으로 바꾸는 규칙.
// 300줄이 화면 안에 들어 있어 지금까지 아무도 확인해본 적이 없다.
import { describe, test, expect, beforeEach, vi } from 'vitest'
import { parseBuildingCsv } from './csvBuildingImport'
import type { TerritoryCard } from '../types'

const card = (id: number, name: string, region = '처인구', area = '유방동') =>
  ({ id, name, region, area, type: '구역', status: '진행중' } as unknown as TerritoryCard)

const CARDS = [card(1, '처인구 유방동 1'), card(2, '처인구 김량장동 2')]

// 좌표는 항상 카드 1 안쪽으로 준다 (경계선으로 카드를 정하는 걸 막지 않기 위해)
const geo = vi.fn(async () => ({ lat: 37.25, lng: 127.19 }))

const deps = (over: Partial<Parameters<typeof parseBuildingCsv>[1]> = {}) => ({
  cards: CARDS,
  cardBoundaries: [],
  unassignedCardId: null,
  geocodeAddress: geo,
  regionNames: ['처인구', '기흥구'],
  ...over,
})

beforeEach(() => {
  geo.mockClear()
})

describe('parseBuildingCsv — 못 읽는 파일', () => {
  test('머리줄만 있으면 거절한다', async () => {
    const r = await parseBuildingCsv('주소,카드\n', deps())
    expect(r.ok).toBe(false)
    expect(r.error).toContain('헤더와 데이터 행')
  })
})

describe('parseBuildingCsv — 기본', () => {
  test('주소와 카드명으로 건물 하나를 만든다', async () => {
    const r = await parseBuildingCsv(
      '주소,카드,호수\n용인시 처인구 유방동 1,처인구 유방동 1,101\n', deps())
    expect(r.ok).toBe(true)
    expect(r.rows).toHaveLength(1)
    expect(r.rows[0].cardId).toBe(1)
    expect(r.rows[0].units.map((u) => u.number)).toEqual(['101'])
  })

  test('호수가 없으면 101 로 넣는다', async () => {
    const r = await parseBuildingCsv('주소,카드\n유방동 1,처인구 유방동 1\n', deps())
    expect(r.rows[0].units.map((u) => u.number)).toEqual(['101'])
  })

  test('같은 건물의 여러 줄은 세대로 합친다', async () => {
    const csv = '주소,카드,건물명,호수\n' +
      '유방동 1,처인구 유방동 1,가나빌라,101\n' +
      '유방동 1,처인구 유방동 1,가나빌라,102\n'
    const r = await parseBuildingCsv(csv, deps())
    expect(r.rows).toHaveLength(1)
    expect(r.rows[0].units.map((u) => u.number)).toEqual(['101', '102'])
  })

  test('주소가 없는 줄은 건너뛰고 이유를 남긴다', async () => {
    const r = await parseBuildingCsv('주소,카드\n,처인구 유방동 1\n', deps())
    expect(r.rows).toHaveLength(0)
    expect(r.skipped).toBe(1)
    expect(r.skippedDetails[0].reason).toContain('주소 없음')
    expect(r.skippedDetails[0].rowNumber).toBe(2)   // 머리줄이 1
  })
})

describe('parseBuildingCsv — 전화 조사 시트', () => {
  const SURVEY = (chinese: string) =>
    `업체ID,주소,카드,상호명,중국어\n123,유방동 1,처인구 유방동 1,쭈꾸미킹,${chinese}\n`

  test("'없음' 은 올리지 않는다", async () => {
    const r = await parseBuildingCsv(SURVEY('없음'), deps())
    expect(r.rows).toHaveLength(0)
    expect(r.skippedDetails[0].reason).toContain('중국어 없음')
  })

  test('빈칸은 아직 전화 안 한 것으로 보고 올리지 않는다', async () => {
    // 업체ID 칸이 있으면 조사 시트다. 빈칸 = 미확인
    const r = await parseBuildingCsv(SURVEY(''), deps())
    expect(r.rows).toHaveLength(0)
    expect(r.skippedDetails[0].reason).toContain('아직 전화 안 함')
  })

  test("'있음' 은 올린다. 상호명이 곧 세대 이름이다", async () => {
    const r = await parseBuildingCsv(SURVEY('있음'), deps())
    expect(r.rows).toHaveLength(1)
    expect(r.rows[0].units[0].number).toBe('쭈꾸미킹')
  })

  test('일반 CSV 의 빈 중국어 칸은 거르지 않는다', async () => {
    // 업체ID 가 없으면 조사 시트가 아니다 — 빈칸이 정상이다
    const r = await parseBuildingCsv('주소,카드,중국어\n유방동 1,처인구 유방동 1,\n', deps())
    expect(r.rows).toHaveLength(1)
  })
})

describe('parseBuildingCsv — 유형과 구분', () => {
  test('업종이 있으면 상가로 본다 (유형 칸에 상가라는 글자가 없어도)', async () => {
    const r = await parseBuildingCsv('주소,카드,업종\n유방동 1,처인구 유방동 1,순대국\n', deps())
    expect(r.rows[0].type).toBe('상가')
  })

  test('업종이 없으면 주택', async () => {
    const r = await parseBuildingCsv('주소,카드\n유방동 1,처인구 유방동 1\n', deps())
    expect(r.rows[0].type).toBe('주택')
  })

  test("구분 '대상외' 는 중국어 아님 — 짐작보다 세다", async () => {
    // 상태가 '만남' 이면 짐작 규칙은 중국어로 본다.
    // 구분 칸이 그걸 눌러야 한다. (상태를 안 넣으면 어느 쪽이든 false 라
    //  시험이 통과해버려서 아무것도 못 잡는다)
    const r = await parseBuildingCsv(
      '주소,카드,구분,상태\n유방동 1,처인구 유방동 1,대상외,만남\n', deps())
    expect(r.rows[0].units[0].isChinese).toBe(false)
  })

  test('구분이 없으면 상태로 짐작한다', async () => {
    const r = await parseBuildingCsv('주소,카드,상태\n유방동 1,처인구 유방동 1,만남\n', deps())
    expect(r.rows[0].units[0].isChinese).toBe(true)
  })

  test("구분 '중국어' 는 중국어", async () => {
    const r = await parseBuildingCsv('주소,카드,구분\n유방동 1,처인구 유방동 1,중국어\n', deps())
    expect(r.rows[0].units[0].isChinese).toBe(true)
  })
})

describe('parseBuildingCsv — 방문기록', () => {
  test('방문기록이 있으면 가장 최근 결과가 세대 상태가 된다', async () => {
    const csv = '주소,카드,호수,방문일자,방문결과\n' +
      '유방동 1,처인구 유방동 1,101,2026-01-01,부재\n' +
      '유방동 1,처인구 유방동 1,101,2026-06-01,만남\n'
    const r = await parseBuildingCsv(csv, deps())
    expect(r.rows[0].units[0].visitHistories).toHaveLength(2)
    expect(r.rows[0].units[0].status).toBe('만남')   // 날짜 순서와 무관하게 최신
  })

  test('줄 순서가 거꾸로여도 최신이 이긴다', async () => {
    const csv = '주소,카드,호수,방문일자,방문결과\n' +
      '유방동 1,처인구 유방동 1,101,2026-06-01,만남\n' +
      '유방동 1,처인구 유방동 1,101,2026-01-01,부재\n'
    const r = await parseBuildingCsv(csv, deps())
    expect(r.rows[0].units[0].status).toBe('만남')
  })
})

describe('parseBuildingCsv — 좌표', () => {
  test('위도·경도가 있으면 지오코딩을 부르지 않는다', async () => {
    const r = await parseBuildingCsv(
      '주소,카드,위도,경도\n유방동 1,처인구 유방동 1,37.25,127.19\n', deps())
    expect(geo).not.toHaveBeenCalled()
    expect(r.rows[0].lat).toBeCloseTo(37.25)
  })

  test('좌표가 없으면 주소로 찾는다', async () => {
    await parseBuildingCsv('주소,카드\n유방동 1,처인구 유방동 1\n', deps())
    expect(geo).toHaveBeenCalledTimes(1)
  })

  test('좌표를 못 찾으면 건너뛴다', async () => {
    const r = await parseBuildingCsv('주소,카드\n유방동 1,처인구 유방동 1\n',
      deps({ geocodeAddress: async () => null }))
    expect(r.rows).toHaveLength(0)
    expect(r.skippedDetails[0].reason).toContain('좌표')
  })
})

describe('parseBuildingCsv — 카드 정하기', () => {
  test('카드를 못 정하면 미배정 카드로 떨어뜨린다', async () => {
    const r = await parseBuildingCsv('주소\n어딘가 1\n',
      deps({ unassignedCardId: 2 }))
    expect(r.rows[0].cardId).toBe(2)
  })

  test('미배정 카드도 없으면 건너뛴다', async () => {
    const r = await parseBuildingCsv('주소\n어딘가 1\n', deps())
    expect(r.rows).toHaveLength(0)
    expect(r.skippedDetails[0].reason).toContain('자동 카드 배정 실패')
  })

  test('카드ID 가 앱에 없으면 건너뛴다 — 엉뚱한 카드에 넣지 않는다', async () => {
    const r = await parseBuildingCsv('주소,카드ID\n유방동 1,999\n', deps({ unassignedCardId: 2 }))
    expect(r.rows).toHaveLength(0)
    expect(r.skippedDetails[0].reason).toContain('카드 ID')
  })
})

// ── 코덱스 리뷰에서 나온, 시험이 없던 구석들 ──────────────────

describe('parseBuildingCsv — 한 칸에 여러 호수 (지금 동작을 못 박는다)', () => {
  test('⚠ 지금은 쪼개지 않는다 — "101|102" 가 이름이 그것인 세대 하나가 된다', () => {
    // splitUnitNumbers 라는 헬퍼가 있고 시험까지 있지만 **파서가 안 쓴다.**
    // 그래서 헬퍼 시험은 헛된 안심이었다.
    // 쪼개도록 바꿀지는 정책 결정이다 (빈 호수 기본값도 101 / 1층 로 갈린다).
    // 그때까지 지금 동작을 여기에 못 박아 둔다.
    return parseBuildingCsv('주소,카드,호수\n유방동 1,처인구 유방동 1,101|102\n', deps())
      .then((r) => {
        expect(r.rows[0].units.map((u) => u.number)).toEqual(['101|102'])
      })
  })
})

describe('parseBuildingCsv — 같은 호수가 여러 줄일 때', () => {
  test('부가정보는 첫 줄이 이긴다 (방문기록만 쌓인다)', async () => {
    const csv = '주소,카드,호수,메모,상태,방문일자,방문결과\n' +
      '유방동 1,처인구 유방동 1,101,첫 메모,부재,2026-01-01,부재\n' +
      '유방동 1,처인구 유방동 1,101,둘째 메모,만남,2026-02-01,부재\n'
    const r = await parseBuildingCsv(csv, deps())
    const u = r.rows[0].units[0]
    expect(u.memo).toBe('첫 메모')            // 둘째 줄 메모는 버려진다
    expect(u.visitHistories).toHaveLength(2)  // 방문기록은 둘 다 쌓인다
  })
})

describe('parseBuildingCsv — 터지는 경우', () => {
  test('지오코딩이 예외를 던지면 그대로 밖으로 나간다 (화면이 finally 로 받는다)', async () => {
    await expect(parseBuildingCsv('주소,카드\n유방동 1,처인구 유방동 1\n',
      deps({ geocodeAddress: async () => { throw new Error('네트워크') } })))
      .rejects.toThrow('네트워크')
  })

  test('일부 줄만 좌표를 못 찾으면 나머지는 올린다', async () => {
    let n = 0
    const csv = '주소,카드\n가나동 1,처인구 유방동 1\n다라동 2,처인구 유방동 1\n'
    const r = await parseBuildingCsv(csv, deps({
      geocodeAddress: async () => (++n === 1 ? null : { lat: 37.25, lng: 127.19 }),
    }))
    expect(r.rows).toHaveLength(1)
    expect(r.skipped).toBe(1)
  })
})

describe('parseBuildingCsv — 구역선으로 자동 배정', () => {
  test('카드명이 없어도 좌표가 구역선 안이면 그 카드로 간다', async () => {
    const square = [
      { lat: 37.2, lng: 127.1 }, { lat: 37.3, lng: 127.1 },
      { lat: 37.3, lng: 127.3 }, { lat: 37.2, lng: 127.3 },
    ]
    const r = await parseBuildingCsv('주소,위도,경도\n어딘가 1,37.25,127.19\n',
      deps({ cardBoundaries: [{ cardId: 2, points: square }] as never, unassignedCardId: 1 }))
    expect(r.rows[0].cardId).toBe(2)   // 미배정(1)이 아니라 구역선의 2
  })
})
