/* stride-chrome.jsx — TopBar + BottomNav + Toast */

function TopBar({ title, onBack, right, sub, scrolled }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', minHeight: 56, flexShrink: 0,
      borderBottom: `1px solid ${scrolled ? 'var(--border)' : 'transparent'}`,
      background: 'var(--bg)', position: 'relative', zIndex: 10, transition: 'border-color var(--dur)',
    }}>
      {onBack && <IconBtn name="chevL" onClick={onBack} size={40} iconSize={22} />}
      <div style={{ flex: 1, minWidth: 0 }}>
        {title && <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 24, lineHeight: 1, letterSpacing: '.3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</div>}
        {sub && <div style={{ fontSize: 12.5, color: 'var(--text-3)', marginTop: 2 }}>{sub}</div>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>{right}</div>
    </div>
  );
}

const TABS = [
  { id: 'home', route: '/', icon: 'home', label: 'Home' },
  { id: 'routes', route: '/routes', icon: 'route', label: 'Routes' },
  { id: 'record', route: '/record', icon: 'play', label: 'Record', center: true },
  { id: 'profile', route: '/profile', icon: 'profile', label: 'Profile' },
];

function BottomNav({ tab, onTab }) {
  return (
    <div style={{
      flexShrink: 0, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around',
      padding: '8px 12px 12px', background: 'var(--bg)', borderTop: '1px solid var(--border)',
      position: 'relative', zIndex: 20,
    }}>
      {TABS.map(tb => {
        if (tb.center) {
          return (
            <button key={tb.id} onClick={() => onTab(tb)} style={{
              width: 60, height: 60, borderRadius: '50%', border: 'none', cursor: 'pointer', marginTop: -22,
              background: 'var(--accent)', color: 'var(--on-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 8px 24px var(--accent-soft), 0 6px 16px rgba(0,0,0,.4)',
            }}>
              <Icon name="play" size={26} fill color="#fff" stroke={0} />
            </button>
          );
        }
        const on = tab === tb.id;
        return (
          <button key={tb.id} onClick={() => onTab(tb)} style={{
            background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column',
            alignItems: 'center', gap: 4, padding: '4px 14px', color: on ? 'var(--accent)' : 'var(--text-3)',
            transition: 'color var(--dur)', flex: 1,
          }}>
            <Icon name={tb.icon} size={24} stroke={on ? 2.4 : 2} fill={false} />
            <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.3px' }}>{tb.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function Toast({ msg }) {
  if (!msg) return null;
  return (
    <div style={{
      position: 'absolute', left: '50%', bottom: 96, transform: 'translateX(-50%)', zIndex: 90,
      background: 'var(--surface-3)', color: 'var(--text)', padding: '11px 18px', borderRadius: 'var(--r-pill)',
      fontSize: 13.5, fontWeight: 600, boxShadow: 'var(--shadow)', border: '1px solid var(--border-strong)',
      maxWidth: '80%', textAlign: 'center', animation: 'strideToast .3s var(--ease-out)',
    }}>{msg}</div>
  );
}

// section header used across screens
function SectionHead({ title, action, onAction }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '4px 0 12px' }}>
      <h2 style={{ fontSize: 21, fontWeight: 700, letterSpacing: '.3px', whiteSpace: 'nowrap' }}>{title}</h2>
      {action && <button onClick={onAction} style={{ background: 'none', border: 'none', color: 'var(--accent)', fontWeight: 700, fontSize: 13.5, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 2, whiteSpace: 'nowrap', flexShrink: 0 }}>{action}<Icon name="chevR" size={15} stroke={2.4} /></button>}
    </div>
  );
}

// empty-state block
function Empty({ icon, title, sub, action, onAction }) {
  return (
    <div style={{ textAlign: 'center', padding: '28px 20px' }}>
      <div style={{ width: 56, height: 56, borderRadius: 18, background: 'var(--surface-2)', border: '1px solid var(--border)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
        <Icon name={icon} size={26} color="var(--text-3)" />
      </div>
      <div style={{ fontWeight: 700, fontSize: 17 }}>{title}</div>
      {sub && <div style={{ color: 'var(--text-2)', fontSize: 13.5, marginTop: 5, maxWidth: 240, marginInline: 'auto', lineHeight: 1.4 }}>{sub}</div>}
      {action && <div style={{ marginTop: 16 }}><Btn size="sm" variant="secondary" onClick={onAction} icon="plus">{action}</Btn></div>}
    </div>
  );
}

// chip
function Chip({ children, active, onClick, icon, onRemove }) {
  return (
    <button onClick={onClick} style={{
      display: 'inline-flex', alignItems: 'center', gap: 5, height: 34, padding: '0 13px', borderRadius: 'var(--r-pill)',
      background: active ? 'var(--accent-soft)' : 'var(--surface-2)', border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
      color: active ? 'var(--accent)' : 'var(--text-2)', fontWeight: 700, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap',
      flexShrink: 0, fontFamily: 'var(--font-body)',
    }}>
      {icon && <Icon name={icon} size={15} stroke={2.2} />}
      {children}
      {onRemove && <span onClick={e => { e.stopPropagation(); onRemove(); }} style={{ display: 'flex', marginLeft: 1 }}><Icon name="x" size={13} stroke={2.6} /></span>}
    </button>
  );
}

// GPS/connection status pill
function StatusPill({ tone = 'live', icon = 'gps', children }) {
  const map = { live: 'var(--live)', warn: 'var(--warn)', danger: 'var(--danger)', neutral: 'var(--text-2)' };
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, height: 30, padding: '0 11px', borderRadius: 'var(--r-pill)',
      background: 'rgba(0,0,0,.4)', backdropFilter: 'blur(8px)', border: '1px solid var(--border)', color: '#fff', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap',
    }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: map[tone], boxShadow: `0 0 8px ${map[tone]}` }} />
      {children}
    </div>
  );
}

Object.assign(window, { TopBar, BottomNav, TABS, Toast, SectionHead, Empty, Chip, StatusPill });

/* ---------- shared list rows / thumbnails ---------- */
function MiniMap({ path, seed, size = 56, r = 14, mapStyle, dim }) {
  return (
    <div style={{ width: size, height: size, borderRadius: r, overflow: 'hidden', position: 'relative', flexShrink: 0, border: '1px solid var(--border)' }}>
      <FauxMap seed={seed} routeD={path} mapStyle={mapStyle} dim={dim} glow={size > 80} />
    </div>
  );
}

const TYPE_TONE = { RUN: 'accent', JOG: 'info', WALK: 'live' };

function ActivityRow({ a, onClick, units = 'metric', mapStyle }) {
  return (
    <Card pad={12} interactive onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <MiniMap path={a.track} seed={a.seed} size={56} mapStyle={mapStyle} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ fontWeight: 700, fontSize: 15.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.title}</span>
          <Tag tone={TYPE_TONE[a.type]} size="sm">{a.type}</Tag>
          {!a.synced && <Tag tone="warn" size="sm" icon="refresh">Syncing</Tag>}
        </div>
        <div style={{ color: 'var(--text-3)', fontSize: 12.5, marginTop: 3 }}>{a.date}</div>
        <div style={{ display: 'flex', gap: 16, marginTop: 7 }}>
          <Metric v={fmtKm(a.dist, units)} u={distUnit(units)} />
          <Metric v={a.dur} u="time" />
          <Metric v={a.pace} u={'/' + distUnit(units)} />
        </div>
      </div>
    </Card>
  );
}

function Metric({ v, u }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
      <span className="stat-num" style={{ fontSize: 19 }}>{v}</span>
      <span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600 }}>{u}</span>
    </div>
  );
}

function RouteCard({ r, onClick, units = 'metric', mapStyle }) {
  const owner = ATHLETES[r.owner];
  const roleTone = { OWNER: 'accent', MEMBER: 'info', INVITED: 'warn' }[r.role];
  return (
    <Card pad={12} interactive onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
      <MiniMap path={r.path} seed={r.seed} size={64} mapStyle={mapStyle} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ fontWeight: 700, fontSize: 15.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</span>
          {r.liveNow > 0 && <Tag tone="live" size="sm" icon="dot">{r.liveNow} live</Tag>}
        </div>
        <div style={{ display: 'flex', gap: 14, marginTop: 6 }}>
          <Metric v={fmtKm(r.dist, units)} u={distUnit(units)} />
          <Metric v={'+' + r.elev} u="m" />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
          <Tag tone={roleTone} size="sm">{r.role}</Tag>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-3)', fontSize: 12, fontWeight: 600 }}>
            <Icon name="users" size={14} /> {r.members}
          </span>
          {!r.isPublic && <Icon name="lock" size={13} color="var(--text-3)" />}
        </div>
      </div>
      <Icon name="chevR" size={20} color="var(--text-4)" />
    </Card>
  );
}

Object.assign(window, { MiniMap, ActivityRow, Metric, RouteCard, TYPE_TONE });
