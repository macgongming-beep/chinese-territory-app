/* 데스크탑 추가 화면 — 공지/캘린더/지도/배정/사용자/통계/설정 */

const DeskNav2 = ({ active }) => {
  const tabs = ["홈", "공지", "캘린더", "구역", "지도", "배정", "사용자", "통계", "설정"];
  return (
    <div className="desk-nav">
      <div className="desk-brand">
        <div className="desk-brand__logo">CH</div>
        <div>
          <div className="desk-brand__name">CHS-Yongin</div>
          <div className="desk-brand__sub">용인 중국어</div>
        </div>
      </div>
      <div className="desk-nav-tabs">
        {tabs.map(t => (
          <button key={t} className={"desk-nav-tab" + (t === active ? " is-active" : "")}>{t}</button>
        ))}
      </div>
      <div className="desk-user">
        <div style={{textAlign:'right'}}>
          <div className="desk-user__name">장웅</div>
          <div className="desk-user__role">관리자 · 경기지부</div>
        </div>
        <div className="avatar avatar--admin">장</div>
      </div>
    </div>
  );
};

/* ─── 공지 ─── */
const DeskNotice = () => (
  <div className="desk">
    <DeskNav2 active="공지" />
    <div className="desk-body">
      <div className="desk-page-head">
        <div className="desk-page-head__title-group">
          <div className="desk-page-head__eyebrow">공지사항</div>
          <div className="desk-page-head__title">공지 목록 <span style={{color:'var(--gray-400)',fontWeight:500}}>2</span></div>
        </div>
        <button className="btn btn--primary"><window.Icon.plus width="14" height="14"/>공지 작성</button>
      </div>

      <div className="desk-grid-12" style={{gap:20}}>
        <div className="desk-card" style={{gridColumn:'span 7',padding:0}}>
          <div className="notice-list" style={{padding:'8px 16px'}}>
            <div className="notice-list__row is-selected">
              <span className="badge badge--primary">공지</span>
              <div style={{flex:1}}>
                <div style={{fontWeight:600,fontSize:14}}>집회 시간 변경 안내</div>
                <div style={{fontSize:12,color:'var(--gray-500)',marginTop:2}}>김민준 · 2026-04-18</div>
              </div>
              <window.Icon.chevronRight width="16" height="16"/>
            </div>
            <div className="notice-list__row">
              <span className="badge badge--neutral">일반</span>
              <div style={{flex:1}}>
                <div style={{fontWeight:600,fontSize:14}}>봉사 모임 위치 변경</div>
                <div style={{fontSize:12,color:'var(--gray-500)',marginTop:2}}>장웅 · 2026-04-18</div>
              </div>
              <window.Icon.chevronRight width="16" height="16"/>
            </div>
          </div>
        </div>

        <div className="desk-card" style={{gridColumn:'span 5'}}>
          <div className="desk-card__head">
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <span className="badge badge--primary">공지</span>
              <span style={{fontSize:13,color:'var(--gray-500)'}}>김민준 · 2026-04-18</span>
            </div>
            <div style={{display:'flex',gap:6}}>
              <button className="btn btn--ghost btn--sm">수정</button>
              <button className="btn btn--danger btn--sm">삭제</button>
            </div>
          </div>
          <div>
            <div style={{fontSize:18,fontWeight:700,letterSpacing:'-0.02em',color:'var(--gray-900)',marginBottom:12}}>집회 시간 변경 안내</div>
            <div style={{fontSize:14,color:'var(--gray-700)',lineHeight:1.7}}>
              안녕하세요. 다음 주부터 화요일 집회 시간이 19:30 → 20:00으로 변경됩니다.<br/><br/>
              혼동 없이 참석해 주시기 바랍니다. 추가 문의는 인도자에게 연락 주세요.
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
);

/* ─── 캘린더 ─── */
const DeskCalendar = () => {
  const rows = [
    [null,null,null,"1","2","3","4"],
    ["5","6","7","8","9","10","11"],
    ["12","13","14","15","16","17","18"],
    ["19","20","21","22","23","24","25"],
    ["26","27","28","29","30",null,null],
  ];
  const events = {
    "2":[{t:"10:00",l:"봉사",c:"am"}],
    "3":[{t:"10:00",l:"오전 방문",c:"am"}],
    "5":[{t:"10:00",l:"오전 방문",c:"am"}],
    "9":[{t:"10:00",l:"봉사",c:"am"}],
    "10":[{t:"10:00",l:"오전 방문",c:"am"}],
    "16":[{t:"10:00",l:"오전 방문",c:"am"},{t:"13:00",l:"봉사",c:"pm"}],
    "20":[{t:"10:00",l:"야외봉사",c:"special"}],
    "23":[{t:"18:00",l:"준비모임",c:"pm"}],
    "24":[{t:"10:00",l:"오전 방문",c:"am"}],
    "25":[{t:"10:00",l:"오후",c:"am"}],
    "27":[{t:"10:00",l:"오전 방문",c:"am"},{t:"13:00",l:"오후 방문",c:"pm"}],
  };
  return (
    <div className="desk">
      <DeskNav2 active="캘린더" />
      <div className="desk-body" style={{padding:'20px 24px'}}>
        <div className="desk-page-head">
          <div className="desk-page-head__title-group">
            <div className="desk-page-head__eyebrow">운영 캘린더</div>
            <div className="desk-page-head__title">2026년 4월</div>
          </div>
          <div style={{display:'flex',gap:8}}>
            <button className="btn btn--secondary btn--sm">신청내역</button>
            <button className="btn btn--secondary btn--sm">일괄 업로드</button>
            <button className="icon-btn"><window.Icon.chevronLeft width="18" height="18"/></button>
            <button className="btn btn--secondary btn--sm">오늘</button>
            <button className="icon-btn"><window.Icon.chevronRight width="18" height="18"/></button>
            <button className="btn btn--primary btn--sm"><window.Icon.plus width="14" height="14"/>일정 추가</button>
          </div>
        </div>

        <div style={{marginBottom:12}}>
          <span className="season-banner" style={{display:'inline-flex',padding:'8px 12px'}}>
            <span className="season-banner__dot"/>
            <span style={{fontSize:13,color:'var(--warning-700)',fontWeight:600}}>기념식 초대장 배부 활동 · 04-28 ~ 05-04</span>
            <button style={{background:'none',border:'none',color:'var(--warning-600)',marginLeft:8,fontSize:14}}>×</button>
          </span>
        </div>

        <div className="desk-grid-12" style={{gap:20}}>
          <div className="desk-card" style={{gridColumn:'span 9',padding:0,overflow:'hidden'}}>
            <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',background:'var(--gray-50)',borderBottom:'1px solid var(--border-default)'}}>
              {["일","월","화","수","목","금","토"].map((d,i)=>(
                <div key={i} style={{padding:'10px 12px',fontSize:12,fontWeight:600,color: i===0?'#DC8888' : i===6?'#6B8FCF':'var(--gray-500)'}}>{d}</div>
              ))}
            </div>
            {rows.map((r,ri)=>(
              <div key={ri} style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',borderBottom: ri<rows.length-1?'1px solid var(--border-subtle)':'none'}}>
                {r.map((d,ci)=>{
                  const isToday = d === "29";
                  const ev = events[d] || [];
                  return (
                    <div key={ci} style={{borderRight: ci<6?'1px solid var(--border-subtle)':'none',padding:'8px 8px 6px',minHeight:90,position:'relative'}}>
                      {d ? (
                        <>
                          <div style={{fontSize:13,fontWeight:600,color: isToday ? 'white' : ci===0?'#DC8888':ci===6?'#6B8FCF':'var(--gray-700)',width:isToday?22:'auto',height:isToday?22:'auto',background:isToday?'var(--primary-500)':'transparent',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',marginBottom:4}}>{d}</div>
                          <div style={{display:'flex',flexDirection:'column',gap:2}}>
                            {ev.map((e,i)=>(
                              <div key={i} style={{
                                fontSize:11,padding:'2px 6px',borderRadius:4,fontWeight:500,
                                background: e.c==="am"?'var(--info-50)':e.c==="pm"?'var(--warning-100)':'var(--success-50)',
                                color: e.c==="am"?'var(--info-600)':e.c==="pm"?'var(--warning-700)':'var(--success-700)',
                                whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'
                              }}>{e.t} {e.l}</div>
                            ))}
                          </div>
                          {d==="28" && <div style={{position:'absolute',bottom:4,left:6,right:6,height:3,background:'var(--warning-500)',borderRadius:2}}/>}
                        </>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          <div className="desk-card" style={{gridColumn:'span 3'}}>
            <div className="desk-card__head">
              <div className="desk-card__title">4월 29일 일정</div>
            </div>
            <div className="empty">
              <div className="empty__icon"><window.Icon.calendar width="22" height="22"/></div>
              <div className="empty__title">4월 29일 일정이 없습니다</div>
              <div className="empty__sub">새로운 일정을 추가해보세요</div>
              <button className="btn btn--soft btn--sm" style={{marginTop:8}}><window.Icon.plus width="14" height="14"/>일정 추가</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ─── 지도 ─── */
const DeskMap = () => (
  <div className="desk">
    <DeskNav2 active="지도" />
    <div style={{display:'flex',gap:12,padding:'12px 24px',background:'var(--bg-card)',borderBottom:'1px solid var(--border-subtle)',alignItems:'center',flexWrap:'wrap'}}>
      <div style={{display:'flex',gap:6,alignItems:'center'}}>
        <span style={{fontSize:12,color:'var(--gray-500)'}}>지역</span>
        <button className="btn btn--secondary btn--sm">전체 ▾</button>
      </div>
      <div style={{display:'flex',gap:6,alignItems:'center'}}>
        <span style={{fontSize:12,color:'var(--gray-500)'}}>동</span>
        <button className="btn btn--secondary btn--sm">전체 ▾</button>
      </div>
      <div style={{display:'flex',gap:6,alignItems:'center'}}>
        <span style={{fontSize:12,color:'var(--gray-500)'}}>카드</span>
        <button className="btn btn--secondary btn--sm">전체 카드 ▾</button>
      </div>
      <div className="segment">
        <button className="segment__item is-active">전체</button>
        <button className="segment__item">상가</button>
        <button className="segment__item">주택</button>
      </div>
      <div className="segment">
        <button className="segment__item is-active">전체</button>
        <button className="segment__item">중국인</button>
        <button className="segment__item">부재</button>
        <button className="segment__item">만남</button>
      </div>
      <div style={{flex:1}}/>
      <button className="btn btn--secondary btn--sm">구역선 수정</button>
      <button className="btn btn--danger btn--sm">삭제</button>
    </div>
    <div style={{flex:1,display:'grid',gridTemplateColumns:'240px 1fr 320px',overflow:'hidden'}}>
      <div style={{borderRight:'1px solid var(--border-subtle)',background:'var(--bg-card)',display:'flex',flexDirection:'column'}}>
        <div style={{padding:'14px 16px',borderBottom:'1px solid var(--border-subtle)',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <div>
            <div style={{fontSize:11,color:'var(--gray-500)',fontWeight:500}}>구역 카드</div>
            <div style={{fontSize:18,fontWeight:700,letterSpacing:'-0.02em'}}>608개</div>
          </div>
          <button className="btn btn--soft btn--sm">전체 보기</button>
        </div>
        <div style={{flex:1,overflow:'auto'}}>
          {Array.from({length:7}).map((_,i)=>(
            <div key={i} style={{padding:'12px 16px',borderBottom:'1px solid var(--border-subtle)',display:'flex',alignItems:'center',gap:8}}>
              <div style={{flex:1}}>
                <div style={{fontSize:13,fontWeight:600,color:'var(--gray-900)'}}>처인구 고림동 {i+1}</div>
                <div style={{fontSize:11,color:'var(--gray-500)',marginTop:2}}>건물 {i%3+1} · 세대 {i%4} · {[0,25,100,0,25,0,0][i]}%</div>
              </div>
              <button className="btn btn--ghost btn--sm" style={{fontSize:11,padding:'4px 8px',height:24}}>구역선 표시</button>
            </div>
          ))}
        </div>
      </div>

      <div className="map-canvas" style={{position:'relative'}}>
        <div className="map-zone-poly" style={{top:'25%',left:'30%',width:'40%',height:'50%'}}/>
        <div className="map-pin" style={{top:'45%',left:'50%'}}/>
        <div className="map-pin map-pin--success" style={{top:'40%',left:'55%'}}/>
        <div className="map-pin map-pin--warning" style={{top:'55%',left:'45%'}}/>
        <div style={{position:'absolute',top:16,left:16,background:'var(--bg-card)',padding:'10px 12px',borderRadius:'var(--radius-md)',boxShadow:'var(--shadow-sm)',display:'flex',gap:14,fontSize:12}}>
          <span style={{display:'flex',alignItems:'center',gap:6}}><span style={{width:10,height:10,borderRadius:'50%',background:'var(--info-500)'}}/>방문필요 5</span>
          <span style={{display:'flex',alignItems:'center',gap:6}}><span style={{width:10,height:10,borderRadius:'50%',background:'var(--success-500)'}}/>방문완료 1</span>
          <span style={{display:'flex',alignItems:'center',gap:6}}><span style={{width:10,height:10,borderRadius:'50%',background:'var(--warning-500)'}}/>정기방문 6</span>
        </div>
        <div className="map-controls">
          <button className="map-control-btn"><window.Icon.layers width="18" height="18"/></button>
          <button className="map-control-btn"><window.Icon.plus width="18" height="18"/></button>
          <button className="map-control-btn"><window.Icon.zoomIn width="18" height="18"/></button>
          <button className="map-control-btn"><window.Icon.zoomOut width="18" height="18"/></button>
        </div>
      </div>

      <div style={{borderLeft:'1px solid var(--border-subtle)',background:'var(--bg-card)',display:'flex',flexDirection:'column'}}>
        <div style={{padding:'14px 16px',borderBottom:'1px solid var(--border-subtle)'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
            <div style={{fontSize:14,fontWeight:700}}>건물 목록 <span style={{color:'var(--gray-400)',fontWeight:500}}>12</span></div>
            <div style={{fontSize:18,fontWeight:700,color:'var(--success-600)',letterSpacing:'-0.02em'}}>53%</div>
          </div>
          <div className="progress"><div className="progress__bar progress__bar--success" style={{width:'53%'}}/></div>
          <div style={{fontSize:11,color:'var(--gray-500)',marginTop:4}}>8/15 세대</div>
        </div>
        <div style={{flex:1,overflow:'auto'}}>
          {[
            {n:"경안천로 232", who:"감자탕형제들", pct:100, color:"success"},
            {n:"경안천로 276", who:"사천요리관", pct:100, color:"info"},
            {n:"경안천로256번길 73", who:"순운친", pct:100, color:"success"},
            {n:"고림로 45", who:"-", pct:0, color:""},
            {n:"경안천로358번길 62", who:"행정", pct:100, color:"success"},
            {n:"고림로200번길 1", who:"홍길동가족", pct:0, color:""},
          ].map((b,i)=>(
            <div key={i} style={{padding:'12px 16px',borderBottom:'1px solid var(--border-subtle)',display:'flex',alignItems:'center',gap:10}}>
              <div style={{flex:1}}>
                <div style={{fontSize:13,fontWeight:600,color:'var(--gray-900)'}}>{b.n}</div>
                <div style={{fontSize:11,color:'var(--gray-500)',marginTop:2}}>{b.who}</div>
              </div>
              <span className={"badge " + (b.pct === 100 ? "badge--success" : "badge--neutral")}>{b.pct}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

/* ─── 배정 ─── */
const DeskAssign = () => (
  <div className="desk">
    <DeskNav2 active="배정" />
    <div className="desk-body">
      <div className="desk-page-head">
        <div className="desk-page-head__title-group">
          <div className="desk-page-head__eyebrow">배정</div>
          <div className="desk-page-head__title">관리자 배정</div>
          <div style={{fontSize:13,color:'var(--gray-500)',marginTop:2}}>인도자에게 담당 구역을 지정합니다</div>
        </div>
        <div style={{display:'flex',gap:8}}>
          <button className="btn btn--ghost">배정 현황 보기</button>
          <span className="badge badge--danger" style={{fontSize:13,padding:'6px 12px'}}>미배정 592개</span>
        </div>
      </div>

      <div className="desk-grid-12" style={{gap:16}}>
        <div className="desk-card" style={{gridColumn:'span 3',padding:0}}>
          <div style={{padding:'14px 16px',borderBottom:'1px solid var(--border-subtle)'}}>
            <div style={{fontSize:14,fontWeight:700,marginBottom:8}}>1. 인도자 선택</div>
            <div className="input-wrap">
              <span className="input-wrap__icon"><window.Icon.search width="16" height="16"/></span>
              <input className="input input--search" placeholder="인도자 검색"/>
            </div>
          </div>
          <div>
            {[
              {a:"관",n:"관리자",sub:"담당 0",cls:"avatar--admin",sel:true},
              {a:"사1",n:"사용자1",sub:"담당 2",cls:"avatar--user-1"},
              {a:"사2",n:"사용자2",sub:"담당 3",cls:"avatar--user-2"},
              {a:"사3",n:"사용자3",sub:"담당 1",cls:"avatar--user-3"},
              {a:"장",n:"장웅",sub:"담당 13",cls:"avatar--user-4"},
            ].map((u,i)=>(
              <div key={i} className={"guide-row" + (u.sel?" is-selected":"")}>
                <div className={"avatar avatar--sm " + u.cls}>{u.a}</div>
                <div className="guide-row__main">
                  <div className="guide-row__name" style={{fontSize:13}}>{u.n}</div>
                </div>
                <div style={{fontSize:12,color:'var(--gray-500)'}}>{u.sub}</div>
              </div>
            ))}
            <div style={{padding:'12px 16px',borderTop:'1px solid var(--border-subtle)'}}>
              <button className="btn btn--ghost btn--sm" style={{width:'100%'}}><window.Icon.plus width="14" height="14"/>인도자 추가</button>
            </div>
          </div>
        </div>

        <div className="desk-card" style={{gridColumn:'span 3',padding:0}}>
          <div style={{padding:'14px 16px',borderBottom:'1px solid var(--border-subtle)'}}>
            <div style={{fontSize:14,fontWeight:700}}>2. 관리자 담당 구역 <span style={{color:'var(--gray-400)',fontWeight:500}}>0</span></div>
          </div>
          <div className="empty">
            <div className="empty__icon" style={{width:64,height:64,fontSize:28}}>👤</div>
            <div className="empty__title">아직 담당 구역이 없습니다</div>
            <div className="empty__sub">우측에서 구역을 선택해 배정하세요</div>
          </div>
        </div>

        <div className="desk-card" style={{gridColumn:'span 6',padding:0}}>
          <div style={{padding:'14px 16px',borderBottom:'1px solid var(--border-subtle)',display:'flex',gap:8,alignItems:'center'}}>
            <div style={{fontSize:14,fontWeight:700}}>3. 전체 구역 목록 <span style={{color:'var(--gray-400)',fontWeight:500}}>608</span></div>
            <div style={{flex:1}}/>
            <input className="input" style={{maxWidth:180,height:32}} placeholder="구역명 검색"/>
            <button className="btn btn--secondary btn--sm">전체 지역 ▾</button>
            <button className="btn btn--secondary btn--sm">전체 상태 ▾</button>
          </div>
          <div style={{maxHeight:480,overflow:'auto'}}>
            {[
              {n:"수지구 고기동 1",sub:"수지구 · 고기동",who:"사용자1, 사용자2 담당"},
              {n:"수지구 고기동 2",sub:"수지구 · 고기동",who:"장웅 담당"},
              {n:"수지구 고기동 3",sub:"수지구 · 고기동",who:null},
              {n:"수지구 고기동 4",sub:"수지구 · 고기동",who:null},
              {n:"수지구 고기동 5",sub:"수지구 · 고기동",who:null},
              {n:"처인구 고림동 1",sub:"처인구 · 고림동",who:"장웅 담당"},
              {n:"처인구 고림동 2",sub:"처인구 · 고림동",who:"장웅 담당"},
              {n:"처인구 고림동 3",sub:"처인구 · 고림동",who:"장웅 담당"},
              {n:"처인구 고림동 4",sub:"처인구 · 고림동",who:"장웅 담당"},
            ].map((z,i)=>(
              <div key={i} style={{padding:'12px 16px',borderBottom:'1px solid var(--border-subtle)',display:'flex',alignItems:'center',gap:12}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:14,fontWeight:600}}>{z.n}</div>
                  <div style={{fontSize:12,color:'var(--gray-500)',marginTop:2}}>{z.sub}</div>
                </div>
                {z.who
                  ? <span style={{fontSize:12,color:'var(--gray-700)'}}>{z.who}</span>
                  : <span className="badge badge--warning">미배정</span>}
                <button className="btn btn--soft btn--sm">배정</button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  </div>
);

/* ─── 사용자 ─── */
const DeskUsers = () => (
  <div className="desk">
    <DeskNav2 active="사용자" />
    <div className="desk-body">
      <div className="desk-page-head">
        <div className="desk-page-head__title-group">
          <div className="desk-page-head__eyebrow">봉사자 관리</div>
          <div className="desk-page-head__title">사용자 목록 <span style={{color:'var(--gray-400)',fontWeight:500}}>7명</span></div>
        </div>
        <div style={{display:'flex',gap:8}}>
          <input className="input" style={{maxWidth:240}} placeholder="이름 검색…"/>
          <button className="btn btn--primary"><window.Icon.plus width="14" height="14"/>사용자 추가</button>
        </div>
      </div>

      <div className="desk-grid-12" style={{gap:16}}>
        <div className="desk-card" style={{gridColumn:'span 7',padding:0}}>
          <div className="list">
            {[
              {a:"관",n:"관리자",cls:"avatar--admin",roles:["관리자","인도자","봉사자"],meta:"방문 기록 0건",sel:true},
              {a:"사1",n:"사용자1",cls:"avatar--user-1",roles:["인도자","봉사자"],meta:"방문 기록 0건"},
              {a:"사2",n:"사용자2",cls:"avatar--user-2",roles:["인도자","봉사자"],meta:"방문 기록 0건"},
              {a:"사3",n:"사용자3",cls:"avatar--user-3",roles:["인도자","봉사자"],meta:"방문 기록 0건"},
              {a:"사4",n:"사용자4",cls:"avatar--user-5",roles:["봉사자"],meta:"방문 기록 0건"},
              {a:"사5",n:"사용자5",cls:"avatar--user-6",roles:["봉사자"],meta:"방문 기록 0건"},
              {a:"장",n:"장웅",cls:"avatar--user-4",roles:["관리자","인도자","봉사자"],meta:"방문 기록 8건 · 최근 04/28"},
            ].map((u,i)=>(
              <div key={i} className="list-row" style={{background:u.sel?'var(--primary-50)':'transparent',padding:'14px 16px'}}>
                <div className={"avatar " + u.cls}>{u.a}</div>
                <div className="list-row__main">
                  <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
                    <span className="list-row__title">{u.n}</span>
                    {u.roles.map((r,ri)=>(
                      <span key={ri} className={"badge " + (r==="관리자"?"badge--danger":r==="인도자"?"badge--success":"badge--neutral")}>{r}</span>
                    ))}
                  </div>
                  <div className="list-row__sub">{u.meta}</div>
                </div>
                <window.Icon.chevronRight width="16" height="16" style={{color:'var(--gray-400)'}}/>
              </div>
            ))}
          </div>
        </div>

        <div className="desk-card" style={{gridColumn:'span 5'}}>
          <div className="profile-block" style={{padding:0}}>
            <div className="avatar avatar--lg avatar--admin">관</div>
            <div className="profile-block__main">
              <div className="profile-block__name">관리자</div>
              <div className="profile-block__role">관리자 · 인도자 · 봉사자</div>
            </div>
          </div>
          <div style={{display:'flex',gap:24,padding:'12px 0',borderBottom:'1px solid var(--border-subtle)'}}>
            <div><div style={{fontSize:11,color:'var(--gray-500)'}}>계정 상태</div><div style={{fontSize:14,fontWeight:600,color:'var(--success-600)'}}>사용 중</div></div>
            <div><div style={{fontSize:11,color:'var(--gray-500)'}}>방문 기록</div><div style={{fontSize:14,fontWeight:600}}>0건</div></div>
          </div>

          <div>
            <div style={{fontSize:13,fontWeight:700,marginBottom:8}}>아이디 / 닉네임</div>
            <div style={{display:'flex',gap:6,marginBottom:16}}>
              <input className="input" defaultValue="관리자" style={{flex:1,height:36}}/>
              <input className="input" defaultValue="관리자" style={{flex:1,height:36}}/>
              <button className="btn btn--secondary btn--sm">저장</button>
            </div>

            <div style={{fontSize:13,fontWeight:700,marginBottom:8}}>사용자 권한</div>
            <div style={{display:'flex',flexDirection:'column',gap:8,marginBottom:16}}>
              <label style={{display:'flex',alignItems:'center',gap:8,fontSize:13}}>
                <input type="checkbox" defaultChecked/> 봉사자 <span style={{color:'var(--gray-500)',fontSize:11,marginLeft:'auto'}}>기본</span>
              </label>
              <label style={{display:'flex',alignItems:'center',gap:8,fontSize:13}}>
                <input type="checkbox" defaultChecked/> 인도자
              </label>
              <label style={{display:'flex',alignItems:'center',gap:8,fontSize:13}}>
                <input type="checkbox" defaultChecked/> 관리자
              </label>
            </div>

            <div style={{padding:12,background:'var(--danger-50)',borderRadius:'var(--radius-md)',display:'flex',alignItems:'center',gap:10}}>
              <div style={{flex:1}}>
                <div style={{fontSize:13,fontWeight:600,color:'var(--danger-700)'}}>비밀번호 강제 초기화</div>
                <div style={{fontSize:11,color:'var(--danger-600)',marginTop:2}}>'0000'으로 초기화됩니다</div>
              </div>
              <button className="btn btn--danger btn--sm">초기화</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
);

/* ─── 통계 ─── */
const DeskStats = () => (
  <div className="desk">
    <DeskNav2 active="통계" />
    <div className="desk-body">
      <div className="desk-page-head">
        <div className="desk-page-head__title-group">
          <div className="desk-page-head__eyebrow">분석</div>
          <div className="desk-page-head__title">통계 대시보드</div>
        </div>
        <div className="segment">
          <button className="segment__item is-active">전체</button>
          <button className="segment__item">일반 봉사만</button>
          <button className="segment__item">🎯 기념식 시즌</button>
        </div>
      </div>

      <div className="desk-grid-12" style={{gap:16}}>
        <div className="desk-card" style={{gridColumn:'span 6'}}>
          <div className="desk-card__head">
            <div className="desk-card__title">📊 이번달 vs 지난달</div>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr auto 1fr',gap:16,alignItems:'center'}}>
            <div style={{padding:18,background:'var(--bg-subtle)',borderRadius:'var(--radius-lg)',textAlign:'center'}}>
              <div style={{fontSize:11,color:'var(--gray-500)',marginBottom:4}}>3월</div>
              <div className="tnum" style={{fontSize:32,fontWeight:700,letterSpacing:'-0.03em'}}>0.0%</div>
              <div style={{fontSize:11,color:'var(--gray-500)',marginTop:4}}>만남 0 / 방문 0</div>
            </div>
            <div style={{textAlign:'center'}}>
              <div style={{fontSize:14,color:'var(--success-600)',fontWeight:700}}>↑</div>
              <div style={{fontSize:13,color:'var(--success-600)',fontWeight:600,marginTop:2}}>37.5%p</div>
            </div>
            <div style={{padding:18,background:'var(--success-50)',borderRadius:'var(--radius-lg)',textAlign:'center',border:'1px solid var(--success-500)'}}>
              <div style={{fontSize:11,color:'var(--success-700)',marginBottom:4,fontWeight:600}}>4월 (이번달)</div>
              <div className="tnum" style={{fontSize:32,fontWeight:700,letterSpacing:'-0.03em',color:'var(--success-700)'}}>37.5%</div>
              <div style={{fontSize:11,color:'var(--success-700)',marginTop:4}}>만남 3 / 방문 8</div>
            </div>
          </div>
        </div>

        <div className="desk-card" style={{gridColumn:'span 6'}}>
          <div className="desk-card__head">
            <div className="desk-card__title">전체 요약</div>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:12}}>
            <div><div className="tnum" style={{fontSize:24,fontWeight:700}}>8</div><div style={{fontSize:11,color:'var(--gray-500)'}}>총 방문</div></div>
            <div><div className="tnum" style={{fontSize:24,fontWeight:700,color:'var(--success-600)'}}>3</div><div style={{fontSize:11,color:'var(--gray-500)'}}>만남</div></div>
            <div><div className="tnum" style={{fontSize:24,fontWeight:700,color:'var(--warning-600)'}}>5</div><div style={{fontSize:11,color:'var(--gray-500)'}}>부재</div></div>
            <div><div className="tnum" style={{fontSize:24,fontWeight:700}}>0</div><div style={{fontSize:11,color:'var(--gray-500)'}}>한국인</div></div>
            <div><div className="tnum" style={{fontSize:24,fontWeight:700,color:'var(--info-600)'}}>37.5%</div><div style={{fontSize:11,color:'var(--gray-500)'}}>만남율</div></div>
          </div>
        </div>

        <div className="desk-card" style={{gridColumn:'span 6'}}>
          <div className="desk-card__head"><div className="desk-card__title">결과 분포</div></div>
          {[
            {l:"만남",v:3,t:37.5,c:"var(--success-500)"},
            {l:"부재",v:5,t:62.5,c:"var(--warning-500)"},
            {l:"한국인",v:0,t:0,c:"var(--gray-300)"},
          ].map((r,i)=>(
            <div key={i} style={{display:'grid',gridTemplateColumns:'60px 1fr 80px',gap:12,alignItems:'center',marginBottom:10}}>
              <div style={{fontSize:13,fontWeight:600}}>{r.l}</div>
              <div style={{height:18,background:'var(--gray-100)',borderRadius:9,overflow:'hidden'}}><div style={{width:r.t+'%',height:'100%',background:r.c,borderRadius:9}}/></div>
              <div className="tnum" style={{fontSize:12,color:'var(--gray-600)',textAlign:'right'}}>{r.v}건 ({r.t}%)</div>
            </div>
          ))}
        </div>

        <div className="desk-card" style={{gridColumn:'span 6'}}>
          <div className="desk-card__head"><div className="desk-card__title">⏰ 시간대별 분석</div></div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12}}>
            {[
              {l:"오전",v:"0.0%",sub:"만남 0 / 0",col:"var(--info-500)"},
              {l:"오후",v:"42.9%",sub:"만남 3 / 7",col:"var(--warning-500)"},
              {l:"저녁",v:"0.0%",sub:"만남 0 / 1",col:"var(--gray-400)"},
            ].map((t,i)=>(
              <div key={i} style={{padding:14,background:'var(--bg-subtle)',borderRadius:'var(--radius-lg)'}}>
                <div style={{fontSize:11,color:'var(--gray-500)',marginBottom:4}}>{t.l}</div>
                <div className="tnum" style={{fontSize:22,fontWeight:700,color:t.col}}>{t.v}</div>
                <div style={{fontSize:11,color:'var(--gray-500)',marginTop:4}}>{t.sub}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="desk-card" style={{gridColumn:'span 6'}}>
          <div className="desk-card__head"><div className="desk-card__title">🇨🇳 중국인 세대 분석</div></div>
          <div style={{padding:18,background:'var(--warning-50)',borderRadius:'var(--radius-lg)',border:'1px solid var(--warning-100)'}}>
            <div style={{fontSize:11,color:'var(--warning-700)',marginBottom:4,fontWeight:600}}>전체 접촉율</div>
            <div className="tnum" style={{fontSize:30,fontWeight:700,color:'var(--warning-700)',letterSpacing:'-0.03em'}}>40.0%</div>
            <div style={{fontSize:11,color:'var(--warning-600)',marginTop:4}}>만남 2 · 방문 5 · 중국인 세대 12개 · 부재 3회</div>
          </div>
        </div>

        <div className="desk-card" style={{gridColumn:'span 6'}}>
          <div className="desk-card__head">
            <div className="desk-card__title">📈 방문 추이</div>
            <div className="segment">
              <button className="segment__item is-active">월별</button>
              <button className="segment__item">주별</button>
            </div>
          </div>
          <svg viewBox="0 0 400 100" style={{width:'100%',height:100}}>
            <polyline points="0,90 50,90 100,90 150,90 200,88 250,88 300,87 350,40 400,5" fill="none" stroke="var(--success-500)" strokeWidth="2.5"/>
            <polyline points="0,90 50,90 100,90 150,90 200,88 250,88 300,87 350,40 400,5 400,100 0,100" fill="var(--success-500)" fillOpacity="0.1" stroke="none"/>
          </svg>
          <div style={{display:'flex',justifyContent:'space-between',fontSize:10,color:'var(--gray-400)'}}>
            <span>1월</span><span>2월</span><span>3월</span><span>4월</span>
          </div>
        </div>
      </div>
    </div>
  </div>
);

/* ─── 설정 ─── */
const DeskSettings = () => (
  <div className="desk">
    <DeskNav2 active="설정" />
    <div className="desk-body" style={{maxWidth:880,margin:'0 auto',width:'100%'}}>
      <div className="desk-page-head">
        <div className="desk-page-head__title-group">
          <div className="desk-page-head__eyebrow">설정</div>
          <div className="desk-page-head__title">앱 설정</div>
        </div>
      </div>

      <div style={{display:'flex',flexDirection:'column',gap:16}}>
        <div className="desk-card">
          <div className="desk-card__head">
            <div className="desk-card__title">계정</div>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:14}}>
            <div className="avatar avatar--lg avatar--admin">장</div>
            <div style={{flex:1}}>
              <div style={{fontSize:15,fontWeight:700}}>장웅</div>
              <div style={{fontSize:12,color:'var(--gray-500)',marginTop:2}}>관리자 · 경기지부</div>
            </div>
            <button className="btn btn--secondary">계정 관리</button>
            <button className="btn btn--danger">로그아웃</button>
          </div>
        </div>

        <div className="desk-card">
          <div className="desk-card__head">
            <div className="desk-card__title">앱 정보</div>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,fontSize:13}}>
            <div><div style={{color:'var(--gray-500)',fontSize:12}}>앱 이름</div><div style={{marginTop:2,fontWeight:500}}>중화권 구역 관리</div></div>
            <div><div style={{color:'var(--gray-500)',fontSize:12}}>버전</div><div style={{marginTop:2,fontWeight:500}}>1.0.0</div></div>
            <div><div style={{color:'var(--gray-500)',fontSize:12}}>현재 사용자</div><div style={{marginTop:2,fontWeight:500}}>장웅</div></div>
            <div><div style={{color:'var(--gray-500)',fontSize:12}}>마지막 로그인</div><div style={{marginTop:2,fontWeight:500}}>2026-04-29 오전 9:00</div></div>
          </div>
        </div>

        <div className="desk-card">
          <div className="desk-card__head">
            <div className="desk-card__title">특별 봉사 시즌</div>
            <button className="btn btn--primary btn--sm"><window.Icon.plus width="14" height="14"/>새 시즌</button>
          </div>
          <div className="season-banner" style={{padding:'14px 16px'}}>
            <span className="season-banner__dot"/>
            <div style={{flex:1}}>
              <div style={{fontSize:14,fontWeight:700,color:'var(--warning-700)'}}>🎯 기념식 초대장 배부 활동</div>
              <div style={{fontSize:12,color:'var(--warning-600)',marginTop:2}}>2026-04-28 ~ 2026-05-04 · 진행 중</div>
              <div style={{fontSize:12,color:'var(--gray-600)',marginTop:6,lineHeight:1.5}}>
                기간 중 모든 방문 기록은 자동으로 시즌에 태깅됩니다. 방문 폼에 "초대장 남김" 체크박스가 표시됩니다.
              </div>
            </div>
            <span className="season-banner__d">D-5</span>
            <button className="btn btn--ghost btn--sm">중료/삭제</button>
          </div>
        </div>
      </div>
    </div>
  </div>
);

window.Desktops2 = { DeskNotice, DeskCalendar, DeskMap, DeskAssign, DeskUsers, DeskStats, DeskSettings };
