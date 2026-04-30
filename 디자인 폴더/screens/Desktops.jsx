/* 데스크탑 핵심 2개 화면 — 홈 + 카드 관리 */

const DeskNav = ({ active }) => {
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

const DeskHome = () => (
  <div className="desk">
    <DeskNav active="홈" />
    <div className="desk-body">
      <div className="desk-page-head">
        <div className="desk-page-head__title-group">
          <div className="desk-page-head__eyebrow">대시보드</div>
          <div className="desk-page-head__title">2026년 4월 29일 (수)</div>
        </div>
        <div className="season-banner" style={{flex:1, maxWidth:560}}>
          <span className="season-banner__dot"></span>
          <div style={{flex:1}}>
            <div style={{fontSize:13,fontWeight:700,color:'var(--warning-700)'}}>기념식 초대장 배부 활동</div>
            <div style={{fontSize:12,color:'var(--warning-600)',marginTop:2}}>2026-04-28 ~ 2026-05-04 · 이 기간의 모든 방문은 시즌으로 자동 기록</div>
          </div>
          <span className="season-banner__d">D-5</span>
        </div>
      </div>

      <div className="desk-grid-12" style={{marginBottom:16}}>
        {[
          {num:"608", label:"전체 카드"},
          {num:"16", label:"인도자 배정", delta:"+3 이번 주"},
          {num:"16", label:"진행 중 카드"},
          {num:"2", label:"완료 카드"},
        ].map((k,i)=>(
          <div key={i} className="desk-kpi" style={{gridColumn:'span 3'}}>
            <div className="desk-kpi__num tnum">{k.num}</div>
            <div className="desk-kpi__label">{k.label}</div>
            {k.delta && <div className="desk-kpi__delta">{k.delta}</div>}
          </div>
        ))}
      </div>

      <div className="desk-grid-12">
        <div className="desk-card" style={{gridColumn:'span 6'}}>
          <div className="desk-card__head">
            <div className="desk-card__title">
              <span className="desk-card__title-dot"/>
              오늘 운영 요약
            </div>
            <a className="desk-card__link" href="#">구역 보기 ›</a>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
            <div style={{padding:16,background:'var(--bg-subtle)',borderRadius:'var(--radius-lg)'}}>
              <div className="desk-kpi__num tnum" style={{fontSize:28}}>0</div>
              <div className="desk-kpi__label">오늘 일정</div>
            </div>
            <div style={{padding:16,background:'var(--bg-subtle)',borderRadius:'var(--radius-lg)'}}>
              <div className="desk-kpi__num tnum" style={{fontSize:28}}>0</div>
              <div className="desk-kpi__label">봉사 세션</div>
            </div>
            <div style={{padding:16,background:'var(--bg-subtle)',borderRadius:'var(--radius-lg)'}}>
              <div className="desk-kpi__num tnum" style={{fontSize:28}}>8<span style={{color:'var(--gray-400)',fontSize:18}}>/15</span></div>
              <div className="desk-kpi__label">완료 세대</div>
            </div>
            <div style={{padding:16,background:'var(--bg-subtle)',borderRadius:'var(--radius-lg)'}}>
              <div className="desk-kpi__num tnum" style={{fontSize:28}}>592</div>
              <div className="desk-kpi__label">미배정 카드</div>
            </div>
          </div>
        </div>

        <div className="desk-card" style={{gridColumn:'span 6'}}>
          <div className="desk-card__head">
            <div className="desk-card__title">
              <span className="desk-card__title-dot" style={{background:'var(--warning-500)'}}/>
              검토 필요
            </div>
            <button className="btn btn--ghost btn--sm"><window.Icon.plus width="14" height="14"/>추가</button>
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            <div style={{padding:'12px 14px',border:'1px solid var(--border-default)',borderRadius:'var(--radius-md)',display:'flex',alignItems:'center',gap:10}}>
              <span className="badge badge--warning">검토</span>
              <div style={{flex:1}}>
                <div style={{fontWeight:600,fontSize:13}}>고기동 3 — 인도자 미정</div>
                <div style={{fontSize:12,color:'var(--gray-500)',marginTop:2}}>3일 전 등록</div>
              </div>
              <button className="btn btn--soft btn--sm">처리</button>
            </div>
            <div style={{padding:'12px 14px',border:'1px solid var(--border-default)',borderRadius:'var(--radius-md)',display:'flex',alignItems:'center',gap:10}}>
              <span className="badge badge--warning">검토</span>
              <div style={{flex:1}}>
                <div style={{fontWeight:600,fontSize:13}}>경안천로 232 — 좌표 누락</div>
                <div style={{fontSize:12,color:'var(--gray-500)',marginTop:2}}>오늘</div>
              </div>
              <button className="btn btn--soft btn--sm">처리</button>
            </div>
          </div>
        </div>

        <div className="desk-card" style={{gridColumn:'span 7'}}>
          <div className="desk-card__head">
            <div className="desk-card__title">
              <span className="desk-card__title-dot"/>
              카드 진행
            </div>
            <a className="desk-card__link" href="#">전체보기 ›</a>
          </div>
          <div className="progress-list">
            {[
              {n:"수지구 고기동 1", sub:"사용자1 · 건물 0 · 세대 0", pct:0, color:""},
              {n:"수지구 고기동 2", sub:"장웅 · 건물 0 · 세대 0", pct:25, color:"warning"},
              {n:"수지구 고기동 3", sub:"인도자 미배정 · 건물 0 · 세대 0", pct:0, color:""},
              {n:"처인구 고림동 1", sub:"장웅 · 건물 1 · 세대 4", pct:100, color:"success"},
              {n:"처인구 고림동 2", sub:"장웅 · 건물 1 · 세대 4", pct:100, color:"success"},
            ].map((r,i)=>(
              <div key={i} className="progress-list__row">
                <div>
                  <div className="progress-list__title">{r.n}</div>
                  <div className="progress-list__meta">{r.sub}</div>
                </div>
                <div className="progress"><div className={"progress__bar" + (r.color ? " progress__bar--"+r.color : "")} style={{width:r.pct+'%'}}/></div>
                <div className="tnum" style={{fontSize:13,fontWeight:600,color:'var(--gray-700)',textAlign:'right'}}>{r.pct}%</div>
              </div>
            ))}
          </div>
        </div>

        <div className="desk-card" style={{gridColumn:'span 5'}}>
          <div className="desk-card__head">
            <div className="desk-card__title">
              <span className="desk-card__title-dot"/>
              공지
            </div>
            <a className="desk-card__link" href="#">전체보기 ›</a>
          </div>
          <div className="notice-list">
            <div className="notice-list__row is-selected">
              <span className="badge badge--primary">공지</span>
              <div style={{flex:1}}>
                <div style={{fontWeight:600,fontSize:13}}>집회 시간 변경 안내</div>
                <div style={{fontSize:12,color:'var(--gray-500)',marginTop:2}}>김민준 · 2026-04-18</div>
              </div>
              <window.Icon.chevronRight width="16" height="16"/>
            </div>
            <div className="notice-list__row">
              <span className="badge badge--neutral">일반</span>
              <div style={{flex:1}}>
                <div style={{fontWeight:600,fontSize:13}}>봉사 모임 위치</div>
                <div style={{fontSize:12,color:'var(--gray-500)',marginTop:2}}>장웅 · 2026-04-18</div>
              </div>
              <window.Icon.chevronRight width="16" height="16"/>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
);

const DeskCards = () => (
  <div className="desk">
    <DeskNav active="구역" />
    <div className="desk-body">
      <div className="desk-page-head">
        <div className="desk-page-head__title-group">
          <div className="desk-page-head__eyebrow">구역 관리</div>
          <div className="desk-page-head__title">카드 관리</div>
        </div>
        <div style={{display:'flex',gap:8}}>
          <button className="btn btn--ghost">상세 열기</button>
          <button className="btn btn--ghost">선택 삭제</button>
          <button className="btn btn--primary"><window.Icon.plus width="14" height="14"/>카드 추가</button>
        </div>
      </div>

      <div className="segment" style={{marginBottom:16}}>
        <button className="segment__item is-active">카드 관리</button>
        <button className="segment__item">건물 관리</button>
      </div>

      <div className="desk-grid-12" style={{marginBottom:16}}>
        {[
          {num:"608", label:"전체 카드"},
          {num:"16", label:"인도자 배정"},
          {num:"15", label:"전체 세대"},
          {num:"8", label:"방문 완료"},
        ].map((k,i)=>(
          <div key={i} className="desk-kpi" style={{gridColumn:'span 3'}}>
            <div className="desk-kpi__num tnum">{k.num}</div>
            <div className="desk-kpi__label">{k.label}</div>
          </div>
        ))}
      </div>

      <div className="desk-card" style={{gridColumn:'span 12',padding:0}}>
        <div style={{padding:'14px 18px',borderBottom:'1px solid var(--border-subtle)',display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
          <span style={{fontSize:12,color:'var(--gray-500)',marginRight:4,fontWeight:600}}>지역</span>
          <button className="chip is-active">전체 <span className="chip__count">608</span></button>
          <button className="chip">처인구 <span className="chip__count">512</span></button>
          <button className="chip">기흥구 <span className="chip__count">48</span></button>
          <button className="chip">수지구 <span className="chip__count">22</span></button>
          <button className="chip">영통구 <span className="chip__count">14</span></button>
          <button className="chip">화성시 <span className="chip__count">12</span></button>
        </div>
        <div style={{padding:'14px 18px',borderBottom:'1px solid var(--border-subtle)',display:'flex',gap:6,flexWrap:'wrap',alignItems:'center'}}>
          <span style={{fontSize:12,color:'var(--gray-500)',marginRight:4,fontWeight:600}}>동</span>
          <button className="chip is-active">전체 동</button>
          <button className="chip">고기동 <span className="chip__count">5</span></button>
          <button className="chip">고림동 <span className="chip__count">12</span></button>
          <button className="chip">구갈동 <span className="chip__count">15</span></button>
          <button className="chip">구성동 <span className="chip__count">9</span></button>
          <button className="chip">기흥동 <span className="chip__count">6</span></button>
          <button className="chip">남동 <span className="chip__count">11</span></button>
          <button className="chip">남사읍 <span className="chip__count">22</span></button>
          <button className="chip">동백동 <span className="chip__count">5</span></button>
          <button className="chip">동천동 <span className="chip__count">3</span></button>
          <button className="chip">마북동 <span className="chip__count">7</span></button>
          <button className="chip">마평동 <span className="chip__count">15</span></button>
          <button className="chip" style={{color:'var(--primary-600)'}}>더보기 ▾</button>
        </div>
        <div style={{padding:'12px 18px',borderBottom:'1px solid var(--border-subtle)',display:'flex',gap:12,alignItems:'center'}}>
          <span style={{fontSize:12,color:'var(--gray-500)',fontWeight:600}}>배정</span>
          <div className="segment">
            <button className="segment__item is-active">전체</button>
            <button className="segment__item">미배정</button>
          </div>
          <div style={{flex:1}}/>
          <button className="btn btn--secondary btn--sm">인도자 선택</button>
          <button className="btn btn--secondary btn--sm">일괄 적용</button>
        </div>
        <div style={{padding:'10px 18px',fontSize:12,color:'var(--gray-500)'}}>전체 지역 · 전체 동 · 표시 608개 카드</div>
        <table className="tbl" style={{padding:'0 18px 18px'}}>
          <thead>
            <tr>
              <th style={{width:36}}><input type="checkbox"/></th>
              <th>카드</th>
              <th style={{width:140}}>진행</th>
              <th>인도자</th>
              <th style={{width:60,textAlign:'right'}}>건물</th>
              <th style={{width:80,textAlign:'right'}}>중국인</th>
              <th style={{width:90,textAlign:'right'}}>정기방문</th>
              <th style={{width:80}}>구역선</th>
              <th style={{width:80}}>상태</th>
              <th style={{width:160,textAlign:'right'}}>작업</th>
            </tr>
          </thead>
          <tbody>
            {[
              {n:"수지구 고기동 1", who:"사용자1, 사용자2, 사용자3", pct:0, ppl:0, ch:0, reg:0, line:"있음", state:{l:"진행중",t:"primary"}},
              {n:"수지구 고기동 2", who:"장웅, 사용자2", pct:25, ppl:0, ch:0, reg:0, line:"있음", state:{l:"진행중",t:"primary"}},
              {n:"수지구 고기동 3", who:"미배정", pct:0, ppl:0, ch:0, reg:0, line:"있음", state:{l:"미배정",t:"warning"}},
              {n:"수지구 고기동 4", who:"미배정", pct:0, ppl:0, ch:0, reg:0, line:"있음", state:{l:"미배정",t:"warning"}},
              {n:"처인구 고림동 1", who:"장웅", pct:100, ppl:1, ch:4, reg:1, line:"있음", state:{l:"완료",t:"success"}},
              {n:"처인구 고림동 2", who:"장웅", pct:100, ppl:1, ch:4, reg:1, line:"있음", state:{l:"완료",t:"success"}},
            ].map((r,i)=>(
              <tr key={i}>
                <td><input type="checkbox"/></td>
                <td>
                  <div className="tbl__title">{r.n}</div>
                  <div className="tbl__sub">{r.n} · 건물 {r.ppl} · 세대 {r.ch}</div>
                </td>
                <td>
                  <div style={{display:'flex',alignItems:'center',gap:8}}>
                    <div className="progress" style={{flex:1}}>
                      <div className={"progress__bar" + (r.pct === 100 ? " progress__bar--success" : r.pct > 0 ? " progress__bar--warning" : "")} style={{width:r.pct+'%'}}/>
                    </div>
                    <span className="tnum" style={{fontSize:12,fontWeight:600,color:'var(--gray-700)',minWidth:32,textAlign:'right'}}>{r.pct}%</span>
                  </div>
                </td>
                <td style={{fontSize:12,color: r.who === "미배정" ? "var(--warning-700)" : "var(--gray-700)"}}>{r.who}</td>
                <td className="tnum" style={{textAlign:'right',fontSize:13}}>{r.ppl}개</td>
                <td className="tnum" style={{textAlign:'right',fontSize:13}}>{r.ch}건</td>
                <td className="tnum" style={{textAlign:'right',fontSize:13}}>{r.reg}건</td>
                <td><span className="badge badge--neutral">{r.line}</span></td>
                <td><span className={"badge badge--" + r.state.t}>{r.state.l}</span></td>
                <td style={{textAlign:'right'}}>
                  <button className="btn btn--ghost btn--sm">지도</button>
                  <button className="btn btn--soft btn--sm">수정</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  </div>
);

window.Desktops = { DeskHome, DeskCards };
