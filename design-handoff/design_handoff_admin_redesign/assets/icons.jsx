// Inline SVG icon set — small, lucide-style outlines (16/18/20px).
// Each accepts size (default 18) and color (defaults to currentColor).

const I = (paths, size = 18) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    {paths}
  </svg>
);

const Bell      = ({s=18}) => I(<>
  <path d="M6 8a6 6 0 0 1 12 0c0 5 1.5 7 3 7H3c1.5 0 3-2 3-7"/>
  <path d="M10 21a2 2 0 0 0 4 0"/>
</>, s);

const Chat      = ({s=18}) => I(<>
  <path d="M3 12a9 9 0 1 1 4.4 7.7L3 21l1.3-4.4A8.9 8.9 0 0 1 3 12z"/>
</>, s);

const Dots      = ({s=18}) => I(<>
  <circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/>
</>, s);

const ChevR     = ({s=14}) => I(<polyline points="9 6 15 12 9 18"/>, s);
const ChevL     = ({s=14}) => I(<polyline points="15 6 9 12 15 18"/>, s);
const ChevD     = ({s=14}) => I(<polyline points="6 9 12 15 18 9"/>, s);
const ChevU     = ({s=14}) => I(<polyline points="6 15 12 9 18 15"/>, s);

const Home      = ({s=22}) => I(<>
  <path d="M3 11l9-8 9 8v9a2 2 0 0 1-2 2h-4v-7H9v7H5a2 2 0 0 1-2-2v-9z"/>
</>, s);

const Cal       = ({s=22}) => I(<>
  <rect x="3" y="5" width="18" height="16" rx="2.5"/>
  <path d="M3 10h18M8 3v4M16 3v4"/>
</>, s);

const MapBig    = ({s=22}) => I(<>
  <path d="M9 4 3 7v13l6-3 6 3 6-3V4l-6 3-6-3z"/>
  <path d="M9 4v13M15 7v13"/>
</>, s);

const Assign    = ({s=22}) => I(<>
  <path d="M4 6h11M4 12h11M4 18h11"/>
  <path d="M17 8l4 4-4 4"/>
</>, s);

const Gear      = ({s=22}) => I(<>
  <circle cx="12" cy="12" r="3"/>
  <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>
</>, s);

const Search    = ({s=16}) => I(<>
  <circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>
</>, s);

const Plus      = ({s=14}) => I(<><path d="M12 5v14M5 12h14"/></>, s);
const X         = ({s=16}) => I(<><path d="M6 6l12 12M18 6 6 18"/></>, s);

const MapIcon   = ({s=16}) => I(<>
  <path d="M9 4 3 7v13l6-3 6 3 6-3V4l-6 3-6-3z"/>
  <path d="M9 4v13M15 7v13"/>
</>, s);

const Clock     = ({s=14}) => I(<>
  <circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>
</>, s);

const Pin       = ({s=14}) => I(<>
  <path d="M12 21s7-7.4 7-12a7 7 0 0 0-14 0c0 4.6 7 12 7 12z"/>
  <circle cx="12" cy="9" r="2.5"/>
</>, s);

const User      = ({s=14}) => I(<>
  <circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>
</>, s);

const Users     = ({s=18}) => I(<>
  <circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0 1 14 0"/>
  <path d="M16 4a4 4 0 0 1 0 8M22 21a7 7 0 0 0-5-6.7"/>
</>, s);

const Megaphone = ({s=18}) => I(<>
  <path d="M3 11v2a2 2 0 0 0 2 2h2l8 5V4l-8 5H5a2 2 0 0 0-2 2z"/>
  <path d="M18 8a4 4 0 0 1 0 8"/>
</>, s);

const Star      = ({s=18}) => I(<>
  <path d="m12 3 2.7 6 6.3.5-4.8 4.2 1.5 6.3L12 17l-5.7 3 1.5-6.3L3 9.5 9.3 9 12 3z"/>
</>, s);

const BellMute  = ({s=18}) => I(<>
  <path d="M6 8a6 6 0 0 1 12 0c0 5 1.5 7 3 7H3c1.5 0 3-2 3-7"/>
  <path d="M10 21a2 2 0 0 0 4 0"/><path d="M3 3l18 18" strokeWidth="2"/>
</>, s);

const Check     = ({s=14}) => I(<polyline points="5 12 10 17 19 7"/>, s);

const Fork      = ({s=14}) => I(<>
  <path d="M7 2v8M5 2v8a2 2 0 0 0 4 0V2M7 10v12"/>
  <path d="M15 2v10c0 1.5 1 2 2 2v8M19 5l-2 7"/>
</>, s);

const Logout    = ({s=16}) => I(<>
  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
  <path d="M16 17l5-5-5-5M21 12H9"/>
</>, s);

const Globe     = ({s=18}) => I(<>
  <circle cx="12" cy="12" r="9"/>
  <path d="M3 12h18M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18z"/>
</>, s);

const ArrowR    = ({s=16}) => I(<><path d="M5 12h14M13 6l6 6-6 6"/></>, s);
const Moon      = ({s=18}) => I(<>
  <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>
</>, s);
const Layers    = ({s=18}) => I(<>
  <path d="M12 2 2 7l10 5 10-5-10-5z"/>
  <path d="M2 12l10 5 10-5"/><path d="M2 17l10 5 10-5"/>
</>, s);
const Crosshair = ({s=18}) => I(<>
  <circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2.5" fill="currentColor"/>
  <path d="M12 3v3M12 18v3M3 12h3M18 12h3"/>
</>, s);
const Minus     = ({s=14}) => I(<path d="M5 12h14"/>, s);
const PinPlus   = ({s=18}) => I(<>
  <path d="M12 21s7-7.4 7-12a7 7 0 0 0-14 0c0 4.6 7 12 7 12z"/>
  <path d="M12 7v4M10 9h4"/>
</>, s);
const LinkIco   = ({s=14}) => I(<>
  <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1.5 1.5"/>
  <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.5-1.5"/>
</>, s);
const Dot       = ({s=8})  => <span style={{display:'inline-block',width:s,height:s,borderRadius:99,background:'currentColor'}} />;

const SignalBars = () => (
  <svg width="14" height="11" viewBox="0 0 14 11" fill="currentColor">
    <rect x="0" y="7" width="2" height="4" rx="0.5"/>
    <rect x="4" y="4" width="2" height="7" rx="0.5"/>
    <rect x="8" y="2" width="2" height="9" rx="0.5"/>
    <rect x="12" y="0" width="2" height="11" rx="0.5"/>
  </svg>
);
const Wifi = () => (
  <svg width="14" height="10" viewBox="0 0 14 10" fill="none" stroke="currentColor" strokeWidth="1.4">
    <path d="M1 3.2A9 9 0 0 1 13 3.2"/><path d="M3 5.6A6 6 0 0 1 11 5.6"/>
    <path d="M5 8a3 3 0 0 1 4 0"/><circle cx="7" cy="9.6" r="0.7" fill="currentColor"/>
  </svg>
);
const Battery = () => (
  <svg width="22" height="11" viewBox="0 0 22 11" fill="none" stroke="currentColor" strokeWidth="1">
    <rect x="0.5" y="0.5" width="18" height="10" rx="2"/>
    <rect x="2" y="2" width="13" height="7" rx="1" fill="currentColor" stroke="none"/>
    <path d="M20 4v3" strokeWidth="1.4" strokeLinecap="round"/>
  </svg>
);

Object.assign(window, {
  Bell, Chat, Dots, ChevR, ChevL, ChevD, ChevU,
  IcoHome: Home, IcoCal: Cal, IcoMap: MapBig, IcoAssign: Assign, IcoGear: Gear,
  Search, Plus, X, MapIcon, Clock, Pin, User, Users, Megaphone, Star, BellMute,
  Check, Fork, Logout, Globe, ArrowR, LinkIco, Dot, SignalBars, Wifi, Battery,
  Moon, Layers, Crosshair, Minus, PinPlus,
});
