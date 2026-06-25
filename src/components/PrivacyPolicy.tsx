// 개인정보 처리방침 전문 (단일 소스) — 설정 화면 + 가입 동의 모달에서 재사용.
// 내용 변경 시 docs/개인정보처리방침.md 와 EFFECTIVE_DATE 도 함께 갱신할 것.

export const PRIVACY_EFFECTIVE_DATE = '2026-07-01'

const S: Record<string, React.CSSProperties> = {
  h: { fontSize: 15, fontWeight: 700, color: 'var(--ink)', margin: '20px 0 8px' },
  p: { fontSize: 13.5, lineHeight: 1.7, color: 'var(--ink)', margin: '0 0 8px' },
  li: { fontSize: 13.5, lineHeight: 1.7, color: 'var(--ink)', margin: '0 0 4px', paddingLeft: 2 },
  muted: { fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.6 },
  row: { display: 'flex', gap: 8, fontSize: 13, padding: '6px 0', borderBottom: '1px solid var(--line)' },
  rowLabel: { flexShrink: 0, width: 52, color: 'var(--muted)', fontWeight: 600 },
  link: { color: 'var(--brand, #2d6a4f)', wordBreak: 'break-all' },
}

function A({ href, children }: { href: string; children: React.ReactNode }) {
  return <a href={href} target="_blank" rel="noopener noreferrer" style={S.link}>{children}</a>
}

export function PrivacyPolicy() {
  return (
    <div style={{ color: 'var(--ink)' }}>
      <h1 style={{ fontSize: 19, fontWeight: 800, margin: '0 0 4px' }}>개인정보 처리방침</h1>
      <p style={S.muted}>필드맵 (구역 관리 앱) · 시행일 {PRIVACY_EFFECTIVE_DATE}</p>
      <p style={{ ...S.p, marginTop: 12 }}>
        필드맵(이하 "본 앱")은 「개인정보 보호법」 및 「위치정보의 보호 및 이용 등에 관한 법률」 등 관련 법령을
        준수하며, 이용자의 개인정보를 보호하기 위해 다음과 같이 개인정보 처리방침을 둡니다.
      </p>

      <h2 style={S.h}>제1조 (총칙)</h2>
      <p style={S.p}>본 앱은 회중 구역 관리를 목적으로 운영되는 내부용 도구이며, 외부에 공개되지 않습니다. 본 방침은 로그인 계정을 보유한 회중 구성원(이하 "이용자")에게 적용됩니다.</p>

      <h2 style={S.h}>제2조 (수집하는 개인정보 항목)</h2>
      <p style={{ ...S.p, fontWeight: 600 }}>1. 이용자(계정 보유자)</p>
      {[
        ['필수', '아이디, 닉네임 (가입 시)'],
        ['필수', '비밀번호(PIN) — 암호화 저장 (가입 시)'],
        ['필수', '로그인 기록(접속 일시) — 자동 생성'],
        ['선택', '전화번호 — 직접 입력한 경우에 한함'],
        ['선택', '위치정보 — 기기에서 일시 이용, 서버 미저장(제8조)'],
      ].map(([k, v]) => (
        <div key={v} style={S.row}><span style={S.rowLabel}>{k}</span><span>{v}</span></div>
      ))}
      <p style={{ ...S.muted, marginTop: 8 }}>닉네임은 실명이 아니어도 무방하며, 비밀번호는 복호화가 불가능한 형태(bcrypt 해시)로 저장되어 운영자도 원문을 확인할 수 없습니다.</p>
      <p style={{ ...S.p, fontWeight: 600, marginTop: 12 }}>2. 구역 정보</p>
      <p style={S.p}>건물 주소, 세대(호수), 방문 결과(만남/부재/대상외), 메모, 정기방문 표시 등. 봉사 대상자의 성명·연락처 등 식별정보는 수집하지 않는 것을 원칙으로 하며, 메모·별칭란에 식별정보를 입력하지 않도록 안내합니다.</p>

      <h2 style={S.h}>제3조 (개인정보의 이용 목적)</h2>
      <ol style={{ margin: 0, paddingLeft: 18 }}>
        <li style={S.li}>계정 식별 및 로그인 인증</li>
        <li style={S.li}>역할(봉사자·인도자·관리자)에 따른 기능 및 정보 접근 제어</li>
        <li style={S.li}>구역의 배정·기록·통계 관리</li>
        <li style={S.li}>부정 이용 방지 및 보안 점검(로그인 기록)</li>
        <li style={S.li}>(선택 동의 시) 봉사 관련 연락(전화번호)</li>
      </ol>

      <h2 style={S.h}>제4조 (보유 및 이용 기간)</h2>
      <p style={S.p}>이용 목적 달성 또는 계정 삭제 시까지 보유하며, 다음 항목은 자동 정리됩니다.</p>
      {[['채팅 메시지', '90일'], ['읽은 알림', '30일'], ['운영 로그', '60일'], ['로그인 기록', '180일']].map(([k, v]) => (
        <div key={k} style={S.row}><span style={{ ...S.rowLabel, width: 96 }}>{k}</span><span>{v}</span></div>
      ))}
      <p style={{ ...S.muted, marginTop: 8 }}>계정 탈퇴(전출 등) 시 로그인 계정 정보는 삭제되며, 기존 봉사 기록은 통계·연속성 보존을 위해 식별정보와 분리되어 유지될 수 있습니다. 보유 기간은 관리자 설정에서 조정될 수 있습니다.</p>

      <h2 style={S.h}>제5조 (처리위탁 및 국외 이전)</h2>
      <p style={S.p}>안정적 운영을 위해 아래 사업자의 서비스를 이용하며, 데이터는 해당 사업자의 국외 서버에 저장됩니다. 각 사는 자체 보안·개인정보 정책 및 데이터 처리 약관(DPA)을 준수합니다.</p>
      <ul style={{ margin: 0, paddingLeft: 18 }}>
        <li style={S.li}><b>Supabase</b> (DB 저장·인증, 국외) — <A href="https://supabase.com/security">security</A> · <A href="https://supabase.com/privacy">privacy</A></li>
        <li style={S.li}><b>Vercel</b> (호스팅·전송, 국외) — <A href="https://vercel.com/legal/privacy-notice">privacy-notice</A></li>
        <li style={S.li}><b>네이버 지도</b> (지도·길찾기, 국내) — 네이버 지도/위치기반서비스 약관</li>
      </ul>
      <p style={{ ...S.muted, marginTop: 8 }}>위치정보는 길찾기 실행 시에 한해 네이버 지도로 전달되며, 본 앱 서버에는 저장되지 않습니다. 국외 이전 보호 조치로 각 수탁사의 표준 데이터 처리 약관(DPA)을 확인·보관합니다.</p>

      <h2 style={S.h}>제6조 (개인정보의 파기)</h2>
      <p style={S.p}>보유 기간이 경과하거나 처리 목적이 달성된 개인정보는 지체 없이, 복구·재생이 불가능한 방법으로 파기합니다. (제4조 자동 정리 포함)</p>

      <h2 style={S.h}>제7조 (정보주체의 권리·행사 방법)</h2>
      <ol style={{ margin: 0, paddingLeft: 18 }}>
        <li style={S.li}>열람·정정 — 앱 내 프로필 화면에서 직접 수정</li>
        <li style={S.li}>삭제·처리정지·동의 철회 — 관리자에게 요청(계정 삭제)</li>
        <li style={S.li}>전화번호 등 선택 정보는 입력하지 않거나 언제든 삭제 가능</li>
      </ol>
      <p style={{ ...S.muted, marginTop: 8 }}>위치 권한은 기기 설정에서 언제든 해제할 수 있으며, 해제 시에도 그 외 기능은 정상 이용 가능합니다.</p>

      <h2 style={S.h}>제8조 (위치정보의 처리)</h2>
      <ol style={{ margin: 0, paddingLeft: 18 }}>
        <li style={S.li}>위치정보는 ① 지도 상 현재 위치 표시 ② 목적지(건물) 길찾기 목적으로만 이용합니다.</li>
        <li style={S.li}>위치정보는 수집·저장하지 않으며, 해당 기능 사용 순간에만 단말기에서 처리됩니다.</li>
        <li style={S.li}>위치 권한 미동의 시 해당 기능만 제한되며 나머지는 정상 이용됩니다.</li>
      </ol>

      <h2 style={S.h}>제9조 (안전성 확보 조치)</h2>
      <ol style={{ margin: 0, paddingLeft: 18 }}>
        <li style={S.li}>암호화 — 비밀번호 단방향 암호화 저장, 전송 구간 HTTPS</li>
        <li style={S.li}>접근 통제 — 로그인 인증 및 역할 기반 권한 분리(최소 노출)</li>
        <li style={S.li}>접속 기록 관리 — 로그인 기록 보관·점검</li>
        <li style={S.li}>정기 백업 — 데이터 손실 대비</li>
      </ol>

      <h2 style={S.h}>제10조 (개인정보 보호책임자)</h2>
      <p style={S.p}>책임자: 필드맵 관리자(회중 내 지정). 개인정보 열람·정정·삭제 등 권리 행사 및 문의는 회중 관리자에게 요청할 수 있습니다.</p>

      <h2 style={S.h}>제11조 (방침의 변경)</h2>
      <p style={S.p}>본 처리방침은 법령·서비스 변경에 따라 개정될 수 있으며, 변경 시 앱 내 공지합니다.</p>
      <p style={{ ...S.muted, marginTop: 4 }}>시행일자: {PRIVACY_EFFECTIVE_DATE}</p>
    </div>
  )
}
