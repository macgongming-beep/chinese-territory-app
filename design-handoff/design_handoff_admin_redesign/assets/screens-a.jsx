// Screens A: Home, Calendar, Calendar Add

// ───────────────────────── HOME ─────────────────────────
const HomeScreen = () =>
<Phone active="home" title="홈" sub="2026년 5월 17일 일요일">
    {/* 공지 */}
    <section>
      <div className="sec-head">
        <h2>공지</h2>
        <span className="all">전체보기 <ChevR /></span>
      </div>
      <div className="card" style={{ marginTop: 10, padding: 14 }}>
        <div className="row gap-3" style={{ justifyContent: 'space-between' }}>
          <div className="row gap-2 flex-1 trunc">
            <span className="pill" style={{ background: 'var(--tint)', color: 'var(--muted)', fontSize: 10.5, padding: '2px 7px', fontWeight: 600, letterSpacing: '0.04em' }}>공지</span>
            <span className="sz-14 trunc">5월 봉사 일정 변경 안내</span>
          </div>
          <span className="sz-12 muted tnum">4/30 읽음</span>
        </div>
      </div>
    </section>

    {/* 오늘의 봉사 */}
    <section>
      <div className="sec-head">
        <h2>오늘의 봉사 <span className="cnt">1</span></h2>
        <span className="all">전체보기 <ChevR /></span>
      </div>
      <div className="card" style={{ marginTop: 10, padding: 14 }}>
        <div className="row gap-3">
          <div style={{
          width: 54, height: 54, borderRadius: 10, background: 'var(--ink)',
          color: 'white', display: 'grid', placeItems: 'center', flexShrink: 0
        }}>
            <div className="col" style={{ alignItems: 'center', gap: 0, lineHeight: 1 }}>
              <span style={{ fontSize: 18, fontWeight: 700 }}>13</span>
              <span style={{ fontSize: 10, opacity: 0.7, marginTop: 2 }}>오후</span>
            </div>
          </div>
          <div className="col flex-1" style={{ gap: 2 }}>
            <span className="card-title">봉사</span>
            <span className="sz-12 muted row gap-2">
              <Pin /> 왕국회관 <span style={{ color: 'var(--muted-2)' }}>·</span> <User /> 최윤민
            </span>
            <span className="sz-12 muted">주택 리스트, 용인시장 전시대</span>
          </div>
          <ChevR />
        </div>
      </div>
    </section>

    {/* 운영 현황 */}
    <section>
      <div className="sec-head">
        <h2>운영 현황</h2>
        <span className="all">전체보기 <ChevR /></span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10 }}>
        {[
      { n: '608', sub: '전체 카드' },
      { n: '122', sub: '진행중' },
      { n: '486', sub: '미배정', danger: true },
      { n: '2.4', unit: '%', sub: '완료 세대 23 / 945' }].
      map((s, i) =>
      <div key={i} className="card" style={{ padding: '14px 14px' }}>
            <div style={{ fontSize: 26, fontWeight: 700, color: s.danger ? 'var(--danger)' : 'var(--ink)', letterSpacing: '-0.02em' }} className="tnum">
              {s.n}{s.unit && <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--muted)' }}>{s.unit}</span>}
            </div>
            <div className="sz-12 muted med" style={{ marginTop: 2 }}>{s.sub}</div>
          </div>
      )}
      </div>
    </section>
  </Phone>;


// ───────────────────────── CALENDAR ─────────────────────────
const CalDay = ({ n, dot, today, sun, sat, empty }) =>
<div className={`day ${today ? 'today' : ''} ${sun ? 'sun' : ''} ${sat ? 'sat' : ''} ${empty ? 'empty' : ''}`}>
    {!empty && <>
      <span>{n}</span>
      {dot && <span className="dot" style={dot === 'soft' ? { background: 'var(--muted-2)' } : undefined} />}
    </>}
  </div>;


const monthGrid = () => {
  const days = [];
  // May 2026: starts Fri (offset 5). 31 days.
  for (let i = 0; i < 5; i++) days.push({ empty: true });
  // Add days 1-31 with weekday calc
  for (let n = 1; n <= 31; n++) {
    const dow = (5 + n - 1) % 7; // 5 = Friday
    days.push({
      n, sun: dow === 0, sat: dow === 6,
      today: n === 17,
      dot: [8, 11, 14, 15, 16, 17].includes(n)
    });
  }
  return days;
};

const CalendarScreen = () =>
<Phone active="cal" title="캘린더" sub="2026년 5월 · 일정 4개">
    {/* Month */}
    <section className="card" style={{ padding: '14px 14px 8px' }}>
      <div className="cal-month">
        <div className="cal-month-nav">
          <span className="cal-nav-btn"><ChevL /></span>
          <h3>2026년 5월</h3>
          <span className="cal-nav-btn"><ChevR /></span>
        </div>
        <span className="cal-today">오늘</span>
      </div>
      <div className="cal-grid">
        {['일', '월', '화', '수', '목', '금', '토'].map((d, i) =>
      <div key={d} className={`dow ${i === 0 ? 'sun' : ''}`}>{d}</div>
      )}
        {monthGrid().map((d, i) => <CalDay key={i} {...d} />)}
      </div>
    </section>

    {/* 5월 17일 */}
    <section>
      <div className="sec-head">
        <h2>5월 17일 (일요일) <span className="cnt">1</span></h2>
        <button className="btn ghost" style={{ height: 30, fontSize: 12, padding: '0 10px' }}>
          <Plus /> 일정 추가
        </button>
      </div>

      {/* Compact event card */}
      <div className="card" style={{ marginTop: 10, padding: 14 }}>
        <div className="row gap-3" style={{ alignItems: 'center' }}>
          <div className="col" style={{ minWidth: 48, flexShrink: 0 }}>
            <span className="sz-13 semi strong tnum">13:00</span>
            <span className="sz-12 muted">15:00</span>
          </div>
          <div className="col flex-1" style={{ gap: 2 }}>
            <div className="row gap-2" style={{ alignItems: 'center' }}>
              <span className="card-title">봉사</span>
              <span className="pill" style={{ fontSize: 10.5, padding: '2px 7px' }}>봉사모임</span>
            </div>
            <span className="sz-12 muted">왕국회관 · 최윤민 · 신청 3명</span>
          </div>
          <ChevR />
        </div>
      </div>
    </section>

    {/* 다음 일정들 (3개 미리보기) */}
    <section>
      <div className="sec-head">
        <h2>다가오는 일정 <span className="cnt">3</span></h2>
      </div>
      <div className="col gap-2" style={{ marginTop: 10 }}>
        {[
      { d: '5/19', dow: '화', t: '13:00', title: '봉사', loc: '왕국회관' },
      { d: '5/22', dow: '금', t: '19:30', title: '장로 모임', loc: '온라인' },
      { d: '5/23', dow: '토', t: '10:00', title: '특별 봉사', loc: '수지구청 앞' }].
      map((e, i) =>
      <div key={i} className="card" style={{ padding: '12px 14px' }}>
            <div className="row gap-3" style={{ alignItems: 'center' }}>
              <div className="col" style={{ width: 42, flexShrink: 0 }}>
                <span className="sz-13 semi strong tnum">{e.d}</span>
                <span className="sz-12 muted">{e.dow}</span>
              </div>
              <div className="col flex-1" style={{ gap: 1 }}>
                <span className="sz-14 semi strong">{e.title}</span>
                <span className="sz-12 muted">{e.t} · {e.loc}</span>
              </div>
              <ChevR />
            </div>
          </div>
      )}
      </div>
    </section>
  </Phone>;


// ───────────────────────── CALENDAR ADD (sheet) ─────────────────────────
const CalendarAddScreen = () =>
<div className="phone" style={{ position: 'relative' }}>
    {/* dimmed bg = compressed calendar */}
    <div style={{ position: 'absolute', inset: 0, background: 'var(--bg)', opacity: 0.7, zIndex: 0, pointerEvents: 'none' }} />
    <div style={{
    position: 'absolute', inset: 0, filter: 'blur(0.6px)', opacity: 0.55, zIndex: 0
  }}>
      <StatusBar />
      <Header title="캘린더" sub="2026년 5월 · 일정 4개" />
      <div className="ph-body">
        <div className="card" style={{ padding: 14, marginTop: 0 }}>
          <div className="cal-month">
            <div className="cal-month-nav">
              <span className="cal-nav-btn"><ChevL /></span>
              <h3>2026년 5월</h3>
              <span className="cal-nav-btn"><ChevR /></span>
            </div>
            <span className="cal-today">오늘</span>
          </div>
          <div className="cal-grid">
            {['일', '월', '화', '수', '목', '금', '토'].map((d, i) =>
          <div key={d} className={`dow ${i === 0 ? 'sun' : ''}`}>{d}</div>
          )}
            {monthGrid().slice(0, 21).map((d, i) => <CalDay key={i} {...d} />)}
          </div>
        </div>
      </div>
    </div>
    <div style={{ position: 'absolute', inset: 0, background: 'rgba(26,26,24,0.34)', zIndex: 1 }} />

    {/* Bottom sheet */}
    <div style={{
    position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 2,
    background: 'var(--bg)',
    borderTopLeftRadius: 18, borderTopRightRadius: 18,
    padding: '8px 16px 18px',
    boxShadow: '0 -12px 40px rgba(0,0,0,0.18)',
    maxHeight: '88%',
    display: 'flex', flexDirection: 'column'
  }}>
      <div style={{ width: 32, height: 4, borderRadius: 99, background: 'var(--line-2)', margin: '4px auto 14px' }} />
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div className="col" style={{ gap: 1 }}>
          <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink)' }}>새 일정 추가</span>
          <span className="sz-12 muted">5월 17일 (일요일)</span>
        </div>
        <button className="ph-h-btn"><X /></button>
      </div>

      <div className="col gap-3" style={{ overflowY: 'auto', flex: 1, paddingRight: 2, marginRight: -2 }}>
        <div className="col" style={{ gap: 6 }}>
          <label className="sz-12 semi" style={{ color: 'var(--text)' }}>일정 제목 <span style={{ color: 'var(--danger)' }}>*</span></label>
          <div className="input" style={{ padding: '12px 14px' }}>봉사</div>
        </div>

        <div className="col" style={{ gap: 6 }}>
          <label className="sz-12 semi">상세 설명 <span className="muted med">(선택)</span></label>
          <div className="input" style={{ padding: '12px 14px', minHeight: 64, alignItems: 'flex-start', color: 'var(--muted-2)' }}>
            주택 리스트, 용인시장 전시대 (가까운 곳부터)
          </div>
        </div>

        <div className="row gap-2">
          <div className="col flex-1" style={{ gap: 6 }}>
            <label className="sz-12 semi">날짜</label>
            <div className="input">2026.05.17</div>
          </div>
          <div className="col flex-1" style={{ gap: 6 }}>
            <label className="sz-12 semi">시간</label>
            <div className="input">13:00 — 15:00</div>
          </div>
        </div>

        <div className="col" style={{ gap: 6 }}>
          <label className="sz-12 semi">모임 장소</label>
          <div className="input"><Pin />왕국회관</div>
          <div className="input" style={{ paddingLeft: 14 }}>
            <LinkIco s={14} />
            <span style={{ color: 'var(--muted-2)' }}>네이버 지도 링크 (선택) — 붙여넣기</span>
          </div>
        </div>

        <div className="col" style={{ gap: 6 }}>
          <label className="sz-12 semi">인도자</label>
          <div className="input" style={{ justifyContent: 'space-between', color: 'var(--text)' }}>
            <span className="row gap-2"><span className="avatar" style={{ width: 22, height: 22, fontSize: 10 }}>장</span> 장웅 <span className="muted sz-12">(나)</span></span>
            <ChevD />
          </div>
        </div>

        <label className="row gap-2 sz-14" style={{ padding: '8px 0', color: 'var(--text)' }}>
          <span style={{
          width: 18, height: 18, borderRadius: 5, background: 'var(--ink)',
          display: 'grid', placeItems: 'center', color: 'white', flexShrink: 0
        }}><Check s={12} /></span>
          이 일정에 봉사 신청을 받습니다
        </label>
      </div>

      <button className="btn solid lg full" style={{ marginTop: 14 }}>저장</button>
    </div>
  </div>;


// ───────────────────────── EVENT DETAIL ─────────────────────────
const EventDetailScreen = () =>
<div className="phone" style={{ position: 'relative' }}>
    <StatusBar />
    {/* Custom header w/ back instead of brand title */}
    <div className="ph-header">
      <div className="row gap-2" style={{ alignItems: 'center' }}>
        <button className="ph-h-btn" style={{ marginLeft: -8 }}><ChevL s={18} /></button>
        <div className="ph-h-titles">
          <span className="ph-h-title">일정</span>
          <span className="ph-h-sub">5월 17일 (일요일)</span>
        </div>
      </div>
      <div className="ph-h-actions">
        <button className="ph-h-btn"><Dots /></button>
      </div>
    </div>

    <div className="ph-body" style={{ paddingBottom: 84, gap: 18 }}>
      {/* Hero block: time / title / chip / leader */}
      <section className="col" style={{ gap: 10 }}>
        <div className="row gap-2" style={{ alignItems: 'baseline' }}>
          <span style={{ fontSize: 22, fontWeight: 700, color: 'var(--ink)' }} className="tnum">13:00 — 15:00</span>
          <span className="pill">봉사 모임</span>
        </div>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.02em' }}>
          봉사
        </h1>
        <div className="row gap-3" style={{ alignItems: 'center', marginTop: 4 }}>
          <div className="row gap-2" style={{ alignItems: 'center' }}>
            <span className="avatar" style={{ width: 24, height: 24, fontSize: 11 }}>최</span>
            <span className="sz-13 semi strong">최윤민</span>
            <span className="sz-12 muted">인도자</span>
          </div>
        </div>
      </section>

      {/* Primary action — full width per feedback */}
      <button className="btn solid lg full">신청하기</button>

      {/* 상세 설명 */}
      <section className="col" style={{ gap: 8 }}>
        <div className="sec-head"><h2>상세 설명</h2></div>
        <div className="sz-14" style={{ color: 'var(--text)', lineHeight: 1.6 }}>
          주택 리스트 · 용인시장 전시대 — 가까운 곳부터 시작합니다.
        </div>
      </section>

      {/* 위치 */}
      <section className="col" style={{ gap: 8 }}>
        <div className="sec-head"><h2>위치</h2></div>
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="map-thumb" style={{ aspectRatio: '16/9', borderRadius: 0, border: 0 }} />
          <div className="row gap-3" style={{ padding: '12px 14px', alignItems: 'center' }}>
            <Pin />
            <div className="col flex-1">
              <span className="sz-14 semi strong">왕국회관</span>
              <span className="sz-12 muted">경기도 용인시 처인구 …</span>
            </div>
            <button className="btn ghost" style={{ height: 30, fontSize: 12, padding: '0 10px', gap: 4 }}>
              <LinkIco s={12} /> 네이버
            </button>
          </div>
        </div>
      </section>

      {/* 신청자 — horizontal scroll chip strip; supports 20-30+ */}
      <section className="col" style={{ gap: 8 }}>
        <div className="sec-head">
          <h2>신청자 <span className="cnt">24</span></h2>
          <span className="all">전체보기 <ChevR /></span>
        </div>
        <div className="row" style={{
          gap: 8, overflowX: 'auto', paddingBottom: 4,
          marginLeft: -16, marginRight: -16, paddingLeft: 16, paddingRight: 16,
          scrollSnapType: 'x mandatory'
        }}>
          {[
            { n: '장웅', i: '장' }, { n: '김휘민', i: '김' }, { n: '박지훈', i: '박' },
            { n: '엄민석', i: '엄' }, { n: '오세창', i: '오' }, { n: '최윤민', i: '최' },
            { n: '+18', i: '', more: true }
          ].map((p, i) => (
            <div key={i} className="row gap-2" style={{
              padding: '5px 12px 5px 5px', background: 'var(--surface)',
              border: '1px solid var(--line)', borderRadius: 99,
              alignItems: 'center', flexShrink: 0, scrollSnapAlign: 'start',
              ...(p.more && { padding: '5px 14px', color: 'var(--muted)' })
            }}>
              {!p.more && <span className="avatar" style={{ width: 22, height: 22, fontSize: 10 }}>{p.i}</span>}
              <span className="sz-13 semi">{p.n}</span>
            </div>
          ))}
          <button className="row gap-2" style={{
            padding: '5px 12px', background: 'transparent', border: '1px dashed var(--line-2)',
            borderRadius: 99, alignItems: 'center', flexShrink: 0, color: 'var(--muted)',
            fontFamily: 'inherit', fontSize: 13, fontWeight: 500, cursor: 'default'
          }}>
            <Plus s={12} /> 추가
          </button>
        </div>
      </section>

      {/* 댓글 — persistent thread (채팅은 헤더 💬 버튼으로 별도 진입) */}
      <section className="col" style={{ gap: 10 }}>
        <div className="sec-head">
          <h2>댓글 <span className="cnt">2</span></h2>
          <button className="row gap-2 sz-13 semi" style={{
            color: 'var(--muted)', background: 'transparent', border: 0,
            fontFamily: 'inherit', cursor: 'default', padding: 0
          }}>
            <Chat s={14} /> 채팅 열기
          </button>
        </div>
        <div className="col gap-3">
          {[
        { who: '박지훈', i: '박', when: '어제 22:30', body: '늦을 수 있어요 5분만요' },
        { who: '최윤민', i: '최', when: '오늘 12:45', body: '13시 정각 출발합니다. 정류장에서 만나요.' }].
        map((m, idx) =>
        <div key={idx} className="row gap-3" style={{ alignItems: 'flex-start' }}>
              <span className="avatar" style={{ width: 28, height: 28, fontSize: 12 }}>{m.i}</span>
              <div className="col flex-1" style={{ gap: 2 }}>
                <div className="row gap-2" style={{ alignItems: 'baseline' }}>
                  <span className="sz-13 semi strong">{m.who}</span>
                  <span className="sz-12 muted">{m.when}</span>
                </div>
                <div className="sz-14" style={{ color: 'var(--text)', lineHeight: 1.5 }}>{m.body}</div>
              </div>
            </div>
        )}
        </div>
      </section>
    </div>

    {/* Sticky comment composer */}
    <div style={{
    position: 'absolute', left: 0, right: 0, bottom: 0,
    padding: '10px 12px 14px', background: 'var(--bg)',
    borderTop: '1px solid var(--line)'
  }}>
      <div className="row gap-2" style={{ alignItems: 'center' }}>
        <span className="avatar" style={{ width: 28, height: 28, fontSize: 12 }}>장</span>
        <div className="input flex-1" style={{ padding: '10px 14px' }}>
          <span>댓글 입력 · @로 멘션</span>
        </div>
      </div>
    </div>
  </div>;


Object.assign(window, { HomeScreen, CalendarScreen, CalendarAddScreen, EventDetailScreen });