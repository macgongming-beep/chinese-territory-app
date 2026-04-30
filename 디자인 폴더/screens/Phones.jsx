/* 모바일 9개 화면 */

const StatusBar = () => (
  <div className="phone__statusbar">
    <span>9:41</span>
    <span className="phone__statusbar-right">
      <svg width="16" height="10" viewBox="0 0 16 10" fill="currentColor"><path d="M1 7h2v2H1zM5 5h2v4H5zM9 3h2v6H9zM13 1h2v8h-2z"/></svg>
      <svg width="14" height="10" viewBox="0 0 14 10" fill="currentColor"><path d="M7 8.5C4 8.5 1.5 6 1.5 3l1.4-.7A6.6 6.6 0 0 1 7 1.5c1.5 0 3 .3 4.1.8l1.4.7c0 3-2.5 5.5-5.5 5.5z" fillOpacity=".4"/><path d="M7 8.5C5.5 8.5 4.2 7.5 4.2 6l.5-.3a4 4 0 0 1 4.6 0l.5.3c0 1.5-1.3 2.5-2.8 2.5z"/></svg>
      <svg width="22" height="10" viewBox="0 0 22 10" fill="none" stroke="currentColor" strokeWidth="1"><rect x="1" y="1" width="18" height="8" rx="2"/><rect x="3" y="3" width="14" height="4" rx="1" fill="currentColor" stroke="none"/><path d="M20.5 4v2"/></svg>
    </span>
  </div>
);

const TabBar = ({ active }) => {
  const items = [
    { key: "home", label: "홈", icon: "home" },
    { key: "calendar", label: "캘린더", icon: "calendar" },
    { key: "zone", label: "구역", icon: "map" },
    { key: "assign", label: "배정", icon: "assign" },
    { key: "settings", label: "설정", icon: "settings" },
  ];
  return (
    <nav className="tabbar">
      {items.map(it => {
        const I = window.Icon[it.icon];
        return (
          <button key={it.key} className={"tabbar__item" + (active === it.key ? " is-active" : "")}>
            <I />
            <span>{it.label}</span>
          </button>
        );
      })}
    </nav>
  );
};

const PageHeader = ({ left, title, sub, right }) => (
  <header className="page-header">
    <div className="page-header__left">{left}</div>
    <div className="page-header__title-group">
      <div className="page-header__title">{title}</div>
      {sub && <div className="page-header__sub">{sub}</div>}
    </div>
    <div className="page-header__right">{right}</div>
  </header>
);

/* ─── 1. HOME ─── */
const PhoneHome = () => (
  <div className="phone">
    <StatusBar />
    <PageHeader
      title="홈"
      sub="2026년 4월 29일 (수)"
      right={<>
        <button className="icon-btn"><window.Icon.bell /></button>
        <button className="avatar avatar--sm avatar--admin">장</button>
      </>}
    />
    <div className="home">
      <div className="home__body">
        <div className="season-banner">
          <span className="season-banner__dot"></span>
          <span className="season-banner__title">기념식 초대장 배부 활동</span>
          <span className="season-banner__d">D-5</span>
        </div>

        <div className="card card--padded-sm">
          <div className="section-header" style={{marginBottom: 4}}>
            <div className="section-header__title">
              <window.Icon.megaphone width="16" height="16" />
              <span>공지</span>
            </div>
            <a className="section-header__link" href="#">전체보기 ›</a>
          </div>
          <div className="notice-row">
            <span className="badge badge--primary">공지</span>
            <span className="notice-row__title">집회 시간 변경 안내</span>
            <span className="notice-row__date">04/18</span>
          </div>
          <div className="notice-row">
            <span className="badge badge--neutral">일반</span>
            <span className="notice-row__title">봉사 모임 위치</span>
            <span className="notice-row__date">04/18</span>
          </div>
        </div>

        <div className="card card--padded-sm">
          <div className="section-header" style={{marginBottom: 8}}>
            <div className="section-header__title">
              <window.Icon.calendar width="16" height="16" />
              <span>오늘의 봉사</span>
            </div>
            <a className="section-header__link" href="#">전체보기 ›</a>
          </div>
          <div className="empty" style={{padding: "24px 16px"}}>
            <div className="empty__icon"><window.Icon.calendar width="22" height="22" /></div>
            <div className="empty__title">오늘 예정된 봉사가 없습니다</div>
            <div className="empty__sub">캘린더에서 새 일정을 추가해 보세요</div>
          </div>
        </div>

        <div>
          <div className="section-header">
            <div className="section-header__title">
              <window.Icon.map width="16" height="16" />
              <span>운영 현황</span>
            </div>
            <a className="section-header__link" href="#">전체보기 ›</a>
          </div>
          <div className="kpi-grid">
            <div className="kpi">
              <div className="kpi__num tnum">608</div>
              <div className="kpi__label">전체 카드</div>
            </div>
            <div className="kpi">
              <div className="kpi__num tnum">16</div>
              <div className="kpi__label">진행중</div>
              <div className="kpi__delta">+3 이번 주</div>
            </div>
            <div className="kpi">
              <div className="kpi__num tnum">2</div>
              <div className="kpi__label">완료 카드</div>
            </div>
            <div className="kpi">
              <div className="kpi__num tnum">8<span style={{color:'var(--gray-400)', fontSize:18}}>/15</span></div>
              <div className="kpi__label">완료 세대</div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <TabBar active="home" />
  </div>
);

/* ─── 2. CALENDAR (empty) ─── */
const calRows = [
  [null, null, null, "1", "2", "3", "4"],
  ["5", "6", "7", "8", "9", "10", "11"],
  ["12", "13", "14", "15", "16", "17", "18"],
  ["19", "20", "21", "22", "23", "24", "25"],
  ["26", "27", "28", "29", "30", null, null],
];
// dot config for visualization
const calDots = {
  "2":  ["am"],
  "3":  ["pm"],
  "5":  ["am"],
  "9":  ["am"],
  "10": ["pm"],
  "16": ["am","pm"],
  "20": ["am"],
  "23": ["pm"],
  "24": ["am"],
  "25": ["am"],
  "27": ["am","pm"],
};

const CalendarGrid = ({ today = "29", selected = null }) => (
  <div className="cal-grid">
    <div className="cal-row">
      <div className="cal-weekday cal-weekday--sun">일</div>
      <div className="cal-weekday">월</div>
      <div className="cal-weekday">화</div>
      <div className="cal-weekday">수</div>
      <div className="cal-weekday">목</div>
      <div className="cal-weekday">금</div>
      <div className="cal-weekday cal-weekday--sat">토</div>
    </div>
    {calRows.map((row, ri) => (
      <div className="cal-row" key={ri}>
        {row.map((d, ci) => {
          if (!d) return <div className="cal-cell cal-cell--muted" key={ci}/>;
          const isToday = d === today;
          const isSelected = d === selected && !isToday;
          const cls = "cal-cell"
            + (ci === 0 ? " cal-cell--sun" : "")
            + (ci === 6 ? " cal-cell--sat" : "")
            + (isToday ? " cal-cell--today" : "")
            + (isSelected ? " cal-cell--selected" : "");
          const dots = calDots[d] || [];
          return (
            <div className={cls} key={ci}>
              {isToday
                ? <span className="cal-cell__num">{d}</span>
                : <span>{d}</span>}
              {dots.length > 0 && (
                <div className="cal-dots">
                  {dots.map((t, i) => <span key={i} className={"cal-dot cal-dot--" + t}/>)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    ))}
  </div>
);

const PhoneCalendarEmpty = () => (
  <div className="phone">
    <StatusBar />
    <PageHeader title="캘린더" right={<>
      <button className="icon-btn"><window.Icon.search width="18" height="18" /></button>
      <button className="btn btn--primary btn--sm"><window.Icon.plus width="14" height="14"/>추가</button>
    </>}/>
    <div className="calendar">
      <div className="cal-toolbar">
        <button className="icon-btn"><window.Icon.chevronLeft width="18" height="18"/></button>
        <div className="cal-toolbar__title">2026년 4월</div>
        <div style={{display:'flex', gap:6}}>
          <button className="btn btn--secondary btn--sm">오늘</button>
          <button className="icon-btn"><window.Icon.chevronRight width="18" height="18"/></button>
        </div>
      </div>
      <CalendarGrid today="29" />
      <div className="cal-detail">
        <div className="cal-detail__header">
          <div className="cal-detail__date">4월 29일 (수요일)</div>
          <span className="badge badge--neutral">0개</span>
        </div>
        <div className="empty" style={{padding: "24px 8px"}}>
          <div className="empty__icon"><window.Icon.calendar width="22" height="22" /></div>
          <div className="empty__title">예정된 일정이 없습니다</div>
          <button className="btn btn--soft btn--sm" style={{marginTop:4}}>
            <window.Icon.plus width="14" height="14"/>일정 추가하기
          </button>
        </div>
      </div>
    </div>
    <TabBar active="calendar" />
  </div>
);

/* ─── 3. CALENDAR (with events on 27) ─── */
const PhoneCalendarFull = () => (
  <div className="phone">
    <StatusBar />
    <PageHeader title="캘린더" right={<>
      <button className="icon-btn"><window.Icon.search width="18" height="18" /></button>
      <button className="btn btn--primary btn--sm"><window.Icon.plus width="14" height="14"/>추가</button>
    </>}/>
    <div className="calendar">
      <div className="cal-toolbar">
        <button className="icon-btn"><window.Icon.chevronLeft width="18" height="18"/></button>
        <div className="cal-toolbar__title">2026년 4월</div>
        <div style={{display:'flex', gap:6}}>
          <button className="btn btn--secondary btn--sm">오늘</button>
          <button className="icon-btn"><window.Icon.chevronRight width="18" height="18"/></button>
        </div>
      </div>
      <CalendarGrid today="29" selected="27" />
      <div className="cal-detail">
        <div className="cal-detail__header">
          <div className="cal-detail__date">4월 27일 (월요일)</div>
          <span className="badge badge--primary">2개</span>
        </div>
        <div className="event-card">
          <div className="event-card__time event-card__time--am">10:00</div>
          <div className="event-card__main">
            <div className="event-card__title-row">
              <span className="event-card__title">오전 방문</span>
              <span className="badge badge--success">봉사모임</span>
            </div>
            <div className="event-card__meta">📍 카페 · 6명 신청</div>
            <div className="attendees">
              <span className="attendee-chip">사용자2</span>
              <span className="attendee-chip">사용자5</span>
              <span className="attendee-chip">사용자3</span>
              <span className="attendee-chip">사용자4</span>
              <span className="attendee-chip">장웅</span>
              <span className="attendee-chip">사용자1</span>
            </div>
            <div className="event-card__actions">
              <button className="btn btn--soft btn--sm" style={{flex:1}}><window.Icon.plus width="12" height="12"/>참여</button>
              <button className="btn btn--ghost btn--sm">편집</button>
              <button className="icon-btn"><window.Icon.more width="18" height="18"/></button>
            </div>
          </div>
        </div>
        <div className="event-card">
          <div className="event-card__time event-card__time--pm">13:00</div>
          <div className="event-card__main">
            <div className="event-card__title-row">
              <span className="event-card__title">오후 방문</span>
            </div>
            <div className="event-card__meta">📍 오후 · 3명 신청</div>
            <div className="attendees">
              <span className="attendee-chip">사용자2</span>
              <span className="attendee-chip">사용자3</span>
              <span className="attendee-chip">장웅</span>
            </div>
            <div className="event-card__actions">
              <button className="btn btn--soft btn--sm" style={{flex:1}}><window.Icon.plus width="12" height="12"/>참여</button>
              <button className="btn btn--ghost btn--sm">편집</button>
              <button className="icon-btn"><window.Icon.more width="18" height="18"/></button>
            </div>
          </div>
        </div>
      </div>
    </div>
    <TabBar active="calendar" />
  </div>
);

/* ─── 4. ZONE LIST ─── */
const PhoneZone = () => (
  <div className="phone">
    <StatusBar />
    <PageHeader title="구역" right={
      <div className="segment">
        <button className="segment__item is-active">목록</button>
        <button className="segment__item">지도</button>
      </div>
    }/>
    <div className="zone">
      <div className="zone__filterbar">
        <div className="segment segment--full">
          <button className="segment__item is-active">담당 구역</button>
          <button className="segment__item">전체 구역</button>
        </div>
      </div>
      <div className="zone__stat-row">
        <div className="zone__stat"><span className="zone__stat-num zone__stat-num--danger tnum">11</span> 방문필요</div>
        <span className="zone__divider"></span>
        <div className="zone__stat"><span className="zone__stat-num zone__stat-num--info tnum">1</span> 진행중</div>
        <span className="zone__divider"></span>
        <div className="zone__stat"><span className="zone__stat-num zone__stat-num--success tnum">1</span> 완료</div>
      </div>

      <div className="zone-group">
        <div className="zone-group__header">
          <div className="zone-group__title-wrap">
            <span className="zone-group__title">처인구</span>
            <span className="zone-group__count">12개</span>
          </div>
          <window.Icon.chevronDown className="zone-group__chevron" width="18" height="18"/>
        </div>
        <div className="zone-item">
          <div className="zone-item__main">
            <div className="zone-item__title">고림동 1</div>
            <div className="zone-item__meta">건물 1 · 세대 4 · 100%</div>
          </div>
          <div className="zone-item__progress">
            <div className="zone-item__pct">100%</div>
            <div className="progress" style={{width:60}}><div className="progress__bar progress__bar--success" style={{width:'100%'}}/></div>
          </div>
        </div>
        <div className="zone-item">
          <div className="zone-item__main">
            <div className="zone-item__title">고림동 2</div>
            <div className="zone-item__meta">건물 3 · 세대 0</div>
          </div>
          <div className="zone-item__progress">
            <div className="zone-item__pct">25%</div>
            <div className="progress" style={{width:60}}><div className="progress__bar progress__bar--warning" style={{width:'25%'}}/></div>
          </div>
        </div>
        <div className="zone-item">
          <div className="zone-item__main">
            <div className="zone-item__title">고림동 3</div>
            <div className="zone-item__meta">건물 2 · 세대 0</div>
          </div>
          <div className="zone-item__progress">
            <div className="zone-item__pct">0%</div>
            <div className="progress" style={{width:60}}><div className="progress__bar" style={{width:'0%'}}/></div>
          </div>
        </div>
      </div>

      <div className="zone-group">
        <div className="zone-group__header">
          <div className="zone-group__title-wrap">
            <span className="zone-group__title">수지구</span>
            <span className="zone-group__count">1개</span>
          </div>
          <window.Icon.chevronDown className="zone-group__chevron" width="18" height="18"/>
        </div>
        <div className="zone-item">
          <div className="zone-item__main">
            <div className="zone-item__title">고기동 1</div>
            <div className="zone-item__meta">사용자1, 사용자2, 사용자3</div>
          </div>
          <div className="zone-item__progress">
            <div className="zone-item__pct">0%</div>
            <div className="progress" style={{width:60}}><div className="progress__bar" style={{width:'0%'}}/></div>
          </div>
        </div>
      </div>
    </div>
    <TabBar active="zone" />
  </div>
);

/* ─── 5. MAP — empty zone ─── */
const PhoneMapEmpty = () => (
  <div className="phone">
    <StatusBar />
    <PageHeader
      left={<button className="icon-btn icon-btn--filled"><window.Icon.back width="18" height="18"/></button>}
      title="기흥구 구갈동 1"
      sub="건물 0 · 0/0 세대"
      right={<div style={{textAlign:'right'}}>
        <div style={{fontSize:18,fontWeight:700,color:'var(--gray-900)',letterSpacing:'-0.02em'}}>0%</div>
      </div>}
    />
    <div className="map-screen">
      <div className="map-filters">
        <button className="chip is-active">전체</button>
        <button className="chip">중국인</button>
        <button className="chip">부재</button>
        <button className="chip">만남</button>
        <button className="chip">상태 ▾</button>
      </div>
      <div className="map-canvas">
        <div className="map-zone-poly"></div>
        <div className="map-pin" style={{top:'40%',left:'45%'}}/>
        <div className="map-pin map-pin--success" style={{top:'58%',left:'52%'}}/>
        <div className="map-controls">
          <button className="map-control-btn"><window.Icon.layers width="18" height="18"/></button>
          <button className="map-control-btn"><window.Icon.plus width="18" height="18"/></button>
          <button className="map-control-btn"><window.Icon.zoomOut width="18" height="18"/></button>
        </div>
      </div>
      <div className="bottom-sheet" style={{maxHeight:'25%'}}>
        <div className="bottom-sheet__handle"></div>
        <div className="bottom-sheet__head">
          <div>
            <div style={{fontWeight:700,color:'var(--gray-900)'}}>건물 0개</div>
            <div style={{fontSize:12,color:'var(--gray-500)',marginTop:2}}>아직 등록된 건물이 없습니다</div>
          </div>
          <button className="btn btn--primary btn--sm"><window.Icon.plus width="14" height="14"/>건물 추가</button>
        </div>
      </div>
    </div>
    <TabBar active="zone" />
  </div>
);

/* ─── 6. MAP detail with house ─── */
const ChecksHeader = () => (
  <div className="checks-header">
    <div className="checks-header__spacer">세대 정보</div>
    <span>초대장</span>
    <span>만남</span>
    <span>부재</span>
    <span>한국</span>
  </div>
);
const UnitRow = ({ label, meta, checks, memo }) => (
  <div>
    <div className="unit-row">
      <div className="unit-row__label">{label}</div>
      <div className="unit-row__meta">{meta}</div>
      <div className="unit-row__checks">
        {checks.map((c, i) => (
          <div key={i} className={"check-cell" + (c ? " is-checked--" + c : "")}>{c ? "✓" : ""}</div>
        ))}
      </div>
    </div>
    {memo && (
      <div style={{padding:'8px 12px',marginBottom:8,background:'var(--bg-subtle)',borderRadius:'var(--radius-md)',fontSize:'var(--text-sm)',color:'var(--gray-600)'}}>
        💬 {memo}
      </div>
    )}
  </div>
);

const PhoneMapDetail = () => (
  <div className="phone">
    <StatusBar />
    <PageHeader
      left={<button className="icon-btn icon-btn--filled"><window.Icon.back width="18" height="18"/></button>}
      title="처인구 고림동 2"
      sub="건물 1 · 4/4 세대"
      right={<div style={{textAlign:'right'}}>
        <div style={{fontSize:18,fontWeight:700,color:'var(--success-600)',letterSpacing:'-0.02em'}}>100%</div>
      </div>}
    />
    <div className="map-screen">
      <div className="map-filters">
        <button className="chip is-active">전체</button>
        <button className="chip">중국인</button>
        <button className="chip">부재</button>
        <button className="chip">만남</button>
        <button className="chip">상태 ▾</button>
      </div>
      <div className="map-canvas" style={{maxHeight:200}}>
        <div className="map-zone-poly" style={{top:'25%',left:'20%',width:'55%',height:'55%'}}></div>
        <div className="map-pin map-pin--success" style={{top:'45%',left:'48%'}}/>
        <div className="map-controls">
          <button className="map-control-btn"><window.Icon.layers width="18" height="18"/></button>
          <button className="map-control-btn"><window.Icon.zoomIn width="18" height="18"/></button>
          <button className="map-control-btn"><window.Icon.zoomOut width="18" height="18"/></button>
        </div>
      </div>
      <div className="bottom-sheet" style={{maxHeight:'62%'}}>
        <div className="bottom-sheet__handle"></div>
        <div className="bottom-sheet__body">
          <div className="house-row">
            <div className="house-row__title-line">
              <div>
                <div className="house-row__title">감자탕형제들</div>
                <div className="house-row__address">경기도 용인시 처인구 고림동 경안천로 232</div>
              </div>
              <span className="badge badge--success">4/4 100%</span>
            </div>
            <ChecksHeader />
            <UnitRow
              label="1층"
              meta={<><span className="badge badge--neutral" style={{marginRight:4}}>中</span><span style={{color:'var(--gray-500)'}}>재방 · 04/28 오후</span></>}
              checks={["invite","met",null,null]}
              memo="중국인 없음"
            />
            <UnitRow
              label="102"
              meta={<span style={{color:'var(--gray-500)'}}>04/28 오후</span>}
              checks={["invite",null,null,null]}
            />
            <UnitRow
              label="103"
              meta={<span style={{color:'var(--gray-500)'}}>04/28 오후</span>}
              checks={["invite",null,null,null]}
            />
          </div>
        </div>
      </div>
    </div>
    <TabBar active="zone" />
  </div>
);

/* ─── 7. ASSIGNMENT step 1 ─── */
const PhoneAssign1 = () => (
  <div className="phone">
    <StatusBar />
    <PageHeader
      title="관리자 배정"
      sub="인도자에게 담당 구역을 지정합니다"
      right={<span className="badge badge--danger">미배정 592</span>}
    />
    <div className="assign">
      <div className="stepper">
        <div className="stepper__item is-active">
          <span className="stepper__num">1</span>
          <span className="stepper__label">인도자 선택</span>
        </div>
        <div className="stepper__item">
          <span className="stepper__num">2</span>
          <span className="stepper__label">구역 배정</span>
        </div>
      </div>

      <div className="assign-section">
        <div className="assign-section__header">
          <div className="assign-section__title">인도자 선택</div>
          <div className="assign-section__count">5명</div>
        </div>
        <div style={{padding:'12px 16px 0'}}>
          <div className="input-wrap">
            <span className="input-wrap__icon"><window.Icon.search width="16" height="16"/></span>
            <input className="input input--search" placeholder="인도자 검색" />
          </div>
        </div>
        <div style={{padding:'8px 0 4px'}}>
          <div className="guide-row is-selected">
            <div className="avatar avatar--admin">관</div>
            <div className="guide-row__main">
              <div className="guide-row__name">관리자</div>
              <div className="guide-row__sub">아이디 관리자</div>
            </div>
            <div className="guide-row__count">담당 <strong>0</strong></div>
          </div>
          <div className="guide-row">
            <div className="avatar avatar--user-1">사1</div>
            <div className="guide-row__main">
              <div className="guide-row__name">사용자1</div>
              <div className="guide-row__sub">인도자</div>
            </div>
            <div className="guide-row__count">담당 <strong>2</strong></div>
          </div>
          <div className="guide-row">
            <div className="avatar avatar--user-2">사2</div>
            <div className="guide-row__main">
              <div className="guide-row__name">사용자2</div>
              <div className="guide-row__sub">인도자</div>
            </div>
            <div className="guide-row__count">담당 <strong>3</strong></div>
          </div>
          <div className="guide-row">
            <div className="avatar avatar--user-3">사3</div>
            <div className="guide-row__main">
              <div className="guide-row__name">사용자3</div>
              <div className="guide-row__sub">인도자</div>
            </div>
            <div className="guide-row__count">담당 <strong>1</strong></div>
          </div>
          <div className="guide-row">
            <div className="avatar avatar--user-4">장</div>
            <div className="guide-row__main">
              <div className="guide-row__name">장웅</div>
              <div className="guide-row__sub">관리자 · 인도자</div>
            </div>
            <div className="guide-row__count">담당 <strong>13</strong></div>
          </div>
        </div>
      </div>
      <div className="cta-fixed">
        <button className="btn btn--primary btn--xl" style={{width:'100%'}}>
          전체 구역에서 배정하기
          <window.Icon.chevronRight width="16" height="16"/>
        </button>
      </div>
    </div>
    <TabBar active="assign" />
  </div>
);

/* ─── 8. ASSIGNMENT step 2 ─── */
const PhoneAssign2 = () => (
  <div className="phone">
    <StatusBar />
    <PageHeader
      title="관리자 배정"
      sub="인도자에게 담당 구역을 지정합니다"
      right={<span className="badge badge--danger">미배정 592</span>}
    />
    <div className="assign">
      <div className="stepper">
        <div className="stepper__item">
          <span className="stepper__num">✓</span>
          <span className="stepper__label">인도자: 관리자</span>
        </div>
        <div className="stepper__item is-active">
          <span className="stepper__num">2</span>
          <span className="stepper__label">구역 배정</span>
        </div>
      </div>

      <div style={{padding:'12px 16px',background:'var(--bg-card)',borderBottom:'1px solid var(--border-subtle)',display:'flex',gap:8}}>
        <div className="input-wrap" style={{flex:1}}>
          <span className="input-wrap__icon"><window.Icon.search width="16" height="16"/></span>
          <input className="input input--search" placeholder="구역명 또는 동 검색" />
        </div>
        <button className="btn btn--secondary btn--sm">전체 ▾</button>
      </div>

      <div style={{padding:'10px 16px',display:'flex',alignItems:'center',gap:8,background:'var(--bg-card)',borderBottom:'1px solid var(--border-subtle)'}}>
        <input type="checkbox" id="onlyUnassigned" />
        <label htmlFor="onlyUnassigned" style={{fontSize:13,color:'var(--gray-700)'}}>미배정만 보기</label>
        <span style={{flex:1}}/>
        <span style={{fontSize:12,color:'var(--gray-500)'}}>전체 608</span>
      </div>

      <div className="assign-section" style={{margin:'12px 16px'}}>
        {[
          {n:"수지구 고기동 1", who:"사용자1, 사용자2, 사용자3", state:"배정됨"},
          {n:"수지구 고기동 2", who:"장웅, 사용자2", state:"배정됨"},
          {n:"수지구 고기동 3", who:"미배정", state:null},
          {n:"수지구 고기동 4", who:"미배정", state:null},
          {n:"수지구 고기동 5", who:"미배정", state:null},
          {n:"처인구 고림동 1", who:"장웅", state:"배정됨"},
        ].map((z, i) => (
          <div key={i} className="zone-item" style={{padding:'14px 16px'}}>
            <div className="zone-item__main">
              <div className="zone-item__title">{z.n}</div>
              <div className="zone-item__meta">{z.who}</div>
            </div>
            {z.state
              ? <button className="btn btn--ghost btn--sm">해제</button>
              : <button className="btn btn--soft btn--sm">배정</button>}
          </div>
        ))}
      </div>
    </div>
    <TabBar active="assign" />
  </div>
);

/* ─── 9. SETTINGS ─── */
const PhoneSettings = () => (
  <div className="phone">
    <StatusBar />
    <PageHeader title="설정" />
    <div className="settings">
      <div className="settings__body">
        <div className="settings-card">
          <div className="profile-block">
            <div className="avatar avatar--lg avatar--admin">장</div>
            <div className="profile-block__main">
              <div className="profile-block__name">장웅</div>
              <div className="profile-block__role">현재 역할 · 관리자</div>
            </div>
            <button className="icon-btn"><window.Icon.chevronRight width="18" height="18"/></button>
          </div>
        </div>

        <div>
          <div style={{fontSize:12,color:'var(--gray-500)',padding:'0 4px 8px',fontWeight:500}}>화면 보기 전환</div>
          <div className="segment segment--full">
            <button className="segment__item is-active">관리자</button>
            <button className="segment__item">인도자</button>
            <button className="segment__item">봉사자</button>
          </div>
        </div>

        <div className="settings-card">
          <div className="settings-row">
            <div className="settings-row__icon"><window.Icon.megaphone width="18" height="18"/></div>
            <div className="settings-row__main">
              <div className="settings-row__title">공지</div>
              <div className="settings-row__sub">공지 작성과 확인</div>
            </div>
            <window.Icon.chevronRight className="settings-row__chevron" width="18" height="18"/>
          </div>
          <div className="settings-row">
            <div className="settings-row__icon"><window.Icon.users width="18" height="18"/></div>
            <div className="settings-row__main">
              <div className="settings-row__title">사용자</div>
              <div className="settings-row__sub">사용자 현황과 권한 관리</div>
            </div>
            <window.Icon.chevronRight className="settings-row__chevron" width="18" height="18"/>
          </div>
          <div className="settings-row">
            <div className="settings-row__icon" style={{background:'var(--warning-100)',color:'var(--warning-700)'}}>
              <window.Icon.star width="18" height="18"/>
            </div>
            <div className="settings-row__main">
              <div className="settings-row__title">특별 봉사 시즌 관리</div>
              <div className="settings-row__sub">현재 시즌 수정 · 새 시즌 추가</div>
            </div>
            <window.Icon.chevronRight className="settings-row__chevron" width="18" height="18"/>
          </div>
        </div>

        <div className="settings-card">
          <div className="settings-row">
            <div className="settings-row__icon" style={{background:'var(--danger-50)',color:'var(--danger-600)'}}>
              <window.Icon.logout width="18" height="18"/>
            </div>
            <div className="settings-row__main">
              <div className="settings-row__title" style={{color:'var(--danger-600)'}}>로그아웃</div>
            </div>
          </div>
        </div>

        <div className="app-meta">
          중화권 구역 관리 · v1.0.0
        </div>
      </div>
    </div>
    <TabBar active="settings" />
  </div>
);

window.Phones = {
  PhoneHome,
  PhoneCalendarEmpty,
  PhoneCalendarFull,
  PhoneZone,
  PhoneMapEmpty,
  PhoneMapDetail,
  PhoneAssign1,
  PhoneAssign2,
  PhoneSettings,
};
