// 세대 하나의 방문 기록을 적는다. DesktopTerritory 에서 떼어냈다.
//
// 폼 값은 여기가 들고 있다. 부모는 "어느 세대인가" 와 "저장" 만 안다.
// 새 기록인지 수정인지도 부모가 판단한다 — 두 콜백이 갈리는 지점이라
// 화면이 헷갈리면 기록을 덮어쓴다.
import { useState } from 'react'
import type { TimeSlot, UnitStatus } from '../types'

export type VisitDraft = {
  result: UnitStatus
  timeSlot: TimeSlot
  visitedAt: string
  memo: string
  /**
   * 누가 방문했나. **관리자·인도자만 고칠 수 있다** (`visitorOptions` 를 받을 때만 칸이 보인다).
   *
   * 왜: 봉사를 마치고 한 사람이 몰아서 입력하면 **실제로 방문한 형제가 아니라
   * 입력한 사람 이름**으로 남아 통계가 어긋난다. 새로 적을 때는 그대로 내 이름으로
   * 두고, **여기서 고치게** 한다 — '대신 기록 모드' 를 켜 두는 방식은 끄는 것을
   * 잊으면 며칠치가 통째로 남의 이름이 된다.
   */
  visitor?: string
}

type Props = {
  /** '수정' 이면 제목이 바뀐다. 저장 경로는 부모가 고른다 */
  mode: 'add' | 'edit'
  /** 어느 건물 · 어느 세대인지 사람이 읽는 형태 */
  label: string
  initial: VisitDraft
  /**
   * 고를 수 있는 방문자 목록. **비어 있거나 없으면 방문자 칸을 아예 안 그린다**
   * (권한이 없는 사람에게는 있는지도 모르게).
   */
  visitorOptions?: string[]
  onClose: () => void
  /**
   * 저장. **성공하면 true, 실패하면 false.**
   * 실패했는데 창이 닫히면 사용자가 적은 내용이 사라진다.
   */
  onSave: (draft: VisitDraft) => Promise<boolean>
}

export function PointVisitEditor({ mode, label, initial, visitorOptions, onClose, onSave }: Props) {
  const [draft, setDraft] = useState<VisitDraft>(initial)
  const [saving, setSaving] = useState(false)
  const set = <K extends keyof VisitDraft>(key: K, value: VisitDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }))

  const save = async () => {
    if (saving || !draft.visitedAt) return
    setSaving(true)
    try {
      if (await onSave(draft)) onClose()
      // 실패면 창을 열어 둔다 — 적은 내용을 지킨다
    } catch {
      // 예상 못 한 장애. 알림은 저장하는 쪽이 띄운다
    } finally {
      setSaving(false)
    }
  }

  /** 저장 중에는 닫지 않는다. 닫아도 저장은 계속돼 결과를 아무도 못 본다 */
  const requestClose = () => { if (!saving) onClose() }

  return (
    <div className="cal-modal-backdrop" onClick={requestClose}>
      <div className="cal-modal territory-confirm-modal" onClick={(e) => e.stopPropagation()}>
        <div className="cal-modal-head">
          <div className="cal-modal-title">
            <h2>{mode === 'edit' ? '방문 기록 수정' : '방문 기록 등록'}</h2>
            <p className="merge-name-modal-sub">{label}</p>
          </div>
        </div>
        <div className="cal-modal-body">
          <div className="point-visit-editor-form">
            <label>
              <span>방문일</span>
              <input
                type="date"
                value={draft.visitedAt}
                onChange={(e) => set('visitedAt', e.target.value)}
              />
            </label>
            <label>
              <span>시간대</span>
              <select value={draft.timeSlot} onChange={(e) => set('timeSlot', e.target.value as TimeSlot)}>
                <option value="오전">오전</option>
                <option value="오후">오후</option>
                <option value="저녁">저녁</option>
              </select>
            </label>
            <label>
              <span>결과</span>
              <select value={draft.result} onChange={(e) => set('result', e.target.value as UnitStatus)}>
                <option value="미방문">미방문</option>
                <option value="만남">만남</option>
                <option value="부재">부재</option>
                <option value="대상외">대상외</option>
              </select>
            </label>
            {visitorOptions && visitorOptions.length > 0 && (
              <label>
                <span>방문자</span>
                <select
                  value={draft.visitor ?? ''}
                  onChange={(e) => set('visitor', e.target.value)}
                >
                  {/* 지금 값이 목록에 없을 수 있다 (탈퇴했거나 이름이 바뀐 사람).
                      그럴 때 목록에 없다고 조용히 다른 사람으로 바뀌면 안 된다. */}
                  {draft.visitor && !visitorOptions.includes(draft.visitor) && (
                    <option value={draft.visitor}>{draft.visitor}</option>
                  )}
                  {visitorOptions.map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </label>
            )}
            <label className="wide">
              <span>메모</span>
              <textarea
                value={draft.memo}
                onChange={(e) => set('memo', e.target.value)}
                placeholder="방문 당시 메모"
              />
            </label>
          </div>
        </div>
        <div className="cal-modal-foot">
          <button className="cal-cancel-btn" disabled={saving} onClick={requestClose} type="button">취소</button>
          <button
            className="cal-save-btn"
            disabled={!draft.visitedAt || saving}
            onClick={() => void save()}
            type="button"
          >
            {saving ? '저장 중…' : '저장'}
          </button>
        </div>
      </div>
    </div>
  )
}
