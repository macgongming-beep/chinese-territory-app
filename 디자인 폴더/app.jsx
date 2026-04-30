/* App entry — design canvas with all artboards */

const { DesignCanvas, DCSection, DCArtboard } = window;
const P = window.Phones;
const D = window.Desktops;
const D2 = window.Desktops2;

const App = () => (
  <DesignCanvas title="구역관리 — 디자인 개선 v1" initialScale={0.5}>
    <DCSection id="mobile" title="모바일">
      <DCArtboard id="m-home" label="01 홈" width={390} height={780}>
        <P.PhoneHome/>
      </DCArtboard>
      <DCArtboard id="m-cal-empty" label="02 캘린더 (비어있음)" width={390} height={780}>
        <P.PhoneCalendarEmpty/>
      </DCArtboard>
      <DCArtboard id="m-cal-full" label="03 캘린더 (일정 포함)" width={390} height={780}>
        <P.PhoneCalendarFull/>
      </DCArtboard>
      <DCArtboard id="m-zone" label="04 구역 목록" width={390} height={780}>
        <P.PhoneZone/>
      </DCArtboard>
      <DCArtboard id="m-map-empty" label="05 지도 (구역)" width={390} height={780}>
        <P.PhoneMapEmpty/>
      </DCArtboard>
      <DCArtboard id="m-map-detail" label="06 지도 + 세대 상세" width={390} height={780}>
        <P.PhoneMapDetail/>
      </DCArtboard>
      <DCArtboard id="m-assign-1" label="07 배정 ① 인도자 선택" width={390} height={780}>
        <P.PhoneAssign1/>
      </DCArtboard>
      <DCArtboard id="m-assign-2" label="08 배정 ② 구역 배정" width={390} height={780}>
        <P.PhoneAssign2/>
      </DCArtboard>
      <DCArtboard id="m-settings" label="09 설정" width={390} height={780}>
        <P.PhoneSettings/>
      </DCArtboard>
    </DCSection>

    <DCSection id="desktop" title="데스크탑">
      <DCArtboard id="d-home" label="01 홈 대시보드" width={1280} height={760}>
        <D.DeskHome/>
      </DCArtboard>
      <DCArtboard id="d-notice" label="02 공지" width={1280} height={760}>
        <D2.DeskNotice/>
      </DCArtboard>
      <DCArtboard id="d-calendar" label="03 캘린더" width={1280} height={760}>
        <D2.DeskCalendar/>
      </DCArtboard>
      <DCArtboard id="d-cards" label="04 구역 (카드 관리)" width={1280} height={760}>
        <D.DeskCards/>
      </DCArtboard>
      <DCArtboard id="d-map" label="05 지도" width={1280} height={760}>
        <D2.DeskMap/>
      </DCArtboard>
      <DCArtboard id="d-assign" label="06 배정" width={1280} height={760}>
        <D2.DeskAssign/>
      </DCArtboard>
      <DCArtboard id="d-users" label="07 사용자" width={1280} height={760}>
        <D2.DeskUsers/>
      </DCArtboard>
      <DCArtboard id="d-stats" label="08 통계" width={1280} height={760}>
        <D2.DeskStats/>
      </DCArtboard>
      <DCArtboard id="d-settings" label="09 설정" width={1280} height={760}>
        <D2.DeskSettings/>
      </DCArtboard>
    </DCSection>
  </DesignCanvas>
);

ReactDOM.createRoot(document.getElementById("root")).render(<App/>);
