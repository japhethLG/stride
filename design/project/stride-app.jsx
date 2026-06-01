/* stride-app.jsx — router + tweaks + device shell */
const { useState, useEffect, useRef, useCallback } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "dark": true,
  "accent": "#FF4D2E",
  "mapStyle": "streets"
}/*EDITMODE-END*/;

/* ---- color helpers for accent tweak ---- */
function hexToRgb(h) { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
function rgba(h, a) { const [r, g, b] = hexToRgb(h); return `rgba(${r},${g},${b},${a})`; }
function shade(h, p) { const [r, g, b] = hexToRgb(h); const f = x => Math.max(0, Math.min(255, Math.round(x * (1 + p)))); return `#${[f(r), f(g), f(b)].map(x => x.toString(16).padStart(2, '0')).join('')}`; }
function onAccent(h) { const [r, g, b] = hexToRgb(h); const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255; return lum > 0.62 ? '#0A1206' : '#ffffff'; }

/* ---- route matching ---- */
function matchRoute(path) {
  if (path === '/' ) return { name: 'home', params: {} };
  if (path === '/login') return { name: 'login', params: {} };
  if (path === '/onboarding/permissions') return { name: 'permissions', params: {} };
  if (path === '/routes') return { name: 'routes', params: {} };
  if (path === '/routes/new') return { name: 'create', params: {} };
  if (path === '/record') return { name: 'record', params: {} };
  if (path === '/record/summary') return { name: 'summary', params: {} };
  if (path === '/profile') return { name: 'profile', params: {} };
  if (path === '/settings') return { name: 'settings', params: {} };
  let m;
  if ((m = path.match(/^\/routes\/([^/]+)\/members$/))) return { name: 'members', params: { id: m[1] } };
  if ((m = path.match(/^\/routes\/([^/]+)\/leaderboard$/))) return { name: 'leaderboard', params: { id: m[1] } };
  if ((m = path.match(/^\/routes\/([^/]+)\/live$/))) return { name: 'live', params: { id: m[1] } };
  if ((m = path.match(/^\/routes\/([^/]+)$/))) return { name: 'routedetail', params: { id: m[1] } };
  if ((m = path.match(/^\/activities\/([^/]+)$/))) return { name: 'activity', params: { id: m[1] } };
  return { name: 'home', params: {} };
}

const TAB_FOR = { home: 'home', routes: 'routes', create: 'routes', routedetail: 'routes', members: 'routes', leaderboard: 'routes', live: 'routes', profile: 'profile' };
const FULLSCREEN = new Set(['login', 'permissions', 'create', 'record', 'summary', 'live', 'routedetail', 'members', 'leaderboard', 'activity', 'settings']);
const DARK_TOP = new Set(['login', 'record', 'live', 'create', 'routedetail', 'activity', 'summary']);

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [authed, setAuthed] = useState(false);
  const [path, setPath] = useState('/login');
  const [stack, setStack] = useState([]);
  const [params, setParams] = useState({});
  const [toast, setToast] = useState('');
  const [units, setUnits] = useState('metric');
  const toastTimer = useRef(null);

  const theme = t.dark ? 'dark' : 'light';

  const nav = useCallback((to, opts = {}) => {
    if (to === '__toast') {
      setToast(opts.msg || '');
      clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setToast(''), 2200);
      return;
    }
    if (to === 'back') {
      setStack(s => {
        if (!s.length) return s;
        const prev = s[s.length - 1];
        setPath(prev.path); setParams(prev.params);
        return s.slice(0, -1);
      });
      return;
    }
    if (opts.authed !== undefined) setAuthed(opts.authed);
    setParams(opts);
    if (opts.replace) {
      setPath(to);
    } else {
      setStack(s => [...s, { path, params }]);
      setPath(to);
    }
  }, [path, params]);

  const onTab = useCallback((tb) => {
    setStack([]); setParams({});
    setPath(tb.route);
  }, []);

  const route = matchRoute(path);
  const showNav = authed && !FULLSCREEN.has(route.name);
  const statusLight = t.dark || DARK_TOP.has(route.name);
  const navLight = t.dark;

  // accent overrides
  const accentVars = {
    '--accent': t.accent,
    '--accent-soft': rgba(t.accent, t.dark ? 0.16 : 0.1),
    '--accent-press': shade(t.accent, -0.12),
    '--on-accent': onAccent(t.accent),
  };

  const screenProps = { nav, params, units, mapStyle: t.mapStyle, setUnits,
    theme, setTheme: (th) => setTweak('dark', th === 'dark') };

  let Screen = null;
  switch (route.name) {
    case 'login': Screen = <LoginScreen {...screenProps} />; break;
    case 'permissions': Screen = <PermissionsScreen {...screenProps} />; break;
    case 'home': Screen = <HomeScreen {...screenProps} />; break;
    case 'routes': Screen = <RoutesScreen {...screenProps} />; break;
    case 'create': Screen = <CreateRouteScreen {...screenProps} />; break;
    case 'routedetail': Screen = <RouteDetailScreen {...screenProps} />; break;
    case 'members': Screen = <MembersScreen {...screenProps} />; break;
    case 'leaderboard': Screen = <LeaderboardScreen {...screenProps} />; break;
    case 'live': Screen = <LiveScreen {...screenProps} />; break;
    case 'record': Screen = <RecordScreen {...screenProps} />; break;
    case 'summary': Screen = <SummaryScreen {...screenProps} />; break;
    case 'activity': Screen = <ActivityDetailScreen {...screenProps} />; break;
    case 'profile': Screen = <ProfileScreen {...screenProps} />; break;
    case 'settings': Screen = <SettingsScreen {...screenProps} />; break;
    default: Screen = <HomeScreen {...screenProps} />;
  }

  return (
    <div data-theme={theme} style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 22, padding: '28px 16px', background: 'var(--bg-2)', ...accentVars,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, opacity: .85 }}>
        <Wordmark size={20} />
        <span style={{ color: 'var(--text-3)', fontSize: 12.5, fontWeight: 600 }}>· interactive prototype</span>
      </div>

      <PhoneShell statusLight={statusLight} navLight={navLight} bg="var(--bg)">
        <div style={{ flex: 1, minHeight: 0, position: 'relative' }} key={route.name + (params.id || '')}>
          {Screen}
        </div>
        {showNav && <BottomNav tab={TAB_FOR[route.name]} onTab={onTab} />}
        <Toast msg={toast} />
      </PhoneShell>

      <TweaksPanel>
        <TweakSection label="Theme" />
        <TweakToggle label="Dark mode" value={t.dark} onChange={v => setTweak('dark', v)} />
        <TweakColor label="Accent" value={t.accent}
          options={['#FF4D2E', '#00E07A', '#5B8CFF', '#C8FF00', '#FF8A00']}
          onChange={v => setTweak('accent', v)} />
        <TweakSection label="Map" />
        <TweakRadio label="Style" value={t.mapStyle} options={['streets', 'terrain', 'minimal']}
          onChange={v => setTweak('mapStyle', v)} />
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
