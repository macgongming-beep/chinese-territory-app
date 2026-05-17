// Screens B: Territory (default), Territory Informal, Territory Restaurant

const TerritoryTabs = ({active}) => (
  <div className="inline-tabs">
    <span className={`inline-tab ${active==='card'?'active':''}`}>구역 카드 <span className="cnt">608</span></span>
    <span className={`inline-tab ${active==='inf'?'active':''}`}>비공식 <span className="cnt">13</span></span>
    <span className={`inline-tab ${active==='rest'?'active':''}`}>식당 <span className="cnt">1</span></span>
  </div>
);

// ───────────────────────── TERRITORY (Cards) ─────────────────────────
const TerritoryScreen = () => (
  <Phone active="terr" title="구역" sub="구역 카드 608 · 미배정 486">
    <TerritoryTabs active="card"/>

    {/* Filters: 담당/전체 segmented + map toggle */}
    <div className="row gap-2" style={{alignItems:'stretch'}}>
      <div className="segmented col-2 flex-1">
        <div className="seg">담당 구역</div>
        <div className="seg active">전체 구역</div>
      </div>
      <div className="row" style={{
        background:'var(--tint)', borderRadius:10, padding:3, gap:0
      }}>
        <div className="seg active" style={{padding:'9px 11px'}}><MapIcon s={15}/></div>
        <div className="seg" style={{padding:'9px 11px'}} title="지도">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
            <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
          </svg>
        </div>
      </div>
    </div>

    {/* Counter row */}
    <div className="row" style={{justifyContent:'space-between',padding:'0 4px'}}>
      <span className="sz-13"><span className="muted">전체</span> <b className="tnum">608</b></span>
      <span className="sz-13"><span className="muted">배정</span> <b className="tnum">122</b></span>
      <span className="sz-13"><span className="muted">미배정</span> <b className="tnum danger">486</b></span>
    </div>

    {/* Search */}
    <div className="input">
      <Search/>
      <span>동 이름 검색</span>
    </div>

    {/* District cards: name · 주택 · 상가 · progress pill (no separate bar) */}
    <div className="col gap-2">
      {[
        {n:'처인구',  ho:134, sa:255, total:375, done:45},
        {n:'기흥구',  ho:113, sa:129, total: 89, done:3},
        {n:'수지구',  ho: 48, sa: 79, total: 39, done:0},
        {n:'영통구',  ho: 54, sa: 31, total: 12, done:5},
        {n:'화성시',  ho:  2, sa: 21, total: 93, done:69},
      ].map((d,i)=>{
        const pct = Math.round(d.done/d.total*100);
        return (
          <div key={i} className="card" style={{padding:'14px 16px'}}>
            <div className="row gap-3" style={{alignItems:'center'}}>
              <div className="col flex-1" style={{gap:2,minWidth:0}}>
                <span className="card-title">{d.n}</span>
                <span className="card-meta">주택 {d.ho} · 상가 {d.sa}</span>
              </div>
              <div className="col" style={{alignItems:'flex-end',gap:3}}>
                <span className="sz-13 tnum semi strong">{pct}%</span>
                <span className="sz-12 muted tnum">{d.done} / {d.total}</span>
              </div>
              <ChevR s={16}/>
            </div>
          </div>
        );
      })}
    </div>
  </Phone>
);

// ───────────────────────── TERRITORY · INFORMAL ─────────────────────────
const MapCard = ({label, big}) => (
  <div className="col" style={{gap:6}}>
    <div className="map-thumb" style={{aspectRatio: big?'1/1':'4/3'}}/>
    <div className="sz-13 semi strong trunc">{label}</div>
  </div>
);

const TerritoryInformalScreen = () => (
  <Phone active="terr" title="구역" sub="비공식 자료 13개 · 그룹 2">
    <TerritoryTabs active="inf"/>

    <div className="row gap-2" style={{justifyContent:'space-between',padding:'0 4px'}}>
      <span className="sz-13 muted">전체 13개</span>
      <button className="btn solid" style={{height:32,padding:'0 12px',fontSize:13}}>
        <Plus/> 자료 추가
      </button>
    </div>

    {/* Group 1 - 경희대 */}
    <section>
      <div className="row" style={{
        alignItems:'center',padding:'0 4px',justifyContent:'space-between'
      }}>
        <div className="row gap-2">
          <ChevD s={14}/>
          <span style={{fontSize:15,fontWeight:600,color:'var(--ink)'}}>경희대</span>
          <span className="sz-12 muted tnum">4</span>
        </div>
        <span className="ph-h-btn" style={{width:28,height:28}}><Dots s={14}/></span>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginTop:10}}>
        <MapCard label="경희대 홈플러스"/>
        <MapCard label="경희대 컴포즈"/>
        <MapCard label="외대정류장"/>
        <MapCard label="경희대 맥도날드"/>
      </div>
    </section>

    {/* Group 2 - 미분류 (collapsed) */}
    <section>
      <div className="row" style={{
        alignItems:'center',padding:'0 4px',justifyContent:'space-between'
      }}>
        <div className="row gap-2">
          <ChevR s={14}/>
          <span style={{fontSize:15,fontWeight:600,color:'var(--muted)'}}>미분류</span>
          <span className="sz-12 muted tnum">9</span>
        </div>
        <span className="ph-h-btn" style={{width:28,height:28}}><Dots s={14}/></span>
      </div>
    </section>

    {/* + 그룹 ghost action */}
    <button className="btn ghost full" style={{borderStyle:'dashed',color:'var(--muted)'}}>
      <Plus/> 그룹 추가
    </button>
  </Phone>
);

// ───────────────────────── TERRITORY · RESTAURANT ─────────────────────────
const TerritoryRestScreen = () => (
  <Phone active="terr" title="구역" sub="식당 1개">
    <TerritoryTabs active="rest"/>

    <div className="row gap-2" style={{justifyContent:'space-between',padding:'0 4px'}}>
      <span className="sz-13 muted">전체 1개</span>
      <button className="btn solid" style={{height:32,padding:'0 12px',fontSize:13}}>
        <Plus/> 식당 추가
      </button>
    </div>

    <div className="input">
      <Search/>
      <span>식당 이름 또는 주소 검색</span>
    </div>

    <section>
      <div className="row" style={{
        alignItems:'center',padding:'0 4px',justifyContent:'space-between'
      }}>
        <div className="row gap-2">
          <ChevD s={14}/>
          <span style={{fontSize:15,fontWeight:600,color:'var(--ink)'}}>처인구</span>
          <span className="sz-12 muted tnum">1</span>
        </div>
      </div>
      <div className="card" style={{padding:14,marginTop:10}}>
        <div className="row gap-3" style={{alignItems:'center'}}>
          <div style={{
            width:40,height:40,borderRadius:10,background:'var(--tint)',
            display:'grid',placeItems:'center',color:'var(--muted)',flexShrink:0
          }}>
            <Fork s={18}/>
          </div>
          <div className="col flex-1" style={{gap:2,minWidth:0}}>
            <span className="card-title">승원반점</span>
            <span className="card-meta trunc">처인구 포곡읍 4 · 경기도 용인시 처인구…</span>
          </div>
          <button className="btn ghost" style={{height:34,padding:'0 12px',fontSize:13,gap:5}}>
            <MapIcon s={15}/> 지도
          </button>
          <span className="ph-h-btn" style={{width:28,height:28}}><Dots s={14}/></span>
        </div>
      </div>
    </section>

    {/* Empty slot encouraging next add */}
    <button className="card" style={{
      padding:'18px 14px',
      border:'1px dashed var(--line-2)',
      background:'transparent',
      color:'var(--muted)',
      display:'flex',gap:8,alignItems:'center',justifyContent:'center',
      fontFamily:'inherit',fontSize:13,fontWeight:500
    }}>
      <Plus/> 두 번째 식당 추가하기
    </button>
  </Phone>
);

Object.assign(window, { TerritoryScreen, TerritoryInformalScreen, TerritoryRestScreen });
