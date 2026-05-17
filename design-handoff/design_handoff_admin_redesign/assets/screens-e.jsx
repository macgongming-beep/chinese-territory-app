// Screens E: Settings sub-pages — 내정보 / 알림설정 / 가입신청 / 특별봉사 / 공지

// Shared sub-header (back chevron + title + sub)
const SubHeader = ({ title, sub, actions }) => (
  <div className="ph-header">
    <div className="row gap-2" style={{ alignItems: 'center', minWidth: 0 }}>
      <button className="ph-h-btn" style={{ marginLeft: -8, flexShrink: 0 }}><ChevL s={18} /></button>
      <div className="ph-h-titles">
        <span className="ph-h-title">{title}</span>
        {sub && <span className="ph-h-sub trunc">{sub}</span>}
      </div>
    </div>
    <div className="ph-h-actions">
      {actions || <button className="ph-h-btn"><Dots /></button>}
    </div>
  </div>
);

const SubPhone = ({ title, sub, children, hideTabs = true, active }) => (
  <div className="phone">
    <StatusBar />
    <SubHeader title={title} sub={sub} />
    <div className="ph-body">{children}</div>
    {!hideTabs && <TabBar active={active} />}
  </div>
);

// ───────────────────────── 내 정보 ─────────────────────────
const MyInfoScreen = () => (
  <SubPhone title="내 정보" sub="관리자 계정">
    {/* Profile card */}
    <div className="card" style={{ padding: '16px' }}>
      <div className="row gap-3" style={{ alignItems: 'center' }}>
        <span className="avatar lg">장</span>
        <div className="col flex-1" style={{ gap: 2 }}>
          <span style={{ fontSize: 17, fontWeight: 700, color: 'var(--ink)' }}>장웅</span>
          <span className="sz-12 muted">@장웅</span>
        </div>
        <RoleBadge role="관리자" />
      </div>
    </div>

    {/* 개인 정보 */}
    <section className="col" style={{ gap: 10 }}>
      <div className="sec-head"><h2>개인 정보</h2></div>
      <div className="col gap-3">
        <div className="col" style={{ gap: 6 }}>
          <label className="sz-12 semi">닉네임</label>
          <div className="input" style={{ color: 'var(--text)' }}>장웅</div>
        </div>
        <div className="col" style={{ gap: 6 }}>
          <label className="sz-12 semi">핸드폰 번호</label>
          <div className="input" style={{ color: 'var(--text)' }}>010-8681-8107</div>
        </div>
        <button className="btn solid full">저장</button>
      </div>
    </section>

    {/* 비밀번호 */}
    <section className="col" style={{ gap: 10 }}>
      <div className="sec-head"><h2>비밀번호</h2></div>
      <div className="col gap-3">
        <div className="col" style={{ gap: 6 }}>
          <label className="sz-12 semi">새 비밀번호</label>
          <div className="input" style={{ color: 'var(--muted-2)' }}>새 비밀번호를 입력하세요</div>
        </div>
        <div className="col" style={{ gap: 6 }}>
          <label className="sz-12 semi">새 비밀번호 확인</label>
          <div className="input" style={{ color: 'var(--muted-2)' }}>다시 입력하세요</div>
        </div>
        <button className="btn ghost full">비밀번호 변경</button>
      </div>
    </section>

    {/* 위험 */}
    <section className="col" style={{ gap: 10, marginTop: 8 }}>
      <button className="row sz-13 semi" style={{
        gap: 8, padding: '12px 4px', alignItems: 'center', justifyContent: 'flex-start',
        color: 'var(--danger)', background: 'transparent', border: 0, fontFamily: 'inherit'
      }}>
        <Logout s={14} /> 로그아웃
      </button>
    </section>
  </SubPhone>
);

// ───────────────────────── 알림 설정 ─────────────────────────
const NotifRow = ({ Ico, title, sub, on, kind = 'group' }) => (
  <div className="row gap-3" style={{ padding: '14px 4px', alignItems: 'center' }}>
    <span style={{
      width: 6, height: 6, borderRadius: 99,
      background: on ? 'var(--ink)' : 'var(--line-2)', flexShrink: 0
    }} />
    <div className="col flex-1" style={{ gap: 1, minWidth: 0 }}>
      <span className="sz-14 semi strong">{title}</span>
      {sub && <span className="sz-12 muted">{sub}</span>}
    </div>
    {kind === 'group' && <ChevR s={14} />}
    <div className={`toggle ${on ? 'on' : ''}`} />
  </div>
);

const NotifSettingsScreen = () => (
  <SubPhone title="알림 설정" sub="받을 알림과 조용한 시간">
    {/* 받을 알림 종류 */}
    <section className="col" style={{ gap: 4 }}>
      <div className="sec-head"><h2>받을 알림</h2></div>
      <div className="card" style={{ padding: '4px 14px' }}>
        <NotifRow Ico={Bell} title="봉사 활동" sub="일정 변경 · 카드 배정 · 봉사 시작/종료" on={true} />
        <div className="divider" style={{ margin: 0 }} />
        <NotifRow Ico={Chat} title="소통" sub="채팅 · 멘션 · 댓글" on={true} />
        <div className="divider" style={{ margin: 0 }} />
        <NotifRow Ico={Megaphone} title="공지" sub="관리자가 새 공지를 올릴 때" on={true} />
      </div>
      <div className="sz-12 muted" style={{ padding: '6px 6px 0', lineHeight: 1.55 }}>
        새 일정 등록 알림은 기본으로 보내지 않습니다. 그룹을 펼치면 세부 알림을 따로 조정할 수 있어요.
      </div>
    </section>

    {/* 방해금지 */}
    <section className="col" style={{ gap: 4 }}>
      <div className="sec-head"><h2>방해금지 시간</h2></div>
      <div className="card" style={{ padding: '4px 14px' }}>
        <div className="row gap-3" style={{ padding: '14px 4px', alignItems: 'center' }}>
          <Moon s={16} />
          <div className="col flex-1" style={{ gap: 1, minWidth: 0 }}>
            <span className="sz-14 semi strong">방해금지 시간 사용</span>
            <span className="sz-12 muted">설정한 시간에는 알림이 와도 무음 (배지로만 표시)</span>
          </div>
          <div className={`toggle`} />
        </div>
      </div>
    </section>

    {/* 미리보기 */}
    <section className="col" style={{ gap: 4 }}>
      <div className="sec-head"><h2>알림 미리보기</h2></div>
      <div className="card" style={{ padding: '4px 14px' }}>
        <div className="row gap-3" style={{ padding: '14px 4px', alignItems: 'center' }}>
          <div className="col flex-1" style={{ gap: 1, minWidth: 0 }}>
            <span className="sz-14 semi strong">잠금화면에 미리보기</span>
            <span className="sz-12 muted">알림 내용을 잠금화면에 노출</span>
          </div>
          <div className={`toggle on`} />
        </div>
      </div>
    </section>
  </SubPhone>
);

// ───────────────────────── 가입 신청 ─────────────────────────
const JoinRequestsScreen = () => (
  <SubPhone title="가입 신청" sub="대기 0 · 승인 12 · 차단 0">
    {/* Tabs */}
    <div className="segmented col-3">
      <div className="seg">
        <div>승인대기</div>
        <div className="sz-12 muted tnum" style={{ marginTop: 2 }}>0</div>
      </div>
      <div className="seg active">
        <div>승인됨</div>
        <div className="sz-12 muted tnum" style={{ marginTop: 2 }}>12</div>
      </div>
      <div className="seg">
        <div>차단됨</div>
        <div className="sz-12 muted tnum" style={{ marginTop: 2 }}>0</div>
      </div>
    </div>

    {/* List */}
    <div className="col gap-2">
      {[
        { n: '최윤민', ad: '최윤민', when: '2026.04.30', role: '관리자' },
        { n: '오세창', ad: '오세창', when: '2026.04.30', last: '2026.05.17', role: '관리자' },
        { n: '엄민석', ad: '엄민석', when: '2026.04.30', role: '관리자' },
        { n: '박지훈', ad: '박지훈', when: '2026.04.30', last: '2026.05.17', role: '관리자' },
        { n: '김휘민', ad: '김휘민', when: '2026.04.30', last: '2026.05.17', role: '관리자' },
        { n: '사용자3', ad: '사용자2', when: '2026.04.24', role: '인도자' },
        { n: '사용자4', ad: '사용자3', when: '2026.04.24', role: '봉사자' },
      ].map((u, i) => (
        <div key={i} className="card" style={{ padding: '14px 16px' }}>
          <div className="row gap-3" style={{ alignItems: 'flex-start' }}>
            <span className="avatar" style={{
              width: 36, height: 36, fontSize: 14,
              background: u.role === '관리자' ? 'var(--ink)' : u.role === '인도자' ? 'var(--muted)' : 'var(--muted-2)'
            }}>{u.n[0]}</span>
            <div className="col flex-1" style={{ gap: 2, minWidth: 0 }}>
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span className="sz-15 semi strong">{u.n}</span>
                <RoleBadge role={u.role}/>
              </div>
              <span className="sz-12 muted">@{u.ad}</span>
              <span className="sz-12 muted">
                신청 {u.when}{u.last && <> · 마지막 로그인 {u.last}</>}
              </span>
              <div className="row gap-2" style={{ marginTop: 8 }}>
                <button className="btn ghost" style={{ height: 28, fontSize: 12, padding: '0 10px' }}>대기로</button>
                <button className="btn ghost" style={{
                  height: 28, fontSize: 12, padding: '0 10px',
                  color: 'var(--danger)', borderColor: 'var(--danger-bg)'
                }}>차단</button>
                <span style={{ flex: 1 }}/>
                <button className="btn ghost" style={{
                  height: 28, fontSize: 12, padding: '0 10px', color: 'var(--muted)'
                }}>삭제</button>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  </SubPhone>
);

// ───────────────────────── 특별봉사 시즌 ─────────────────────────
const SpecialSeasonScreen = () => (
  <SubPhone title="특별봉사 시즌" sub="진행 중 0 · 지난 시즌 1">
    {/* 진행 중 / 지난 시즌 */}
    <section className="col" style={{ gap: 10 }}>
      <div className="sec-head">
        <h2>지난 시즌</h2>
      </div>
      <div className="card" style={{ padding: '14px 16px' }}>
        <div className="row gap-3" style={{ alignItems: 'center' }}>
          <Star s={16}/>
          <div className="col flex-1" style={{ gap: 1, minWidth: 0 }}>
            <span className="sz-14 semi strong">지역대회 초대장</span>
            <span className="sz-12 muted">2026-04-15 ~ 2026-04-17 · 3일</span>
          </div>
          <button className="ph-h-btn" style={{ width: 28, height: 28 }}><Dots s={14}/></button>
        </div>
      </div>
    </section>

    {/* 새 시즌 만들기 */}
    <section className="col" style={{ gap: 10 }}>
      <div className="sec-head"><h2>새 시즌 만들기</h2></div>
      <div className="col gap-3">
        <div className="col" style={{ gap: 6 }}>
          <label className="sz-12 semi">라벨 <span style={{ color: 'var(--danger)' }}>*</span></label>
          <div className="input" style={{ color: 'var(--muted-2)' }}>예: 봄 특별봉사 2026</div>
        </div>
        <div className="col" style={{ gap: 6 }}>
          <label className="sz-12 semi">시작일</label>
          <div className="input" style={{ justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text)' }}>2026.05.17</span>
            <ChevD/>
          </div>
        </div>
        <div className="col" style={{ gap: 6 }}>
          <label className="sz-12 semi">기간 (일)</label>
          <div className="input" style={{ color: 'var(--text)' }}>7</div>
          <div className="row gap-2" style={{ marginTop: 4 }}>
            {[3, 5, 7, 10, 14].map((n) => (
              <div key={n} className="pill" style={{
                padding: '5px 12px',
                background: n === 7 ? 'var(--ink)' : 'var(--surface)',
                color: n === 7 ? 'white' : 'var(--text)',
                border: '1px solid ' + (n === 7 ? 'var(--ink)' : 'var(--line)'),
                fontWeight: n === 7 ? 600 : 500
              }}>{n}일</div>
            ))}
          </div>
        </div>

        {/* Summary chip */}
        <div className="row gap-2" style={{
          padding: '10px 14px', background: 'var(--paper)',
          borderRadius: 10, alignItems: 'center', flexWrap: 'wrap'
        }}>
          <span className="sz-13 semi" style={{ color: 'var(--text)' }}>종료일</span>
          <span className="sz-13 semi strong tnum">2026-05-23</span>
          <span style={{ flex: 1 }}/>
          <span className="pill" style={{ background: 'var(--ok-bg)', color: 'var(--ok)', fontWeight: 600 }}>
            오늘부터 활성화
          </span>
        </div>

        <div className="row gap-2" style={{ marginTop: 4 }}>
          <button className="btn ghost flex-1">취소</button>
          <button className="btn solid flex-1">시즌 생성</button>
        </div>
      </div>
    </section>
  </SubPhone>
);

// ───────────────────────── 공지 ─────────────────────────
const AnnouncementsScreen = () => (
  <SubPhone title="공지" sub="2개 · 관리자 작성">
    {/* Top bar */}
    <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', padding: '0 4px' }}>
      <span className="sz-15 semi strong">공지사항</span>
      <button className="btn solid" style={{ height: 32, padding: '0 12px', fontSize: 13 }}>
        <Plus/> 공지 작성
      </button>
    </div>

    {/* Notice cards */}
    <div className="col gap-3">
      {[
        {
          kind: '중요', title: '5월 봉사 일정 변경 안내',
          body: '5월 19일 화요일 봉사는 오후 2시로 변경됩니다.\n장소는 동일합니다.',
          who: '장웅', date: '2026-05-15',
          comments: [
            { who: '김휘민', i: '김', when: '5/15', body: '확인했습니다' },
            { who: '엄민석', i: '엄', when: '5/15', body: '저도 확인했어요' },
          ]
        },
        {
          kind: '일반', title: '테스트', body: '테스트',
          who: '장웅', date: '2026-04-30',
          comments: []
        }
      ].map((n, i) => (
        <div key={i} className="card" style={{ padding: '14px 16px' }}>
          <div className="col" style={{ gap: 6 }}>
            <span className="pill" style={{
              alignSelf: 'flex-start',
              background: n.kind === '중요' ? 'var(--danger-bg)' : 'var(--tint)',
              color: n.kind === '중요' ? 'var(--danger)' : 'var(--muted)',
              fontWeight: 600
            }}>{n.kind}</span>
            <span className="sz-15 semi strong">{n.title}</span>
            <span className="sz-13" style={{ color: 'var(--text)', lineHeight: 1.55, whiteSpace: 'pre-line' }}>
              {n.body}
            </span>
            <div className="row" style={{ justifyContent: 'space-between', marginTop: 4, alignItems: 'center' }}>
              <span className="sz-12 muted">{n.who} · {n.date}</span>
              <button className="btn ghost" style={{
                height: 26, fontSize: 12, padding: '0 10px', color: 'var(--muted)'
              }}>삭제</button>
            </div>
          </div>

          {/* Inline comments */}
          {(n.comments.length > 0 || true) && (
            <div style={{
              marginTop: 12, padding: 12, background: 'var(--paper)',
              borderRadius: 10
            }}>
              <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
                <span className="sz-13 semi strong">댓글</span>
                <span className="sz-12 muted tnum">{n.comments.length}개</span>
              </div>
              {n.comments.length === 0 ? (
                <div className="sz-13 muted" style={{ textAlign: 'center', padding: '8px 0 12px' }}>
                  아직 댓글이 없습니다.
                </div>
              ) : (
                <div className="col gap-3" style={{ marginBottom: 10 }}>
                  {n.comments.map((c, ci) => (
                    <div key={ci} className="row gap-2" style={{ alignItems: 'flex-start' }}>
                      <span className="avatar" style={{ width: 24, height: 24, fontSize: 11 }}>{c.i}</span>
                      <div className="col flex-1" style={{ gap: 1 }}>
                        <div className="row gap-2" style={{ alignItems: 'baseline' }}>
                          <span className="sz-12 semi strong">{c.who}</span>
                          <span className="sz-12 muted">{c.when}</span>
                        </div>
                        <span className="sz-13">{c.body}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="row gap-2">
                <div className="input flex-1" style={{ padding: '8px 12px', fontSize: 13 }}>
                  <span>댓글 입력 · @로 멘션</span>
                </div>
                <button className="btn solid" style={{ height: 34, padding: '0 12px', fontSize: 13 }}>등록</button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  </SubPhone>
);

Object.assign(window, {
  SubHeader, SubPhone,
  MyInfoScreen, NotifSettingsScreen, JoinRequestsScreen,
  SpecialSeasonScreen, AnnouncementsScreen
});
