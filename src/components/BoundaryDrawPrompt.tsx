// 카드를 만든 직후 "구역선을 바로 그릴까요?" 를 묻는다.
//
// DesktopTerritory 에서 떼어냈다. 이 모달은 자기 상태가 없다 — 보여줄 카드와
// 두 갈래(그리기 / 나중에)뿐이다. 그래서 부모가 카드를 쥐고, 여기는 그리기만 한다.
type Props = {
  /** 방금 만든 카드. 이게 있어야 모달이 뜬다 */
  card: { id: number; name: string }
  /** '나중에' 또는 바깥 클릭 */
  onDismiss: () => void
  /** '구역선 그리기' — 부모가 지도를 편집 모드로 연다 */
  onDraw: (cardId: number) => void
}

export function BoundaryDrawPrompt({ card, onDismiss, onDraw }: Props) {
  return (
    <div className="cal-modal-backdrop" onClick={onDismiss}>
      <div className="cal-modal" style={{ maxWidth: '380px' }} onClick={(e) => e.stopPropagation()}>
        <div className="cal-modal-head">
          <div className="cal-modal-title">
            <h2>카드 생성 완료</h2>
          </div>
        </div>
        <div className="cal-modal-body">
          <p style={{ margin: 0, fontSize: '15px', color: '#374151', fontWeight: 600 }}>
            <strong style={{ color: 'var(--ink-900)' }}>{card.name}</strong> 카드가 생성됐습니다.<br />
            지도에서 구역선을 바로 그릴까요?
          </p>
        </div>
        <div className="cal-modal-foot">
          <button className="cal-cancel-btn" onClick={onDismiss} type="button">나중에</button>
          <button className="cal-save-btn" onClick={() => onDraw(card.id)} type="button">
            구역선 그리기
          </button>
        </div>
      </div>
    </div>
  )
}
