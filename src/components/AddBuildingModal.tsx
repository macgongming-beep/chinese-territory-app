// 건물 하나를 손으로 추가하는 모달. DesktopTerritory 에서 떼어냈다.
//
// 여기가 아는 것: 입력값과 좌표 찾기 상태.
// 여기가 모르는 것: 어느 카드에 넣을지, 어떻게 저장할지. 그건 부모가 한다.
//   자동 배정은 구역선·카드 목록을 봐야 해서 화면이 들고 있을 일이 아니다.
import { useState } from 'react'
import type { Building, TerritoryCard } from '../types'

export type AddBuildingForm = {
  name: string
  address: string
  type: Building['type']
  /** 'auto' 면 부모가 주소·좌표로 카드를 고른다 */
  cardId: number | 'auto'
}

type Props = {
  cards: TerritoryCard[]
  onClose: () => void
  /** 주소 → 좌표. 못 찾으면 null */
  onGeocode: (address: string) => Promise<{ lat: number; lng: number } | null>
  /** 저장. false 를 돌려주면 모달을 닫지 않는다 (입력을 잃지 않게) */
  onSubmit: (form: AddBuildingForm, latLng: { lat: number; lng: number } | null) => Promise<boolean | void> | boolean | void
}

const EMPTY: AddBuildingForm = { name: '', address: '', type: '주택', cardId: 'auto' }

export function AddBuildingModal({ cards, onClose, onGeocode, onSubmit }: Props) {
  const [form, setForm] = useState<AddBuildingForm>(EMPTY)
  const [geoState, setGeoState] = useState<'idle' | 'loading' | 'ok' | 'fail'>('idle')
  const [latLng, setLatLng] = useState<{ lat: number; lng: number } | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const submit = async () => {
    if (!form.address.trim() || submitting) return
    setSubmitting(true)

    // 좌표를 아직 안 찾았으면 여기서 한 번 찾는다 (사용자가 버튼을 안 눌렀을 때)
    let point = latLng
    if (!point) {
      setGeoState('loading')
      point = await onGeocode(form.address)
      setLatLng(point)
      setGeoState(point ? 'ok' : 'fail')
    }

    const ok = await onSubmit(form, point)
    setSubmitting(false)
    if (ok === false) return       // 저장 실패 — 모달을 열어 둔다
    onClose()
  }

  return (
      <div className="cal-modal-backdrop" onClick={() => onClose()}>
        <div className="cal-modal add-building-modal" onClick={(e) => e.stopPropagation()}>
          <div className="cal-modal-head">
            <div className="cal-modal-title">
              <h2>건물 추가</h2>
              <p className="merge-name-modal-sub">주소 입력 후 자동으로 좌표를 찾고 카드에 배정됩니다.</p>
            </div>
            <button className="cal-modal-close" onClick={() => onClose()} type="button">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
          <div className="add-building-modal-body">
            <label className="add-building-field">
              <span>주소 <em className="add-building-required">*</em></span>
              <div className="add-building-address-row">
                <input
                  className="add-building-input"
                  placeholder="예) 경기도 용인시 처인구 언동로 213"
                  value={form.address}
                  onChange={(e) => {
                    setForm((f) => ({ ...f, address: e.target.value }))
                    setLatLng(null)
                    setGeoState('idle')
                  }}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onGeocode(form.address).then((r) => { setLatLng(r); setGeoState(r ? 'ok' : 'fail') }) }}}
                />
                <button
                  className="add-building-geocode-btn"
                  type="button"
                  disabled={!form.address.trim() || geoState === 'loading'}
                  onClick={async () => {
                    setGeoState('loading')
                    const r = await onGeocode(form.address)
                    setLatLng(r)
                    setGeoState(r ? 'ok' : 'fail')
                  }}
                >
                  {geoState === 'loading' ? '검색 중...' : '좌표 찾기'}
                </button>
              </div>
              {geoState === 'ok' && latLng && (
                <span className="add-building-geo-ok">📍 좌표 확인 ({latLng.lat.toFixed(5)}, {latLng.lng.toFixed(5)})</span>
              )}
              {geoState === 'fail' && (
                <span className="add-building-geo-fail">주소를 찾지 못했습니다. 핀 없이 건물이 생성됩니다.</span>
              )}
            </label>
            <label className="add-building-field">
              <span>건물명 <em className="add-building-hint">(비워두면 주소에서 자동 설정)</em></span>
              <input
                className="add-building-input"
                placeholder="예) 언동로빌라, 고진로상가 등"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </label>
            <div className="add-building-row2">
              <label className="add-building-field">
                <span>유형</span>
                <select className="add-building-select" value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as Building['type'] }))}>
                  <option value="주택">주택</option>
                  <option value="상가">상가</option>
                </select>
              </label>
              <label className="add-building-field">
                <span>카드 배정</span>
                <select className="add-building-select" value={form.cardId === 'auto' ? 'auto' : String(form.cardId)} onChange={(e) => setForm((f) => ({ ...f, cardId: e.target.value === 'auto' ? 'auto' : Number(e.target.value) }))}>
                  <option value="auto">자동 (주소 기준)</option>
                  {cards.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
            </div>
          </div>
          <div className="merge-name-modal-footer">
            <button className="cal-cancel-btn" onClick={() => onClose()} type="button">취소</button>
            <button
              className="dup-address-merge-btn"
              type="button"
              disabled={!form.address.trim() || submitting}
              onClick={submit}
              style={{ background: '#2563eb' }}
            >
              {submitting ? '추가 중...' : '건물 추가'}
            </button>
          </div>
        </div>
      </div>
  )
}
