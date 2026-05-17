// Shared phone shell — status bar + header + tab bar.
// All admin screens use these three primitives + a body.

const StatusBar = () => (
  <div className="ph-status">
    <span>9:41</span>
    <span className="ph-status-r">
      <SignalBars/><Wifi/><Battery/>
    </span>
  </div>
);

const Header = ({title, sub, badges = {bell:10, chat:3}}) => (
  <div className="ph-header">
    <div className="ph-h-titles">
      <span className="ph-h-title">{title}</span>
      {sub && <span className="ph-h-sub">{sub}</span>}
    </div>
    <div className="ph-h-actions">
      <button className="ph-h-btn"><Bell/>{badges.bell ? <span className="badge">{badges.bell}</span> : null}</button>
      <button className="ph-h-btn"><Chat/>{badges.chat ? <span className="badge">{badges.chat}</span> : null}</button>
      <button className="ph-h-btn"><Dots/></button>
    </div>
  </div>
);

const TabBar = ({active = 'home'}) => {
  const tabs = [
    {id:'home',   label:'홈',     Ico: IcoHome},
    {id:'cal',    label:'캘린더', Ico: IcoCal},
    {id:'terr',   label:'구역',   Ico: IcoMap},
    {id:'assign', label:'배정',   Ico: IcoAssign},
    {id:'set',    label:'설정',   Ico: IcoGear},
  ];
  return (
    <div className="ph-tabbar">
      {tabs.map(t => {
        const Ico = t.Ico;
        return (
          <div key={t.id} className={`ph-tab ${active===t.id?'active':''}`}>
            <Ico s={24}/>
            <span>{t.label}</span>
          </div>
        );
      })}
    </div>
  );
};

const Phone = ({active, title, sub, badges, hideTabs, children, style}) => (
  <div className="phone" style={style}>
    <StatusBar/>
    <Header title={title} sub={sub} badges={badges}/>
    <div className="ph-body">{children}</div>
    {!hideTabs && <TabBar active={active}/>}
  </div>
);

Object.assign(window, { StatusBar, Header, TabBar, Phone });
