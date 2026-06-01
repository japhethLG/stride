/* screens-auth.jsx — Login + Permissions Primer */
const { useState, useEffect, useRef } = React;

function LoginScreen({ nav }) {
  const [mode, setMode] = useState('signin');
  const [email, setEmail] = useState('maya@stride.run');
  const [pw, setPw] = useState('runner2026');
  const [name, setName] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const signup = mode === 'signup';

  const submit = () => {
    setErr('');
    if (!/.+@.+\..+/.test(email)) { setErr('Enter a valid email address'); return; }
    if (pw.length < 6) { setErr('Password must be at least 6 characters'); return; }
    setLoading(true);
    setTimeout(() => { setLoading(false); nav('/onboarding/permissions'); }, 1100);
  };

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
      {/* brand hero */}
      <div style={{ position: 'relative', height: 300, flexShrink: 0, overflow: 'hidden' }}>
        <FauxMap seed={7} routeD={PATHS.riverside} dim glow />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(9,10,13,0.55) 0%, rgba(9,10,13,0.2) 35%, var(--bg) 100%)' }} />
        <div style={{ position: 'absolute', left: 24, bottom: 30 }}>
          <Wordmark size={40} />
          <div style={{ marginTop: 14, fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 30, lineHeight: .98, letterSpacing: '.3px', maxWidth: 260 }}>
            Every stride,<br />on the map.
          </div>
          <div style={{ marginTop: 8, color: 'var(--text-2)', fontSize: 14.5, maxWidth: 250 }}>
            Track runs, build routes, and race friends on the leaderboard.
          </div>
        </div>
      </div>

      {/* form */}
      <div style={{ padding: '8px 24px 28px', display: 'flex', flexDirection: 'column', gap: 16, flex: 1 }}>
        <Segmented options={[{ value: 'signin', label: 'Sign in' }, { value: 'signup', label: 'Create account' }]}
          value={mode} onChange={m => { setMode(m); setErr(''); }} />

        {signup && <Field label="Display name" value={name} onChange={setName} placeholder="How should we call you?" icon="profile" />}
        <Field label="Email" value={email} onChange={setEmail} placeholder="you@email.com" icon="mail" inputMode="email" />
        <Field label="Password" value={pw} onChange={setPw} placeholder="••••••••" icon="lock"
          type={show ? 'text' : 'password'}
          trailing={<button onClick={() => setShow(s => !s)} style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', padding: 4, display: 'flex' }}><Icon name="eye" size={19} /></button>} />

        {err && <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--danger-soft)', color: 'var(--danger)', padding: '10px 12px', borderRadius: 'var(--r-sm)', fontSize: 13.5, fontWeight: 500 }}>
          <Icon name="warning" size={17} /> {err}
        </div>}

        {!signup && <button onClick={() => nav('__toast', { msg: 'If an account exists, a reset link was sent' })}
          style={{ alignSelf: 'flex-end', background: 'none', border: 'none', color: 'var(--text-2)', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', marginTop: -4 }}>Forgot password?</button>}

        <div style={{ flex: 1 }} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Btn full size="lg" loading={loading} onClick={submit}>{signup ? 'Create account' : 'Sign in'}</Btn>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: 'var(--text-4)', fontSize: 12, fontWeight: 600 }}>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} /> OR <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          </div>
          <Btn full size="lg" variant="secondary" onClick={() => nav('/onboarding/permissions')} icon="google">Continue with Google</Btn>
          <p style={{ textAlign: 'center', color: 'var(--text-3)', fontSize: 12, margin: '6px 8px 0', lineHeight: 1.5 }}>
            By continuing you agree to Stride's <span style={{ color: 'var(--text-2)', textDecoration: 'underline' }}>Terms</span> & <span style={{ color: 'var(--text-2)', textDecoration: 'underline' }}>Privacy</span>.
          </p>
        </div>
      </div>
    </div>
  );
}

function PermissionsScreen({ nav }) {
  const [state, setState] = useState('prompt'); // prompt | requesting | denied
  const uses = [
    { icon: 'gps', t: 'Record your runs', s: 'Capture distance, pace, and your exact path by GPS.' },
    { icon: 'locate', t: 'Show you on the map', s: 'Place your live position as you move.' },
    { icon: 'route', t: 'Draw routes by location', s: 'Build and snap routes starting from where you are.' },
    { icon: 'users', t: 'Race friends live', s: 'See yourself next to other runners in real time.' },
  ];

  const request = () => {
    setState('requesting');
    setTimeout(() => nav('/', { replace: true, authed: true }), 1500);
  };

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px 12px' }}>
        <div style={{ width: 72, height: 72, borderRadius: 22, background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 22 }}>
          <Icon name="target" size={38} color="var(--accent)" stroke={1.8} />
        </div>
        <h1 style={{ fontSize: 38, lineHeight: .98, fontWeight: 700, maxWidth: 280 }}>
          Stride works best with location
        </h1>
        <p style={{ color: 'var(--text-2)', fontSize: 15, marginTop: 12, lineHeight: 1.5, maxWidth: 300 }}>
          We use your location only while you're recording or watching a live run — never in the background.
        </p>

        <div style={{ marginTop: 26, display: 'flex', flexDirection: 'column', gap: 18 }}>
          {uses.map(u => (
            <Row key={u.t} gap={14} style={{ alignItems: 'flex-start' }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--surface-2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon name={u.icon} size={20} color="var(--accent)" />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15.5 }}>{u.t}</div>
                <div style={{ color: 'var(--text-2)', fontSize: 13.5, marginTop: 2, lineHeight: 1.4 }}>{u.s}</div>
              </div>
            </Row>
          ))}
        </div>

        {state === 'denied' && (
          <div style={{ marginTop: 22, background: 'var(--warn-soft)', borderRadius: 'var(--r)', padding: 16 }}>
            <div style={{ display: 'flex', gap: 8, color: 'var(--warn)', fontWeight: 700, fontSize: 14 }}>
              <Icon name="info" size={18} /> Location is off
            </div>
            <p style={{ color: 'var(--text-2)', fontSize: 13.5, margin: '8px 0 0', lineHeight: 1.5 }}>
              You can still browse and view routes, but recording and live tracking need location. Enable it anytime in your browser's site settings.
            </p>
          </div>
        )}
      </div>

      <div style={{ padding: '12px 24px 20px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 10, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, color: 'var(--text-3)', fontSize: 12, marginBottom: 2 }}>
          <Icon name="lock" size={13} /> Foreground only · no background tracking
        </div>
        {state === 'denied' ? (
          <Btn full size="lg" onClick={() => setState('prompt')}>Try again</Btn>
        ) : (
          <Btn full size="lg" loading={state === 'requesting'} onClick={request}>
            {state === 'requesting' ? 'Requesting…' : 'Enable location'}
          </Btn>
        )}
        <Btn full variant="quiet" onClick={() => state === 'prompt' ? setState('denied') : nav('/', { replace: true, authed: true })}>
          {state === 'denied' ? 'Continue without location' : 'Not now'}
        </Btn>
      </div>
    </div>
  );
}

Object.assign(window, { LoginScreen, PermissionsScreen });
