/* screens-home.jsx — Home / Dashboard, Profile, Settings */
const { useState, useEffect } = React;

function HomeScreen({ nav, units, mapStyle }) {
  const recent = ACTIVITIES.slice(0, 3);
  const myRoutes = ROUTES.filter(r => r.role === 'OWNER');
  const [invites, setInvites] = useState(INVITES);
  const unsynced = ACTIVITIES.filter(a => !a.synced).length;
  const hr = new Date().getHours();
  const greet = hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'auto' }}>
      {/* header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px 8px' }}>
        <div>
          <div style={{ color: 'var(--text-3)', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' }}>{greet},</div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 26, lineHeight: 1, letterSpacing: '.3px' }}>{USER.name.split(' ')[0]}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <IconBtn name="bell" size={42} iconSize={20} badge={invites.length || undefined} onClick={() => nav('__toast', { msg: 'Notifications' })} />
          <button onClick={() => nav('/profile')} style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer' }}>
            <Avatar name={USER.name} size={42} color={USER.avatarColor} />
          </button>
        </div>
      </div>

      <div style={{ padding: '4px 20px 24px', display: 'flex', flexDirection: 'column', gap: 22 }}>
        {unsynced > 0 && (
          <Row gap={8} style={{ color: 'var(--warn)', fontSize: 12.5, fontWeight: 600 }}>
            <Icon name="refresh" size={15} /> {unsynced} activity syncing — saved on this device
          </Row>
        )}

        {/* Record hero */}
        <div onClick={() => nav('/record')} style={{ position: 'relative', height: 188, borderRadius: 'var(--r-lg)', overflow: 'hidden', cursor: 'pointer', border: '1px solid var(--border)' }}>
          <FauxMap seed={7} routeD={PATHS.freeRun} mapStyle={mapStyle} />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(110deg, rgba(9,10,13,.82) 30%, rgba(9,10,13,.1) 100%)' }} />
          <div style={{ position: 'absolute', inset: 0, padding: 20, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div className="eyebrow" style={{ color: 'var(--accent)' }}>Ready when you are</div>
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 32, lineHeight: .95 }}>Start a run</div>
              <Row gap={10} style={{ marginTop: 14 }}>
                <div style={{ width: 54, height: 54, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 22px var(--accent-soft)' }}>
                  <Icon name="play" size={24} fill color="#fff" stroke={0} />
                </div>
                <span style={{ color: 'var(--text-2)', fontSize: 13.5, fontWeight: 600 }}>Free run, or pick a route</span>
              </Row>
            </div>
          </div>
        </div>

        {/* lifetime stats */}
        <Card pad={0} style={{ display: 'flex', overflow: 'hidden' }}>
          {[
            { v: units === 'imperial' ? '523' : '842', u: distUnit(units), l: 'Total distance' },
            { v: '78', u: 'h', l: 'Active time' },
            { v: '186', u: 'runs', l: 'Activities' },
          ].map((s, i) => (
            <div key={s.l} style={{ flex: 1, padding: '16px 8px', textAlign: 'center', borderLeft: i ? '1px solid var(--border)' : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 2, justifyContent: 'center' }}>
                <span className="stat-num" style={{ fontSize: 30 }}>{s.v}</span>
                <span style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 700 }}>{s.u}</span>
              </div>
              <div className="eyebrow" style={{ fontSize: 9.5, marginTop: 4 }}>{s.l}</div>
            </div>
          ))}
        </Card>

        {/* invites */}
        {invites.length > 0 && invites.map(inv => {
          const from = ATHLETES[inv.from];
          return (
            <Card key={inv.routeId} pad={14} style={{ borderColor: 'var(--accent)', background: 'var(--accent-soft)' }}>
              <Row gap={11}>
                <Avatar name={from.name} color={from.color} size={40} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: 'var(--text-2)' }}><b style={{ color: 'var(--text)' }}>{from.name}</b> invited you to</div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{inv.route}</div>
                </div>
              </Row>
              <Row gap={8} style={{ marginTop: 12 }}>
                <Btn size="sm" full onClick={() => { setInvites([]); nav('__toast', { msg: 'Joined Forest Park Trail' }); }}>Accept</Btn>
                <Btn size="sm" full variant="secondary" onClick={() => setInvites([])}>Decline</Btn>
              </Row>
            </Card>
          );
        })}

        {/* recent activities */}
        <div>
          <SectionHead title="Recent runs" action="See all" onAction={() => nav('/profile')} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {recent.map(a => <ActivityRow key={a.id} a={a} units={units} mapStyle={mapStyle} onClick={() => nav('/activities/' + a.id)} />)}
          </div>
        </div>

        {/* my routes */}
        <div>
          <SectionHead title="My routes" action="All routes" onAction={() => nav('/routes')} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {myRoutes.map(r => <RouteCard key={r.id} r={r} units={units} mapStyle={mapStyle} onClick={() => nav('/routes/' + r.id)} />)}
          </div>
        </div>
      </div>
    </div>
  );
}

function ProfileScreen({ nav, units, mapStyle }) {
  const [tab, setTab] = useState('activities');
  const myRoutes = ROUTES.filter(r => r.role === 'OWNER' || r.role === 'MEMBER');
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'auto' }}>
      <TopBar title="Profile" right={<IconBtn name="settings" onClick={() => nav('/settings')} />} />
      <div style={{ padding: '8px 20px 24px' }}>
        {/* identity */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Avatar name={USER.name} size={72} color={USER.avatarColor} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 26, lineHeight: 1 }}>{USER.name}</div>
            <div style={{ color: 'var(--text-3)', fontSize: 13.5, marginTop: 3 }}>{USER.email}</div>
          </div>
          <IconBtn name="edit" onClick={() => nav('__toast', { msg: 'Edit profile' })} />
        </div>

        {/* totals */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 20 }}>
          {[
            { v: units === 'imperial' ? '523.4' : '842.6', u: distUnit(units), l: 'Distance', i: 'ruler' },
            { v: '78:14', u: 'h', l: 'Moving time', i: 'clock' },
            { v: '186', u: '', l: 'Activities', i: 'shoe' },
            { v: units === 'imperial' ? '30.3k' : '9.2k', u: distUnit(units) === 'mi' ? 'ft' : 'm', l: 'Elevation', i: 'mountain' },
          ].map(s => (
            <Card key={s.l} pad={14}>
              <Row gap={6} style={{ color: 'var(--text-3)', marginBottom: 8 }}><Icon name={s.i} size={15} /><span className="eyebrow" style={{ fontSize: 10 }}>{s.l}</span></Row>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
                <span className="stat-num" style={{ fontSize: 30 }}>{s.v}</span>
                <span style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 700 }}>{s.u}</span>
              </div>
            </Card>
          ))}
        </div>

        <Segmented style={{ marginTop: 20 }} options={[{ value: 'activities', label: 'Activities' }, { value: 'routes', label: 'Routes' }]} value={tab} onChange={setTab} />

        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {tab === 'activities'
            ? ACTIVITIES.map(a => <ActivityRow key={a.id} a={a} units={units} mapStyle={mapStyle} onClick={() => nav('/activities/' + a.id)} />)
            : myRoutes.map(r => <RouteCard key={r.id} r={r} units={units} mapStyle={mapStyle} onClick={() => nav('/routes/' + r.id)} />)}
        </div>
        <div style={{ textAlign: 'center', padding: 16 }}><Spinner /></div>
      </div>
    </div>
  );
}

function SettingsScreen({ nav, units, setUnits, theme, setTheme }) {
  const [gps, setGps] = useState('granted');
  const Group = ({ title, children }) => (
    <div style={{ marginBottom: 22 }}>
      <div className="eyebrow" style={{ marginBottom: 10, paddingLeft: 4 }}>{title}</div>
      <Card pad={0}>{children}</Card>
    </div>
  );
  const Item = ({ icon, label, sub, right, onClick, danger }) => (
    <Row onClick={onClick} gap={13} pad="14px 16px" style={{ borderBottom: '1px solid var(--border)' }}>
      <div style={{ width: 34, height: 34, borderRadius: 10, background: danger ? 'var(--danger-soft)' : 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon name={icon} size={18} color={danger ? 'var(--danger)' : 'var(--text-2)'} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 15, color: danger ? 'var(--danger)' : 'var(--text)' }}>{label}</div>
        {sub && <div style={{ fontSize: 12.5, color: 'var(--text-3)', marginTop: 1 }}>{sub}</div>}
      </div>
      {right}
    </Row>
  );
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'auto' }}>
      <TopBar title="Settings" onBack={() => nav('back')} />
      <div style={{ padding: '8px 20px 24px' }}>
        <Group title="Account">
          <Row gap={13} pad="14px 16px" style={{ borderBottom: '1px solid var(--border)' }}>
            <Avatar name={USER.name} size={44} color={USER.avatarColor} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{USER.name}</div>
              <div style={{ fontSize: 12.5, color: 'var(--text-3)' }}>{USER.email} · Google</div>
            </div>
            <IconBtn name="edit" size={36} iconSize={17} onClick={() => nav('__toast', { msg: 'Edit name' })} />
          </Row>
          <Item icon="camera" label="Change avatar" onClick={() => nav('__toast', { msg: 'Photo picker' })} right={<Icon name="chevR" size={18} color="var(--text-4)" />} />
        </Group>

        <Group title="Preferences">
          <Item icon="ruler" label="Units" sub="Distance, pace & elevation"
            right={<Segmented style={{ width: 150 }} options={[{ value: 'metric', label: 'km' }, { value: 'imperial', label: 'mi' }]} value={units} onChange={setUnits} />} />
          <Item icon="shoe" label="Default activity type" sub="Run" right={<Icon name="chevR" size={18} color="var(--text-4)" />} onClick={() => nav('__toast', { msg: 'Activity type' })} />
          <Item icon="eye" label="Dark mode" right={<Toggle value={theme === 'dark'} onChange={v => setTheme(v ? 'dark' : 'light')} />} />
        </Group>

        <Group title="Device & permissions">
          <Item icon="gps" label="Location" sub={gps === 'granted' ? 'Granted · while using the app' : 'Not granted'}
            right={<Tag tone={gps === 'granted' ? 'live' : 'warn'}>{gps === 'granted' ? 'On' : 'Off'}</Tag>} />
          <Item icon="bolt" label="Keep screen on" sub="During recording (foreground only)" right={<Tag tone="live">Supported</Tag>} />
          <Item icon="bell" label="Notifications" sub="Available in the app build" right={<Tag>Later</Tag>} />
          <Item icon="target" label="Test GPS" sub="Get a one-shot fix" onClick={() => nav('__toast', { msg: 'GPS fix: ±4m · good' })} right={<Icon name="chevR" size={18} color="var(--text-4)" />} />
        </Group>

        <Group title="Data">
          <Item icon="refresh" label="Clear local data" sub="Cached routes & unsynced runs" onClick={() => nav('__toast', { msg: 'Local cache cleared' })} right={<Icon name="chevR" size={18} color="var(--text-4)" />} />
        </Group>

        <Group title="Account actions">
          <Item icon="signout" label="Sign out" danger onClick={() => nav('/login', { replace: true, authed: false })} />
          <Item icon="trash" label="Delete account" danger onClick={() => nav('__toast', { msg: 'Are you sure? (demo)' })} />
        </Group>

        <div style={{ textAlign: 'center', color: 'var(--text-4)', fontSize: 12, marginTop: 8 }}>Stride · PoC v0.1</div>
      </div>
    </div>
  );
}

Object.assign(window, { HomeScreen, ProfileScreen, SettingsScreen });
