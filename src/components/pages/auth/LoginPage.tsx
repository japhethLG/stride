/**
 * LoginPage (CP5) — ported verbatim from design/project/screens-auth.jsx
 * `LoginScreen`, wired to the real auth.
 *
 * The design's `nav('/onboarding/permissions')` mock now runs the real dev-stub
 * auth flow: `signInWithEmail` / `signUpWithEmail` / `signInWithGoogle` from
 * `useAuth` sign the user in (which makes the <AuthGuard> pass) and THEN we
 * `navigate('/onboarding/permissions')`. The design's `nav('__toast', …)`
 * forgot-password mock becomes a local <Toast> (no global registry).
 *
 * The brand hero replaces the design's <FauxMap> with a static, non-interactive
 * <MapView> preview drawing the same demo route path.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Btn, Field, Icon, Segmented, Wordmark } from "@/components/primitives";
import { Toast } from "@/components/chrome";
import { MapView } from "@/components/map/MapView";
import { useAuth } from "@/lib/auth/AuthProvider";
import { PATHS } from "@/components/pages/auth/heroPath";

type Mode = "signin" | "signup";

export function LoginPage() {
  const navigate = useNavigate();
  const { signInWithEmail, signUpWithEmail, signInWithGoogle } = useAuth();

  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("maya@stride.run");
  const [pw, setPw] = useState("runner2026");
  const [name, setName] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [toast, setToast] = useState("");
  const signup = mode === "signup";

  const goNext = () => navigate("/onboarding/permissions");

  const submit = async () => {
    setErr("");
    if (!/.+@.+\..+/.test(email)) {
      setErr("Enter a valid email address");
      return;
    }
    if (pw.length < 6) {
      setErr("Password must be at least 6 characters");
      return;
    }
    setLoading(true);
    try {
      if (signup) await signUpWithEmail(email, pw);
      else await signInWithEmail(email, pw);
      goNext();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const google = async () => {
    setErr("");
    setLoading(true);
    try {
      await signInWithGoogle();
      goNext();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not sign in with Google.");
    } finally {
      setLoading(false);
    }
  };

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(""), 2600);
  };

  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", overflow: "auto" }}>
      {/* brand hero */}
      <div style={{ position: "relative", height: 300, flexShrink: 0, overflow: "hidden" }}>
        <MapView
          interactive={false}
          routeD={PATHS.riverside}
          glow
          fit
          fitPadding={64}
          style={{ position: "absolute", inset: 0 }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            background:
              "linear-gradient(180deg, rgba(9,10,13,0.55) 0%, rgba(9,10,13,0.2) 35%, var(--bg) 100%)",
          }}
        />
        <div style={{ position: "absolute", left: 24, bottom: 30 }}>
          <Wordmark size={40} />
          <div
            style={{
              marginTop: 14,
              fontFamily: "var(--font-display)",
              fontWeight: 600,
              fontSize: 30,
              lineHeight: 0.98,
              letterSpacing: ".3px",
              maxWidth: 260,
            }}
          >
            Every stride,
            <br />
            on the map.
          </div>
          <div style={{ marginTop: 8, color: "var(--text-2)", fontSize: 14.5, maxWidth: 250 }}>
            Track runs, build routes, and race friends on the leaderboard.
          </div>
        </div>
      </div>

      {/* form */}
      <div style={{ padding: "8px 24px 28px", display: "flex", flexDirection: "column", gap: 16, flex: 1 }}>
        <Segmented
          options={[
            { value: "signin", label: "Sign in" },
            { value: "signup", label: "Create account" },
          ]}
          value={mode}
          onChange={(m) => {
            setMode(m as Mode);
            setErr("");
          }}
        />

        {signup && (
          <Field
            label="Display name"
            value={name}
            onChange={setName}
            placeholder="How should we call you?"
            icon="profile"
          />
        )}
        <Field
          label="Email"
          value={email}
          onChange={setEmail}
          placeholder="you@email.com"
          icon="mail"
          inputMode="email"
        />
        <Field
          label="Password"
          value={pw}
          onChange={setPw}
          placeholder="••••••••"
          icon="lock"
          type={show ? "text" : "password"}
          trailing={
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              style={{
                background: "none",
                border: "none",
                color: "var(--text-3)",
                cursor: "pointer",
                padding: 4,
                display: "flex",
              }}
            >
              <Icon name="eye" size={19} />
            </button>
          }
        />

        {err && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "var(--danger-soft)",
              color: "var(--danger)",
              padding: "10px 12px",
              borderRadius: "var(--r-sm)",
              fontSize: 13.5,
              fontWeight: 500,
            }}
          >
            <Icon name="warning" size={17} /> {err}
          </div>
        )}

        {!signup && (
          <button
            type="button"
            onClick={() => showToast("If an account exists, a reset link was sent")}
            style={{
              alignSelf: "flex-end",
              background: "none",
              border: "none",
              color: "var(--text-2)",
              fontSize: 13.5,
              fontWeight: 600,
              cursor: "pointer",
              marginTop: -4,
            }}
          >
            Forgot password?
          </button>
        )}

        <div style={{ flex: 1 }} />

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Btn full size="lg" loading={loading} onClick={submit}>
            {signup ? "Create account" : "Sign in"}
          </Btn>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              color: "var(--text-4)",
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            <div style={{ flex: 1, height: 1, background: "var(--border)" }} /> OR{" "}
            <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
          </div>
          <Btn full size="lg" variant="secondary" onClick={google} icon="google">
            Continue with Google
          </Btn>
          <p
            style={{
              textAlign: "center",
              color: "var(--text-3)",
              fontSize: 12,
              margin: "6px 8px 0",
              lineHeight: 1.5,
            }}
          >
            By continuing you agree to Stride's{" "}
            <span style={{ color: "var(--text-2)", textDecoration: "underline" }}>Terms</span> &{" "}
            <span style={{ color: "var(--text-2)", textDecoration: "underline" }}>Privacy</span>.
          </p>
        </div>
      </div>

      <Toast msg={toast} />
    </div>
  );
}
