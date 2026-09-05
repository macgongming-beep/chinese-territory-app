import { useRef, useState } from 'react'
import type { Building } from '../types'
import type { RegisterRestaurant } from '../types/restaurantRegistration'
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
  const submitting = useRef(false)
  const selected = buildings.find(b => b.id === buildingId && b.type === '상가')
  const resolvedAddress = existing ? selected?.address ?? '' : address.trim()
  const q = normalizeCardSearch(search)
  const matches = buildings.filter(b => b.type === '상가' && normalizeCardSearch(
    `${b.name} ${b.address} ${b.units.map(u => u.number).join(' ')}`,
  ).includes(q)).slice(0, 50)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (submitting.current || !name.trim() || !resolvedAddress || (existing && !selected)) return
    submitting.current = true
    setSaving(true)
    setFailed(false)
    try {
      if (await onRegister({ name: name.trim(), address: resolvedAddress, existingBuildingId: existing ? selected!.id : null })) onClose()
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
          </> : <label>{msg('주소')}<input required maxLength={500} value={address} onChange={e => setAddress(e.target.value)} /></label>}
          {failed && <p role="alert">{msg('식당을 등록하지 못했습니다.')}</p>}
          <button type="submit" className="restaurant-registration-submit" disabled={!name.trim() || !resolvedAddress || (existing && !selected)}>{saving ? msg('등록 중...') : msg('등록')}</button>
        </fieldset>
      </form>
    </div>
  )
}
