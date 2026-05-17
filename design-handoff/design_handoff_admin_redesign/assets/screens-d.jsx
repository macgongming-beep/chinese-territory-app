// Screens D: header dropdowns (알림 / 채팅), 채팅방, 사용자 목록 / 편집

// ───────────────────────── 알림 패널 (overlay) ─────────────────────────
const AlertsPanelScreen = () => (
  <div className="phone" style={{ position: 'relative' }}>
    {/* Dimmed underlying screen */}
    <div style={{ position: 'absolute', inset: 0, filter: 'blur(0.4px)', opacity: 0.4 }}>
      <StatusBar/>
      <Header title="홈" sub="2026년 5월 18일 월요일"/>
      <div className="ph-body"></div>
      <TabBar active="home"/>
    </div>
    <div style={{ position: 'absolute', inset: 0, background: 'rgba(26,26,24,0.28)' }}/>

    {/* Panel */}
    <div style={{
      position: 'absolute', top: 8, right: 8, left: 8, zIndex: 2,
      background: 'var(--bg)', borderRadius: 14,
      boxShadow: '0 16px 48px rgba(0,0,0,0.18)',
      border: '1px solid var(--line)',
      maxHeight: 'calc(100% - 16px)',
      display: 'flex', flexDirection: 'column'
    }}>
      {/* Panel header */}
      <div className="row" style={{
        padding: '14px 16px', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid var(--line)'
      }}>
        <div className="row gap-2" style={{ alignItems: 'baseline' }}>
          <span style={{ fontSize: 17, fontWeight: 700, color: 'var(--ink)' }}>알림</span>
          <span className="pill danger tnum" style={{ fontWeight: 700 }}>13</span>
        </div>
        <div className="row gap-2">
          <button className="btn ghost" style={{ height: 28, fontSize: 12, padding: '0 10px' }}>모두 읽음</button>
          <button className="ph-h-btn" style={{ width: 30, height: 30 }}><X s={14}/></button>
        </div>
      </div>

      <div className="col gap-2" style={{ padding: '14px 12px', overflowY: 'auto' }}>
        {/* Group: 새 알림 */}
        <span className="sz-12 semi muted" style={{ padding: '0 4px' }}>새 알림</span>

        {[
          { ico: Chat, kind: 'chat', title: '오전봉사', body: '사용자5님이 합류했습니다.', when: '11분 전', side: '2명', badge: 3, unread: true },
          { ico: Chat, kind: 'chat', title: '봉사', body: '김휘민님이 합류했습니다.', when: '12시간 전', side: '3명', badge: 3, unread: true },
          { ico: Bell, kind: 'event', title: '일정이 변경되었습니다', body: 'd · 2026-05-16 19:00', when: '1일 전', unread: true },
          { ico: Bell, kind: 'card',  title: '비공식 자료가 배정되었습니다', body: '명지대(함박관)', when: '1일 전', unread: true },
          { ico: Bell, kind: 'card',  title: '비공식 자료가 배정되었습니다', body: '경희대(외대정류장)', when: '1일 전', unread: true },
        ].map((n, i) => {
          const Ico = n.ico;
          return (
            <div key={i} className="row gap-3" style={{
              padding: '12px 12px', borderRadius: 10,
              background: n.unread ? 'rgba(26,26,24,0.04)' : 'transparent',
              alignItems: 'flex-start'
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: 8, background: n.kind==='chat'?'var(--ink)':'var(--tint)',
                color: n.kind==='chat'?'white':'var(--text)',
                display: 'grid', placeItems: 'center', flexShrink: 0
              }}>
                <Ico s={15}/>
              </div>
              <div className="col flex-1" style={{ gap: 2, minWidth: 0 }}>
                <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                  <div className="row gap-2" style={{ alignItems: 'baseline', flex: 1, minWidth: 0 }}>
                    {n.unread && <span style={{ width: 6, height: 6, borderRadius: 99, background: 'var(--danger)', flexShrink: 0 }}/>}
                    <span className="sz-14 semi strong trunc">{n.title}</span>
                  </div>
                  {n.side && <span className="sz-12 muted" style={{ flexShrink: 0 }}>{n.side}</span>}
                </div>
                <span className="sz-12 muted trunc">{n.body}</span>
                <span className="sz-12" style={{ color: 'var(--muted-2)' }}>{n.when}</span>
              </div>
              {n.badge && (
                <span style={{
                  background: 'var(--danger)', color: 'white', fontSize: 10, fontWeight: 700,
                  padding: '2px 6px', borderRadius: 99, minWidth: 18, textAlign: 'center',
                  flexShrink: 0, alignSelf: 'center'
                }} className="tnum">{n.badge}</span>
              )}
            </div>
          );
        })}

        {/* Group: 이전 알림 */}
        <span className="sz-12 semi muted" style={{ padding: '8px 4px 0' }}>이전 알림</span>

        {[
          { ico: Chat, kind: 'chat', title: '오전 방문', body: '장웅님이 합류했습니다.', when: '2일 전', side: '2명' },
          { ico: Bell, kind: 'event', title: '일정이 등록되었습니다', body: '봉사 · 2026-05-23 10:00', when: '3일 전' },
        ].map((n, i) => {
          const Ico = n.ico;
          return (
            <div key={i} className="row gap-3" style={{ padding: '12px 12px', alignItems: 'flex-start' }}>
              <div style={{
                width: 32, height: 32, borderRadius: 8, background: n.kind==='chat'?'var(--ink)':'var(--tint)',
                color: n.kind==='chat'?'white':'var(--text)',
                display: 'grid', placeItems: 'center', flexShrink: 0
              }}>
                <Ico s={15}/>
              </div>
              <div className="col flex-1" style={{ gap: 2, minWidth: 0 }}>
                <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                  <span className="sz-14 semi" style={{ color: 'var(--text)' }}>{n.title}</span>
                  {n.side && <span className="sz-12 muted" style={{ flexShrink: 0 }}>{n.side}</span>}
                </div>
                <span className="sz-12 muted trunc">{n.body}</span>
                <span className="sz-12" style={{ color: 'var(--muted-2)' }}>{n.when}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  </div>
);

// ───────────────────────── 채팅 목록 패널 (overlay) ─────────────────────────
const ChatsPanelScreen = () => (
  <div className="phone" style={{ position: 'relative' }}>
    <div style={{ position: 'absolute', inset: 0, filter: 'blur(0.4px)', opacity: 0.4 }}>
      <StatusBar/>
      <Header title="홈" sub="2026년 5월 18일 월요일"/>
      <div className="ph-body"></div>
      <TabBar active="home"/>
    </div>
    <div style={{ position: 'absolute', inset: 0, background: 'rgba(26,26,24,0.28)' }}/>

    <div style={{
      position: 'absolute', top: 8, right: 8, left: 8, zIndex: 2,
      background: 'var(--bg)', borderRadius: 14,
      boxShadow: '0 16px 48px rgba(0,0,0,0.18)',
      border: '1px solid var(--line)',
      maxHeight: 'calc(100% - 16px)',
      display: 'flex', flexDirection: 'column'
    }}>
      <div className="row" style={{
        padding: '14px 16px', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid var(--line)'
      }}>
        <div className="row gap-2" style={{ alignItems: 'baseline' }}>
          <span style={{ fontSize: 17, fontWeight: 700, color: 'var(--ink)' }}>채팅</span>
          <span className="sz-13 muted">일정별 대화방</span>
        </div>
        <button className="ph-h-btn" style={{ width: 30, height: 30 }}><X s={14}/></button>
      </div>

      <div className="col" style={{ padding: '12px 8px', overflowY: 'auto' }}>
        <span className="sz-12 semi muted" style={{ padding: '4px 8px 6px' }}>활성</span>

        {[
          { title: '오전봉사', sub: '5/18 (월) 07:10 · 2명', last: '11분 전', badge: 3, last2: '사용자5: 5분만 늦을게요' },
          { title: '봉사', sub: '5/17 (일) 13:00 · 3명', last: '오후 12:10', badge: 0, last2: '최윤민: 13시 정각 출발합니다' },
        ].map((c, i) => (
          <div key={i} className="row gap-3" style={{
            padding: '12px 10px', borderRadius: 10, alignItems: 'center',
            background: c.badge ? 'rgba(26,26,24,0.04)' : 'transparent'
          }}>
            <span className="avatar" style={{ width: 36, height: 36, fontSize: 13 }}>{c.title[0]}</span>
            <div className="col flex-1" style={{ gap: 1, minWidth: 0 }}>
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span className="sz-14 semi strong trunc">{c.title}</span>
                <span className="sz-12 muted" style={{ flexShrink: 0 }}>{c.last}</span>
              </div>
              <span className="sz-12 muted trunc">{c.sub}</span>
              <span className="sz-13 trunc" style={{ color: 'var(--text)' }}>{c.last2}</span>
            </div>
            {c.badge > 0 && (
              <span style={{
                background: 'var(--danger)', color: 'white', fontSize: 10, fontWeight: 700,
                padding: '2px 6px', borderRadius: 99, minWidth: 18, textAlign: 'center'
              }} className="tnum">{c.badge}</span>
            )}
          </div>
        ))}

        <span className="sz-12 semi muted" style={{ padding: '12px 8px 6px' }}>지난 대화</span>

        {[
          { title: '오전 방문', sub: '5/15 (금) 10:00 · 2명', last: '5/15' },
          { title: '오전 방문', sub: '5/14 (목) 10:00 · 2명', last: '5/14' },
          { title: '오전 방문', sub: '5/11 (월) 10:00 · 2명', last: '5/11' },
          { title: '오전 방문', sub: '4/24 (금) 10:00 · 1명', last: '4/24' },
          { title: '오후 방문', sub: '4/27 (월) 13:00 · 3명', last: '4/27' },
        ].map((c, i) => (
          <div key={i} className="row gap-3" style={{ padding: '10px 10px', alignItems: 'center' }}>
            <span className="avatar muted" style={{ width: 32, height: 32, fontSize: 12 }}>{c.title[0]}</span>
            <div className="col flex-1" style={{ gap: 1, minWidth: 0 }}>
              <span className="sz-14 semi" style={{ color: 'var(--muted)' }} >{c.title}</span>
              <span className="sz-12 muted trunc">{c.sub}</span>
            </div>
            <span className="sz-12 muted tnum" style={{ flexShrink: 0 }}>{c.last}</span>
          </div>
        ))}
      </div>
    </div>
  </div>
);

// ───────────────────────── 채팅방 (전체화면) ─────────────────────────
const ChatRoomScreen = () => (
  <div className="phone" style={{ position: 'relative' }}>
    <StatusBar/>

    {/* Custom header: chat title + close (no tab bar at bottom — full-screen modal) */}
    <div className="ph-header" style={{ alignItems: 'flex-start', paddingTop: 10, paddingBottom: 10, height: 'auto' }}>
      <div className="col" style={{ gap: 2, minWidth: 0 }}>
        <span className="ph-h-title">봉사</span>
        <span className="sz-12 muted">2026-05-17 · 13:00 · 신청 3명</span>
      </div>
      <button className="btn ghost" style={{ height: 34, padding: '0 14px', fontSize: 13 }}>닫기</button>
    </div>

    <div className="ph-body" style={{ paddingBottom: 78, gap: 14, background: 'var(--paper)' }}>
      {/* Day divider */}
      <div className="row" style={{ justifyContent: 'center', alignItems: 'center', gap: 8 }}>
        <span style={{ flex: 1, borderTop: '1px solid var(--line)' }}/>
        <span className="sz-12 muted">5월 17일 일요일</span>
        <span style={{ flex: 1, borderTop: '1px solid var(--line)' }}/>
      </div>

      {/* System messages */}
      {['채팅방이 생성되었습니다', '장웅님이 합류했습니다', '최윤민님이 합류했습니다', '김휘민님이 합류했습니다'].map((s, i) => (
        <div key={i} className="row" style={{ justifyContent: 'center' }}>
          <span style={{
            fontSize: 12, padding: '4px 10px', borderRadius: 99,
            background: 'var(--surface)', color: 'var(--muted)', border: '1px solid var(--line)'
          }}>{s}</span>
        </div>
      ))}

      {/* Message bubbles */}
      <div className="col gap-3">
        {/* Other - 최윤민 */}
        <div className="row gap-2" style={{ alignItems: 'flex-end' }}>
          <span className="avatar" style={{ width: 28, height: 28, fontSize: 11 }}>최</span>
          <div className="col" style={{ gap: 3, maxWidth: '70%' }}>
            <span className="sz-12 semi" style={{ color: 'var(--text)', paddingLeft: 4 }}>최윤민</span>
            <div style={{
              background: 'var(--surface)', padding: '10px 14px', borderRadius: '14px 14px 14px 4px',
              fontSize: 14, lineHeight: 1.5, border: '1px solid var(--line)'
            }}>13시 정각 출발합니다.<br/>정류장에서 만나요.</div>
            <span className="sz-12" style={{ color: 'var(--muted-2)', paddingLeft: 4 }}>12:45</span>
          </div>
        </div>

        {/* Me - 장웅 (right-aligned, dark) */}
        <div className="row gap-2" style={{ alignItems: 'flex-end', justifyContent: 'flex-end' }}>
          <div className="col" style={{ gap: 3, maxWidth: '70%', alignItems: 'flex-end' }}>
            <div style={{
              background: 'var(--ink)', color: 'white', padding: '10px 14px',
              borderRadius: '14px 14px 4px 14px', fontSize: 14, lineHeight: 1.5
            }}>네 알겠습니다 👍</div>
            <span className="sz-12" style={{ color: 'var(--muted-2)' }}>12:46 · 읽음</span>
          </div>
        </div>

        {/* Other - 박지훈 */}
        <div className="row gap-2" style={{ alignItems: 'flex-end' }}>
          <span className="avatar" style={{ width: 28, height: 28, fontSize: 11 }}>박</span>
          <div className="col" style={{ gap: 3, maxWidth: '70%' }}>
            <span className="sz-12 semi" style={{ color: 'var(--text)', paddingLeft: 4 }}>박지훈</span>
            <div style={{
              background: 'var(--surface)', padding: '10px 14px', borderRadius: '14px 14px 14px 4px',
              fontSize: 14, lineHeight: 1.5, border: '1px solid var(--line)'
            }}>늦을 수 있어요 5분만요</div>
            <span className="sz-12" style={{ color: 'var(--muted-2)', paddingLeft: 4 }}>12:55</span>
          </div>
        </div>
      </div>
    </div>

    {/* Composer */}
    <div style={{
      position: 'absolute', left: 0, right: 0, bottom: 0,
      padding: '10px 12px 14px', background: 'var(--bg)',
      borderTop: '1px solid var(--line)'
    }}>
      <div className="row gap-2" style={{ alignItems: 'center' }}>
        <button className="ph-h-btn" style={{ width: 36, height: 36, background: 'var(--tint)', borderRadius: 8 }}>
          <Plus s={16}/>
        </button>
        <div className="input flex-1" style={{ padding: '10px 14px' }}>
          <span>메시지 · @로 멘션</span>
        </div>
        <button className="btn solid" style={{ height: 36, padding: '0 14px', fontSize: 13 }}>전송</button>
      </div>
    </div>
  </div>
);

// ───────────────────────── 사용자 목록 ─────────────────────────
const UsersListScreen = () => (
  <Phone title="사용자" sub="회중 12명 · 관리자 7" hideTabs>
    <div className="ph-header" style={{ display: 'none' }}/>

    {/* Filter + search */}
    <div className="row gap-2">
      <div className="input flex-1">
        <Search/>
        <span>이름 검색</span>
      </div>
      <div className="input" style={{ paddingRight: 10 }}>
        <span style={{ color: 'var(--text)' }}>전체</span>
        <ChevD/>
      </div>
    </div>

    {/* Add user button */}
    <button className="btn ghost full" style={{ borderStyle: 'dashed', color: 'var(--muted)' }}>
      <Plus/> 사용자 추가
    </button>

    {/* User list */}
    <section className="col gap-2">
      <div className="row" style={{ justifyContent: 'space-between', padding: '0 4px' }}>
        <span className="sz-13 semi strong">사용자 목록</span>
        <span className="sz-13 muted tnum">12명</span>
      </div>

      {/* Admins */}
      {[
        { n: '관리자',   ad: '관리자', role: '관리자' },
        { n: '김휘민',   ad: '김휘민', role: '관리자' },
        { n: '박지훈',   ad: '박지훈', role: '관리자' },
        { n: '엄민석',   ad: '엄민석', role: '관리자' },
        { n: '오세창',   ad: '오세창', role: '관리자' },
        { n: '장웅',     ad: '장웅 (나)', role: '관리자', isMe: true },
        { n: '최윤민',   ad: '최윤민', role: '관리자' },
      ].map((u, i) => (
        <div key={i} className="card" style={{ padding: '12px 14px' }}>
          <div className="row gap-3" style={{ alignItems: 'center' }}>
            <span className="avatar" style={{ width: 36, height: 36, fontSize: 14 }}>{u.n[0]}</span>
            <div className="col flex-1" style={{ gap: 1 }}>
              <span className="sz-14 semi strong">{u.n}{u.isMe && <span className="sz-12 muted med"> (나)</span>}</span>
              <span className="card-meta">@{u.ad.split(' ')[0]}</span>
            </div>
            <RoleBadge role={u.role}/>
            <ChevR s={14}/>
          </div>
        </div>
      ))}

      {/* Leaders */}
      {[
        { n: '사용자1', ad: '사용자', role: '인도자' },
        { n: '사용자2', ad: '사용자1', role: '인도자' },
        { n: '사용자3', ad: '사용자2', role: '인도자' },
      ].map((u, i) => (
        <div key={i} className="card" style={{ padding: '12px 14px' }}>
          <div className="row gap-3" style={{ alignItems: 'center' }}>
            <span className="avatar" style={{ width: 36, height: 36, fontSize: 14, background: 'var(--muted)' }}>{u.n[0]}</span>
            <div className="col flex-1" style={{ gap: 1 }}>
              <span className="sz-14 semi strong">{u.n}</span>
              <span className="card-meta">@{u.ad}</span>
            </div>
            <RoleBadge role={u.role}/>
            <ChevR s={14}/>
          </div>
        </div>
      ))}

      {/* Volunteers */}
      {[
        { n: '사용자4', ad: '사용자3', role: '봉사자' },
        { n: '사용자5', ad: '사용자4', role: '봉사자' },
      ].map((u, i) => (
        <div key={i} className="card" style={{ padding: '12px 14px' }}>
          <div className="row gap-3" style={{ alignItems: 'center' }}>
            <span className="avatar" style={{ width: 36, height: 36, fontSize: 14, background: 'var(--muted-2)' }}>{u.n[0]}</span>
            <div className="col flex-1" style={{ gap: 1 }}>
              <span className="sz-14 semi strong">{u.n}</span>
              <span className="card-meta">@{u.ad}</span>
            </div>
            <RoleBadge role={u.role}/>
            <ChevR s={14}/>
          </div>
        </div>
      ))}
    </section>
  </Phone>
);

// Role-coded pill — replaces colored pills in original (used a different color per role).
// In Tone B, roles use neutral pill with one accent character (●) in role color.
const RoleBadge = ({ role }) => (
  <span className="pill" style={{
    background: 'var(--tint)', color: 'var(--text)',
    padding: '3px 9px 3px 6px',
    display: 'inline-flex', alignItems: 'center', gap: 5
  }}>
    <span style={{
      width: 5, height: 5, borderRadius: 99,
      background: role === '관리자' ? 'var(--ink)' : role === '인도자' ? 'var(--muted)' : 'var(--muted-2)'
    }}/>
    {role}
  </span>
);

// ───────────────────────── 사용자 편집 ─────────────────────────
const UserEditScreen = () => (
  <div className="phone" style={{ position: 'relative' }}>
    <StatusBar/>
    <div className="ph-header">
      <div className="row gap-2" style={{ alignItems: 'center' }}>
        <button className="ph-h-btn" style={{ marginLeft: -8 }}><ChevL s={18}/></button>
        <div className="ph-h-titles">
          <span className="ph-h-title">사용자 편집</span>
          <span className="ph-h-sub">관리자 · 마지막 로그인 5/17</span>
        </div>
      </div>
      <div className="ph-h-actions">
        <button className="ph-h-btn"><Dots/></button>
      </div>
    </div>

    <div className="ph-body" style={{ gap: 20 }}>
      {/* Profile */}
      <div className="card" style={{ padding: '14px 16px' }}>
        <div className="row gap-3" style={{ alignItems: 'center' }}>
          <span className="avatar lg">관</span>
          <div className="col flex-1" style={{ gap: 2 }}>
            <span style={{ fontSize: 17, fontWeight: 700, color: 'var(--ink)' }}>관리자</span>
            <span className="sz-12 muted">@관리자</span>
          </div>
          <RoleBadge role="관리자"/>
        </div>
      </div>

      {/* 계정 관리 */}
      <section className="col" style={{ gap: 10 }}>
        <div className="sec-head"><h2>계정 관리</h2></div>
        <div className="col gap-3">
          <div className="col" style={{ gap: 6 }}>
            <label className="sz-12 semi">아이디</label>
            <div className="input" style={{ color: 'var(--text)' }}>관리자</div>
          </div>
          <div className="col" style={{ gap: 6 }}>
            <label className="sz-12 semi">닉네임</label>
            <div className="input" style={{ color: 'var(--text)' }}>관리자</div>
          </div>
          <button className="btn solid full">저장</button>
        </div>
      </section>

      {/* 권한 변경 */}
      <section className="col" style={{ gap: 10 }}>
        <div className="sec-head"><h2>사용자 권한</h2></div>
        <div className="segmented col-3">
          <div className="seg active">관리자</div>
          <div className="seg">인도자</div>
          <div className="seg">봉사자</div>
        </div>
        <span className="sz-12 muted" style={{ padding: '0 4px' }}>
          관리자는 인도자와 봉사자 권한을 포함합니다.
        </span>
      </section>

      {/* 비밀번호 초기화 */}
      <section className="col" style={{ gap: 10 }}>
        <div className="sec-head"><h2>비밀번호</h2></div>
        <button className="btn ghost full">0000으로 초기화</button>
      </section>

      {/* Remove */}
      <section className="col" style={{ gap: 10 }}>
        <div className="card" style={{ padding: '14px 16px', borderColor: 'var(--line)' }}>
          <div className="row gap-3" style={{ alignItems: 'center' }}>
            <div className="col flex-1" style={{ gap: 2 }}>
              <span className="sz-14 semi" style={{ color: 'var(--danger)' }}>사용자 제거</span>
              <span className="sz-12 muted">로그인 계정만 삭제, 방문 기록은 보존됩니다.</span>
            </div>
            <button className="btn" style={{
              background: 'var(--danger)', color: 'white', height: 34, padding: '0 14px', fontSize: 13
            }}>제거</button>
          </div>
        </div>
      </section>
    </div>
  </div>
);

Object.assign(window, { AlertsPanelScreen, ChatsPanelScreen, ChatRoomScreen, UsersListScreen, UserEditScreen });
