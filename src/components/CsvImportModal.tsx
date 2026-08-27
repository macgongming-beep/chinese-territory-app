// CSV 건물 업로드 모달.
//
// 상태 여섯 개(preview·skipped·headers·parsing·importing)가 **여기서만** 쓰인다.
// 예전에는 DesktopTerritory 가 그걸 다 들고 있어서, 화면 상태 59개 중 여섯이
// 이 모달 것이었다. 닫힌 흐름은 상태째 내려보내는 게 맞다.
import { useState } from 'react'
import type { CardBoundary, TerritoryCard } from '../types'
import {
  type CsvPreviewRow,
  type CsvSkippedRow,
  downloadCsvExample,
  parseBuildingCsvFile,
} from '../utils/csvBuildingImport'
import { showToast } from '../lib/toast'
import { msg } from '../lib/msg'
import { describeDbError } from '../utils/dbError'

type Props = {
  onClose: () => void
  cards: TerritoryCard[]
  cardBoundaries: CardBoundary[]
  unassignedCardId: number | null
  regionNames: string[]
  geocodeAddress: (address: string) => Promise<{ lat: number; lng: number } | null>
  onImportBuildings: (rows: CsvPreviewRow[]) => Promise<{ inserted: number; skipped: number }>
}

export function CsvImportModal({
  onClose, cards, cardBoundaries, unassignedCardId, regionNames, geocodeAddress, onImportBuildings,
}: Props) {
  const [csvPreviewRows, setCsvPreviewRows] = useState<CsvPreviewRow[]>([])
  const [csvSkippedRows, setCsvSkippedRows] = useState(0)
  const [csvSkippedDetails, setCsvSkippedDetails] = useState<CsvSkippedRow[]>([])
  const [csvHeaders, setCsvHeaders] = useState<string[]>([])
  const [csvParsing, setCsvParsing] = useState(false)
  const [csvImporting, setCsvImporting] = useState(false)

  // 파싱 자체는 parseBuildingCsvFile 이 한다. 그건 **절대 던지지 않는다** —
  // 그래서 여기에 try/finally 가 없어도 '확인 중' 에 갇히지 않는다.
  const parseCsvFile = async (file: File) => {
    setCsvParsing(true)
    setCsvPreviewRows([])
    setCsvSkippedRows(0)
    setCsvSkippedDetails([])
    setCsvHeaders([])

    const result = await parseBuildingCsvFile(file, {
      cards, cardBoundaries, unassignedCardId, geocodeAddress, regionNames,
    })
    setCsvParsing(false)
    if (!result.ok) {
      showToast(msg(result.error ?? 'CSV를 읽지 못했습니다.'), 'error')
      return
    }

    setCsvHeaders(result.headers)
    setCsvPreviewRows(result.rows)
    setCsvSkippedRows(result.skipped)
    setCsvSkippedDetails(result.skippedDetails)
    const totalVisits = result.rows.reduce((sum, r) => sum + r.units.reduce((s, u) => s + u.visitHistories.length, 0), 0)
    const visitMsg = totalVisits > 0 ? `, 방문기록 ${totalVisits}건` : ''
    showToast(msg('CSV 확인 완료: 건물 {length}개 준비{visitMsg}, {skipped}개 제외', { length: result.rows.length, visitMsg: visitMsg, skipped: result.skipped }), result.rows.length > 0 ? 'success' : 'info')
  }

  // ⚠ 실패해도 입력을 잃지 않는다. finally 로 '올리는 중' 을 풀고,
  //   **성공했을 때만** 닫는다. 실패하면 미리보기를 남겨 다시 시도할 수 있다.
  const handleImportCsv = async () => {
    if (csvPreviewRows.length === 0 || csvImporting) return
    setCsvImporting(true)
    let result: { inserted: number; skipped: number } | null = null
    try {
      result = await onImportBuildings(csvPreviewRows)
    } catch (e) {
      console.error('[handleImportCsv]', e)
      showToast(describeDbError(msg('건물을 올리지 못했습니다.'), e), 'error')
      return
    } finally {
      setCsvImporting(false)
    }

    if (!result || result.inserted === 0) {
      showToast(msg('올라간 건물이 없습니다. 내용을 확인하고 다시 시도해 주세요.'), 'error')
      return
    }
    onClose()
  }

  return (
      <div className="cal-modal-backdrop" onClick={() => onClose()}>
        <div className="cal-modal csv-import-modal" style={{ maxWidth: '720px' }} onClick={(e) => e.stopPropagation()}>
          <div className="cal-modal-head">
            <div className="cal-modal-title">
              <h2>CSV 건물 업로드</h2>
            </div>
            <button className="cal-modal-close" onClick={() => onClose()} type="button">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
          <div className="cal-modal-body">
            <div className="csv-guide-box">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <strong>권장 헤더</strong>
                <button
                  onClick={downloadCsvExample}
                  style={{ background: 'var(--brand-100)', color: 'var(--brand-700)', border: 'none', padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                  type="button"
                >
                  📥 예시 파일 다운로드
                </button>
              </div>
              <p style={{ fontWeight: 600, marginBottom: 2 }}>건물 정보</p>
              <p style={{ marginTop: 0 }}>카드명, 지역, 동, 주소, 건물명, 유형, 호수, 상태, <b>구분</b>(중국어/대상외), <b>방문금지</b>, 정기방문자, <b>정기방문시작일</b>, 메모</p>
              <p style={{ fontWeight: 600, marginBottom: 2 }}>방문기록 (선택 — 있으면 과거 기록도 함께 삽입)</p>
              <p style={{ marginTop: 0 }}>방문일자(YYYY-MM-DD), 방문결과, 방문자, 시간대(오전/오후/저녁), 방문메모</p>
              <small>한 세대에 방문기록이 여러 건이면 같은 주소+호수로 여러 행을 작성하세요. 카드 정보가 비어 있으면 구역선 기준으로 자동 배정합니다.</small>
            </div>

            <label className="csv-file-drop">
              <input
                accept=".csv,text/csv"
                type="file"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) void parseCsvFile(file)
                  event.currentTarget.value = ''
                }}
              />
              <span>{csvParsing ? 'CSV 확인 중...' : 'CSV 파일 선택'}</span>
            </label>

            <div className="csv-preview-summary">
              <span>준비 {csvPreviewRows.length}개</span>
              <span>제외 {csvSkippedRows}개</span>
            </div>

            {csvPreviewRows.length > 0 && (
              <div className="csv-preview-table">
                <div>
                  <span>행</span>
                  <span>카드</span>
                  <span>건물</span>
                  <span>주소</span>
                  <span>세대</span>
                  <span>방문기록</span>
                </div>
                {csvPreviewRows.slice(0, 8).map((row) => {
                  const visitCount = row.units.reduce((sum, u) => sum + u.visitHistories.length, 0)
                  return (
                    <div key={`${row.rowNumber}-${row.address}`}>
                      <span>{row.rowNumber}</span>
                      <span>{row.cardName}</span>
                      <span>{row.name}</span>
                      <span>{row.address}</span>
                      <span>{row.units.length || 1}</span>
                      <span>{visitCount > 0 ? `${visitCount}건` : '-'}</span>
                    </div>
                  )
                })}
                {csvPreviewRows.length > 8 && <p>외 {csvPreviewRows.length - 8}개 건물이 더 있습니다.</p>}
              </div>
            )}

            {csvSkippedDetails.length > 0 && (
              <div className="csv-skip-list">
                <strong>제외된 행</strong>
                {csvSkippedDetails.slice(0, 8).map((item) => (
                  <div key={`${item.rowNumber}-${item.reason}`}>
                    <span>{item.rowNumber}행</span>
                    <b>{item.reason}</b>
                    <em>{item.hint}</em>
                    {item.address && <small>{item.address}</small>}
                  </div>
                ))}
                {csvSkippedDetails.length > 8 && <p>외 {csvSkippedDetails.length - 8}개 제외 사유가 더 있습니다.</p>}
                
                {csvHeaders.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      const csvContent = [
                        csvHeaders.map(h => `"${String(h).replace(/"/g, '""')}"`).join(','),
                        ...csvSkippedDetails
                          .filter(item => item.rawRow)
                          .map(item => item.rawRow!.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
                      ].join('\n')
                      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
                      const url = URL.createObjectURL(blob)
                      const link = document.createElement('a')
                      link.href = url
                      link.download = 'skipped_rows.csv'
                      link.click()
                      URL.revokeObjectURL(url)
                    }}
                    style={{
                      marginTop: 12, padding: '8px 12px', background: '#fff', border: '1px solid #d8dbe0',
                      borderRadius: 8, fontSize: 13, fontWeight: 700, color: '#4b5563', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 6, width: 'fit-content'
                    }}
                  >
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                    제외된 항목 다운로드
                  </button>
                )}
              </div>
            )}
          </div>
          <div className="cal-modal-foot">
            <button className="cal-cancel-btn" onClick={() => onClose()} type="button">취소</button>
            <button
              className="cal-save-btn"
              disabled={csvPreviewRows.length === 0 || csvParsing || csvImporting}
              onClick={handleImportCsv}
              type="button"
            >
              {csvImporting ? '업로드 중...' : '업로드'}
            </button>
          </div>
        </div>
      </div>
  )
}
