/* ds-page.jsx — Stride design system reference gallery */
const { useState } = React;

function Swatch({ name, varName, value, dark }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ height: 56, borderRadius: 12, background: value || `var(${varName})`, border: '1px solid var(--border)' }} />
      <div>
        <div style={{ fontSize: 12.5, fontWeight: 700 }}>{name}</div>
        <div style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'monospace' }}>{value || varName}</div>
      </div>
    </div>
  );
}

function DSCard({ title, sub, children, span = 1 }) {
  return (
    <div style={{ gridColumn: `span ${span}`, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: 24, minWidth: 0 }}>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 22, letterSpacing: '.3px' }}>{title}</div>
        {sub && <div style={{ color: 'var(--text-3)', fontSize: 13, marginTop: 2 }}>{sub}</div>}
      </div>
      {children}
    </div>
  );
}

function Label({ children }) {
  return <div className="eyebrow" style={{ margin: '20px 0 12px' }}>{children}</div>;
}

function DSApp() {
  const [dark, setDark] = useState(true);
  const [accent, setAccent] = useState('#FF4D2E');
  const accentVars = {
    '--accent': accent, '--accent-soft': accent + '28', '--accent-press': accent,
    '--on-accent': '#fff',
  };
  const icons = ['home','route','play','pause','stop','target','locate','flag','mountain','clock','gauge','ruler','trophy','medal','crown','bolt','users','share','bell','settings','signout','gps','refresh','edit','trash','camera','lock','calendar','search','filter','sort','mail','heart','map','shoe','sparkle'];

  return (
    <div data-theme={dark ? 'dark' : 'light'} className="stride" style={{ minHeight: '100vh', background: 'var(--bg-2)', ...accentVars }}>
      {/* hero */}
      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '48px 32px 0' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 20 }}>
          <div>
            <Wordmark size={44} />
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 40, lineHeight: 1, marginTop: 20 }}>Design System</div>
            <div style={{ color: 'var(--text-2)', fontSize: 16, marginTop: 10, maxWidth: 540, lineHeight: 1.5 }}>
              An energetic, dark-first system for a GPS run tracker. Bold condensed numerals, a single decisive accent, and maps with a glowing route line.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {['#FF4D2E','#00E07A','#5B8CFF','#C8FF00','#FF8A00'].map(c => (
              <button key={c} onClick={() => setAccent(c)} style={{ width: 30, height: 30, borderRadius: '50%', background: c, border: accent === c ? '3px solid var(--text)' : '3px solid transparent', cursor: 'pointer' }} />
            ))}
            <Btn size="sm" variant="secondary" icon="eye" onClick={() => setDark(d => !d)}>{dark ? 'Dark' : 'Light'}</Btn>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1180, margin: '0 auto', padding: 32, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
        {/* BRAND */}
        <DSCard title="Brand mark" sub="Forward-leaning stride glyph + condensed wordmark" span={1}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 22, alignItems: 'flex-start' }}>
            <StrideMark size={64} />
            <Wordmark size={34} />
            <div style={{ background: 'var(--accent)', borderRadius: 16, padding: '18px 22px' }}><Wordmark size={28} color="#fff" accent="#fff" /></div>
          </div>
        </DSCard>

        {/* TYPE */}
        <DSCard title="Typography" sub="Barlow Condensed display · Hanken Grotesk body" span={2}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            <div>
              <Label>Display · Barlow Condensed</Label>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 46, lineHeight: .95 }}>Run. Route.<br/>Repeat.</div>
              <div className="stat-num" style={{ fontSize: 64, marginTop: 12 }}>42:18</div>
              <div className="eyebrow" style={{ marginTop: 2 }}>Tabular stat numerals</div>
            </div>
            <div>
              <Label>Body · Hanken Grotesk</Label>
              <div style={{ fontSize: 17, fontWeight: 700 }}>Semibold 17 — section titles</div>
              <div style={{ fontSize: 15, marginTop: 8, lineHeight: 1.5 }}>Regular 15 — the workhorse body size for rows, descriptions, and list content across the app.</div>
              <div style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 8 }}>Secondary 13 — metadata & helper text.</div>
              <div className="eyebrow" style={{ marginTop: 14 }}>Eyebrow · 11 / uppercase / +1.4</div>
            </div>
          </div>
        </DSCard>

        {/* ACCENT + SEMANTIC */}
        <DSCard title="Accent" sub="One decisive energy color" span={1}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Swatch name="Accent" value={accent} />
            <Swatch name="Accent soft" value={accent + '28'} />
          </div>
          <Label>Semantic</Label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Swatch name="Live / good" varName="--live" />
            <Swatch name="Warning" varName="--warn" />
            <Swatch name="Danger" varName="--danger" />
            <Swatch name="Info" varName="--info" />
          </div>
        </DSCard>

        <DSCard title="Surfaces & neutrals" sub="Near-black layered surfaces" span={1}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Swatch name="Background" varName="--bg" />
            <Swatch name="Surface" varName="--surface" />
            <Swatch name="Surface 2" varName="--surface-2" />
            <Swatch name="Surface 3" varName="--surface-3" />
          </div>
          <Label>Text</Label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ color: 'var(--text)', fontWeight: 700 }}>Primary text</span>
            <span style={{ color: 'var(--text-2)' }}>Secondary text</span>
            <span style={{ color: 'var(--text-3)' }}>Tertiary text</span>
          </div>
        </DSCard>

        <DSCard title="Map treatment" sub="Dark canvas, glowing route line" span={1}>
          <div style={{ height: 220, borderRadius: 16, overflow: 'hidden', position: 'relative', border: '1px solid var(--border)' }}>
            <FauxMap seed={7} routeD={PATHS.riverside} markers={[{ x: 22, y: 78, type: 'start' }, { x: 56, y: 70, type: 'me' }]} />
          </div>
        </DSCard>

        {/* BUTTONS */}
        <DSCard title="Buttons" sub="Pill, three sizes, five variants" span={1}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-start' }}>
            <Btn icon="play">Start run</Btn>
            <Btn variant="secondary" icon="plus">New route</Btn>
            <Btn variant="ghost" icon="share">Share</Btn>
            <Btn variant="danger" icon="trash">Delete</Btn>
            <div style={{ display: 'flex', gap: 8 }}>
              <Btn size="sm">Small</Btn>
              <IconBtn name="bell" /><IconBtn name="settings" active />
            </div>
          </div>
        </DSCard>

        <DSCard title="Tags & status" sub="Status, types, GPS state" span={1}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <Tag tone="accent">RUN</Tag><Tag tone="info">JOG</Tag><Tag tone="live">WALK</Tag>
            <Tag tone="live" icon="dot">2 live</Tag><Tag tone="warn" icon="refresh">Syncing</Tag>
            <Tag tone="accent" icon="trophy">PR</Tag><Tag icon="lock">Private</Tag>
          </div>
          <Label>GPS / connection</Label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <StatusPill tone="live" icon="gps">GPS · strong</StatusPill>
            <StatusPill tone="warn" icon="gps">Acquiring…</StatusPill>
          </div>
          <Label>Chips</Label>
          <div style={{ display: 'flex', gap: 8 }}><Chip active>All</Chip><Chip>Mine</Chip><Chip icon="calendar">This week</Chip></div>
        </DSCard>

        <DSCard title="Inputs & controls" span={1}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Field label="Email" value="maya@stride.run" onChange={() => {}} icon="mail" />
            <Segmented options={['RUN','JOG','WALK']} value="RUN" onChange={() => {}} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}><span style={{ fontWeight: 600 }}>Dark mode</span><Toggle value={dark} onChange={setDark} /></div>
          </div>
        </DSCard>

        {/* STATS */}
        <DSCard title="Stat blocks" sub="The hero of every screen" span={1}>
          <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'flex-end' }}>
            <StatBlock value="8.42" unit="km" label="Distance" size="sm" />
            <StatBlock value="5:01" unit="/km" label="Pace" size="sm" accent />
          </div>
          <div style={{ textAlign: 'center', marginTop: 18 }}><StatBlock value="42:18" label="Elapsed" size="md" /></div>
        </DSCard>

        <DSCard title="Avatars" sub="Initials fallback, color-seeded" span={1}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <Avatar name="Maya Okafor" size={52} color="#FF4D2E" />
            <Avatar name="Devon Hart" size={44} color="#5B8CFF" />
            <Avatar name="Priya Nair" size={44} color="#00E07A" />
            <Avatar name="Luca Romano" size={36} color="#FFB020" />
            <Avatar name="Sana Y" size={36} color="#C879FF" />
          </div>
          <Label>Roster stack</Label>
          <div style={{ display: 'flex' }}>{['#FF4D2E','#5B8CFF','#00E07A','#FFB020'].map((c,i)=>(<div key={i} style={{ marginLeft: i?-10:0 }}><Avatar name={'A'+i} size={36} color={c} ring="var(--surface)" /></div>))}</div>
        </DSCard>

        <DSCard title="Leaderboard row" sub="Rank, athlete, time" span={1}>
          <Card pad={0}>
            <LeaderRow e={LEADERBOARD[0]} units="metric" dist={8.4} />
            <LeaderRow e={LEADERBOARD[3]} units="metric" dist={8.4} last />
          </Card>
        </DSCard>

        <DSCard title="Radii & elevation" span={1}>
          <Label>Corner radii</Label>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
            {[['8','--r-xs'],['12','--r-sm'],['16','--r'],['22','--r-lg'],['999','--r-pill']].map(([n,v])=>(
              <div key={n} style={{ textAlign: 'center' }}>
                <div style={{ width: 48, height: 48, background: 'var(--surface-3)', borderRadius: `var(${v})`, border: '1px solid var(--border-strong)' }} />
                <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 6 }}>{n}</div>
              </div>
            ))}
          </div>
          <Label>Spacing scale</Label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            {[4,8,12,16,24,32].map(s=>(<div key={s} style={{ width: s, height: s, background: 'var(--accent)', borderRadius: 3 }} />))}
          </div>
        </DSCard>

        {/* ICONS */}
        <DSCard title="Iconography" sub="Custom 24px line set, ~2px stroke" span={2}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(9, 1fr)', gap: 16 }}>
            {icons.map(n => (
              <div key={n} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--surface-2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name={n} size={22} color="var(--text)" />
                </div>
                <span style={{ fontSize: 10, color: 'var(--text-3)' }}>{n}</span>
              </div>
            ))}
          </div>
        </DSCard>
      </div>

      <div style={{ textAlign: 'center', color: 'var(--text-4)', fontSize: 12.5, padding: '8px 0 48px' }}>Stride Design System · v0.1</div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<DSApp />);
