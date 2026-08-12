// 전화 조사 — 플레이스 수집 목록을 필드맵과 대조하고, 조사 결과를 대장에 기록한다.
//
// 흐름
//   ① 수집기 CSV 올리기 → 신규 / 이미 등록됨 / 이미 조사함 / 확인 필요 로 분류
//   ② [통화 목록 내려받기] → 신규만 담긴 CSV 로 전화 봉사
//   ③ 조사 결과를 적어 다시 올리기 → [대장에 기록]
//        · 있음   → 대장 기록 + 건물 CSV 업로드로 등록 (안내)
//        · 없음·미확인 → 대장에만 기록 (지도·통계는 건드리지 않는다)
//
// 왜 대장을 앱에 두나: 조사 이력이 수집기(외부 스크립트)에만 있으면 그 코드를
// 고치다 날아갈 수 있고, 여러 사람이 조사하면 합치기도 어렵다.
import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { showToast } from '../lib/toast'
import { msg } from '../lib/msg'
import { parseCsv, toCsv, downloadCsvFile } from '../utils/roundTripCsv'
import {
  matchSurveyRows,
  normalizeSurveyAnswer,
  type KnownUnit,
  type MatchResult,
  type SurveyRow,
} from '../utils/placeMatch'

const HEADERS = ['상호명', '전화번호', '주소', '업종', '식당', '수집상태', '중국어', '확인일', '확인자', '조사메모', '업체ID', '상세링크']

async function fetchAllRows<T>(build: (from: number, to: number) => PromiseLike<{ data: unknown; error: unknown }>): Promise<T[]> {
  const page = 1000
  const out: T[] = []
  for (let from = 0; ; from += page) {
    const { data, error } = await build(from, from + page - 1)
    if (error) throw error
    const chunk = (data ?? []) as T[]
    out.push(...chunk)
    if (chunk.length < page) break
  }
  return out
}

type Summary = {
  results: MatchResult[]
  fileName: string
}

export function PhoneSurveyPanel({ currentVisitor = '' }: { currentVisitor?: string }) {
  const [busy, setBusy] = useState<string | null>(null)
  const [summary, setSummary] = useState<Summary | null>(null)
  const [saved, setSaved] = useState<string | null>(null)

  const readFile = async (file: File) => {
    setBusy('match'); setSummary(null); setSaved(null)
    try {
      const rows = parseCsv(await file.text())
      if (rows.length < 2) { showToast(msg('데이터 행이 없습니다'), 'error'); return }
      const header = rows[0].map((h) => h.trim())
      const idx = (name: string) => header.indexOf(name)
      if (idx('상호명') < 0 || idx('주소') < 0) {
        showToast(msg('헤더가 다릅니다. 다운로드한 파일 형식을 유지해 주세요'), 'error')
        return
      }
      const get = (r: string[], name: string) => {
        const i = idx(name)
        return i >= 0 ? (r[i] ?? '').trim() : ''
      }
      const surveyRows: SurveyRow[] = rows.slice(1)
        .filter((r) => get(r, '상호명'))
        .map((r) => ({
          placeId: get(r, '업체ID'),
          name: get(r, '상호명'),
          address: get(r, '주소'),
          category: get(r, '업종'),
          phone: get(r, '전화번호'),
          chinese: get(r, '중국어'),
          checkedAt: get(r, '확인일'),
          checkedBy: get(r, '확인자'),
          memo: get(r, '조사메모'),
        }))

      // 필드맵 현재 상태
      const buildings = await fetchAllRows<{ id: number; address: string; units: Array<{ id: number; number: string; is_chinese: boolean | null; naver_place_id: string | null }> }>(
        (f, t) => supabase.from('buildings').select('id, address, units(id, number, is_chinese, naver_place_id)').order('id').range(f, t))
      const known: KnownUnit[] = []
      for (const b of buildings) {
        for (const u of b.units ?? []) {
          known.push({ unitId: u.id, buildingId: b.id, name: u.number, address: b.address, placeId: u.naver_place_id, isChinese: Boolean(u.is_chinese) })
        }
      }
      const surveys = await fetchAllRows<{ place_id: string }>(
        (f, t) => supabase.from('phone_surveys').select('place_id').order('id').range(f, t))
      const surveyedIds = new Set(surveys.map((s) => s.place_id))

      setSummary({ results: matchSurveyRows(surveyRows, known, surveyedIds), fileName: file.name })
    } catch (e) {
      console.error(e); showToast(msg('파일 처리 실패'), 'error')
    } finally { setBusy(null) }
  }

  const counts = summary
    ? {
        new: summary.results.filter((r) => r.kind === 'new').length,
        registered: summary.results.filter((r) => r.kind === 'registered').length,
        surveyed: summary.results.filter((r) => r.kind === 'surveyed').length,
        ambiguous: summary.results.filter((r) => r.kind === 'ambiguous').length,
      }
    : null

  // 조사 결과가 적힌 줄 (중국어 칸이 채워진 줄)
  const answered = summary?.results.filter((r) => normalizeSurveyAnswer(r.row.chinese) !== null) ?? []
  const answeredCount = {
    있음: answered.filter((r) => normalizeSurveyAnswer(r.row.chinese) === '있음').length,
    없음: answered.filter((r) => normalizeSurveyAnswer(r.row.chinese) === '없음').length,
    미확인: answered.filter((r) => normalizeSurveyAnswer(r.row.chinese) === '미확인').length,
  }

  const downloadCallList = () => {
    if (!summary) return
    // 전화할 곳 = 신규 + 확인 필요 (확인 필요는 걸어 보고 판단)
    const targets = summary.results.filter((r) => r.kind === 'new' || r.kind === 'ambiguous')
    const rows: string[][] = [HEADERS.slice()]
    for (const r of targets) {
      rows.push([
        r.row.name, r.row.phone ?? '', r.row.address, r.row.category ?? '', '', '',
        '', '', '', r.kind === 'ambiguous' ? `※ ${r.reason}` : '',
        r.row.placeId, '',
      ])
    }
    downloadCsvFile(`통화목록_${summary.fileName.replace(/\.[^.]+$/, '')}.csv`, toCsv(rows))
    showToast(msg('{v1}개 항목을 내보냈습니다.', { v1: targets.length }))
  }

  const saveSurveys = async () => {
    if (answered.length === 0) return
    setBusy('save')
    try {
      const payload = answered
        .filter((r) => r.row.placeId)
        .map((r) => ({
          place_id: r.row.placeId,
          name: r.row.name,
          address: r.row.address || null,
          category: r.row.category || null,
          phone: r.row.phone || null,
          result: normalizeSurveyAnswer(r.row.chinese)!,
          checked_at: r.row.checkedAt || null,
          checked_by: r.row.checkedBy || null,
          memo: r.row.memo || null,
          unit_id: r.unit?.unitId ?? null,
          uploaded_by: currentVisitor || null,
        }))
      const skipped = answered.length - payload.length
      const { error } = await supabase.from('phone_surveys').upsert(payload, { onConflict: 'place_id' })
      if (error) { console.error(error); showToast(msg('저장 실패'), 'error'); return }
      setSaved(`${payload.length}건 기록${skipped > 0 ? ` (업체ID 없는 ${skipped}건 제외)` : ''}`)
      showToast(msg('저장되었습니다.'))
    } finally { setBusy(null) }
  }

  const box: React.CSSProperties = {
    display: 'flex', justifyContent: 'space-between', padding: '9px 12px',
    borderRadius: 8, background: 'var(--paper)', fontSize: 13.5,
  }

  return (
    <section className="desk-card ds-card">
      <h2 className="desk-card__title" style={{ marginBottom: 12 }}>전화 조사</h2>
      <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--gray-500)', lineHeight: 1.6 }}>
        플레이스 수집기 CSV 를 올리면 이미 등록됐거나 지난번에 조사한 곳을 걸러 줍니다.
        남은 곳만 내려받아 전화하고, 결과를 적어 다시 올리면 조사 대장에 기록됩니다.
      </p>

      <label className="ds-btn" style={{ display: 'inline-flex', cursor: 'pointer' }}>
        {busy === 'match' ? '대조 중…' : 'CSV 올리기'}
        <input type="file" accept=".csv,text/csv" style={{ display: 'none' }}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void readFile(f); e.target.value = '' }} />
      </label>

      {summary && counts && (
        <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ ...box, background: 'var(--tint)', fontWeight: 700 }}>
            <span>신규 — 전화 대상</span><span>{counts.new}곳</span>
          </div>
          <div style={box}><span>이미 등록됨</span><span>{counts.registered}곳</span></div>
          <div style={box}><span>이미 조사함</span><span>{counts.surveyed}곳</span></div>
          <div style={box}><span>확인 필요 — 같은 건물, 이름 다름</span><span>{counts.ambiguous}곳</span></div>

          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button className="ds-btn ds-btn--primary" type="button"
              disabled={counts.new + counts.ambiguous === 0}
              onClick={downloadCallList}>
              통화 목록 내려받기 ({counts.new + counts.ambiguous}곳)
            </button>
          </div>

          {answered.length > 0 && (
            <div style={{ marginTop: 12, padding: 12, borderRadius: 10, border: '1px solid var(--line)' }}>
              <strong style={{ fontSize: 13.5 }}>조사 결과 {answered.length}건</strong>
              <p style={{ margin: '4px 0 10px', fontSize: 12.5, color: 'var(--muted)' }}>
                있음 {answeredCount.있음} · 없음 {answeredCount.없음} · 미확인 {answeredCount.미확인}
              </p>
              <button className="ds-btn ds-btn--primary" type="button"
                disabled={busy === 'save'} onClick={() => void saveSurveys()}>
                {busy === 'save' ? '기록 중…' : '대장에 기록하기'}
              </button>
              {saved && <p style={{ margin: '8px 0 0', fontSize: 12.5, color: 'var(--muted)' }}>{saved}</p>}
              {answeredCount.있음 > 0 && (
                <p style={{ margin: '10px 0 0', fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.6 }}>
                  중국어 <b>있음 {answeredCount.있음}곳</b>은 지도에도 등록해야 합니다 —
                  구역 → 건물 관리 → <b>건물 CSV 업로드</b>에 같은 파일을 올리세요.
                  (없음·미확인은 자동으로 제외됩니다)
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  )
}
