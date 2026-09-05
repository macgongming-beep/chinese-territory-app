import { useRef, useState } from 'react'
import type { Building } from '../types'
import { RESTAURANT_INITIAL_STATES, type RegisterRestaurant, type RestaurantInitialState } from '../types/restaurantRegistration'
import { msg } from '../lib/msg'
import { normalizeCardSearch } from '../utils/cardSearch'
import './RestaurantRegistrationModal.css'

export function RestaurantRegistrationModal({ buildings, onRegister, onClose }: {
  buildings: Building[]
  onRegister: RegisterRestaurant
  onClose: () => void
}) {
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [existing, setExisting] = useState(false)
  const [buildingId, setBuildingId] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState(false)
  const [isChinese, setIsChinese] = useState(true)
  const [initialState, setInitialState] = useState<RestaurantInitialState>('미방문')
  const [regularVisitor, setRegularVisitor] = useState(() => localStorage.getItem('currentVisitor') ?? '')
  const submitting = useRef(false)
  const selected = buildings.find(b => b.id === buildingId && b.type === '상가')
  const resolvedAddress = existing ? selected?.address ?? '' : address.trim()
  const q = normalizeCardSearch(search)
  const matches = buildings.filter(b => b.type === '상가' && normalizeCardSearch(
    `${b.name} ${b.address} ${b.units.map(u => u.number).join(' ')}`,
  ).includes(q)).slice(0, 50)
  const addressQuery = normalizeCardSearch(address)
  const addressMatches = addressQuery.length >= 3
    ? buildings.filter(b => b.type === '상가' && normalizeCardSearch(`${b.name} ${b.address}`).includes(addressQuery)).slice(0, 8)
    : []

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (submitting.current || !name.trim() || !resolvedAddress || (existing && !selected) || (initialState === '정기방문' && !regularVisitor.trim())) return
    submitting.current = true
    setSaving(true)
    setFailed(false)
    try {
      if (await onRegister({
        name: name.trim(),
        address: resolvedAddress,
        existingBuildingId: existing ? selected!.id : null,
        isChinese,
        initialState,
        regularVisitor: initialState === '정기방문' ? regularVisitor.trim() : null,
      })) onClose()
      else setFailed(true)
    } catch { setFailed(true) } finally {
      submitting.current = false
      setSaving(false)
    }
  }

  return (
    <div className="v2-picker-backdrop" onClick={() => { if (!saving) onClose() }}>
      <form className="v2-picker-sheet restaurant-registration" role="dialog" aria-modal="true" aria-labelledby="restaurant-registration-title" onSubmit={submit} onClick={e => e.stopPropagation()} onKeyDown={e => { if (e.key === 'Escape' && !saving) onClose() }}>
        <div className="v2-picker-head">
          <h2 id="restaurant-registration-title">{msg('식당 등록')}</h2>
          <button type="button" className="v2-picker-close" disabled={saving} onClick={onClose} aria-label={msg('닫기')}>×</button>
        </div>
        <fieldset disabled={saving}>
          <label>{msg('식당 이름')}<input autoFocus required maxLength={200} value={name} onChange={e => setName(e.target.value)} /></label>
          <div className="restaurant-registration-modes">
            <label><input type="radio" name="restaurant-building-mode" checked={!existing} onChange={() => setExisting(false)} />{msg('새 건물')}</label>
            <label><input type="radio" name="restaurant-building-mode" checked={existing} onChange={() => setExisting(true)} />{msg('기존 건물')}</label>
          </div>
          {existing ? <>
            <label>{msg('건물 검색')}<input value={search} onChange={e => setSearch(e.target.value)} /></label>
            <label>{msg('기존 건물')}<select required value={buildingId ?? ''} onChange={e => setBuildingId(e.target.value ? Number(e.target.value) : null)}>
              <option value="">{msg('건물 선택')}</option>
              {selected && !matches.some(b => b.id === selected.id) && <option value={selected.id}>{selected.name} · {selected.address}</option>}
              {matches.map(b => <option key={b.id} value={b.id}>{b.name} · {b.address}</option>)}
            </select></label>
          </> : <>
            <label>{msg('주소')}<input required maxLength={500} value={address} onChange={e => setAddress(e.target.value)} /></label>
            {addressMatches.length > 0 && (
              <div className="restaurant-registration-address-matches">
                <strong>{msg('이 주소의 기존 건물')}</strong>
                {addressMatches.map(building => (
                  <button key={building.id} type="button" onClick={() => {
                    setExisting(true); setBuildingId(building.id); setSearch(building.address)
                  }}>
                    <span>{building.name}</span><small>{building.address}</small>
                  </button>
                ))}
              </div>
            )}
          </>}
          <label>{msg('현재 상태')}<select aria-label={msg('현재 상태')} value={initialState} onChange={e => setInitialState(e.target.value as RestaurantInitialState)}>
            {RESTAURANT_INITIAL_STATES.map(state => <option key={state} value={state}>{msg(state)}</option>)}
          </select></label>
          {initialState === '정기방문' && (
            <label>{msg('정기방문 담당자')}<input required value={regularVisitor} onChange={e => setRegularVisitor(e.target.value)} /></label>
          )}
          <label className="restaurant-registration-check"><input type="checkbox" checked={isChinese} onChange={e => setIsChinese(e.target.checked)} />{msg('중국어를 사용하는 식당')}</label>
          {failed && <p role="alert">{msg('식당을 등록하지 못했습니다.')}</p>}
          <button type="submit" className="restaurant-registration-submit" disabled={!name.trim() || !resolvedAddress || (existing && !selected) || (initialState === '정기방문' && !regularVisitor.trim())}>{saving ? msg('등록 중...') : msg('등록')}</button>
        </fieldset>
      </form>
    </div>
  )
}
