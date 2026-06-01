/* screens-record.jsx — Record, Live Tracking, Activity Summary, Activity Detail */
const { useState, useEffect, useRef } = React;

function fmtTime(s) {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`;
}
function fmtPace(s) { const m = Math.floor(s / 60), sec = Math.round(s % 60); return `${m}:${String(sec).padStart(2, '0')}`; }

/* ---------------- RECORD ---------------- */
function RecordScreen({ nav, params, units, mapStyle }) {
  const route = params.routeId ? ROUTES.find(r => r.id === params.routeId) : null;
  const [phase, setPhase] = useState('acquiring'); // acquiring | ready | recording | paused
  const [sec, setSec] = useState(0);
  const [stopOpen, setStopOpen] = useState(false);
  const path = route ? route.path : PATHS.freeRun;
  const PATH_LEN = 240; // approx for dash animation

  useEffect(() => { const t = setTimeout(() => setPhase('ready'), 1600); return () => clearTimeout(t); }, []);
  useEffect(() => {
    if (phase !== 'recording') return;
    const t = setInterval(() => setSec(s => s + 1), 1000);
    return () => clearInterval(t);
  }, [phase]);

  // simulated distance: ~3.3 m/s
  const distKm = +(sec * 0.0033).toFixed(2);
  const paceS = distKm > 0 ? Math.round(sec / distKm) : 0;
  const reveal = Math.min(1, sec / 150); // reveal whole path over ~2.5min
  const recording = phase === 'recording';
  const paused = phase === 'paused';
  const live = recording || paused;

  // marker position along path (rough): pick along by reveal
  const mePos = posAlong(path, reveal);

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <FauxMap seed={route ? route.seed : 9} mapStyle={mapStyle}
        markers={[
          ...(route ? [{ x: 22, y: 78, type: 'start' }] : []),
          ...(route ? LIVE_RUNNERS.slice(0, 2).map(rn => ({ x: rn.x, y: rn.y, type: 'runner', color: ATHLETES[rn.athlete].color, label: ATHLETES[rn.athlete].name.split(' ')[0], dim: !rn.online })) : []),
          { x: mePos.x, y: mePos.y, type: 'me' },
        ]}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
          {route && <path d={route.path} stroke="var(--text-3)" strokeWidth="1.4" fill="none" strokeDasharray="3 3" opacity="0.6" strokeLinecap="round" />}
          {live && <path d={path} stroke="var(--accent)" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round"
            pathLength="1" strokeDasharray="1" strokeDashoffset={1 - reveal} style={{ filter: 'drop-shadow(0 0 3px var(--accent))' }} />}
        </svg>
      </FauxMap>

      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(9,10,13,.55) 0%, transparent 22%, transparent 55%, rgba(9,10,13,.85) 100%)', pointerEvents: 'none' }} />

      {/* top: close + GPS */}
      <div style={{ position: 'absolute', top: 10, left: 14, right: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 10 }}>
        {!live ? <IconBtn name="chevL" onClick={() => nav('back')} style={{ background: 'rgba(0,0,0,.45)', backdropFilter: 'blur(8px)', color: '#fff' }} /> : <span />}
        <StatusPill tone={phase === 'acquiring' ? 'warn' : 'live'} icon="gps">{phase === 'acquiring' ? 'Acquiring GPS…' : 'GPS · strong'}</StatusPill>
        <IconBtn name="locate" onClick={() => {}} style={{ background: 'rgba(0,0,0,.45)', backdropFilter: 'blur(8px)', color: '#fff' }} />
      </div>

      {/* foreground banner */}
      {live && (
        <div style={{ position: 'absolute', top: 60, left: 14, right: 14, zIndex: 9, display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(0,0,0,.5)', backdropFilter: 'blur(8px)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', padding: '8px 12px', color: 'var(--text-2)', fontSize: 11.5, fontWeight: 600 }}>
          <Icon name="bolt" size={15} color="var(--warn)" /> Screen stays on — keep Stride open while recording
        </div>
      )}

      {route && live && (
        <div style={{ position: 'absolute', top: 106, left: 14, zIndex: 9 }}>
          <Tag tone="accent" icon="route">{route.name}</Tag>
        </div>
      )}

      {/* stats + controls */}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '0 20px 22px', zIndex: 10 }}>
        {/* big stats */}
        <div style={{ textAlign: 'center', marginBottom: 22 }}>
          <div className="eyebrow" style={{ color: 'var(--accent)', marginBottom: -2 }}>{paused ? 'Paused' : recording ? 'Recording' : 'Ready'}</div>
          <div className="stat-num" style={{ fontSize: 84, letterSpacing: '1px', color: '#fff' }}>{fmtTime(sec)}</div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 36, marginTop: 6 }}>
            <div><div className="stat-num" style={{ fontSize: 38, color: '#fff' }}>{fmtKm(distKm, units)}</div><div className="eyebrow" style={{ fontSize: 9.5 }}>{distUnit(units)}</div></div>
            <div><div className="stat-num" style={{ fontSize: 38, color: '#fff' }}>{paceS ? fmtPace(paceS) : '--'}</div><div className="eyebrow" style={{ fontSize: 9.5 }}>/{distUnit(units)}</div></div>
          </div>
        </div>

        {/* controls */}
        {!live ? (
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <button disabled={phase === 'acquiring'} onClick={() => setPhase('recording')} style={{
              width: 96, height: 96, borderRadius: '50%', border: '5px solid rgba(255,255,255,.25)', cursor: phase === 'acquiring' ? 'wait' : 'pointer',
              background: 'var(--accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 12px 40px var(--accent-soft)', opacity: phase === 'acquiring' ? .5 : 1,
            }}>
              {phase === 'acquiring' ? <Spinner size={30} color="#fff" /> : <Icon name="play" size={40} fill color="#fff" stroke={0} />}
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 28 }}>
            <button onClick={() => setStopOpen(true)} style={{ width: 72, height: 72, borderRadius: '50%', border: '2px solid var(--border-strong)', background: 'var(--surface-2)', color: 'var(--danger)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="stop" size={26} fill color="var(--danger)" stroke={0} />
            </button>
            <button onClick={() => setPhase(recording ? 'paused' : 'recording')} style={{ width: 92, height: 92, borderRadius: '50%', border: 'none', background: recording ? '#fff' : 'var(--accent)', color: recording ? '#000' : '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 10px 30px rgba(0,0,0,.4)' }}>
              <Icon name={recording ? 'pause' : 'play'} size={36} fill color={recording ? '#000' : '#fff'} stroke={0} />
            </button>
            <div style={{ width: 72 }} />
          </div>
        )}
      </div>

      <Sheet open={stopOpen} onClose={() => setStopOpen(false)} title="Finish run?">
        <p style={{ color: 'var(--text-2)', fontSize: 14, lineHeight: 1.5, marginTop: -4 }}>You've covered <b style={{ color: 'var(--text)' }}>{fmtKm(distKm, units)} {distUnit(units)}</b> in {fmtTime(sec)}. Save it to your activities?</p>
        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Btn full size="lg" icon="check" onClick={() => nav('/record/summary', { sec, distKm, routeId: params.routeId, replace: true })}>Finish & review</Btn>
          <Btn full variant="quiet" onClick={() => setStopOpen(false)}>Keep running</Btn>
        </div>
      </Sheet>
    </div>
  );
}

// rough position along a path string by t (0..1) using its M/C/L numbers
function posAlong(d, t) {
  const nums = (d.match(/-?\d+\.?\d*/g) || []).map(Number);
  const pts = [];
  for (let i = 0; i + 1 < nums.length; i += 2) pts.push({ x: nums[i], y: nums[i + 1] });
  if (!pts.length) return { x: 50, y: 50 };
  const idx = Math.min(pts.length - 1, Math.floor(t * (pts.length - 1)));
  return pts[idx];
}

/* ---------------- LIVE TRACKING ---------------- */
function LiveScreen({ nav, params, units, mapStyle }) {
  const r = ROUTES.find(x => x.id === params.id) || ROUTES[0];
  const [expanded, setExpanded] = useState(false);
  const [selected, setSelected] = useState(null);
  const runners = [...LIVE_RUNNERS].sort((a, b) => b.progress - a.progress);

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <FauxMap seed={r.seed} routeD={r.path} mapStyle={mapStyle}
        markers={[{ x: 22, y: 78, type: 'start' }, ...runners.map(rn => ({ x: rn.x, y: rn.y, type: 'runner', color: ATHLETES[rn.athlete].color, label: ATHLETES[rn.athlete].name.split(' ')[0], dim: !rn.online }))]} />
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(9,10,13,.55) 0%, transparent 20%, transparent 60%, var(--bg) 100%)', pointerEvents: 'none' }} />

      <div style={{ position: 'absolute', top: 10, left: 14, right: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 10 }}>
        <IconBtn name="chevL" onClick={() => nav('back')} style={{ background: 'rgba(0,0,0,.45)', backdropFilter: 'blur(8px)', color: '#fff' }} />
        <StatusPill tone="live" icon="dot">Live · {runners.filter(r => r.online).length} running</StatusPill>
        <IconBtn name="map" onClick={() => {}} style={{ background: 'rgba(0,0,0,.45)', backdropFilter: 'blur(8px)', color: '#fff' }} />
      </div>

      <div style={{ position: 'absolute', top: 60, left: 14, zIndex: 9 }}>
        <div style={{ background: 'rgba(0,0,0,.5)', backdropFilter: 'blur(8px)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', padding: '8px 12px' }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#fff' }}>{r.name}</div>
          <div style={{ fontSize: 12, color: 'var(--text-2)' }}>{fmtKm(r.dist, units)} {distUnit(units)} loop</div>
        </div>
      </div>

      {/* roster sheet */}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, background: 'var(--surface)', borderRadius: '24px 24px 0 0', borderTop: '1px solid var(--border)', zIndex: 20, boxShadow: 'var(--shadow-lg)', maxHeight: '64%', display: 'flex', flexDirection: 'column' }}>
        <div onClick={() => setExpanded(e => !e)} style={{ padding: '10px 0 4px', display: 'flex', justifyContent: 'center', cursor: 'pointer' }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--border-strong)' }} />
        </div>
        <div style={{ padding: '4px 20px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: 20 }}>Running now</h3>
          <Tag tone="live" icon="dot">{runners.length}</Tag>
        </div>
        <div style={{ overflow: 'auto', padding: '0 20px', flex: 1 }}>
          {runners.map((rn, i) => {
            const a = ATHLETES[rn.athlete];
            return (
              <Row key={i} onClick={() => setSelected(rn.athlete)} gap={12} pad="11px 0" style={{ borderBottom: '1px solid var(--border)', opacity: rn.online ? 1 : 0.55 }}>
                <div style={{ position: 'relative' }}>
                  <Avatar name={a.name} color={a.color} size={42} ring={selected === rn.athlete ? 'var(--accent)' : undefined} />
                  <span style={{ position: 'absolute', bottom: 0, right: 0, width: 12, height: 12, borderRadius: '50%', background: rn.online ? 'var(--live)' : 'var(--text-4)', border: '2px solid var(--surface)' }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14.5 }}>{a.name}{!rn.online && <span style={{ color: 'var(--text-3)', fontWeight: 500 }}> · paused</span>}</div>
                  <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
                    <Metric v={fmtKm(rn.dist, units)} u={distUnit(units)} />
                    <Metric v={rn.elapsed} u="time" />
                    <Metric v={rn.pace} u={'/' + distUnit(units)} />
                  </div>
                </div>
              </Row>
            );
          })}
          <div style={{ padding: '14px 0 18px', display: 'flex', gap: 10 }}>
            <Btn full variant="secondary" icon="target" onClick={() => {}}>Fit all</Btn>
            <Btn full icon="play" onClick={() => nav('/record', { routeId: r.id })}>Run this route</Btn>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- ACTIVITY SUMMARY ---------------- */
function SummaryScreen({ nav, params, units, mapStyle }) {
  const route = params.routeId ? ROUTES.find(r => r.id === params.routeId) : null;
  const sec = params.sec || 2538;
  const distKm = params.distKm || 8.42;
  const [title, setTitle] = useState(new Date().getHours() < 12 ? 'Morning Run' : 'Evening Run');
  const [type, setType] = useState('RUN');
  const [saving, setSaving] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const paceS = Math.round(sec / distKm);
  const trackD = route ? route.path : PATHS.freeRun;
  const splits = ACTIVITIES[0].splits;

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
      <div style={{ position: 'relative', height: 220, flexShrink: 0 }}>
        <FauxMap seed={route ? route.seed : 9} trackD={trackD} mapStyle={mapStyle}
          markers={[{ x: 22, y: 78, type: 'start' }, { x: 56, y: 70, type: 'finish' }]} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, transparent 50%, var(--bg) 100%)' }} />
        <div style={{ position: 'absolute', top: 10, left: 14, zIndex: 6 }}>
          <Tag tone="live" icon="checkCircle">Run complete</Tag>
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '0 20px 110px', marginTop: -6 }}>
        {/* editable title */}
        <Field value={title} onChange={setTitle} icon="edit" />
        <Segmented style={{ marginTop: 12 }} options={['RUN', 'JOG', 'WALK']} value={type} onChange={setType} />

        {/* headline stats */}
        <Card pad={18} style={{ marginTop: 16 }}>
          <Row style={{ justifyContent: 'space-around' }}>
            <StatBlock value={fmtKm(distKm, units)} unit={distUnit(units)} label="Distance" size="sm" />
            <StatBlock value={fmtTime(sec)} label="Time" size="sm" />
            <StatBlock value={fmtPace(paceS)} unit={'/' + distUnit(units)} label="Avg pace" size="sm" accent />
          </Row>
        </Card>

        {/* leaderboard result */}
        {route && (
          <Card pad={14} style={{ marginTop: 14, background: 'var(--accent-soft)', borderColor: 'var(--accent)' }}>
            <Row gap={12}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon name="trophy" size={24} color="#fff" /></div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>4th on {route.name}</div>
                <div style={{ fontSize: 12.5, color: 'var(--text-2)' }}>Saves your effort to the leaderboard</div>
              </div>
              <Tag tone="accent">Pending</Tag>
            </Row>
          </Card>
        )}

        {/* splits */}
        <div style={{ marginTop: 20 }}>
          <div className="eyebrow" style={{ marginBottom: 10 }}>Splits · per {distUnit(units)}</div>
          <SplitsList splits={splits} units={units} />
        </div>

        <div style={{ marginTop: 20 }}>
          <div className="eyebrow" style={{ marginBottom: 8 }}>Elevation</div>
          <Card pad={14}><ElevationChart seed={route ? route.seed : 9} h={64} /></Card>
        </div>
      </div>

      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '14px 20px 18px', background: 'linear-gradient(180deg, transparent, var(--bg) 30%)', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Btn full size="lg" icon="check" loading={saving} onClick={() => { setSaving(true); setTimeout(() => nav('/activities/a1', { replace: true }), 1100); }}>Save activity</Btn>
        <Btn full variant="quiet" onClick={() => setDiscardOpen(true)}>Discard</Btn>
      </div>

      <Sheet open={discardOpen} onClose={() => setDiscardOpen(false)} title="Discard this run?">
        <p style={{ color: 'var(--text-2)', fontSize: 14, lineHeight: 1.5, marginTop: -4 }}>This can't be undone. Your {fmtKm(distKm, units)} {distUnit(units)} run won't be saved.</p>
        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Btn full size="lg" variant="danger" icon="trash" onClick={() => nav('/', { replace: true })}>Discard run</Btn>
          <Btn full variant="quiet" onClick={() => setDiscardOpen(false)}>Keep it</Btn>
        </div>
      </Sheet>
    </div>
  );
}

function SplitsList({ splits, units }) {
  const max = Math.max(...splits.map(s => s[2]));
  const fastest = splits.reduce((best, s, i) => s[2] > splits[best][2] ? i : best, 0);
  return (
    <Card pad={0}>
      {splits.map((s, i) => {
        const partial = String(s[0]).includes('.');
        return (
          <Row key={i} gap={12} pad="10px 14px" style={{ borderBottom: i === splits.length - 1 ? 'none' : '1px solid var(--border)' }}>
            <span className="stat-num" style={{ fontSize: 18, width: 30, color: partial ? 'var(--text-3)' : 'var(--text)' }}>{s[0]}</span>
            <div style={{ flex: 1, height: 8, borderRadius: 4, background: 'var(--surface-2)', overflow: 'hidden' }}>
              <div style={{ width: (s[2] / max * 100) + '%', height: '100%', borderRadius: 4, background: i === fastest ? 'var(--live)' : 'var(--accent)' }} />
            </div>
            {i === fastest && <Icon name="bolt" size={15} color="var(--live)" fill />}
            <span className="stat-num" style={{ fontSize: 18, width: 50, textAlign: 'right' }}>{s[1]}</span>
          </Row>
        );
      })}
    </Card>
  );
}

/* ---------------- ACTIVITY DETAIL ---------------- */
function ActivityDetailScreen({ nav, params, units, mapStyle }) {
  const a = ACTIVITIES.find(x => x.id === params.id) || ACTIVITIES[0];
  const route = a.routeId ? ROUTES.find(r => r.id === a.routeId) : null;
  const [delOpen, setDelOpen] = useState(false);

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
      <div style={{ position: 'relative', height: 280, flexShrink: 0 }}>
        <FauxMap seed={a.seed} routeD={a.route} trackD={a.track} mapStyle={mapStyle}
          markers={[{ x: 22, y: 78, type: 'start' }, { x: 56, y: 70, type: 'finish' }]} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(9,10,13,.5) 0%, transparent 25%, transparent 65%, var(--bg) 100%)' }} />
        <div style={{ position: 'absolute', top: 10, left: 14, right: 14, display: 'flex', justifyContent: 'space-between', zIndex: 6 }}>
          <IconBtn name="chevL" onClick={() => nav('back')} style={{ background: 'rgba(0,0,0,.45)', backdropFilter: 'blur(8px)', color: '#fff' }} />
          <div style={{ display: 'flex', gap: 8 }}>
            <IconBtn name="share" onClick={() => nav('__toast', { msg: 'Sharing summary card' })} style={{ background: 'rgba(0,0,0,.45)', backdropFilter: 'blur(8px)', color: '#fff' }} />
            <IconBtn name="trash" onClick={() => setDelOpen(true)} style={{ background: 'rgba(0,0,0,.45)', backdropFilter: 'blur(8px)', color: '#fff' }} />
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '0 20px 24px', marginTop: -8 }}>
        <Row gap={8} style={{ marginBottom: 6 }}>
          <Tag tone={TYPE_TONE[a.type]}>{a.type}</Tag>
          {a.pr && <Tag tone="accent" icon="trophy">PR</Tag>}
          {!a.synced && <Tag tone="warn" icon="refresh">Syncing</Tag>}
        </Row>
        <h1 style={{ fontSize: 32, lineHeight: 1, fontWeight: 700 }}>{a.title}</h1>
        <div style={{ color: 'var(--text-3)', fontSize: 13.5, marginTop: 6 }}>{a.date}</div>

        {/* stats grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 18 }}>
          {[
            [fmtKm(a.dist, units), distUnit(units), 'Distance', 'ruler'],
            [a.dur, '', 'Time', 'clock'],
            [a.pace, '/' + distUnit(units), 'Avg pace', 'gauge'],
            ['+' + a.elev, 'm', 'Elevation', 'mountain'],
          ].map(s => (
            <Card key={s[2]} pad={14}>
              <Row gap={6} style={{ color: 'var(--text-3)', marginBottom: 6 }}><Icon name={s[3]} size={15} /><span className="eyebrow" style={{ fontSize: 10 }}>{s[2]}</span></Row>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}><span className="stat-num" style={{ fontSize: 30 }}>{s[0]}</span><span style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 700 }}>{s[1]}</span></div>
            </Card>
          ))}
        </div>

        {/* leaderboard placement */}
        {route && a.rank && (
          <Card pad={14} interactive onClick={() => nav('/routes/' + route.id + '/leaderboard')} style={{ marginTop: 14 }}>
            <Row gap={12}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: a.pr ? 'var(--accent)' : 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon name="trophy" size={22} color={a.pr ? '#fff' : 'var(--text-2)'} /></div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{ordinal(a.rank)} of {a.of} on {route.name}</div>
                <div style={{ fontSize: 12.5, color: 'var(--text-2)' }}>{a.pr ? 'New personal best' : 'View segment leaderboard'}</div>
              </div>
              <Icon name="chevR" size={20} color="var(--text-4)" />
            </Row>
          </Card>
        )}

        {/* splits */}
        <div style={{ marginTop: 20 }}>
          <div className="eyebrow" style={{ marginBottom: 10 }}>Splits · per {distUnit(units)}</div>
          <SplitsList splits={a.splits} units={units} />
        </div>

        {/* elevation */}
        <div style={{ marginTop: 20 }}>
          <div className="eyebrow" style={{ marginBottom: 8 }}>Elevation profile</div>
          <Card pad={14}><ElevationChart seed={a.seed} h={70} /></Card>
        </div>

        {route && (
          <Card pad={13} interactive onClick={() => nav('/routes/' + route.id)} style={{ marginTop: 14 }}>
            <Row gap={12}>
              <MiniMap path={route.path} seed={route.seed} size={44} mapStyle={mapStyle} />
              <div style={{ flex: 1 }}><div className="eyebrow" style={{ fontSize: 9.5 }}>On route</div><div style={{ fontWeight: 700, fontSize: 15 }}>{route.name}</div></div>
              <Icon name="chevR" size={20} color="var(--text-4)" />
            </Row>
          </Card>
        )}
      </div>

      <Sheet open={delOpen} onClose={() => setDelOpen(false)} title="Delete activity?">
        <p style={{ color: 'var(--text-2)', fontSize: 14, lineHeight: 1.5, marginTop: -4 }}>This permanently deletes "{a.title}" and its GPS track. This can't be undone.</p>
        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Btn full size="lg" variant="danger" icon="trash" onClick={() => nav('/', { replace: true })}>Delete</Btn>
          <Btn full variant="quiet" onClick={() => setDelOpen(false)}>Cancel</Btn>
        </div>
      </Sheet>
    </div>
  );
}

function ordinal(n) { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); }

Object.assign(window, { RecordScreen, LiveScreen, SummaryScreen, ActivityDetailScreen, SplitsList, fmtTime, fmtPace, ordinal });
