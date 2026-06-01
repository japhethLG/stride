/* screens-routes.jsx — Routes List, Create Route, Route Detail, Members, Leaderboard */
const { useState, useEffect, useRef } = React;

/* ---------------- ROUTES LIST ---------------- */
function RoutesScreen({ nav, units, mapStyle }) {
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState('updated');
  const [invites, setInvites] = useState(ROUTES.filter(r => r.role === 'INVITED'));
  const [sortOpen, setSortOpen] = useState(false);

  let list = ROUTES.filter(r => r.role !== 'INVITED');
  if (filter === 'mine') list = list.filter(r => r.role === 'OWNER');
  if (filter === 'shared') list = list.filter(r => r.role === 'MEMBER');
  if (q) list = list.filter(r => r.name.toLowerCase().includes(q.toLowerCase()));
  if (sort === 'name') list = [...list].sort((a, b) => a.name.localeCompare(b.name));
  if (sort === 'distance') list = [...list].sort((a, b) => b.dist - a.dist);

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
      <TopBar title="Routes" sub={`${ROUTES.length - invites.length} routes`} right={<IconBtn name="sort" onClick={() => setSortOpen(true)} />} />
      <div style={{ padding: '0 20px 12px', flexShrink: 0 }}>
        <Field value={q} onChange={setQ} placeholder="Search routes" icon="search" />
        <div style={{ display: 'flex', gap: 8, marginTop: 12, overflowX: 'auto' }}>
          {[['all', 'All'], ['mine', 'Mine'], ['shared', 'Shared']].map(([v, l]) => (
            <Chip key={v} active={filter === v} onClick={() => setFilter(v)}>{l}</Chip>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '4px 20px 90px' }}>
        {invites.length > 0 && (
          <div style={{ marginBottom: 18 }}>
            <SectionHead title={`Invitations (${invites.length})`} />
            {invites.map(r => {
              const from = ATHLETES[r.owner];
              return (
                <Card key={r.id} pad={13} style={{ borderColor: 'var(--accent)' }}>
                  <Row gap={11}>
                    <MiniMap path={r.path} seed={r.seed} size={48} mapStyle={mapStyle} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>{r.name}</div>
                      <div style={{ fontSize: 12.5, color: 'var(--text-3)', marginTop: 1 }}>from {from.name} · {fmtKm(r.dist, units)} {distUnit(units)}</div>
                    </div>
                  </Row>
                  <Row gap={8} style={{ marginTop: 11 }}>
                    <Btn size="sm" full onClick={() => { setInvites([]); nav('__toast', { msg: 'Joined ' + r.name }); }}>Accept</Btn>
                    <Btn size="sm" full variant="secondary" onClick={() => setInvites([])}>Decline</Btn>
                  </Row>
                </Card>
              );
            })}
          </div>
        )}

        {list.length === 0 ? (
          <Empty icon="route" title={q ? 'No routes match' : 'No routes yet'} sub={q ? 'Try a different search.' : 'Create your first route to start tracking efforts.'} action={q ? null : 'Create route'} onAction={() => nav('/routes/new')} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {list.map(r => <RouteCard key={r.id} r={r} units={units} mapStyle={mapStyle} onClick={() => nav('/routes/' + r.id)} />)}
          </div>
        )}
      </div>

      {/* FAB */}
      <button onClick={() => nav('/routes/new')} style={{
        position: 'absolute', right: 20, bottom: 20, height: 54, padding: '0 22px', borderRadius: 'var(--r-pill)',
        background: 'var(--accent)', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
        fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 15.5, boxShadow: '0 10px 28px var(--accent-soft), 0 6px 16px rgba(0,0,0,.4)', zIndex: 30,
      }}><Icon name="plus" size={22} stroke={2.6} />New route</button>

      <Sheet open={sortOpen} onClose={() => setSortOpen(false)} title="Sort by">
        {[['updated', 'Recently updated'], ['name', 'Name A–Z'], ['distance', 'Distance']].map(([v, l]) => (
          <Row key={v} onClick={() => { setSort(v); setSortOpen(false); }} pad="14px 4px" style={{ borderBottom: '1px solid var(--border)' }}>
            <span style={{ flex: 1, fontWeight: 600, fontSize: 15 }}>{l}</span>
            {sort === v && <Icon name="check" size={20} color="var(--accent)" />}
          </Row>
        ))}
      </Sheet>
    </div>
  );
}

/* ---------------- CREATE ROUTE ---------------- */
function CreateRouteScreen({ nav, units, mapStyle }) {
  const [pts, setPts] = useState([]);
  const [snap, setSnap] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [isPublic, setPublic] = useState(false);

  const addPoint = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setPts(p => [...p, { x: +x.toFixed(1), y: +y.toFixed(1) }]);
  };
  const dist = (pts.length < 2) ? 0 : pts.reduce((acc, p, i) => i ? acc + Math.hypot(p.x - pts[i - 1].x, p.y - pts[i - 1].y) * 0.13 : 0, 0);
  const elev = Math.round(dist * 7.4);
  const routeD = pts.length ? 'M ' + pts.map(p => `${p.x} ${p.y}`).join(' L ') : null;

  const save = () => { setSaving(true); setTimeout(() => nav('/routes/riverside', { replace: true }), 1200); };

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      {/* map canvas */}
      <div onClick={addPoint} style={{ position: 'absolute', inset: 0, cursor: 'crosshair' }}>
        <FauxMap seed={3} mapStyle={mapStyle}>
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
            {routeD && <path d={routeD} stroke="var(--accent)" strokeWidth="0.9" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeDasharray={snap ? 'none' : '2 2'} />}
          </svg>
          {pts.map((p, i) => (
            <div key={i} style={{ position: 'absolute', left: `${p.x}%`, top: `${p.y}%`, transform: 'translate(-50%,-50%)', zIndex: 4 }}>
              <div style={{ width: i === 0 ? 16 : 13, height: i === 0 ? 16 : 13, borderRadius: '50%', background: i === 0 ? 'var(--live)' : 'var(--accent)', border: '3px solid var(--bg)', boxShadow: '0 2px 6px rgba(0,0,0,.5)' }} />
            </div>
          ))}
        </FauxMap>
      </div>

      {/* top controls */}
      <div style={{ position: 'absolute', top: 10, left: 14, right: 14, display: 'flex', justifyContent: 'space-between', zIndex: 10 }}>
        <IconBtn name="chevL" onClick={() => nav('back')} style={{ background: 'rgba(0,0,0,.45)', backdropFilter: 'blur(8px)', color: '#fff' }} />
        <div style={{ display: 'flex', gap: 8 }}>
          <IconBtn name="refresh" onClick={() => setPts(p => p.slice(0, -1))} style={{ background: 'rgba(0,0,0,.45)', backdropFilter: 'blur(8px)', color: '#fff' }} />
          <button onClick={() => setSnap(s => !s)} style={{
            height: 40, padding: '0 14px', borderRadius: 'var(--r-pill)', border: '1px solid var(--border)', cursor: 'pointer',
            background: snap ? 'var(--accent)' : 'rgba(0,0,0,.45)', backdropFilter: 'blur(8px)', color: '#fff', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6,
          }}><Icon name="route" size={16} />Snap {snap ? 'on' : 'off'}</button>
        </div>
      </div>

      {pts.length === 0 && (
        <div style={{ position: 'absolute', top: '38%', left: 0, right: 0, textAlign: 'center', zIndex: 6, pointerEvents: 'none' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(0,0,0,.55)', backdropFilter: 'blur(8px)', padding: '10px 16px', borderRadius: 'var(--r-pill)', color: '#fff', fontWeight: 600, fontSize: 13.5 }}>
            <Icon name="plus" size={17} /> Tap the map to drop your first point
          </div>
        </div>
      )}

      <IconBtn name="locate" size={46} iconSize={22} style={{ position: 'absolute', right: 14, bottom: expanded ? 360 : 156, zIndex: 10, background: 'var(--surface)', transition: 'bottom .34s var(--ease-out)' }} onClick={() => {}} />

      {/* bottom sheet */}
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0, background: 'var(--surface)', borderRadius: '24px 24px 0 0',
        borderTop: '1px solid var(--border)', zIndex: 20, boxShadow: 'var(--shadow-lg)',
      }}>
        <div onClick={() => setExpanded(e => !e)} style={{ padding: '10px 0 4px', display: 'flex', justifyContent: 'center', cursor: 'pointer' }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--border-strong)' }} />
        </div>
        <div style={{ padding: '6px 20px 22px' }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', gap: 24 }}>
              <div>
                <div className="eyebrow" style={{ fontSize: 10 }}>Distance</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}><span className="stat-num" style={{ fontSize: 34 }}>{fmtKm(dist, units)}</span><span style={{ color: 'var(--text-3)', fontWeight: 700, fontSize: 13 }}>{distUnit(units)}</span></div>
              </div>
              <div>
                <div className="eyebrow" style={{ fontSize: 10 }}>Elev gain</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}><span className="stat-num" style={{ fontSize: 34 }}>+{elev}</span><span style={{ color: 'var(--text-3)', fontWeight: 700, fontSize: 13 }}>m</span></div>
              </div>
            </div>
            <div style={{ color: 'var(--text-3)', fontSize: 12.5, fontWeight: 600, textAlign: 'right' }}>{pts.length} point{pts.length !== 1 ? 's' : ''}</div>
          </Row>

          {expanded && (
            <div style={{ marginTop: 18 }}>
              <div className="eyebrow" style={{ marginBottom: 8 }}>Elevation profile</div>
              <ElevationChart seed={3} />
              <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <Field label="Route name" value={name} onChange={setName} placeholder="e.g. Riverside Loop" icon="route" />
                <Row style={{ justifyContent: 'space-between' }}>
                  <div><div style={{ fontWeight: 600, fontSize: 14.5 }}>Make public</div><div style={{ fontSize: 12.5, color: 'var(--text-3)' }}>Anyone can find and run it</div></div>
                  <Toggle value={isPublic} onChange={setPublic} />
                </Row>
              </div>
            </div>
          )}

          <div style={{ marginTop: 16 }}>
            <Btn full size="lg" loading={saving} disabled={pts.length < 2 || (expanded && !name)} onClick={() => expanded ? save() : setExpanded(true)}>
              {expanded ? 'Save route' : pts.length < 2 ? 'Add at least 2 points' : 'Review & save'}
            </Btn>
          </div>
        </div>
      </div>
    </div>
  );
}

function ElevationChart({ seed = 1, color = 'var(--accent)', h = 64 }) {
  const rnd = mulberry32(seed * 99991);
  const n = 28;
  let v = 40 + rnd() * 20;
  const ys = Array.from({ length: n }, () => { v += (rnd() - 0.45) * 14; v = Math.max(10, Math.min(90, v)); return v; });
  const step = 100 / (n - 1);
  const line = ys.map((y, i) => `${i * step} ${100 - y}`).join(' L ');
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: '100%', height: h, display: 'block' }}>
      <defs><linearGradient id={'eg' + seed} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={color} stopOpacity="0.35" /><stop offset="1" stopColor={color} stopOpacity="0" /></linearGradient></defs>
      <path d={`M 0 ${100 - ys[0]} L ${line} L 100 100 L 0 100 Z`} fill={`url(#eg${seed})`} />
      <path d={`M 0 ${100 - ys[0]} L ${line}`} stroke={color} strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ---------------- ROUTE DETAIL ---------------- */
function RouteDetailScreen({ nav, params, units, mapStyle }) {
  const r = ROUTES.find(x => x.id === params.id) || ROUTES[0];
  const owner = ATHLETES[r.owner];
  const top = LEADERBOARD.slice(0, 3);
  const joined = MEMBERS.filter(m => m.status === 'JOINED');
  const [starting, setStarting] = useState(false);

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
      {/* map header */}
      <div style={{ position: 'relative', height: 280, flexShrink: 0 }}>
        <FauxMap seed={r.seed} routeD={r.path} mapStyle={mapStyle}
          markers={[{ x: 22, y: 78, type: 'start' }, ...(r.loop ? [] : [{ x: 80, y: 22, type: 'finish' }])]} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(9,10,13,.6) 0%, transparent 30%, transparent 70%, var(--bg) 100%)' }} />
        <div style={{ position: 'absolute', top: 10, left: 14, right: 14, display: 'flex', justifyContent: 'space-between', zIndex: 6 }}>
          <IconBtn name="chevL" onClick={() => nav('back')} style={{ background: 'rgba(0,0,0,.45)', backdropFilter: 'blur(8px)', color: '#fff' }} />
          <div style={{ display: 'flex', gap: 8 }}>
            <IconBtn name="share" onClick={() => nav('__toast', { msg: 'Link copied' })} style={{ background: 'rgba(0,0,0,.45)', backdropFilter: 'blur(8px)', color: '#fff' }} />
            <IconBtn name="more" onClick={() => nav('__toast', { msg: 'Route options' })} style={{ background: 'rgba(0,0,0,.45)', backdropFilter: 'blur(8px)', color: '#fff' }} />
          </div>
        </div>
        {r.liveNow > 0 && (
          <button onClick={() => nav('/routes/' + r.id + '/live')} style={{ position: 'absolute', bottom: 18, left: 20, zIndex: 6, border: 'none', cursor: 'pointer', background: 'none' }}>
            <StatusPill tone="live" icon="dot">{r.liveNow} running now · Watch live</StatusPill>
          </button>
        )}
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '0 20px 110px', marginTop: -8 }}>
        <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: 32, lineHeight: 1, fontWeight: 700 }}>{r.name}</h1>
            <Row gap={7} style={{ marginTop: 8 }}>
              <Avatar name={owner.name} color={owner.color} size={22} />
              <span style={{ fontSize: 13, color: 'var(--text-2)', fontWeight: 600 }}>{owner.name}</span>
              {!r.isPublic && <Tag size="sm" icon="lock">Private</Tag>}
            </Row>
          </div>
        </Row>
        <p style={{ color: 'var(--text-2)', fontSize: 14, lineHeight: 1.5, marginTop: 12 }}>{r.desc}</p>

        {/* stats */}
        <Card pad={0} style={{ display: 'flex', marginTop: 16 }}>
          {[[fmtKm(r.dist, units), distUnit(units), 'Distance'], ['+' + r.elev, 'm', 'Elevation'], ['1', '', 'Segment']].map((s, i) => (
            <div key={i} style={{ flex: 1, padding: '16px 8px', textAlign: 'center', borderLeft: i ? '1px solid var(--border)' : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 2, justifyContent: 'center' }}><span className="stat-num" style={{ fontSize: 28 }}>{s[0]}</span><span style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 700 }}>{s[1]}</span></div>
              <div className="eyebrow" style={{ fontSize: 9.5, marginTop: 4 }}>{s[2]}</div>
            </div>
          ))}
        </Card>

        {/* elevation */}
        <div style={{ marginTop: 22 }}>
          <div className="eyebrow" style={{ marginBottom: 8 }}>Elevation profile</div>
          <Card pad={14}><ElevationChart seed={r.seed} h={70} /></Card>
        </div>

        {/* leaderboard preview */}
        <div style={{ marginTop: 22 }}>
          <SectionHead title="Leaderboard" action="Full board" onAction={() => nav('/routes/' + r.id + '/leaderboard')} />
          <Card pad={0}>
            {top.map((e, i) => <LeaderRow key={i} e={e} units={units} dist={r.dist} last={i === top.length - 1} onClick={() => nav('/activities/a1')} />)}
          </Card>
        </div>

        {/* members */}
        <div style={{ marginTop: 22 }}>
          <SectionHead title={`Members (${joined.length})`} action="Manage" onAction={() => nav('/routes/' + r.id + '/members')} />
          <Card pad={14} interactive onClick={() => nav('/routes/' + r.id + '/members')}>
            <Row style={{ justifyContent: 'space-between' }}>
              <div style={{ display: 'flex' }}>
                {joined.slice(0, 5).map((m, i) => (
                  <div key={i} style={{ marginLeft: i ? -10 : 0, position: 'relative', zIndex: 5 - i }}><Avatar name={ATHLETES[m.athlete].name} color={ATHLETES[m.athlete].color} size={36} ring="var(--surface)" /></div>
                ))}
              </div>
              <Btn size="sm" variant="secondary" icon="plus" onClick={(e) => { e.stopPropagation(); nav('/routes/' + r.id + '/members'); }}>Invite</Btn>
            </Row>
          </Card>
        </div>
      </div>

      {/* start CTA */}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '14px 20px 18px', background: 'linear-gradient(180deg, transparent, var(--bg) 30%)', zIndex: 10 }}>
        <Btn full size="lg" icon="play" loading={starting} onClick={() => { setStarting(true); setTimeout(() => nav('/record', { routeId: r.id }), 900); }}>
          {starting ? 'Acquiring GPS…' : 'Start run on this route'}
        </Btn>
      </div>
    </div>
  );
}

function LeaderRow({ e, units, dist, last, onClick }) {
  const a = ATHLETES[e.athlete];
  const medal = ['#FFD24A', '#C7CDD6', '#E0915A'][e.rank - 1];
  return (
    <Row onClick={onClick} gap={12} pad="11px 14px" style={{ borderBottom: last ? 'none' : '1px solid var(--border)', background: e.me ? 'var(--accent-soft)' : 'transparent' }}>
      <div style={{ width: 26, textAlign: 'center', flexShrink: 0 }}>
        {e.rank <= 3 ? <Icon name="medal" size={22} color={medal} fill={false} stroke={2} /> : <span className="stat-num" style={{ fontSize: 18, color: 'var(--text-3)' }}>{e.rank}</span>}
      </div>
      <Avatar name={a.name} color={a.color} size={36} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 14.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.me ? 'You' : a.name}</div>
        <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{e.pace} /{distUnit(units)} · {e.date}</div>
      </div>
      <span className="stat-num" style={{ fontSize: 22, color: e.me ? 'var(--accent)' : 'var(--text)' }}>{e.time}</span>
    </Row>
  );
}

/* ---------------- MEMBERS ---------------- */
function MembersScreen({ nav, params }) {
  const r = ROUTES.find(x => x.id === params.id) || ROUTES[0];
  const [members, setMembers] = useState(MEMBERS);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [email, setEmail] = useState('');
  const order = { OWNER: 0, JOINED: 1, INVITED: 2, DECLINED: 3 };
  const sorted = [...members].sort((a, b) => (a.role === 'OWNER' ? 0 : order[a.status]) - (b.role === 'OWNER' ? 0 : order[b.status]));
  const counts = { joined: members.filter(m => m.status === 'JOINED').length, pending: members.filter(m => m.status === 'INVITED').length };

  const StatusTag = ({ s }) => s === 'JOINED' ? <Tag tone="live">Joined</Tag> : s === 'INVITED' ? <Tag tone="warn">Pending</Tag> : <Tag>Declined</Tag>;

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
      <TopBar title="Members" sub={`${r.name} · ${counts.joined} joined, ${counts.pending} pending`} onBack={() => nav('back')}
        right={<IconBtn name="share" onClick={() => nav('__toast', { msg: 'Invite link copied' })} />} />
      <div style={{ flex: 1, overflow: 'auto', padding: '4px 20px 100px' }}>
        <Card pad={0}>
          {sorted.map((m, i) => {
            const a = ATHLETES[m.athlete];
            return (
              <Row key={m.athlete} gap={12} pad="12px 14px" style={{ borderBottom: i === sorted.length - 1 ? 'none' : '1px solid var(--border)', opacity: m.status === 'DECLINED' ? 0.55 : 1 }}>
                <Avatar name={a.name} color={a.color} size={42} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Row gap={6}><span style={{ fontWeight: 700, fontSize: 15 }}>{a.name}</span>{m.role === 'OWNER' && <Tag tone="accent" size="sm">Owner</Tag>}</Row>
                  <div style={{ fontSize: 12.5, color: 'var(--text-3)', marginTop: 1 }}>{a.name.toLowerCase().replace(' ', '.')}@stride.run</div>
                </div>
                {m.role === 'OWNER' ? <Tag tone="accent">You</Tag> : <>
                  <StatusTag s={m.status} />
                  <IconBtn name="more" size={34} iconSize={17} onClick={() => nav('__toast', { msg: m.status === 'INVITED' ? 'Resend / revoke' : 'Remove member' })} />
                </>}
              </Row>
            );
          })}
        </Card>
        <p style={{ color: 'var(--text-3)', fontSize: 12.5, textAlign: 'center', marginTop: 16, lineHeight: 1.5 }}>Members can see the route, the live tracking, and the leaderboard.</p>
      </div>

      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '14px 20px 18px', background: 'linear-gradient(180deg, transparent, var(--bg) 30%)' }}>
        <Btn full size="lg" icon="plus" onClick={() => setInviteOpen(true)}>Invite people</Btn>
      </div>

      <Sheet open={inviteOpen} onClose={() => setInviteOpen(false)} title="Invite by email">
        <Field label="Email address" value={email} onChange={setEmail} placeholder="friend@email.com" icon="mail" inputMode="email" autoFocus />
        <div style={{ marginTop: 16 }}><Btn full size="lg" disabled={!/.+@.+\..+/.test(email)} onClick={() => { setInviteOpen(false); setEmail(''); nav('__toast', { msg: 'Invite sent' }); }}>Send invite</Btn></div>
        <Btn full variant="ghost" icon="share" style={{ marginTop: 10 }} onClick={() => { setInviteOpen(false); nav('__toast', { msg: 'Invite link copied' }); }}>Share invite link instead</Btn>
      </Sheet>
    </div>
  );
}

/* ---------------- LEADERBOARD ---------------- */
function LeaderboardScreen({ nav, params, units }) {
  const r = ROUTES.find(x => x.id === params.id) || ROUTES[0];
  const [filterOpen, setFilterOpen] = useState(false);
  const [period, setPeriod] = useState('all');
  const [type, setType] = useState('all');
  const me = LEADERBOARD.find(e => e.me);
  const leader = LEADERBOARD[0];

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
      <TopBar title="Leaderboard" onBack={() => nav('back')} right={<IconBtn name="filter" onClick={() => setFilterOpen(true)} />} />
      {/* segment header */}
      <div style={{ padding: '0 20px 14px', flexShrink: 0 }}>
        <Card pad={14} interactive onClick={() => nav('/routes/' + r.id)}>
          <Row style={{ justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{r.name}</div>
              <div style={{ fontSize: 12.5, color: 'var(--text-3)', marginTop: 2 }}>{fmtKm(r.dist, units)} {distUnit(units)} · +{r.elev} m · {LEADERBOARD.length} athletes</div>
            </div>
            <Icon name="chevR" size={20} color="var(--text-4)" />
          </Row>
        </Card>
        <div style={{ display: 'flex', gap: 8, marginTop: 12, overflowX: 'auto' }}>
          <Chip icon="calendar" active={period !== 'all'} onClick={() => setFilterOpen(true)}>{period === 'all' ? 'All time' : period}</Chip>
          <Chip icon="users" onClick={() => setFilterOpen(true)}>Everyone</Chip>
          <Chip icon="shoe" active={type !== 'all'} onClick={() => setFilterOpen(true)}>{type === 'all' ? 'All types' : type}</Chip>
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '0 20px 96px' }}>
        <Card pad={0}>
          {LEADERBOARD.map((e, i) => {
            const a = ATHLETES[e.athlete];
            const medal = ['#FFD24A', '#C7CDD6', '#E0915A'][e.rank - 1];
            const gap = i === 0 ? null : '+' + fmtGap(e.time, leader.time);
            return (
              <Row key={i} onClick={() => nav('/activities/a1')} gap={12} pad="13px 14px" style={{ borderBottom: i === LEADERBOARD.length - 1 ? 'none' : '1px solid var(--border)', background: e.me ? 'var(--accent-soft)' : 'transparent' }}>
                <div style={{ width: 30, textAlign: 'center', flexShrink: 0 }}>
                  {e.rank <= 3 ? <Icon name="medal" size={24} color={medal} stroke={2} /> : <span className="stat-num" style={{ fontSize: 19, color: 'var(--text-3)' }}>{e.rank}</span>}
                </div>
                <Avatar name={a.name} color={a.color} size={40} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.me ? 'You' : a.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{e.pace} /{distUnit(units)} · {gap || 'Leader'}</div>
                </div>
                <span className="stat-num" style={{ fontSize: 24, color: e.me ? 'var(--accent)' : 'var(--text)' }}>{e.time}</span>
              </Row>
            );
          })}
        </Card>
      </div>

      {/* my rank pinned */}
      {me && (
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '12px 20px 18px', background: 'linear-gradient(180deg, transparent, var(--bg) 25%)' }}>
          <Card pad={12} style={{ background: 'var(--surface-3)', borderColor: 'var(--accent)' }}>
            <Row gap={12}>
              <div style={{ textAlign: 'center', width: 34 }}><div className="stat-num" style={{ fontSize: 24, color: 'var(--accent)' }}>{me.rank}</div><div className="eyebrow" style={{ fontSize: 8 }}>You</div></div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14.5 }}>Your best · {me.time}</div>
                <div style={{ fontSize: 12.5, color: 'var(--text-2)' }}>+{fmtGap(me.time, leader.time)} to leader</div>
              </div>
              <Btn size="sm" onClick={() => nav('/record', { routeId: r.id })}>Beat it</Btn>
            </Row>
          </Card>
        </div>
      )}

      <Sheet open={filterOpen} onClose={() => setFilterOpen(false)} title="Filters">
        <FilterGroup label="Time period" value={period} onChange={setPeriod} options={[['all', 'All time'], ['year', 'This year'], ['month', 'This month'], ['week', 'This week']]} />
        <FilterGroup label="Activity type" value={type} onChange={setType} options={[['all', 'All'], ['run', 'Run'], ['jog', 'Jog'], ['walk', 'Walk']]} />
        <div style={{ marginTop: 8 }}><Btn full size="lg" onClick={() => setFilterOpen(false)}>Apply</Btn></div>
      </Sheet>
    </div>
  );
}

function FilterGroup({ label, value, onChange, options }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div className="eyebrow" style={{ marginBottom: 10 }}>{label}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {options.map(([v, l]) => <Chip key={v} active={value === v} onClick={() => onChange(v)}>{l}</Chip>)}
      </div>
    </div>
  );
}

function fmtGap(t, base) {
  const s = x => { const [m, sec] = x.split(':').map(Number); return m * 60 + sec; };
  const d = s(t) - s(base);
  const m = Math.floor(d / 60), sec = d % 60;
  return (m ? m + ':' : '') + String(sec).padStart(m ? 2 : 1, '0') + (m ? '' : 's');
}

Object.assign(window, { RoutesScreen, CreateRouteScreen, RouteDetailScreen, MembersScreen, LeaderboardScreen, ElevationChart, LeaderRow });
