// 개인정보 처리방침 전문 (ko/zh/en 단일 소스) — 설정 화면 + 가입 동의 모달 재사용.
// 내용 변경 시 docs/개인정보처리방침.md 와 PRIVACY_EFFECTIVE_DATE 도 함께 갱신할 것.

import type { AppLanguage } from '../i18n'

export const PRIVACY_EFFECTIVE_DATE = '2026-07-01'

type Block =
  | { k: 'p'; t: string }
  | { k: 'note'; t: string }
  | { k: 'sub'; t: string }
  | { k: 'rows'; w?: number; rows: [string, string][] }
  | { k: 'ol'; items: string[] }
  | { k: 'procs'; items: { name: string; desc: string; links: { label: string; href: string }[] }[] }

type Section = { h: string; blocks: Block[] }
type Content = { title: string; meta: string; intro: string; sections: Section[] }

const SUPA_SEC = 'https://supabase.com/security'
const SUPA_PRIV = 'https://supabase.com/privacy'
const VERCEL = 'https://vercel.com/legal/privacy-notice'

const CONTENT: Record<AppLanguage, Content> = {
  ko: {
    title: '개인정보 처리방침',
    meta: `필드맵 (구역 관리 앱) · 시행일 ${PRIVACY_EFFECTIVE_DATE}`,
    intro: '필드맵(이하 "본 앱")은 「개인정보 보호법」 및 「위치정보의 보호 및 이용 등에 관한 법률」 등 관련 법령을 준수하며, 이용자의 개인정보를 보호하기 위해 다음과 같이 개인정보 처리방침을 둡니다.',
    sections: [
      { h: '제1조 (총칙)', blocks: [{ k: 'p', t: '본 앱은 회중 구역 관리를 목적으로 운영되는 내부용 도구이며, 외부에 공개되지 않습니다. 본 방침은 로그인 계정을 보유한 회중 구성원(이하 "이용자")에게 적용됩니다.' }] },
      { h: '제2조 (수집하는 개인정보 항목)', blocks: [
        { k: 'sub', t: '1. 이용자(계정 보유자)' },
        { k: 'rows', rows: [['필수', '아이디, 닉네임 (가입 시)'], ['필수', '비밀번호(PIN) — 암호화 저장 (가입 시)'], ['필수', '로그인 기록(접속 일시) — 자동 생성'], ['선택', '전화번호 — 직접 입력한 경우에 한함'], ['선택', '위치정보 — 기기에서 일시 이용, 서버 미저장(제8조)']] },
        { k: 'note', t: '닉네임은 실명이 아니어도 무방하며, 비밀번호는 복호화가 불가능한 형태(bcrypt 해시)로 저장되어 운영자도 원문을 확인할 수 없습니다.' },
        { k: 'sub', t: '2. 구역 정보' },
        { k: 'p', t: '건물 주소, 세대(호수), 방문 결과(만남/부재/대상외), 메모, 정기방문 표시 등. 봉사 대상자의 성명·연락처 등 식별정보는 수집하지 않는 것을 원칙으로 하며, 메모·별칭란에 식별정보를 입력하지 않도록 안내합니다.' },
      ] },
      { h: '제3조 (개인정보의 이용 목적)', blocks: [{ k: 'ol', items: ['계정 식별 및 로그인 인증', '역할(봉사자·인도자·관리자)에 따른 기능 및 정보 접근 제어', '구역의 배정·기록·통계 관리', '부정 이용 방지 및 보안 점검(로그인 기록)', '(선택 동의 시) 봉사 관련 연락(전화번호)'] }] },
      { h: '제4조 (보유 및 이용 기간)', blocks: [
        { k: 'p', t: '이용 목적 달성 또는 계정 삭제 시까지 보유하며, 다음 항목은 자동 정리됩니다.' },
        { k: 'rows', w: 96, rows: [['채팅 메시지', '90일'], ['읽은 알림', '30일'], ['운영 로그', '60일'], ['로그인 기록', '180일']] },
        { k: 'note', t: '계정 탈퇴(전출 등) 시 로그인 계정 정보는 삭제되며, 기존 봉사 기록은 통계·연속성 보존을 위해 식별정보와 분리되어 유지될 수 있습니다. 보유 기간은 관리자 설정에서 조정될 수 있습니다.' },
      ] },
      { h: '제5조 (처리위탁 및 국외 이전)', blocks: [
        { k: 'p', t: '안정적 운영을 위해 아래 사업자의 서비스를 이용하며, 데이터는 해당 사업자의 국외 서버에 저장됩니다. 각 사는 자체 보안·개인정보 정책 및 데이터 처리 약관(DPA)을 준수합니다.' },
        { k: 'procs', items: [
          { name: 'Supabase', desc: 'DB 저장·인증 (국외)', links: [{ label: 'security', href: SUPA_SEC }, { label: 'privacy', href: SUPA_PRIV }] },
          { name: 'Vercel', desc: '호스팅·전송 (국외)', links: [{ label: 'privacy-notice', href: VERCEL }] },
          { name: '네이버 지도', desc: '지도·길찾기 (국내)', links: [] },
        ] },
        { k: 'note', t: '위치정보는 길찾기 실행 시에 한해 네이버 지도로 전달되며, 본 앱 서버에는 저장되지 않습니다. 국외 이전 보호 조치로 각 수탁사의 표준 데이터 처리 약관(DPA)을 확인·보관합니다.' },
      ] },
      { h: '제6조 (개인정보의 파기)', blocks: [{ k: 'p', t: '보유 기간이 경과하거나 처리 목적이 달성된 개인정보는 지체 없이, 복구·재생이 불가능한 방법으로 파기합니다. (제4조 자동 정리 포함)' }] },
      { h: '제7조 (정보주체의 권리·행사 방법)', blocks: [
        { k: 'ol', items: ['열람·정정 — 앱 내 프로필 화면에서 직접 수정', '삭제·처리정지·동의 철회 — 관리자에게 요청(계정 삭제)', '전화번호 등 선택 정보는 입력하지 않거나 언제든 삭제 가능'] },
        { k: 'note', t: '위치 권한은 기기 설정에서 언제든 해제할 수 있으며, 해제 시에도 그 외 기능은 정상 이용 가능합니다.' },
      ] },
      { h: '제8조 (위치정보의 처리)', blocks: [{ k: 'ol', items: ['위치정보는 ① 지도 상 현재 위치 표시 ② 목적지(건물) 길찾기 목적으로만 이용합니다.', '위치정보는 수집·저장하지 않으며, 해당 기능 사용 순간에만 단말기에서 처리됩니다.', '위치 권한 미동의 시 해당 기능만 제한되며 나머지는 정상 이용됩니다.'] }] },
      { h: '제9조 (안전성 확보 조치)', blocks: [{ k: 'ol', items: ['암호화 — 비밀번호 단방향 암호화 저장, 전송 구간 HTTPS', '접근 통제 — 로그인 인증 및 역할 기반 권한 분리(최소 노출)', '접속 기록 관리 — 로그인 기록 보관·점검', '정기 백업 — 데이터 손실 대비'] }] },
      { h: '제10조 (개인정보 보호책임자)', blocks: [{ k: 'p', t: '책임자: 필드맵 관리자(회중 내 지정). 개인정보 열람·정정·삭제 등 권리 행사 및 문의는 회중 관리자에게 요청할 수 있습니다.' }] },
      { h: '제11조 (방침의 변경)', blocks: [{ k: 'p', t: '본 처리방침은 법령·서비스 변경에 따라 개정될 수 있으며, 변경 시 앱 내 공지합니다.' }, { k: 'note', t: `시행일자: ${PRIVACY_EFFECTIVE_DATE}` }] },
    ],
  },
  zh: {
    title: '隐私政策',
    meta: `Field Map (地区管理应用) · 生效日 ${PRIVACY_EFFECTIVE_DATE}`,
    intro: 'Field Map（以下简称"本应用"）遵守韩国《个人信息保护法》及《位置信息的保护及利用等相关法律》等相关法规，为保护用户个人信息，特制定如下隐私政策。',
    sections: [
      { h: '第1条 (总则)', blocks: [{ k: 'p', t: '本应用是以会众地区管理为目的运营的内部工具，不对外公开。本政策适用于持有登录账户的会众成员（以下简称"用户"）。' }] },
      { h: '第2条 (收集的个人信息项目)', blocks: [
        { k: 'sub', t: '1. 用户（账户持有人）' },
        { k: 'rows', rows: [['必填', '账号、昵称（注册时）'], ['必填', '密码(PIN) — 加密存储（注册时）'], ['必填', '登录记录（登录时间）— 自动生成'], ['选填', '电话号码 — 仅在用户主动填写时'], ['选填', '位置信息 — 仅在设备上临时使用，不在服务器存储（第8条）']] },
        { k: 'note', t: '昵称无需为真实姓名；密码以不可逆方式（bcrypt 哈希）存储，运营者也无法查看原文。' },
        { k: 'sub', t: '2. 地区信息' },
        { k: 'p', t: '楼栋地址、住户（门牌）、探访结果（遇见/不在/非目标）、备注、定期访问标记等。原则上不收集探访对象的姓名、联系方式等可识别信息，并提醒用户不要在备注、别称栏中填写可识别信息。' },
      ] },
      { h: '第3条 (个人信息的使用目的)', blocks: [{ k: 'ol', items: ['账户识别及登录验证', '按角色（传道员·带头人·管理员）控制功能和信息访问', '地区的分配·记录·统计管理', '防止滥用及安全检查（登录记录）', '（在选择同意时）传道相关联络（电话号码）'] }] },
      { h: '第4条 (保存及使用期限)', blocks: [
        { k: 'p', t: '在达成使用目的或删除账户前予以保存，下列项目将自动清理。' },
        { k: 'rows', w: 110, rows: [['聊天消息', '90天'], ['已读通知', '30天'], ['运营日志', '60天'], ['登录记录', '180天']] },
        { k: 'note', t: '账户注销（迁出等）时删除登录账户信息；既有传道记录为统计与连续性目的，可在与识别信息分离后保留。保存期限可在管理员设置中调整。' },
      ] },
      { h: '第5条 (委托处理及跨境传输)', blocks: [
        { k: 'p', t: '为稳定运营，本应用使用以下服务商的服务，数据存储于其位于境外的服务器。各服务商均遵守其自身的安全·隐私政策及数据处理协议(DPA)。' },
        { k: 'procs', items: [
          { name: 'Supabase', desc: '数据库存储·认证（境外）', links: [{ label: 'security', href: SUPA_SEC }, { label: 'privacy', href: SUPA_PRIV }] },
          { name: 'Vercel', desc: '托管·传输（境外）', links: [{ label: 'privacy-notice', href: VERCEL }] },
          { name: 'Naver 地图', desc: '地图·导航（韩国境内）', links: [] },
        ] },
        { k: 'note', t: '位置信息仅在执行导航时传输给 Naver 地图，不在本应用服务器存储。作为跨境传输的保护措施，将确认并保管各受托方的标准数据处理协议(DPA)。' },
      ] },
      { h: '第6条 (个人信息的销毁)', blocks: [{ k: 'p', t: '保存期限届满或处理目的达成的个人信息，将以无法恢复·再生的方式立即销毁。（含第4条的自动清理）' }] },
      { h: '第7条 (信息主体的权利及行使方法)', blocks: [
        { k: 'ol', items: ['查阅·更正 — 在应用内个人资料页面直接修改', '删除·停止处理·撤回同意 — 向管理员申请（删除账户）', '电话号码等选填信息可不填写或随时删除'] },
        { k: 'note', t: '位置权限可随时在设备设置中关闭，关闭后其余功能仍可正常使用。' },
      ] },
      { h: '第8条 (位置信息的处理)', blocks: [{ k: 'ol', items: ['位置信息仅用于 ① 在地图上显示当前位置 ② 前往目的地（楼栋）的导航。', '位置信息不收集·不存储，仅在使用该功能的瞬间于设备上处理。', '未同意位置权限时仅限制该功能，其余功能正常使用。'] }] },
      { h: '第9条 (安全保障措施)', blocks: [{ k: 'ol', items: ['加密 — 密码单向加密存储，传输区间使用 HTTPS', '访问控制 — 登录验证及基于角色的权限分离（最小披露）', '访问记录管理 — 保存并检查登录记录', '定期备份 — 防范数据丢失'] }] },
      { h: '第10条 (个人信息保护负责人)', blocks: [{ k: 'p', t: '负责人：Field Map 管理员（由会众内部指定）。查阅·更正·删除个人信息等权利行使及咨询，可向会众管理员提出。' }] },
      { h: '第11条 (政策的变更)', blocks: [{ k: 'p', t: '本隐私政策可能因法规·服务变更而修订，变更时将在应用内公告。' }, { k: 'note', t: `生效日期：${PRIVACY_EFFECTIVE_DATE}` }] },
    ],
  },
  en: {
    title: 'Privacy Policy',
    meta: `Field Map (Territory app) · Effective ${PRIVACY_EFFECTIVE_DATE}`,
    intro: 'Field Map ("the App") complies with applicable laws including the Personal Information Protection Act and the Location Information Act, and establishes the following privacy policy to protect users’ personal information.',
    sections: [
      { h: 'Article 1 (General)', blocks: [{ k: 'p', t: 'The App is an internal tool operated for congregation territory management and is not publicly available. This policy applies to congregation members who hold a login account ("users").' }] },
      { h: 'Article 2 (Information Collected)', blocks: [
        { k: 'sub', t: '1. Users (account holders)' },
        { k: 'rows', w: 80, rows: [['Required', 'ID, nickname (at sign-up)'], ['Required', 'Password (PIN) — stored encrypted (at sign-up)'], ['Required', 'Login records (sign-in times) — auto-generated'], ['Optional', 'Phone number — only if entered by the user'], ['Optional', 'Location — used on-device only, not stored on server (Art. 8)']] },
        { k: 'note', t: 'The nickname need not be a real name. Passwords are stored irreversibly (bcrypt hash); even operators cannot view the original.' },
        { k: 'sub', t: '2. Territory information' },
        { k: 'p', t: 'Building address, unit, visit result (met/not-in/not-applicable), memo, regular-visit flag, etc. As a rule, identifying information about householders (name, contact) is not collected, and users are advised not to enter identifying information in memo or nickname fields.' },
      ] },
      { h: 'Article 3 (Purpose of Use)', blocks: [{ k: 'ol', items: ['Account identification and login authentication', 'Role-based access control (publisher / leader / admin)', 'Territory assignment, records, and statistics', 'Abuse prevention and security review (login records)', '(With optional consent) service-related contact (phone)'] }] },
      { h: 'Article 4 (Retention Period)', blocks: [
        { k: 'p', t: 'Retained until the purpose is fulfilled or the account is deleted. The following are automatically cleaned up.' },
        { k: 'rows', w: 120, rows: [['Chat messages', '90 days'], ['Read notifications', '30 days'], ['Operation logs', '60 days'], ['Login records', '180 days']] },
        { k: 'note', t: 'On account withdrawal (e.g., transfer), login account data is deleted; existing service records may be retained separated from identifying information for statistical and continuity purposes. Retention periods are adjustable in admin settings.' },
      ] },
      { h: 'Article 5 (Processing Entrustment & Overseas Transfer)', blocks: [
        { k: 'p', t: 'For stable operation, the App uses the following providers; data is stored on their overseas servers. Each provider complies with its own security/privacy policy and Data Processing Addendum (DPA).' },
        { k: 'procs', items: [
          { name: 'Supabase', desc: 'Database & auth (overseas)', links: [{ label: 'security', href: SUPA_SEC }, { label: 'privacy', href: SUPA_PRIV }] },
          { name: 'Vercel', desc: 'Hosting & delivery (overseas)', links: [{ label: 'privacy-notice', href: VERCEL }] },
          { name: 'Naver Map', desc: 'Maps & directions (domestic)', links: [] },
        ] },
        { k: 'note', t: 'Location is sent to Naver Map only when directions are requested, and is not stored on the App server. As a safeguard for overseas transfer, each processor’s standard DPA is reviewed and retained.' },
      ] },
      { h: 'Article 6 (Destruction)', blocks: [{ k: 'p', t: 'Personal information whose retention period has expired or purpose fulfilled is destroyed without delay, in an unrecoverable manner (including the auto-cleanup in Article 4).' }] },
      { h: 'Article 7 (Rights of the Data Subject)', blocks: [
        { k: 'ol', items: ['Access/correction — edit directly in the in-app profile', 'Deletion / stop processing / withdraw consent — request to admin (account deletion)', 'Optional data such as phone can be omitted or deleted anytime'] },
        { k: 'note', t: 'Location permission can be turned off in device settings anytime; other features still work.' },
      ] },
      { h: 'Article 8 (Location Processing)', blocks: [{ k: 'ol', items: ['Location is used only for ① showing your current position on the map ② directions to a destination (building).', 'Location is not collected or stored; it is processed on the device only at the moment of use.', 'Without location permission, only that feature is limited; the rest works normally.'] }] },
      { h: 'Article 9 (Security Measures)', blocks: [{ k: 'ol', items: ['Encryption — one-way password hashing, HTTPS in transit', 'Access control — login auth and role-based separation (minimal exposure)', 'Access logging — login records kept and reviewed', 'Regular backups — against data loss'] }] },
      { h: 'Article 10 (Privacy Officer)', blocks: [{ k: 'p', t: 'Officer: Field Map administrator (designated within the congregation). Requests to exercise rights (access, correction, deletion) and inquiries may be made to the congregation administrator.' }] },
      { h: 'Article 11 (Changes)', blocks: [{ k: 'p', t: 'This policy may be revised due to legal or service changes; changes will be announced in the App.' }, { k: 'note', t: `Effective date: ${PRIVACY_EFFECTIVE_DATE}` }] },
    ],
  },
}

const S: Record<string, React.CSSProperties> = {
  h: { fontSize: 15, fontWeight: 700, color: 'var(--ink)', margin: '20px 0 8px' },
  p: { fontSize: 13.5, lineHeight: 1.7, color: 'var(--ink)', margin: '0 0 8px' },
  li: { fontSize: 13.5, lineHeight: 1.7, color: 'var(--ink)', margin: '0 0 4px', paddingLeft: 2 },
  sub: { fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', margin: '0 0 8px' },
  muted: { fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.6, margin: '0 0 8px' },
  row: { display: 'flex', gap: 8, fontSize: 13, padding: '6px 0', borderBottom: '1px solid var(--line)' },
  link: { color: 'var(--brand, #2d6a4f)', wordBreak: 'break-all' },
}

function renderBlock(b: Block, i: number) {
  switch (b.k) {
    case 'p': return <p key={i} style={S.p}>{b.t}</p>
    case 'note': return <p key={i} style={S.muted}>{b.t}</p>
    case 'sub': return <p key={i} style={S.sub}>{b.t}</p>
    case 'rows': return (
      <div key={i}>{b.rows.map(([k, v], j) => (
        <div key={j} style={S.row}><span style={{ flexShrink: 0, width: b.w ?? 52, color: 'var(--muted)', fontWeight: 600 }}>{k}</span><span>{v}</span></div>
      ))}</div>
    )
    case 'ol': return <ol key={i} style={{ margin: 0, paddingLeft: 18 }}>{b.items.map((it, j) => <li key={j} style={S.li}>{it}</li>)}</ol>
    case 'procs': return (
      <ul key={i} style={{ margin: 0, paddingLeft: 18 }}>{b.items.map((it, j) => (
        <li key={j} style={S.li}>
          <b>{it.name}</b> — {it.desc}
          {it.links.length > 0 && <> · {it.links.map((l, k) => (
            <span key={k}>{k > 0 && ' · '}<a href={l.href} target="_blank" rel="noopener noreferrer" style={S.link}>{l.label}</a></span>
          ))}</>}
        </li>
      ))}</ul>
    )
  }
}

export function PrivacyPolicy({ language = 'ko' }: { language?: AppLanguage }) {
  const c = CONTENT[language] ?? CONTENT.ko
  return (
    <div style={{ color: 'var(--ink)' }}>
      <h1 style={{ fontSize: 19, fontWeight: 800, margin: '0 0 4px' }}>{c.title}</h1>
      <p style={{ ...S.muted, margin: 0 }}>{c.meta}</p>
      <p style={{ ...S.p, marginTop: 12 }}>{c.intro}</p>
      {c.sections.map((sec, i) => (
        <div key={i}>
          <h2 style={S.h}>{sec.h}</h2>
          {sec.blocks.map(renderBlock)}
        </div>
      ))}
    </div>
  )
}
