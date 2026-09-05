import { useRef, useState } from 'react'
import type { Building, CardBoundary } from '../types'
import { RESTAURANT_INITIAL_STATES, type RegisterRestaurant, type RestaurantInitialState } from '../types/restaurantRegistration'
import { msg } from '../lib/msg'
import { normalizeCardSearch } from '../utils/cardSearch'
import { searchPlacesForCongregation } from '../lib/placeSearch'
import { classifyRestaurantPlaces, type ClassifiedRestaurantPlace } from '../utils/restaurantPlaceCandidate'
import { showToast } from '../lib/toast'
import './RestaurantRegistrationModal.css'

export function RestaurantRegistrationModal({ buildings, cardBoundaries = [], visitorNames = [], onRegister, onClose }: {
  buildings: Building[]
  cardBoundaries?: CardBoundary[]
  visitorNames?: string[]
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
  const [placeResults, setPlaceResults] = useState<ClassifiedRestaurantPlace[] | null>(null)
  const [searchingPlace, setSearchingPlace] = useState(false)
  const [verifiedAddress, setVerifiedAddress] = useState(false)
  const [selectedLat, setSelectedLat] = useState<number | null>(null)
  const [selectedLng, setSelectedLng] = useState<number | null>(null)
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
  const regularVisitorOptions = [...new Set([regularVisitor, ...visitorNames].map((value) => value.trim()).filter(Boolean))]

  async function runPlaceSearch(query: string) {
    const value = query.trim()
    if (!value || searchingPlace) return
    setSearchingPlace(true)
    setPlaceResults(null)
    const result = await searchPlacesForCongregation(value)
    setSearchingPlace(false)
    if (!result.ok) {
      showToast(result.reason === 'no_session' || result.reason === 'rejected'
        ? msg('로그인 세션을 확인할 수 없습니다. 앱에서 다시 로그인해 주세요.')
        : msg('장소 검색을 쓸 수 없습니다. 잠시 뒤 다시 시도해 주세요.'), 'error')
      return
    }
    setPlaceResults(classifyRestaurantPlaces(result.places, buildings, cardBoundaries))
  }

  function pickPlace(place: ClassifiedRestaurantPlace) {
    if (place.status === 'registered') return
    setName(place.name)
    setAddress(place.address)
    setSelectedLat(place.lat)
    setSelectedLng(place.lng)
    setVerifiedAddress(true)
    setPlaceResults(null)
    if (place.buildingId != null) {
      const building = buildings.find((item) => item.id === place.buildingId)
      setExisting(true)
      setBuildingId(place.buildingId)
      setSearch(building?.address ?? place.address)
    } else {
      setExisting(false)
      setBuildingId(null)
    }
  }

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
        ...(!existing && selectedLat != null && selectedLng != null ? { lat: selectedLat, lng: selectedLng } : {}),
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
          <label>{msg('식당 이름')}<span className="restaurant-registration-search-row"><input autoFocus required maxLength={200} value={name} onChange={e => { setName(e.target.value); setPlaceResults(null) }} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void runPlaceSearch(name) } }} /><button type="button" onClick={() => void runPlaceSearch(name)} disabled={!name.trim() || searchingPlace}>{searchingPlace ? msg('검색 중...') : msg('네이버 검색')}</button></span></label>
          {placeResults && (
            <div className="restaurant-registration-place-results" aria-label={msg('장소 검색 결과')}>
              {placeResults.length === 0 ? <p>{msg('검색 결과가 없습니다.')}</p> : placeResults.map((place) => (
                <button key={`${place.name}-${place.address}-${place.lat}-${place.lng}`} type="button" disabled={place.status === 'registered'} onClick={() => pickPlace(place)}>
                  <span className="restaurant-registration-place-title"><strong>{place.name}</strong><span className={`restaurant-registration-badge is-${place.status}`}>{msg(place.status === 'registered' ? '이미 등록됨' : place.status === 'existing-building' ? '기존 건물에 추가' : '새 건물')}</span></span>
                  <small>{place.address || msg('주소 정보 없음')}{place.category ? ` · ${place.category}` : ''}</small>
                  <span className={`restaurant-registration-scope is-${place.scope}`}>{msg(place.scope === 'card' ? '구역 안' : place.scope === 'unassigned' ? '미배정 지역' : '봉사 범위 밖')}</span>
                </button>
              ))}
            </div>
          )}
          {verifiedAddress ? (
            <div className="restaurant-registration-auto-choice">
              <span>{existing && selected ? msg('기존 건물을 자동으로 찾았습니다.') : msg('새 건물로 등록합니다.')}</span>
              <strong>{existing && selected ? `${selected.name} · ${selected.address}` : address}</strong>
              <button type="button" onClick={() => setVerifiedAddress(false)}>{msg('직접 변경')}</button>
            </div>
          ) : (
            <div className="restaurant-registration-modes">
              <label><input type="radio" name="restaurant-building-mode" checked={!existing} onChange={() => setExisting(false)} />{msg('새 건물')}</label>
              <label><input type="radio" name="restaurant-building-mode" checked={existing} onChange={() => setExisting(true)} />{msg('기존 건물')}</label>
            </div>
          )}
          {!verifiedAddress && (existing ? <>
            <label>{msg('건물 검색')}<input value={search} onChange={e => setSearch(e.target.value)} /></label>
            <label>{msg('기존 건물')}<select required value={buildingId ?? ''} onChange={e => setBuildingId(e.target.value ? Number(e.target.value) : null)}>
              <option value="">{msg('건물 선택')}</option>
              {selected && !matches.some(b => b.id === selected.id) && <option value={selected.id}>{selected.name} · {selected.address}</option>}
              {matches.map(b => <option key={b.id} value={b.id}>{b.name} · {b.address}</option>)}
            </select></label>
          </> : <>
            <label>{msg('주소')}<span className="restaurant-registration-search-row"><input required maxLength={500} value={address} onChange={e => { setAddress(e.target.value); setVerifiedAddress(false); setSelectedLat(null); setSelectedLng(null); setPlaceResults(null) }} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void runPlaceSearch(address) } }} /><button type="button" onClick={() => void runPlaceSearch(address)} disabled={!address.trim() || searchingPlace}>{msg('주소 확인')}</button></span></label>
            <p className={`restaurant-registration-verification ${verifiedAddress ? 'is-verified' : ''}`}>{verifiedAddress ? msg('네이버에서 위치를 확인했습니다.') : msg('검색 결과를 선택하면 실제 주소와 위치를 확인할 수 있습니다.')}</p>
            {addressMatches.length > 0 && (
              <div className="restaurant-registration-address-matches">
                <strong>{msg('이 주소의 기존 건물')}</strong>
                {addressMatches.map(building => (
                  <button key={building.id} type="button" onClick={() => {
                    setExisting(true); setBuildingId(building.id); setSearch(building.address); setVerifiedAddress(true)
                  }}>
                    <span>{building.name}</span><small>{building.address}</small>
                  </button>
                ))}
              </div>
            )}
          </>)}
          <label>{msg('현재 상태')}<select aria-label={msg('현재 상태')} value={initialState} onChange={e => setInitialState(e.target.value as RestaurantInitialState)}>
            {RESTAURANT_INITIAL_STATES.map(state => <option key={state} value={state}>{msg(state)}</option>)}
          </select></label>
          {initialState === '정기방문' && (
            <label>{msg('정기방문 담당자')}{regularVisitorOptions.length > 0 ? (
              <select required value={regularVisitor} onChange={e => setRegularVisitor(e.target.value)}>
                <option value="">{msg('담당자 선택')}</option>
                {regularVisitorOptions.map(visitor => <option key={visitor} value={visitor}>{visitor}</option>)}
              </select>
            ) : <input required value={regularVisitor} onChange={e => setRegularVisitor(e.target.value)} />}</label>
          )}
          <label className="restaurant-registration-check"><input type="checkbox" checked={isChinese} onChange={e => setIsChinese(e.target.checked)} />{msg('중국어를 사용하는 식당')}</label>
          {failed && <p role="alert">{msg('식당을 등록하지 못했습니다.')}</p>}
          <button type="submit" className="restaurant-registration-submit" disabled={!name.trim() || !resolvedAddress || (existing && !selected) || (initialState === '정기방문' && !regularVisitor.trim())}>{saving ? msg('등록 중...') : msg('등록')}</button>
        </fieldset>
      </form>
    </div>
  )
}
