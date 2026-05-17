// Screens F: Territory drill-down — 동 / 카드 / 담당 / 지도

// Breadcrumb path
const Crumb = ({ items }) =>
<nav className="breadcrumb">
    {items.map((it, i) =>
  <React.Fragment key={i}>
        {i > 0 && <span className="sep">›</span>}
        <span className={`crumb ${i === items.length - 1 ? 'cur' : ''}`}>{it}</span>
      </React.Fragment>
  )}
  </nav>;


// Card state pill. Two vocabularies share colors:
//   전체/지도 view: 방문필요 / 완료 / 방문금지 / 정기방문 (4)
//   담당 view:       미사용 / 사용중 / 사용완료 (3)
const StatePill = ({ state }) => {
  const map = {
    // 전체 / 지도
    '방문필요': { bg: 'var(--danger-bg)', fg: 'var(--danger)' },
    '완료': { bg: 'var(--ok-bg)', fg: 'var(--ok)' },
    '방문금지': { bg: 'rgba(26,26,24,0.08)', fg: 'var(--ink)' },
    '정기방문': { bg: 'var(--warn-bg)', fg: 'var(--warn)' },
    // 담당
    '미사용': { bg: 'var(--danger-bg)', fg: 'var(--danger)' },
    '사용중': { bg: 'var(--info-bg)', fg: 'var(--info)' },
    '사용완료': { bg: 'var(--ok-bg)', fg: 'var(--ok)' }
  };
  const { bg, fg } = map[state] || map['방문필요'];
  return (
    <span className="pill" style={{ background: bg, color: fg, fontWeight: 600 }}>
      {state}
    </span>);

};

// Icon-only 목록/지도 toggle — used in territory views.
// Convention: 목록 (list) LEFT, 지도 (map) RIGHT.
const ViewToggle = ({ view = 'list' }) =>
<div className="segmented col-2" style={{ padding: 2 }}>
    <div className={`seg ${view === 'list' ? 'active' : ''}`} style={{ padding: '6px 12px' }} title="목록">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
        <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
        <line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
      </svg>
    </div>
    <div className={`seg ${view === 'map' ? 'active' : ''}`} style={{ padding: '6px 12px' }} title="지도">
      <MapIcon s={14} />
    </div>
  </div>;


// ───────────────────────── 구역 · 동 level (drilled into 처인구) ─────────────────────────
const TerritoryDongScreen = () =>
<Phone active="terr" title="구역" sub="처인구 · 동 11개">
    {/* Tabs at top of territory section */}
    <div className="inline-tabs">
      <span className="inline-tab active">구역 카드 <span className="cnt">608</span></span>
      <span className="inline-tab">비공식 <span className="cnt">13</span></span>
      <span className="inline-tab">식당 <span className="cnt">1</span></span>
    </div>

    {/* Breadcrumb with back */}
    <div className="row gap-2" style={{ alignItems: 'center' }}>
      <button className="ph-h-btn" style={{ marginLeft: -8 }}><ChevL s={16} /></button>
      <Crumb items={['전체 구역', '처인구']} />
      <span style={{ flex: 1 }} />
      <ViewToggle view="list" />
    </div>

    {/* Stats row — 전체 / 주택 / 상가 (아이녹 레이아웃으로 압축) */}
    <div className="stats-inline">
      <span>전체<b>375</b></span>
      <span className="sep">·</span>
      <span>주택<b>134</b></span>
      <span className="sep">·</span>
      <span>상가<b>255</b></span>
    </div>

    {/* Search */}
    <div className="input"><Search /><span>동 이름 검색</span></div>

    {/* Dong list */}
    <div className="col gap-2">
      {[
    { n: '고림동', t: 12, h: 7, s: 2 },
    { n: '김량장동', t: 27, h: 46, s: 24 },
    { n: '남동', t: 11, h: 6, s: 3 },
    { n: '남사읍', t: 22, h: 2, s: 25 },
    { n: '마평동', t: 15, h: 18, s: 6 },
    { n: '미배정', t: 3, h: 0, s: 0, unassigned: true },
    { n: '백암면', t: 45, h: 8, s: 31 },
    { n: '삼가동', t: 6, h: 0, s: 6 },
    { n: '양지면', t: 31, h: 5, s: 35 }].
    map((d, i) =>
    <div key={i} className="card" style={{ padding: '12px 14px' }}>
          <div className="row gap-3" style={{ alignItems: 'center' }}>
            <div className="col flex-1" style={{ gap: 2, minWidth: 0 }}>
              <span className="card-title" style={{
            color: d.unassigned ? 'var(--muted)' : 'var(--ink)'
          }}>{d.n}</span>
              <span className="card-meta">주택 {d.h} · 상가 {d.s}</span>
            </div>
            <span className="pill tnum">{d.t}개</span>
            <ChevR s={14} />
          </div>
        </div>
    )}
    </div>
  </Phone>;


// ───────────────────────── 구역 · 카드 level (drilled into 고림동) ─────────────────────────
const TerritoryCardScreen = () =>
<Phone active="terr" title="구역" sub="처인구 › 고림동 · 12개">
    <div className="inline-tabs">
      <span className="inline-tab active">구역 카드 <span className="cnt">608</span></span>
      <span className="inline-tab">비공식 <span className="cnt">13</span></span>
      <span className="inline-tab">식당 <span className="cnt">1</span></span>
    </div>

    <div className="row gap-2" style={{ alignItems: 'center' }}>
      <button className="ph-h-btn" style={{ marginLeft: -8 }}><ChevL s={16} /></button>
      <Crumb items={['전체 구역', '처인구', '고림동']} />
      <span style={{ flex: 1 }} />
      <ViewToggle view="list" />
    </div>

    {/* Stats — 전체 / 주택 / 상가 (고림동 기준) — 압축 */}
    <div className="stats-inline">
      <span>전체<b>12</b></span>
      <span className="sep">·</span>
      <span>주택<b>7</b></span>
      <span className="sep">·</span>
      <span>상가<b>2</b></span>
    </div>

    {/* Card items - showing 6 of 12 */}
    <div className="col gap-2">
      {[
    { n: '고림동 1', h: 0, s: 0, pct: 0, state: '방문필요' },
    { n: '고림동 2', h: 0, s: 1, pct: 0, state: '방문필요' },
    { n: '고림동 3', h: 0, s: 0, pct: 0, state: '방문필요' },
    { n: '고림동 6', h: 3, s: 0, pct: 50, state: '정기방문' },
    { n: '고림동 7', h: 2, s: 0, pct: 0, state: '방문필요' },
    { n: '고림동 12', h: 0, s: 1, pct: 0, state: '방문필요' }].
    map((c, i) =>
    <div key={i} className="card" style={{ padding: '12px 14px' }}>
          <div className="row gap-3" style={{ alignItems: 'center', marginBottom: 8 }}>
            <div className="col flex-1" style={{ gap: 2, minWidth: 0 }}>
              <div className="row gap-2" style={{ alignItems: 'baseline', flexWrap: 'wrap' }}>
                <span className="card-title">{c.n}</span>
                <StatePill state={c.state} />
              </div>
              <span className="card-meta">담당 장웅 · 주택 {c.h} · 상가 {c.s}</span>
            </div>
            <button className="btn ghost" style={{
          height: 30, padding: '0 12px', fontSize: 12, gap: 5
        }}>
              <MapIcon s={13} /> 지도
            </button>
          </div>
          {/* progress */}
          <div className="row gap-2" style={{ alignItems: 'center' }}>
            <div className="bar flex-1" style={{ marginTop: 0 }}>
              <i style={{ width: c.pct + '%' }} />
            </div>
            <span className="sz-12 muted tnum" style={{ width: 32, textAlign: 'right' }}>{c.pct}%</span>
          </div>
        </div>
    )}
    </div>
  </Phone>;


// ───────────────────────── 구역 · 담당 (state-grouped) ─────────────────────────
const TerritoryMineScreen = () =>
<Phone active="terr" title="구역" sub="담당 13개 · 미방문 12">
    <div className="inline-tabs">
      <span className="inline-tab active">구역 카드 <span className="cnt">608</span></span>
      <span className="inline-tab">비공식 <span className="cnt">13</span></span>
      <span className="inline-tab">식당 <span className="cnt">1</span></span>
    </div>

    {/* Top filters: 담당/전체 + 목록/지도 toggle (목록 ➜ 지도 순서) */}
    <div className="row gap-2">
      <div className="segmented col-2 flex-1">
        <div className="seg active">담당 구역</div>
        <div className="seg">전체 구역</div>
      </div>
      <ViewToggle view="list" />
    </div>

    {/* State totals row — 담당 view 압축 (작은 도트 · 작은 폰트) */}
    <div className="row" style={{
    padding: '8px 12px', background: 'var(--surface)',
    borderRadius: 8, border: '1px solid var(--line)',
    alignItems: 'center', gap: 14, flexWrap: 'wrap'
  }}>
      {[
    { l: '미사용', n: 12, c: 'var(--danger)' },
    { l: '사용중', n: 1, c: 'var(--info)' },
    { l: '사용완료', n: 0, c: 'var(--ok)' }].
    map((s, i) =>
    <span key={i} className="row" style={{ alignItems: 'center', fontSize: 13, gap: 6 }}>
          <span style={{ width: 7, height: 7, borderRadius: 99, background: s.c, flexShrink: 0 }} />
          <b className="tnum semi" style={{ color: 'var(--ink)' }}>{s.n}</b>
          <span className="muted med" style={{ fontSize: 12 }}>{s.l}</span>
        </span>
    )}
    </div>

    {/* Group: 처인구 (expanded) — 지도 아이콘이 이 그룹의 담당 지도 임 */}
    <section className="card" style={{ padding: '12px 14px' }}>
      <div className="row gap-2" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
        <div className="row gap-2" style={{ alignItems: 'center' }}>
          <ChevD s={14} />
          <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>처인구</span>
        </div>
        <div className="row gap-2" style={{ alignItems: 'center' }}>
          <span className="pill tnum">12개</span>
          <button className="ph-h-btn" style={{
          width: 30, height: 30, background: 'var(--tint)', borderRadius: 8
        }} title="이 그룹의 담당 구역 지도 보기">
            <MapIcon s={14} />
          </button>
        </div>
      </div>

      <div className="divider" style={{ margin: '12px -4px 8px' }} />

      {/* Sub-group: 미사용 */}
      <div className="row gap-2" style={{ alignItems: 'center', marginBottom: 8 }}>
        <StatePill state="미사용" />
        <span className="sz-12 muted tnum">11개</span>
      </div>
      <div className="col gap-1">
        {[
      { n: '고림동 1', h: 0, s: 0 },
      { n: '고림동 2', h: 0, s: 1 },
      { n: '고림동 3', h: 0, s: 0 }].
      map((c, i) =>
      <div key={i} className="row" style={{
        padding: '8px 4px', alignItems: 'center', justifyContent: 'space-between'
      }}>
            <div className="col flex-1" style={{ minWidth: 0 }}>
              <span className="sz-14 semi strong">{c.n}</span>
              <span className="sz-12 muted">주택 {c.h} · 상가 {c.s}</span>
            </div>
            <button className="btn ghost" style={{ height: 28, padding: '0 10px', fontSize: 12, gap: 4 }}>
              <MapIcon s={12} />
            </button>
          </div>
      )}
        <button className="sz-12 muted med" style={{
        padding: '6px 0', background: 'transparent', border: 0, fontFamily: 'inherit', textAlign: 'left'
      }}>
          8개 더 보기 <ChevR s={11} />
        </button>
      </div>

      <div className="divider" style={{ margin: '8px -4px' }} />

      {/* Sub-group: 사용중 */}
      <div className="row gap-2" style={{ alignItems: 'center', margin: '6px 0 8px' }}>
        <StatePill state="사용중" />
        <span className="sz-12 muted tnum">1개</span>
      </div>
      <div className="col gap-1">
        <div className="row" style={{
        padding: '8px 4px', alignItems: 'center', justifyContent: 'space-between'
      }}>
          <div className="col flex-1" style={{ minWidth: 0 }}>
            <div className="row gap-2" style={{ alignItems: 'baseline' }}>
              <span className="sz-14 semi strong">고림동 6</span>
              <span className="sz-12 muted tnum">50%</span>
            </div>
            <span className="sz-12 muted">주택 3 · 상가 0</span>
          </div>
          <button className="btn ghost" style={{ height: 28, padding: '0 10px', fontSize: 12, gap: 4 }}>
            <MapIcon s={12} />
          </button>
        </div>
      </div>
    </section>

    {/* Group: 수지구 (collapsed) */}
    <section className="card" style={{ padding: '12px 14px' }}>
      <div className="row gap-2" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
        <div className="row gap-2" style={{ alignItems: 'center' }}>
          <ChevR s={14} />
          <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>수지구</span>
          <span className="sz-12 muted">전체 1 · 방문 1</span>
        </div>
        <span className="pill tnum">1개</span>
      </div>
    </section>
  </Phone>;


// ───────────────────────── 구역 · 지도 view ─────────────────────────
const TerritoryMapScreen = () =>
<div className="phone" style={{ position: 'relative' }}>
    <StatusBar />

    {/* Top floating header — 뒤로 버튼 추가, search는 카드/주소 검색으로 명시 */}
    <div className="ph-header" style={{ position: 'absolute', top: 32, left: 0, right: 0, zIndex: 3,
    background: 'rgba(248,248,247,0.92)', backdropFilter: 'blur(6px)',
    borderBottom: '1px solid var(--line)' }}>
      <div className="row gap-2" style={{ alignItems: 'center', minWidth: 0 }}>
        <button className="ph-h-btn" style={{ marginLeft: -8, flexShrink: 0 }} title="목록으로 돌아가기"><ChevL s={18} /></button>
        <div className="ph-h-titles">
          <span className="ph-h-title">구역 · 지도</span>
          <span className="ph-h-sub">전체 866 · 주택 351 · 상가 515</span>
        </div>
      </div>
      <div className="ph-h-actions">
        <button className="ph-h-btn" title="카드 / 주소 검색"><Search s={16} /></button>
        <button className="ph-h-btn"><Dots /></button>
      </div>
    </div>

    {/* Map area */}
    <div style={{
    flex: 1, position: 'relative', overflow: 'hidden',
    background:
    'radial-gradient(circle at 30% 30%, rgba(91,107,124,0.06), transparent 60%),' +
    'radial-gradient(circle at 70% 60%, rgba(196,69,54,0.05), transparent 60%),' +
    'linear-gradient(135deg, transparent 49%, var(--line) 49%, var(--line) 51%, transparent 51%),' +
    'linear-gradient(45deg, transparent 49%, var(--line) 49%, var(--line) 51%, transparent 51%),' +
    'var(--paper)',
    backgroundSize: '100% 100%, 100% 100%, 80px 80px, 80px 80px, 100% 100%'
  }}>
      {/* District labels (buble) */}
      {[
    { n: '수지구', c: 127, top: '24%', left: '18%' },
    { n: '기흥구', c: 242, top: '40%', left: '50%' },
    { n: '처인구', c: 375, top: '60%', left: '32%', active: true },
    { n: '영통구', c: 12, top: '20%', left: '64%' },
    { n: '화성시', c: 93, top: '72%', left: '68%' }].
    map((b, i) =>
    <div key={i} style={{
      position: 'absolute', top: b.top, left: b.left,
      transform: 'translate(-50%, -50%)',
      padding: '6px 12px', borderRadius: 99,
      background: b.active ? 'var(--ink)' : 'var(--surface)',
      color: b.active ? 'white' : 'var(--ink)',
      border: '1px solid ' + (b.active ? 'var(--ink)' : 'var(--line)'),
      boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
      fontSize: 12, fontWeight: 600,
      display: 'flex', alignItems: 'center', gap: 6
    }}>
          <span>{b.n}</span>
          <span style={{ opacity: 0.7 }} className="tnum">{b.c}</span>
        </div>
    )}

      {/* Pin markers (subtle) */}
      {[
    { top: '32%', left: '42%', state: 'danger' },
    { top: '46%', left: '38%', state: 'danger' },
    { top: '52%', left: '52%', state: 'info' },
    { top: '64%', left: '46%', state: 'ok' },
    { top: '38%', left: '60%', state: 'warn' }].
    map((p, i) => {
      const bg = p.state === 'danger' ? 'var(--danger)' :
      p.state === 'info' ? 'var(--info)' :
      p.state === 'ok' ? 'var(--ok)' :
      'var(--warn)';
      return (
        <div key={i} style={{
          position: 'absolute', top: p.top, left: p.left,
          width: 14, height: 14, borderRadius: '50% 50% 50% 0',
          transform: 'translate(-50%, -100%) rotate(-45deg)',
          background: bg, border: '2px solid white',
          boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
        }} />);

    })}

      {/* Left vertical legend — 압축: 지도가 제일 중요
        상태 4종: 방문필요 / 완료 / 방문금지 / 정기방문 */}
      <div style={{
      position: 'absolute', top: 90, left: 8,
      background: 'rgba(255,255,255,0.94)', backdropFilter: 'blur(6px)',
      border: '1px solid var(--line)', borderRadius: 8,
      padding: '6px 9px',
      display: 'flex', flexDirection: 'column', gap: 5,
      boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
    }}>
        {[
      { l: '방문필요', n: 803, c: 'var(--danger)' },
      { l: '완료', n: 9, c: 'var(--ok)' },
      { l: '방문금지', n: 1, c: 'var(--ink)' },
      { l: '정기방문', n: 53, c: 'var(--warn)' }].
      map((s, i) =>
      <span key={i} className="row" style={{ alignItems: 'center', fontSize: 11.5, gap: 6 }}>
            <span style={{
          width: 7, height: 7, borderRadius: 99, background: s.c, flexShrink: 0
        }} />
            <b className="tnum semi" style={{
          color: 'var(--ink)', minWidth: 22, textAlign: 'right', fontSize: 12
        }}>{s.n}</b>
            <span className="muted med" style={{ letterSpacing: '-0.01em' }}>{s.l}</span>
          </span>
      )}
      </div>

      {/* Right floating controls — with pin popover */}
      <div style={{
      position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
      display: 'flex', flexDirection: 'column', gap: 6
    }}>
        <button className="ph-h-btn" style={{
        width: 40, height: 40, background: 'var(--surface)',
        border: '1px solid var(--line)', borderRadius: 10,
        boxShadow: '0 2px 6px rgba(0,0,0,0.06)'
      }} title="레이어">
          <Layers s={16} />
        </button>

        {/* PinPlus button with popover menu — active state showing menu */}
        <div style={{ position: 'relative' }}>
          <button className="ph-h-btn" style={{
          width: 40, height: 40, background: 'var(--ink)', color: 'white',
          border: '1px solid var(--ink)', borderRadius: 10,
          boxShadow: '0 2px 6px rgba(0,0,0,0.18)'
        }} title="핀 추가">
            <PinPlus s={16} />
          </button>
          {/* Popover — left of pin button */}
          <div style={{
          position: 'absolute', right: 48, top: 0,
          background: 'var(--surface)', border: '1px solid var(--line)',
          borderRadius: 10, padding: 4, minWidth: 138,
          boxShadow: '0 8px 24px rgba(0,0,0,0.14)'
        }}>
            <div className="row gap-2" style={{
            padding: '9px 12px', alignItems: 'center', borderRadius: 6,
            fontSize: 13, fontWeight: 500, color: 'var(--text)',
            background: 'var(--tint)'
          }}>
              <Plus s={14} /> 건물 추가
            </div>
            <div className="row gap-2" style={{
            padding: '9px 12px', alignItems: 'center', borderRadius: 6,
            fontSize: 13, fontWeight: 500, color: 'var(--text)'
          }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
              </svg>
              핀 위치 수정
            </div>
          </div>
        </div>

        <button className="ph-h-btn" style={{
        width: 40, height: 40, background: 'var(--surface)',
        border: '1px solid var(--line)', borderRadius: 10,
        boxShadow: '0 2px 6px rgba(0,0,0,0.06)'
      }} title="내 위치">
          <Crosshair s={16} />
        </button>
        <div style={{
        background: 'var(--surface)', border: '1px solid var(--line)',
        borderRadius: 10, boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
        display: 'flex', flexDirection: 'column'
      }}>
          <button className="ph-h-btn" style={{ width: 40, height: 36, borderRadius: 0 }}>
            <Plus s={14} />
          </button>
          <div style={{ height: 1, background: 'var(--line)' }} />
          <button className="ph-h-btn" style={{ width: 40, height: 36, borderRadius: 0 }}>
            <Minus s={14} />
          </button>
        </div>
      </div>

      {/* Bottom peek — selected card */}
      <div style={{
      position: 'absolute', left: 12, right: 12, bottom: 12,
      background: 'var(--surface)', border: '1px solid var(--line)',
      borderRadius: 12, padding: 14,
      boxShadow: '0 4px 16px rgba(0,0,0,0.08)'
    }}>
        <div className="row gap-3" style={{ alignItems: 'center' }}>
          <div className="col flex-1" style={{ gap: 2, minWidth: 0 }}>
            <div className="row gap-2" style={{ alignItems: 'baseline' }}>
              <span className="sz-15 semi strong">고림동 6</span>
              <StatePill state="정기방문" />
            </div>
            <span className="sz-12 muted">담당 장웅 · 주택 3 · 상가 0 · 50%</span>
          </div>
          <button className="btn solid" style={{ height: 34, padding: '0 14px', fontSize: 13 }}>
            기록
          </button>
        </div>
      </div>
    </div>

    <TabBar active="terr" />
  </div>;


Object.assign(window, {
  Crumb, StatePill,
  TerritoryDongScreen, TerritoryCardScreen, TerritoryMineScreen, TerritoryMapScreen
});