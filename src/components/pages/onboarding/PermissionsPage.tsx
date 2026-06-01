/**
 * PermissionsPage (CP5) — ported verbatim from
 * design/project/screens-auth.jsx `PermissionsScreen`, wired to the real
 * geolocation permission via the LocationTracker adapter.
 *
 * The design's `nav('/', { replace: true, authed: true })` mock becomes a real
 * `navigate('/', { replace: true })` — the user is already signed in (the Login
 * flow set `useAuth().user`, so the <AuthGuard> already lets them here). The
 * `setTimeout` permission mock becomes a real prompt:
 *
 *   "Enable location" → `getAdapters().location.start()` (which triggers the
 *   browser geolocation prompt and resolves on the first fix), then we stop the
 *   probe tracker and proceed. A PERMISSION_DENIED error flips to the design's
 *   `denied` state instead of navigating.
 *
 * We go through the adapter (NEVER `navigator.geolocation` directly) per
 * CLAUDE.md §4 — this keeps the Capacitor migration cheap.
 */
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Btn, Icon, Row } from "@/components/primitives";
import { getAdapters } from "@/adapters";
import type { IconName } from "@/components/primitives";

type PermState = "prompt" | "requesting" | "denied";

interface UseRow {
  icon: IconName;
  t: string;
  s: string;
}

const USES: UseRow[] = [
  { icon: "gps", t: "Record your runs", s: "Capture distance, pace, and your exact path by GPS." },
  { icon: "locate", t: "Show you on the map", s: "Place your live position as you move." },
  { icon: "route", t: "Draw routes by location", s: "Build and snap routes starting from where you are." },
  { icon: "users", t: "Race friends live", s: "See yourself next to other runners in real time." },
];

export function PermissionsPage() {
  const navigate = useNavigate();
  const [state, setState] = useState<PermState>("prompt");
  const cancelled = useRef(false);

  useEffect(() => {
    cancelled.current = false;
    return () => {
      cancelled.current = true;
    };
  }, []);

  const proceed = () => navigate("/", { replace: true });

  const request = async () => {
    setState("requesting");
    const tracker = getAdapters().location;
    try {
      // start() triggers the browser geolocation prompt and resolves on the
      // first acceptable fix. We only need the grant — stop the probe right away.
      await tracker.start({ keepScreenOn: false });
      await tracker.stop();
      if (!cancelled.current) proceed();
    } catch {
      // Permission denied / position unavailable: surface the design's denied state.
      await tracker.stop().catch(() => {});
      if (!cancelled.current) setState("denied");
    }
  };

  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column" }}>
      <div style={{ flex: 1, overflow: "auto", padding: "20px 24px 12px" }}>
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: 22,
            background: "var(--accent-soft)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 22,
          }}
        >
          <Icon name="target" size={38} color="var(--accent)" stroke={1.8} />
        </div>
        <h1 style={{ fontSize: 38, lineHeight: 0.98, fontWeight: 700, maxWidth: 280 }}>
          Stride works best with location
        </h1>
        <p style={{ color: "var(--text-2)", fontSize: 15, marginTop: 12, lineHeight: 1.5, maxWidth: 300 }}>
          We use your location only while you're recording or watching a live run — never in the
          background.
        </p>

        <div style={{ marginTop: 26, display: "flex", flexDirection: "column", gap: 18 }}>
          {USES.map((u) => (
            <Row key={u.t} gap={14} style={{ alignItems: "flex-start" }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  background: "var(--surface-2)",
                  border: "1px solid var(--border)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Icon name={u.icon} size={20} color="var(--accent)" />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15.5 }}>{u.t}</div>
                <div style={{ color: "var(--text-2)", fontSize: 13.5, marginTop: 2, lineHeight: 1.4 }}>
                  {u.s}
                </div>
              </div>
            </Row>
          ))}
        </div>

        {state === "denied" && (
          <div style={{ marginTop: 22, background: "var(--warn-soft)", borderRadius: "var(--r)", padding: 16 }}>
            <div style={{ display: "flex", gap: 8, color: "var(--warn)", fontWeight: 700, fontSize: 14 }}>
              <Icon name="info" size={18} /> Location is off
            </div>
            <p style={{ color: "var(--text-2)", fontSize: 13.5, margin: "8px 0 0", lineHeight: 1.5 }}>
              You can still browse and view routes, but recording and live tracking need location.
              Enable it anytime in your browser's site settings.
            </p>
          </div>
        )}
      </div>

      <div
        style={{
          padding: "12px 24px 20px",
          borderTop: "1px solid var(--border)",
          display: "flex",
          flexDirection: "column",
          gap: 10,
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            color: "var(--text-3)",
            fontSize: 12,
            marginBottom: 2,
          }}
        >
          <Icon name="lock" size={13} /> Foreground only · no background tracking
        </div>
        {state === "denied" ? (
          <Btn full size="lg" onClick={() => setState("prompt")}>
            Try again
          </Btn>
        ) : (
          <Btn full size="lg" loading={state === "requesting"} onClick={request}>
            {state === "requesting" ? "Requesting…" : "Enable location"}
          </Btn>
        )}
        <Btn full variant="quiet" onClick={() => (state === "prompt" ? setState("denied") : proceed())}>
          {state === "denied" ? "Continue without location" : "Not now"}
        </Btn>
      </div>
    </div>
  );
}
