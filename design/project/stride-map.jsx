/* stride-map.jsx — procedural faux map with glowing route line. */

// deterministic RNG
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// build a procedural street network in 0..100 space
function buildStreets(seed, style) {
  const rnd = mulberry32(seed * 2654435761);
  const roads = [];
  const minor = [];
  const blobs = [];

  // a couple of soft "park"/"water" blobs
  const blobCount = style === 'minimal' ? 0 : 2;
  for (let i = 0; i < blobCount; i++) {
    const kind = i === 0 ? 'water' : (style === 'terrain' ? 'park' : (rnd() > .5 ? 'park' : 'water'));
    blobs.push({
      kind,
      cx: 8 + rnd() * 84, cy: 8 + rnd() * 84,
      rx: 14 + rnd() * 20, ry: 12 + rnd() * 16,
      rot: rnd() * 60 - 30,
    });
  }

  // major avenues (2 near-horizontal, 2 near-vertical, jittered)
  const jit = () => (rnd() - .5) * 16;
  for (let i = 0; i < 2; i++) {
    const y = 22 + i * 34 + jit();
    roads.push(`M -6 ${y + jit() * .4} L 40 ${y} L 70 ${y + jit() * .5} L 106 ${y + jit() * .4}`);
    const x = 24 + i * 38 + jit();
    roads.push(`M ${x + jit() * .4} -6 L ${x} 42 L ${x + jit() * .5} 70 L ${x + jit() * .4} 106`);
  }
  // a diagonal avenue
  roads.push(`M -6 ${10 + rnd() * 20} L 50 ${45 + jit()} L 106 ${75 + rnd() * 18}`);

  // minor grid streets
  const n = style === 'minimal' ? 5 : 11;
  for (let i = 0; i < n; i++) {
    if (rnd() > .5) {
      const y = rnd() * 100;
      minor.push(`M -6 ${y} L 106 ${y + jit() * .6}`);
    } else {
      const x = rnd() * 100;
      minor.push(`M ${x} -6 L ${x + jit() * .6} 106`);
    }
  }
  return { roads, minor, blobs };
}

function FauxMap({
  routeD, trackD, seed = 7, markers = [], style = 'streets',
  dim = false, fit, glow = true, children, mapStyle,
}) {
  const st = mapStyle || style;
  const { roads, minor, blobs } = React.useMemo(() => buildStreets(seed, st), [seed, st]);
  const fid = 'gl' + seed + st;
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: 'var(--map-bg)' }}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block',
          opacity: dim ? 0.5 : 1, transition: 'opacity var(--dur)' }}>
        <defs>
          <filter id={fid} x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="1.6" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        <rect x="0" y="0" width="100" height="100" fill="var(--map-land)" />
        {blobs.map((b, i) => (
          <ellipse key={i} cx={b.cx} cy={b.cy} rx={b.rx} ry={b.ry}
            transform={`rotate(${b.rot} ${b.cx} ${b.cy})`}
            fill={b.kind === 'water' ? 'var(--map-water)' : 'var(--map-park)'} opacity="0.9" />
        ))}
        {/* faint grid */}
        {Array.from({ length: 11 }).map((_, i) => (
          <line key={'h' + i} x1="0" y1={i * 10} x2="100" y2={i * 10} stroke="var(--map-grid)" strokeWidth="0.4" />
        ))}
        {Array.from({ length: 11 }).map((_, i) => (
          <line key={'v' + i} x1={i * 10} y1="0" x2={i * 10} y2="100" stroke="var(--map-grid)" strokeWidth="0.4" />
        ))}
        {/* minor streets */}
        {minor.map((d, i) => (
          <path key={'m' + i} d={d} stroke="var(--map-road)" strokeWidth="0.9" fill="none" strokeLinecap="round" />
        ))}
        {/* major avenues */}
        {roads.map((d, i) => (
          <path key={'r' + i} d={d} stroke="var(--map-road-major)" strokeWidth="2.2" fill="none" strokeLinecap="round" />
        ))}
        {/* planned route (under, neutral dashed) */}
        {trackD && routeD && (
          <path d={routeD} stroke="var(--text-3)" strokeWidth="1.6" fill="none"
            strokeLinecap="round" strokeLinejoin="round" strokeDasharray="3 3" opacity="0.65" />
        )}
        {/* the glowing line: route if no track, else the recorded track */}
        {(trackD || routeD) && (
          <path d={trackD || routeD} stroke="var(--accent)" strokeWidth="2.6" fill="none"
            strokeLinecap="round" strokeLinejoin="round" filter={glow ? `url(#${fid})` : undefined} />
        )}
        {(trackD || routeD) && (
          <path d={trackD || routeD} stroke="#fff" strokeWidth="0.7" fill="none"
            strokeLinecap="round" strokeLinejoin="round" opacity="0.5" />
        )}
      </svg>
      {/* markers in % space */}
      {markers.map((m, i) => <MapMarker key={i} {...m} />)}
      {children}
    </div>
  );
}

function MapMarker({ x, y, type = 'dot', color = 'var(--accent)', label, dim }) {
  const pos = { position: 'absolute', left: `${x}%`, top: `${y}%`, transform: 'translate(-50%,-50%)', zIndex: 4 };
  if (type === 'start') {
    return <div style={{ ...pos }}>
      <div style={{ width: 16, height: 16, borderRadius: '50%', background: 'var(--live)', border: '3px solid var(--bg)', boxShadow: '0 0 0 2px var(--live)' }} />
    </div>;
  }
  if (type === 'finish') {
    return <div style={{ ...pos, width: 22, height: 22, borderRadius: '50%', background: 'var(--bg)', border: '2px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Icon name="flag" size={13} color="#fff" stroke={2.4} />
    </div>;
  }
  if (type === 'me') {
    return <div style={{ ...pos }}>
      <div style={{ position: 'relative', width: 20, height: 20 }}>
        <span style={{ position: 'absolute', inset: -8, borderRadius: '50%', background: 'var(--accent)', opacity: .3, animation: 'stridePing 1.8s ease-out infinite' }} />
        <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'var(--accent)', border: '3px solid var(--bg)', boxShadow: '0 2px 8px rgba(0,0,0,.5)' }} />
      </div>
    </div>;
  }
  if (type === 'runner') {
    return <div style={{ ...pos, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, opacity: dim ? .45 : 1 }}>
      {label && <span style={{ fontSize: 10, fontWeight: 800, color: '#fff', background: color, padding: '1px 6px', borderRadius: 'var(--r-pill)', whiteSpace: 'nowrap', boxShadow: '0 2px 6px rgba(0,0,0,.4)' }}>{label}</span>}
      <span style={{ width: 16, height: 16, borderRadius: '50%', background: color, border: '2.5px solid var(--bg)', boxShadow: '0 2px 6px rgba(0,0,0,.5)' }} />
    </div>;
  }
  return <div style={{ ...pos, width: 12, height: 12, borderRadius: '50%', background: color, border: '2px solid var(--bg)' }} />;
}

Object.assign(window, { FauxMap, MapMarker, mulberry32 });
