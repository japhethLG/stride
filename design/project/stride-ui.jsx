/* stride-ui.jsx — icons, primitives, phone shell. Globals via window. */

const { useState, useEffect, useRef, useCallback } = React;

/* ============================ ICONS ============================ */
const ICON_PATHS = {
  home:    'M3 10.8 12 4l9 6.8M5.5 9.4V20h13V9.4',
  route:   'M6.5 19a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM17.5 9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM6.5 14V12a4 4 0 0 1 4-4h3a4 4 0 0 0 4-4',
  profile: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM5 20c0-3.3 3.1-5 7-5s7 1.7 7 5',
  play:    'M7 5.5v13l11-6.5-11-6.5Z',
  pause:   'M8 5.5v13M16 5.5v13',
  stop:    'M6.5 6.5h11v11h-11z',
  target:  'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM12 2v3M12 19v3M22 12h-3M5 12H2',
  locate:  'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM12 2v3M12 19v3M22 12h-3M5 12H2',
  chevL:   'M15 5l-7 7 7 7',
  chevR:   'M9 5l7 7-7 7',
  chevD:   'M5 9l7 7 7-7',
  chevU:   'M5 15l7-7 7 7',
  arrowUR: 'M7 17 17 7M9 7h8v8',
  plus:    'M12 5v14M5 12h14',
  search:  'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM20 20l-4-4',
  filter:  'M3 5h18M6 12h12M10 19h4',
  sort:    'M7 4v16M7 20l-3-3M7 4l3 3M17 20V4M17 4l-3 3M17 4l3 3',
  more:    'M12 6h.01M12 12h.01M12 18h.01',
  share:   'M14 9l4-4m0 0h-4m4 0v4M20 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5',
  bell:    'M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6M10 20a2 2 0 0 0 4 0',
  mail:    'M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7ZM3.5 7.5l8.5 6 8.5-6',
  settings:'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM19 12a7 7 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2-1.2l-.4-2.6H10.9l-.4 2.6a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6A7 7 0 0 0 5 12a7 7 0 0 0 .1 1.2l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 2 1.2l.4 2.6h3.2l.4-2.6a7 7 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6A7 7 0 0 0 19 12Z',
  signout: 'M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M11 16l4-4-4-4M15 12H4',
  check:   'M5 12.5 10 17.5 19.5 7',
  checkCircle: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM8.5 12l2.5 2.5L15.5 9',
  x:       'M6 6l12 12M18 6 6 18',
  xCircle: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM9 9l6 6M15 9l-6 6',
  trophy:  'M7 4h10v4a5 5 0 0 1-10 0V4ZM7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3M9 14h6M10 14l-.5 4M14 14l.5 4M8 20h8',
  medal:   'M12 14a5 5 0 1 0 0-10 5 5 0 0 0 0 10ZM12 14v7l-3-2-3 2M12 14l3 7 3-2 3 2',
  flag:    'M6 21V4M6 4h11l-2 4 2 4H6',
  mountain:'M3 19h18L14 7l-3 5-2-3-6 10Z',
  clock:   'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7v5l3 2',
  gauge:   'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 12l4-3M12 12a1.5 1.5 0 1 0 0 3',
  ruler:   'M4 8l12-4 4 12-12 4L4 8ZM8 8l1 2M11 7l1.5 3M14 6l1 2',
  users:   'M9 12a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM3 20c0-3 2.7-4.5 6-4.5s6 1.5 6 4.5M16 5.5a3.5 3.5 0 0 1 0 7M18 15.5c2 .6 3 1.9 3 4.5',
  crown:   'M4 18h16M4 18l-1.5-9 5 4L12 5l4.5 8 5-4L20 18',
  bolt:    'M13 3 4 14h6l-1 7 9-11h-6l1-7Z',
  google:  '',
  eye:     'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z',
  gps:     'M12 13a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM5 5l3.5 3.5M19 5l-3.5 3.5M5 19l3.5-3.5M19 19l-3.5-3.5M12 2v2M12 20v2M2 12h2M20 12h2',
  refresh: 'M20 11a8 8 0 1 0-1.5 5.5M20 6v5h-5',
  edit:    'M4 20h4L19 9l-4-4L4 16v4ZM14 6l4 4',
  trash:   'M5 7h14M9 7V4h6v3M6 7l1 13h10l1-13',
  camera:  'M3 8a2 2 0 0 1 2-2h2l1.5-2h7L19 6h0a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8ZM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z',
  lock:    'M6 11V8a6 6 0 0 1 12 0v3M5 11h14v9H5z',
  calendar:'M4 6h16v15H4zM4 10h16M8 3v4M16 3v4',
  heart:   'M12 20S4 14.5 4 9a4 4 0 0 1 8-1 4 4 0 0 1 8 1c0 5.5-8 11-8 11Z',
  map:     'M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2ZM9 4v14M15 6v14',
  wifi:    'M2 9a14 14 0 0 1 20 0M5 12.5a9 9 0 0 1 14 0M8.5 16a4 4 0 0 1 7 0M12 20h.01',
  signal:  'M3 17h3v3H3zM9 12h3v8H9zM15 8h3v12h-3z',
  shoe:    'M3 16v-4l3-1 2-4 4 3 6 1c2 .4 3 1.6 3 3v2H3ZM3 14h18',
  sparkle: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z',
  info:    'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 11v5M12 8h.01',
  warning: 'M12 4 2 20h20L12 4ZM12 10v4M12 17h.01',
  star:    'M12 4l2.4 5 5.6.8-4 3.9 1 5.5L12 16.6 7 19.2l1-5.5-4-3.9 5.6-.8L12 4Z',
  dot:     '',
};

function Icon({ name, size = 22, color = 'currentColor', stroke = 2, fill = false, style }) {
  if (name === 'google') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" style={style} aria-hidden="true">
        <path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.3Z"/>
        <path fill="#34A853" d="M12 22c2.7 0 5-.9 6.6-2.5l-3.2-2.5c-.9.6-2 .9-3.4.9-2.6 0-4.8-1.7-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22Z"/>
        <path fill="#FBBC05" d="M6.4 13.8a6 6 0 0 1 0-3.6V7.6H3.1a10 10 0 0 0 0 8.8l3.3-2.6Z"/>
        <path fill="#EA4335" d="M12 6.2c1.5 0 2.8.5 3.8 1.5l2.8-2.8A10 10 0 0 0 3.1 7.6l3.3 2.6C7.2 7.9 9.4 6.2 12 6.2Z"/>
      </svg>
    );
  }
  if (name === 'dot') {
    return <svg width={size} height={size} viewBox="0 0 24 24" style={style}><circle cx="12" cy="12" r="5" fill={color}/></svg>;
  }
  const d = ICON_PATHS[name] || '';
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style} aria-hidden="true">
      <path d={d} stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round"
        fill={fill ? color : 'none'} />
    </svg>
  );
}

/* ============================ PRIMITIVES ============================ */
function Btn({ children, variant = 'primary', size = 'md', icon, full, onClick, disabled, loading, style }) {
  const sizes = {
    sm: { h: 38, px: 14, fs: 14 },
    md: { h: 50, px: 20, fs: 16 },
    lg: { h: 58, px: 24, fs: 18 },
  }[size];
  const variants = {
    primary: { background: 'var(--accent)', color: 'var(--on-accent)', border: 'none' },
    solidLive: { background: 'var(--live)', color: '#04130C', border: 'none' },
    secondary: { background: 'var(--surface-3)', color: 'var(--text)', border: '1px solid var(--border)' },
    ghost: { background: 'transparent', color: 'var(--text)', border: '1px solid var(--border-strong)' },
    danger: { background: 'var(--danger-soft)', color: 'var(--danger)', border: '1px solid transparent' },
    quiet: { background: 'transparent', color: 'var(--text-2)', border: 'none' },
  }[variant];
  return (
    <button onClick={disabled || loading ? undefined : onClick} disabled={disabled || loading}
      style={{
        height: sizes.h, padding: `0 ${sizes.px}px`, fontSize: sizes.fs, fontWeight: 700,
        fontFamily: 'var(--font-body)', borderRadius: 'var(--r-pill)', cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 9,
        width: full ? '100%' : 'auto', opacity: disabled ? 0.45 : 1, whiteSpace: 'nowrap',
        transition: 'transform .12s var(--ease), filter var(--dur)', letterSpacing: '.2px',
        ...variants, ...style,
      }}
      onMouseDown={e => !disabled && (e.currentTarget.style.transform = 'scale(.97)')}
      onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
      onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}>
      {loading ? <Spinner color={variants.color} /> : (icon && <Icon name={icon} size={sizes.fs + 3} stroke={2.2} />)}
      {children}
    </button>
  );
}

function IconBtn({ name, onClick, size = 40, iconSize = 21, active, style, color, badge }) {
  return (
    <button onClick={onClick} style={{
      width: size, height: size, borderRadius: 'var(--r-pill)', position: 'relative',
      background: active ? 'var(--accent-soft)' : 'var(--surface-2)',
      border: '1px solid var(--border)', color: color || (active ? 'var(--accent)' : 'var(--text)'),
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
      transition: 'background var(--dur)', flexShrink: 0, ...style,
    }}>
      <Icon name={name} size={iconSize} stroke={2} />
      {badge ? <span style={{
        position: 'absolute', top: -2, right: -2, minWidth: 16, height: 16, padding: '0 4px',
        borderRadius: 8, background: 'var(--accent)', color: '#fff', fontSize: 10, fontWeight: 800,
        display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--bg)',
      }}>{badge}</span> : null}
    </button>
  );
}

function Spinner({ size = 18, color = 'currentColor' }) {
  return (
    <span style={{
      width: size, height: size, borderRadius: '50%', display: 'inline-block',
      border: `2.5px solid ${color}`, borderTopColor: 'transparent', opacity: .9,
      animation: 'strideSpin .7s linear infinite',
    }} />
  );
}

function Tag({ children, tone = 'neutral', size = 'md', icon, style }) {
  const tones = {
    neutral: { bg: 'var(--surface-3)', fg: 'var(--text-2)' },
    accent:  { bg: 'var(--accent-soft)', fg: 'var(--accent)' },
    live:    { bg: 'var(--live-soft)', fg: 'var(--live)' },
    warn:    { bg: 'var(--warn-soft)', fg: 'var(--warn)' },
    danger:  { bg: 'var(--danger-soft)', fg: 'var(--danger)' },
    info:    { bg: 'var(--info-soft)', fg: 'var(--info)' },
  }[tone];
  const fs = size === 'sm' ? 10.5 : 11.5;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4, background: tones.bg, color: tones.fg,
      padding: size === 'sm' ? '2px 7px' : '3px 9px', borderRadius: 'var(--r-pill)',
      fontSize: fs, fontWeight: 700, letterSpacing: '.4px', textTransform: 'uppercase',
      lineHeight: 1.4, ...style,
    }}>
      {icon && <Icon name={icon} size={fs + 2} stroke={2.4} />}
      {children}
    </span>
  );
}

function Avatar({ name, src, size = 40, color, ring }) {
  const initials = (name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  const colors = ['#FF4D2E', '#5B8CFF', '#00E07A', '#FFB020', '#C879FF', '#FF6FB5', '#21D4C4'];
  const bg = color || colors[(name || '').charCodeAt(0) % colors.length] || colors[0];
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0, overflow: 'hidden',
      background: src ? `center/cover url(${src})` : bg, color: '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: size * 0.4,
      boxShadow: ring ? `0 0 0 2px var(--bg), 0 0 0 4px ${ring}` : 'none',
    }}>
      {!src && initials}
    </div>
  );
}

function Card({ children, pad = 16, onClick, style, interactive }) {
  return (
    <div onClick={onClick} className={interactive ? 'strideCard' : ''} style={{
      background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r)',
      padding: pad, cursor: onClick ? 'pointer' : 'default', transition: 'transform .12s var(--ease), background var(--dur)',
      ...style,
    }}>
      {children}
    </div>
  );
}

function StatBlock({ value, unit, label, accent, size = 'md', align = 'center' }) {
  const fs = { sm: 34, md: 52, lg: 88, xl: 120 }[size];
  return (
    <div style={{ textAlign: align, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, justifyContent: align === 'center' ? 'center' : 'flex-start' }}>
        <span className="stat-num" style={{ fontSize: fs, color: accent ? 'var(--accent)' : 'var(--text)' }}>{value}</span>
        {unit && <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: fs * 0.32, color: 'var(--text-3)' }}>{unit}</span>}
      </div>
      {label && <div className="eyebrow" style={{ marginTop: 4 }}>{label}</div>}
    </div>
  );
}

function Segmented({ options, value, onChange, style }) {
  return (
    <div style={{
      display: 'flex', background: 'var(--surface-2)', borderRadius: 'var(--r-pill)', padding: 4,
      border: '1px solid var(--border)', gap: 2, ...style,
    }}>
      {options.map(opt => {
        const v = typeof opt === 'string' ? opt : opt.value;
        const label = typeof opt === 'string' ? opt : opt.label;
        const on = v === value;
        return (
          <button key={v} onClick={() => onChange(v)} style={{
            flex: 1, height: 34, border: 'none', borderRadius: 'var(--r-pill)', cursor: 'pointer',
            background: on ? 'var(--accent)' : 'transparent', color: on ? 'var(--on-accent)' : 'var(--text-2)',
            fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 13, letterSpacing: '.3px',
            transition: 'background var(--dur), color var(--dur)', whiteSpace: 'nowrap', padding: '0 8px',
          }}>{label}</button>
        );
      })}
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', placeholder, icon, trailing, error, onFocus, autoFocus, inputMode }) {
  const [focus, setFocus] = useState(false);
  return (
    <div>
      {label && <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-2)', marginBottom: 7 }}>{label}</div>}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, height: 52, padding: '0 14px',
        background: 'var(--surface-2)', borderRadius: 'var(--r-sm)',
        border: `1.5px solid ${error ? 'var(--danger)' : focus ? 'var(--accent)' : 'var(--border)'}`,
        transition: 'border-color var(--dur)',
      }}>
        {icon && <Icon name={icon} size={19} color="var(--text-3)" />}
        <input value={value} onChange={e => onChange && onChange(e.target.value)} type={type}
          placeholder={placeholder} autoFocus={autoFocus} inputMode={inputMode}
          onFocus={() => { setFocus(true); onFocus && onFocus(); }} onBlur={() => setFocus(false)}
          style={{
            flex: 1, minWidth: 0, background: 'none', border: 'none', outline: 'none', color: 'var(--text)',
            fontFamily: 'var(--font-body)', fontSize: 16, fontWeight: 500,
          }} />
        {trailing}
      </div>
      {error && <div style={{ fontSize: 12.5, color: 'var(--danger)', marginTop: 6, fontWeight: 500 }}>{error}</div>}
    </div>
  );
}

function Toggle({ value, onChange }) {
  return (
    <button onClick={() => onChange(!value)} style={{
      width: 48, height: 28, borderRadius: 'var(--r-pill)', border: 'none', cursor: 'pointer', flexShrink: 0,
      background: value ? 'var(--accent)' : 'var(--surface-3)', position: 'relative', transition: 'background var(--dur)',
    }}>
      <span style={{
        position: 'absolute', top: 3, left: value ? 23 : 3, width: 22, height: 22, borderRadius: '50%',
        background: '#fff', transition: 'left var(--dur) var(--ease)', boxShadow: '0 1px 3px rgba(0,0,0,.3)',
      }} />
    </button>
  );
}

function Skeleton({ w = '100%', h = 16, r = 8, style }) {
  return <div style={{ width: w, height: h, borderRadius: r, background: 'var(--surface-3)', animation: 'stridePulse 1.4s ease-in-out infinite', ...style }} />;
}

function Row({ children, onClick, style, gap = 12, pad }) {
  return (
    <div onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap, padding: pad, cursor: onClick ? 'pointer' : 'default', ...style,
    }}>{children}</div>
  );
}

function Sheet({ open, onClose, children, title, height }) {
  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 60, pointerEvents: open ? 'auto' : 'none',
    }}>
      <div onClick={onClose} style={{
        position: 'absolute', inset: 0, background: 'rgba(0,0,0,.55)', opacity: open ? 1 : 0,
        transition: 'opacity var(--dur)',
      }} />
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '88%', height,
        background: 'var(--surface)', borderRadius: '24px 24px 0 0', border: '1px solid var(--border)',
        transform: open ? 'translateY(0)' : 'translateY(110%)', transition: 'transform .34s var(--ease-out)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        <div style={{ padding: '12px 0 4px', display: 'flex', justifyContent: 'center' }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--border-strong)' }} />
        </div>
        {title && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 20px 12px' }}>
            <h3 style={{ fontSize: 22 }}>{title}</h3>
            <IconBtn name="x" onClick={onClose} size={34} iconSize={18} />
          </div>
        )}
        <div style={{ overflow: 'auto', padding: '0 20px 24px', flex: 1 }}>{children}</div>
      </div>
    </div>
  );
}

/* ============================ PHONE SHELL ============================ */
function StatusBar({ light }) {
  const c = light ? '#fff' : 'var(--text)';
  return (
    <div style={{
      height: 36, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 20px', position: 'relative', flexShrink: 0, zIndex: 5,
    }}>
      <span style={{ fontSize: 14, fontWeight: 700, color: c, fontFamily: 'var(--font-body)', letterSpacing: '.3px' }}>9:41</span>
      <div style={{
        position: 'absolute', left: '50%', top: 10, transform: 'translateX(-50%)',
        width: 20, height: 20, borderRadius: 100, background: '#000',
      }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: c }}>
        <Icon name="signal" size={14} fill color={c} stroke={0} />
        <Icon name="wifi" size={15} stroke={1.8} color={c} />
        <svg width="22" height="13" viewBox="0 0 24 14"><rect x="1" y="1" width="20" height="12" rx="3" fill="none" stroke={c} strokeWidth="1.5" opacity=".5"/><rect x="3" y="3" width="14" height="8" rx="1.5" fill={c}/><rect x="22" y="4.5" width="2" height="5" rx="1" fill={c} opacity=".5"/></svg>
      </div>
    </div>
  );
}

function NavPill({ light }) {
  return (
    <div style={{ height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, zIndex: 5 }}>
      <div style={{ width: 128, height: 5, borderRadius: 3, background: light ? '#fff' : 'var(--text)', opacity: .35 }} />
    </div>
  );
}

function PhoneShell({ children, statusLight, navLight, bg = 'var(--bg)' }) {
  return (
    <div style={{
      width: 396, height: 858, borderRadius: 46, padding: 5, background: '#000',
      boxShadow: '0 40px 90px rgba(0,0,0,.55), inset 0 0 2px rgba(255,255,255,.2)', flexShrink: 0,
    }}>
      <div className="stride" style={{
        width: '100%', height: '100%', borderRadius: 41, overflow: 'hidden', position: 'relative',
        background: bg, display: 'flex', flexDirection: 'column',
      }}>
        <StatusBar light={statusLight} />
        <div style={{ flex: 1, minHeight: 0, position: 'relative', display: 'flex', flexDirection: 'column' }}>
          {children}
        </div>
        <NavPill light={navLight} />
      </div>
    </div>
  );
}

/* ============================ BRAND ============================ */
function StrideMark({ size = 28, color = 'var(--accent)' }) {
  // forward-leaning chevron stack — motion / stride glyph
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path d="M6 22 L15 22 L19 14" stroke={color} strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M11 26 L22 26 L27 16 L21 6" stroke={color} strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" opacity="0.55" />
    </svg>
  );
}

function Wordmark({ size = 30, color = 'var(--text)', accent = 'var(--accent)' }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: size * 0.28 }}>
      <StrideMark size={size * 1.05} color={accent} />
      <span style={{
        fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: size, letterSpacing: '1.5px',
        color, lineHeight: 1, textTransform: 'uppercase',
      }}>Stride</span>
    </span>
  );
}

Object.assign(window, {
  Icon, Btn, IconBtn, Spinner, Tag, Avatar, Card, StatBlock, Segmented, Field, Toggle,
  Skeleton, Row, Sheet, StatusBar, NavPill, PhoneShell, StrideMark, Wordmark,
});
