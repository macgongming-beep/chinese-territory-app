// Screens C: Assign Step 1, Assign Step 2, Settings

const AssignStepper = ({step}) => (
  <div className="stepper">
    <div className={`step ${step===1?'active':''}`}>
      <span className="step-no">1</span>
      <span>인도자 선택</span>
    </div>
    <span className="step-arrow"><ChevR/></span>
    <div className={`step ${step===2?'active':''}`}>
      <span className="step-no">2</span>
      <span>구역 배정</span>
    </div>
  </div>
);

// ───────────────────────── ASSIGN STEP 1 ─────────────────────────
const AssignScreen = () => (
  <div className="phone" style={{position:'relative'}}>
    <StatusBar/>
    <Header title="배정" sub="인도자 8명 · 미배정 486개"/>
    <div className="ph-body" style={{paddingBottom:80}}>
      <AssignStepper step={1}/>

      <div className="row gap-2" style={{padding:'0 4px'}}>
        <span className="pill" style={{background:'var(--ink)',color:'white'}}>전체 8</span>
        <span className="pill">활성 5</span>
        <span className="pill">신규 3</span>
      </div>

      <div className="input">
        <Search/>
        <span>인도자 이름 검색</span>
      </div>

      {/* Leader cards with expanded info */}
      <div className="col gap-2">
        {[
          {nm:'김휘민', initial:'김', last:'5/12', total:26, done:18, prog:5},
          {nm:'엄민석', initial:'엄', last:'5/14', total:15, done:9,  prog:4},
          {nm:'오세창', initial:'오', last:'5/10', total:12, done:8,  prog:3},
          {nm:'박지훈', initial:'박', last:'5/03', total: 6, done:0,  prog:2},
        ].map((l,i)=>(
          <div key={i} className="card" style={{padding:'14px 16px'}}>
            <div className="row gap-3" style={{alignItems:'center'}}>
              <span className="avatar">{l.initial}</span>
              <div className="col flex-1" style={{gap:3,minWidth:0}}>
                <div className="row" style={{justifyContent:'space-between',alignItems:'baseline'}}>
                  <span className="card-title">{l.nm}</span>
                  <span className="sz-12 muted tnum">마지막 활동 {l.last}</span>
                </div>
                <div className="row" style={{gap:14,fontSize:12}}>
                  <span><span className="muted">담당</span> <b className="tnum">{l.total}</b></span>
                  <span><span className="muted">진행</span> <b className="tnum">{l.prog}</b></span>
                  <span><span className="muted">완료</span> <b className="tnum">{l.done}</b></span>
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* Separator: 0개 사용자 */}
        <div className="row gap-2" style={{padding:'8px 4px 0'}}>
          <span className="sz-12 semi muted">신규 인도자 (담당 없음)</span>
          <span className="sz-12 muted tnum">3</span>
          <span style={{flex:1,borderBottom:'1px solid var(--line)',marginBottom:4}}/>
        </div>
        {['사용자1','사용자2','사용자3'].map((n,i)=>(
          <div key={i} className="card" style={{padding:'12px 16px'}}>
            <div className="row gap-3" style={{alignItems:'center'}}>
              <span className="avatar muted">{n[0]}</span>
              <div className="col flex-1">
                <span className="card-title">{n}</span>
                <span className="card-meta">아직 담당 구역 없음</span>
              </div>
            </div>
          </div>
        ))}

        {/* My (장웅) — selected */}
        <div className="row gap-2" style={{padding:'8px 4px 0'}}>
          <span className="sz-12 semi muted">나</span>
          <span style={{flex:1,borderBottom:'1px solid var(--line)',marginBottom:4}}/>
        </div>
        <div className="card" style={{
          padding:'14px 16px',
          border:'1.5px solid var(--ink)',
          background:'var(--surface)'
        }}>
          <div className="row gap-3" style={{alignItems:'center'}}>
            <span className="avatar">장</span>
            <div className="col flex-1" style={{gap:3,minWidth:0}}>
              <div className="row" style={{justifyContent:'space-between',alignItems:'baseline'}}>
                <span className="card-title">장웅 <span className="sz-12 muted med">(나)</span></span>
                <span className="sz-12 muted tnum">마지막 활동 오늘</span>
              </div>
              <div className="row" style={{gap:14,fontSize:12}}>
                <span><span className="muted">담당</span> <b className="tnum">6</b></span>
                <span><span className="muted">진행</span> <b className="tnum">4</b></span>
                <span><span className="muted">완료</span> <b className="tnum">2</b></span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    {/* Sticky bottom CTA */}
    <div style={{
      position:'absolute',left:0,right:0,bottom:0,
      padding:'12px 16px 16px',background:'var(--bg)',
      borderTop:'1px solid var(--line)'
    }}>
      <button className="btn solid lg full">
        장웅 담당 구역 배정하기 <ArrowR s={16}/>
      </button>
    </div>
  </div>
);

// ───────────────────────── ASSIGN STEP 2 ─────────────────────────
const AssignStep2Screen = () => (
  <div className="phone" style={{position:'relative'}}>
    <StatusBar/>
    <Header title="배정" sub="장웅에게 배정 · 미배정 486"/>
    <div className="ph-body" style={{paddingBottom:80}}>
      <AssignStepper step={2}/>

      <div className="row gap-2">
        <div className="input flex-1">
          <Search/>
          <span>구·동 검색</span>
        </div>
        <button className="btn ghost" style={{height:42,padding:'0 12px',fontSize:13,gap:5}}>
          <MapIcon s={16}/> 지도
        </button>
      </div>

      <div className="row gap-2" style={{padding:'0 4px',flexWrap:'wrap'}}>
        <span className="pill" style={{background:'var(--ink)',color:'white'}}>전체 486</span>
        <span className="pill">처인구 312</span>
        <span className="pill">기흥구 89</span>
        <span className="pill">수지구 39</span>
        <span className="pill">+ 2</span>
      </div>

      {/* Group · 처인구 김량장동 — expanded */}
      <section>
        <div className="card" style={{padding:'12px 14px'}}>
          <div className="row gap-2" style={{alignItems:'center',justifyContent:'space-between'}}>
            <div className="row gap-2" style={{alignItems:'center'}}>
              <ChevD s={14}/>
              <div className="col">
                <span style={{fontSize:14,fontWeight:600,color:'var(--ink)'}}>처인구 · 김량장동</span>
                <span className="sz-12 muted">전체 18 · 미배정 12</span>
              </div>
            </div>
            <button className="btn subtle" style={{height:30,padding:'0 10px',fontSize:12}}>
              전체 배정
            </button>
          </div>
          <div className="divider" style={{margin:'10px -4px'}}/>
          <div className="col gap-1">
            {[
              {n:'김량장동 001', state:'free'},
              {n:'김량장동 002', state:'free'},
              {n:'김량장동 003', state:'taken', by:'김휘민'},
              {n:'김량장동 004', state:'free'},
              {n:'김량장동 005', state:'taken', by:'엄민석'},
            ].map((c,i)=>(
              <div key={i} className="row" style={{
                padding:'8px 4px',alignItems:'center',justifyContent:'space-between',gap:8
              }}>
                <div className="col flex-1" style={{minWidth:0}}>
                  <span className="sz-14 semi strong">{c.n}</span>
                  {c.state==='taken' &&
                    <span className="sz-12 muted">{c.by}에게 배정됨</span>
                  }
                </div>
                {c.state==='free' ?
                  <button className="btn solid" style={{height:30,fontSize:12,padding:'0 12px'}}>배정</button>
                  : <span className="pill" style={{color:'var(--muted-2)'}}>배정됨</span>
                }
              </div>
            ))}
            <button className="sz-12 muted med" style={{
              padding:'8px 0',background:'transparent',border:0,fontFamily:'inherit'
            }}>
              7개 더 보기
            </button>
          </div>
        </div>
      </section>

      {/* Collapsed groups */}
      {[
        {n:'처인구 · 포곡읍', t:32, m:28},
        {n:'처인구 · 고림동', t:24, m:20},
        {n:'기흥구 · 기흥동', t:18, m:12},
        {n:'수지구 · 고기동', t:14, m:11},
      ].map((g,i)=>(
        <div key={i} className="card" style={{padding:'12px 14px'}}>
          <div className="row gap-2" style={{alignItems:'center',justifyContent:'space-between'}}>
            <div className="row gap-2">
              <ChevR s={14}/>
              <div className="col">
                <span style={{fontSize:14,fontWeight:600,color:'var(--ink)'}}>{g.n}</span>
                <span className="sz-12 muted">전체 {g.t} · 미배정 {g.m}</span>
              </div>
            </div>
            <button className="btn subtle" style={{height:28,padding:'0 10px',fontSize:12}}>
              전체 배정
            </button>
          </div>
        </div>
      ))}
    </div>

    <div style={{
      position:'absolute',left:0,right:0,bottom:0,
      padding:'12px 16px 16px',background:'var(--bg)',
      borderTop:'1px solid var(--line)'
    }}>
      <div className="row" style={{justifyContent:'space-between',alignItems:'center'}}>
        <span className="sz-13"><span className="muted">이번 세션 배정</span> <b className="tnum strong">3개</b></span>
        <button className="btn solid" style={{height:40,padding:'0 18px'}}>완료</button>
      </div>
    </div>
  </div>
);

// ───────────────────────── SETTINGS ─────────────────────────
const SettingsScreen = () => (
  <Phone active="set" title="설정" sub="장웅 · 관리자">
    {/* Language */}
    <section>
      <div className="sec-head">
        <h2>언어</h2>
        <span className="sz-12 muted">계정 단위 저장</span>
      </div>
      <div className="segmented col-3" style={{marginTop:10}}>
        <div className="seg active">한국어</div>
        <div className="seg">简体中文</div>
        <div className="seg">English</div>
      </div>
    </section>

    {/* Menu list */}
    <section>
      <div className="sec-head"><h2>관리</h2></div>
      <div className="col gap-2" style={{marginTop:10}}>
        {[
          {Ico: Megaphone, t:'공지',         sub:'작성과 확인'},
          {Ico: Bell,      t:'알림 설정',     sub:'받을 알림과 방해금지 시간'},
          {Ico: Users,     t:'사용자',        sub:'전체 80명 · 관리 권한 3명'},
          {Ico: User,      t:'가입 신청',     sub:'승인 대기 중인 사용자 확인', badge:3},
          {Ico: Star,      t:'특별 봉사 시즌', sub:'5월 시즌 진행 중'},
        ].map((m,i)=>{
          const Ico = m.Ico;
          return (
            <div key={i} className="card" style={{padding:'14px 16px'}}>
              <div className="row gap-3" style={{alignItems:'center'}}>
                <div style={{
                  width:32,height:32,borderRadius:9,background:'var(--tint)',
                  display:'grid',placeItems:'center',color:'var(--text)',flexShrink:0
                }}>
                  <Ico s={16}/>
                </div>
                <div className="col flex-1" style={{gap:1,minWidth:0}}>
                  <span className="card-title">{m.t}</span>
                  <span className="card-meta">{m.sub}</span>
                </div>
                {m.badge && (
                  <span className="pill danger tnum">{m.badge}</span>
                )}
                <ChevR s={16}/>
              </div>
            </div>
          );
        })}
      </div>
    </section>

    {/* Subtle device/install status */}
    <section>
      <div className="sec-head"><h2>이 기기</h2></div>
      <div className="card" style={{padding:'12px 16px',marginTop:10}}>
        <div className="row gap-3" style={{alignItems:'center'}}>
          <div className="col flex-1" style={{gap:1}}>
            <span className="sz-14 semi strong">홈 화면에 설치</span>
            <span className="sz-12 muted">알림을 받으려면 PWA 설치 필요</span>
          </div>
          <button className="btn ghost" style={{height:32,fontSize:13,padding:'0 12px'}}>안내</button>
        </div>
      </div>
      <div className="card" style={{padding:'12px 16px',marginTop:8}}>
        <div className="row gap-3" style={{alignItems:'center'}}>
          <div className="col flex-1" style={{gap:1}}>
            <span className="sz-14 semi strong">푸시 알림</span>
            <span className="sz-12 muted">이 기기 알림 꺼짐</span>
          </div>
          <button className="btn solid" style={{height:32,fontSize:13,padding:'0 12px'}}>켜기</button>
        </div>
      </div>
    </section>

    {/* Footer */}
    <section style={{marginTop:'auto',paddingTop:8}}>
      <div className="row" style={{justifyContent:'space-between',alignItems:'center',padding:'0 4px'}}>
        <div className="row gap-2">
          <span style={{width:6,height:6,borderRadius:99,background:'var(--ok)'}}/>
          <span className="sz-12 muted">최신 버전 · v1.0.0</span>
        </div>
        <span className="sz-12 muted">업데이트 확인</span>
      </div>
      <div className="row" style={{justifyContent:'space-between',alignItems:'center',marginTop:14,padding:'0 4px'}}>
        <span className="sz-13 muted row gap-2"><Logout/> 로그아웃</span>
        <span className="sz-12" style={{color:'var(--muted-2)'}}>고급 설정</span>
      </div>
    </section>
  </Phone>
);

Object.assign(window, { AssignScreen, AssignStep2Screen, SettingsScreen });
