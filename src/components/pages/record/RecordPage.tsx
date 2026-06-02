/**
 * RecordPage — ported from design/project/screens-record.jsx `RecordScreen`.
 *
 * Real wiring: drives the recording store (`useRecordingStore`) instead of the
 * design's fake timer + simulated distance. The big stats (time / distance /
 * pace) read `store.stats`; Start/Pause/Resume/Stop call the store actions
 * (which own the LocationTracker + PointUploader adapters — never
 * `navigator.geolocation` here). The MapView replaces FauxMap: it draws the
 * planned route line (when `?routeId=`), the live "me" track as the glowing
 * accent line, and a "me" marker at the latest fix. `useRecordingSubmit()` is
 * mounted here so the store's `stop()` can POST `/api/activities`.
 *
 * Phases: `idle` -> the "Ready" start gate; `acquiring` -> the start button
 * spins ("Acquiring GPS…"); `recording`/`paused` -> the live controls + banner.
 * Stop opens a finish BaseSheet -> navigate `/record/summary` (the store carries
 * the just-finished result + bestEfforts; Summary reads it).
 *
 * Other-runners overlay is an EMPTY stub until CP6 (RTDB) — see the TODO below.
 */
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Btn, Icon, IconBtn, Spinner, Tag } from "@/components/primitives";
import { StatusPill, runnerColor } from "@/components/chrome";
import { BaseSheet } from "@/components/sheets/BaseSheet";
import { MapView } from "@/components/map/MapView";
import { useRoute } from "@/lib/api/routes";
import { useLiveRunners } from "@/lib/api/live";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useRecordingStore } from "@/lib/recording/store";
import { useRecordingSubmit } from "@/lib/recording/submit";
import { useUserLocation } from "@/lib/location/UserLocationProvider";
import { useUnits } from "@/lib/prefs/store";
import { fmtKm, distUnit } from "@/lib/format";
import { fmtTime, fmtPace, lineCoords, asText } from "./_shared";

export function RecordPage() {
  const nav = useNavigate();
  const [search] = useSearchParams();
  const routeId = search.get("routeId") ?? undefined;
  const units = useUnits();

  // Register the activity submitter so the store's stop() can POST.
  useRecordingSubmit();

  const routeQ = useRoute(routeId);
  const route = routeQ.data;
  const routeCoords = lineCoords(route?.geometry);

  // Other-runners overlay (CP6): subscribe to RTDB for everyone live on this
  // route, excluding myself, keeping only runners with a known position. No-op
  // (empty) when Firebase is unconfigured or this is a free run (no routeId).
  const { user } = useAuth();
  // Shared device location — centers the map (and shows a "me" marker) before the
  // run starts, instead of falling back to the default center.
  const loc = useUserLocation();
  const liveRt = useLiveRunners(routeId);
  const otherRunners = liveRt.runners.filter(
    (p) =>
      p.userId !== user?.uid &&
      p.online &&
      typeof p.lat === "number" &&
      typeof p.lng === "number",
  );

  // --- recording store (source of truth) ---
  const status = useRecordingStore((s) => s.status);
  const points = useRecordingStore((s) => s.points);
  const stats = useRecordingStore((s) => s.stats);
  const startRun = useRecordingStore((s) => s.start);
  const pause = useRecordingStore((s) => s.pause);
  const resume = useRecordingStore((s) => s.resume);
  const stop = useRecordingStore((s) => s.stop);
  const reset = useRecordingStore((s) => s.reset);

  const [stopOpen, setStopOpen] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // If we land here with a stale finished/idle session that still has points,
  // clear it so the screen starts fresh.
  useEffect(() => {
    if (status === "idle" && points.length > 0) reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const recording = status === "recording";
  const paused = status === "paused";
  const acquiring = status === "acquiring";
  const saving = status === "saving";
  const live = recording || paused;

  // Derived display values from the store stats (BigInt-safe: ms are numbers here).
  const sec = Math.floor(stats.durationMs / 1000);
  const distKm = stats.distanceM / 1000;
  const paceS = stats.paceSPerKm;

  // Live "me" track + marker from the recorded points.
  const meCoords = useMemo(
    () => points.map((p) => [p.lng, p.lat] as [number, number]),
    [points],
  );
  const me = meCoords[meCoords.length - 1];
  const start = routeCoords[0];
  // The user's own position before any track points exist (live fix, else last known).
  const here: [number, number] | null = loc.current
    ? [loc.current.lng, loc.current.lat]
    : loc.lastKnown;

  async function handleStart() {
    setError(null);
    try {
      await startRun({ routeId: routeId ?? null });
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Couldn't start GPS. Check location permission and try again.",
      );
    }
  }

  async function handleFinish() {
    setStopping(true);
    setError(null);
    try {
      const result = await stop();
      setStopOpen(false);
      if (result) {
        // Store carries lastBestEfforts; Summary reads the finished run.
        nav("/record/summary", { replace: true });
      } else {
        // Nothing saved (no points / no submitter) — go home.
        nav("/", { replace: true });
      }
    } catch (e) {
      setStopping(false);
      setError(
        e instanceof Error ? e.message : "Couldn't save the run. Your track is still buffered.",
      );
    }
  }

  const markers = [
    ...(start ? [{ lng: start[0], lat: start[1], type: "start" as const }] : []),
    // Other-runner markers from RTDB (online runners on this route, not me).
    ...otherRunners.map((p) => ({
      lng: p.lng as number,
      lat: p.lat as number,
      type: "runner" as const,
      label: (p.displayName ?? "Runner").split(" ")[0],
      color: runnerColor(p.userId),
      dim: !p.online,
    })),
    // "me": the live track head while recording, else the device location.
    ...(me
      ? [{ lng: me[0], lat: me[1], type: "me" as const }]
      : here
        ? [{ lng: here[0], lat: here[1], type: "me" as const }]
        : []),
  ];

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <MapView
        center={start ? [start[0], start[1]] : loc.center}
        routeD={routeCoords}
        trackD={meCoords}
        markers={markers}
        fit={!live}
      />

      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(180deg, rgba(9,10,13,.55) 0%, transparent 22%, transparent 55%, rgba(9,10,13,.85) 100%)",
          pointerEvents: "none",
        }}
      />

      {/* top: close + GPS */}
      <div
        style={{
          position: "absolute",
          top: 10,
          left: 14,
          right: 14,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          zIndex: 10,
        }}
      >
        {!live ? (
          <IconBtn
            name="chevL"
            onClick={() => nav(-1)}
            style={{ background: "rgba(0,0,0,.45)", backdropFilter: "blur(8px)", color: "#fff" }}
          />
        ) : (
          <span />
        )}
        <StatusPill tone={acquiring ? "warn" : "live"}>
          {acquiring ? "Acquiring GPS…" : "GPS · strong"}
        </StatusPill>
        <IconBtn
          name="locate"
          onClick={() => {}}
          style={{ background: "rgba(0,0,0,.45)", backdropFilter: "blur(8px)", color: "#fff" }}
        />
      </div>

      {/* foreground banner — PWA records foreground-only (CLAUDE.md §4/§12) */}
      {live && (
        <div
          style={{
            position: "absolute",
            top: 60,
            left: 14,
            right: 14,
            zIndex: 9,
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "rgba(0,0,0,.5)",
            backdropFilter: "blur(8px)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-sm)",
            padding: "8px 12px",
            color: "var(--text-2)",
            fontSize: 11.5,
            fontWeight: 600,
          }}
        >
          <Icon name="bolt" size={15} color="var(--warn)" /> Screen stays on — keep Stride open
          while recording
        </div>
      )}

      {route && live && (
        <div style={{ position: "absolute", top: 106, left: 14, zIndex: 9 }}>
          <Tag tone="accent" icon="route">
            {asText(route.name)}
          </Tag>
        </div>
      )}

      {/* live-runners roster — who else is on this route right now (color-matched
          to their map marker). Only on route runs; useLiveRunners is subscribed
          whether or not we've started, so it shows pre-run too. */}
      {routeId && (otherRunners.length > 0 || live) && (
        <div
          style={{
            position: "absolute",
            top: live ? 106 : 60,
            right: 14,
            zIndex: 9,
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            gap: 6,
            maxWidth: 168,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: "rgba(0,0,0,.5)",
              backdropFilter: "blur(8px)",
              border: "1px solid var(--border)",
              borderRadius: "var(--r-pill)",
              padding: "5px 11px",
              color: "#fff",
              fontWeight: 700,
              fontSize: 11.5,
            }}
          >
            <Icon name="users" size={13} color={otherRunners.length ? "var(--live)" : "var(--text-3)"} />
            {otherRunners.length > 0
              ? `${otherRunners.length} running now`
              : "You're the only one here"}
          </div>
          {otherRunners.map((p) => (
            <div
              key={p.userId}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 7,
                background: "rgba(0,0,0,.5)",
                backdropFilter: "blur(8px)",
                border: "1px solid var(--border)",
                borderRadius: "var(--r-pill)",
                padding: "4px 10px 4px 8px",
                color: "#fff",
                fontWeight: 600,
                fontSize: 12,
                opacity: p.online ? 1 : 0.5,
                maxWidth: "100%",
              }}
            >
              <span
                style={{
                  width: 9,
                  height: 9,
                  borderRadius: "50%",
                  background: runnerColor(p.userId),
                  flexShrink: 0,
                  boxShadow: "0 0 0 2px rgba(0,0,0,.35)",
                }}
              />
              <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {(p.displayName ?? "Runner").split(" ")[0]}
              </span>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div style={{ position: "absolute", top: live ? 150 : 60, left: 14, right: 14, zIndex: 11 }}>
          <div
            style={{
              background: "var(--danger-soft)",
              color: "var(--danger)",
              border: "1px solid var(--danger)",
              borderRadius: "var(--r-sm)",
              padding: "10px 12px",
              fontSize: 12.5,
              fontWeight: 600,
            }}
          >
            {error}
          </div>
        </div>
      )}

      {/* stats + controls */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          padding: "0 20px 22px",
          zIndex: 10,
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 22 }}>
          <div className="eyebrow" style={{ color: "var(--accent)", marginBottom: -2 }}>
            {paused ? "Paused" : recording ? "Recording" : "Ready"}
          </div>
          <div className="stat-num" style={{ fontSize: 84, letterSpacing: "1px", color: "#fff" }}>
            {fmtTime(sec)}
          </div>
          <div style={{ display: "flex", justifyContent: "center", gap: 36, marginTop: 6 }}>
            <div>
              <div className="stat-num" style={{ fontSize: 38, color: "#fff" }}>
                {fmtKm(distKm, units)}
              </div>
              <div className="eyebrow" style={{ fontSize: 9.5 }}>
                {distUnit(units)}
              </div>
            </div>
            <div>
              <div className="stat-num" style={{ fontSize: 38, color: "#fff" }}>
                {paceS ? fmtPace(units === "imperial" ? paceS / 0.621371 : paceS) : "--"}
              </div>
              <div className="eyebrow" style={{ fontSize: 9.5 }}>
                /{distUnit(units)}
              </div>
            </div>
          </div>
        </div>

        {/* controls */}
        {!live ? (
          <div style={{ display: "flex", justifyContent: "center" }}>
            <button
              type="button"
              disabled={acquiring}
              onClick={handleStart}
              style={{
                width: 96,
                height: 96,
                borderRadius: "50%",
                border: "5px solid rgba(255,255,255,.25)",
                cursor: acquiring ? "wait" : "pointer",
                background: "var(--accent)",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 12px 40px var(--accent-soft)",
                opacity: acquiring ? 0.5 : 1,
              }}
            >
              {acquiring ? (
                <Spinner size={30} color="#fff" />
              ) : (
                <Icon name="play" size={40} fill color="#fff" stroke={0} />
              )}
            </button>
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              gap: 28,
            }}
          >
            <button
              type="button"
              onClick={() => setStopOpen(true)}
              style={{
                width: 72,
                height: 72,
                borderRadius: "50%",
                border: "2px solid var(--border-strong)",
                background: "var(--surface-2)",
                color: "var(--danger)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon name="stop" size={26} fill color="var(--danger)" stroke={0} />
            </button>
            <button
              type="button"
              onClick={() => (recording ? pause() : resume())}
              style={{
                width: 92,
                height: 92,
                borderRadius: "50%",
                border: "none",
                background: recording ? "#fff" : "var(--accent)",
                color: recording ? "#000" : "#fff",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 10px 30px rgba(0,0,0,.4)",
              }}
            >
              <Icon
                name={recording ? "pause" : "play"}
                size={36}
                fill
                color={recording ? "#000" : "#fff"}
                stroke={0}
              />
            </button>
            <div style={{ width: 72 }} />
          </div>
        )}
      </div>

      <BaseSheet open={stopOpen} onOpenChange={(o) => !stopping && setStopOpen(o)} title="Finish run?">
        <p style={{ color: "var(--text-2)", fontSize: 14, lineHeight: 1.5, marginTop: -4 }}>
          You've covered{" "}
          <b style={{ color: "var(--text)" }}>
            {fmtKm(distKm, units)} {distUnit(units)}
          </b>{" "}
          in {fmtTime(sec)}. Save it to your activities?
        </p>
        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
          <Btn full size="lg" icon="check" loading={stopping || saving} onClick={handleFinish}>
            Finish &amp; review
          </Btn>
          <Btn full variant="quiet" onClick={() => setStopOpen(false)}>
            Keep running
          </Btn>
        </div>
      </BaseSheet>
    </div>
  );
}
