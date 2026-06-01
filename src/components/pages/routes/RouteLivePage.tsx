/**
 * RouteLivePage — ported from design/project/screens-record.jsx `LiveScreen`.
 *
 * Real wiring: `useRoute(id)` drives the MapView route line + header card
 * (name / distance). `useLiveSession(routeId)` is joined on mount to obtain the
 * RTDB paths + throttle policy (structure only today). `useLiveParticipants(id)`
 * powers the "Running now" roster sheet.
 *
 * TODO(CP6): Firebase RTDB is not configured, so `useLiveParticipants` returns
 * `{ enabled:false, participants:[] }` and `useLiveSession` returns paths the
 * client can't yet subscribe to. The roster + map therefore render their full
 * structure with an EMPTY "waiting for live runners" state — no positions, no
 * runner markers — until CP6 wires the RTDB subscription. The "Run this route"
 * CTA already works (-> /record?routeId=).
 */
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Avatar, Btn, IconBtn, Row, Spinner, Tag } from "@/components/primitives";
import { StatusPill, Empty, Metric } from "@/components/chrome";
import { MapView } from "@/components/map/MapView";
import { useRoute } from "@/lib/api/routes";
import { useLiveSession, useLiveParticipants } from "@/lib/api/live";
import { useUnits } from "@/lib/prefs/store";
import { fmtKm, distUnit, fmtTime, fmtPace } from "@/lib/format";
import { lineCoords, asText, asNum, msStringToSeconds, paceSPerKm } from "../record/_shared";

export function RouteLivePage() {
  const nav = useNavigate();
  const { id } = useParams<{ id: string }>();
  const units = useUnits();

  const routeQ = useRoute(id);
  const route = routeQ.data;
  const coords = useMemo(() => lineCoords(route?.geometry), [route?.geometry]);
  const start = coords[0];
  const distKm = asNum(route?.distanceM) / 1000;

  // Join the live session on mount for the RTDB paths/structure (CP6 will use
  // these to subscribe). 429 (live_full) surfaces as a thrown ApiError.
  const liveSession = useLiveSession(id ?? "");
  const [sessionError, setSessionError] = useState<string | null>(null);
  useEffect(() => {
    if (!id) return;
    liveSession
      .mutateAsync()
      .catch((e) =>
        setSessionError(
          e instanceof Error && /full/i.test(e.message)
            ? "This route's live session is full right now."
            : null,
        ),
      );
    // join once per route id
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const participantsQ = useLiveParticipants(id);
  const participants = participantsQ.data?.participants ?? [];
  const runners = useMemo(
    () =>
      [...participants].sort((a, b) => {
        // sort online-first; positions aren't available pre-CP6 so this is stable
        return Number(b.online) - Number(a.online);
      }),
    [participants],
  );
  const onlineCount = runners.filter((r) => r.online).length;

  // Runner markers — empty until CP6 (no RTDB positions).
  const runnerMarkers = runners
    .filter((r) => typeof r.lat === "number" && typeof r.lng === "number")
    .map((r) => ({
      lng: r.lng as number,
      lat: r.lat as number,
      type: "runner" as const,
      label: (r.displayName ?? "Runner").split(" ")[0],
      dim: !r.online,
    }));

  if (routeQ.isLoading) {
    return (
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Spinner size={28} color="var(--accent)" />
      </div>
    );
  }
  if (routeQ.isError || !route) {
    return (
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "10px 14px" }}>
          <IconBtn name="chevL" onClick={() => nav(-1)} size={40} iconSize={22} />
        </div>
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Empty
            icon="warning"
            title="Couldn't load route"
            sub={routeQ.error?.message ?? "This route may have been removed."}
            action="Retry"
            onAction={() => routeQ.refetch()}
          />
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <MapView
        interactive
        routeD={coords}
        markers={[
          ...(start ? [{ lng: start[0], lat: start[1], type: "start" as const }] : []),
          ...runnerMarkers,
        ]}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(180deg, rgba(9,10,13,.55) 0%, transparent 20%, transparent 60%, var(--bg) 100%)",
          pointerEvents: "none",
        }}
      />

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
        <IconBtn
          name="chevL"
          onClick={() => nav(-1)}
          style={{ background: "rgba(0,0,0,.45)", backdropFilter: "blur(8px)", color: "#fff" }}
        />
        <StatusPill tone={onlineCount > 0 ? "live" : "neutral"}>
          {onlineCount > 0 ? `Live · ${onlineCount} running` : "Live · waiting"}
        </StatusPill>
        <IconBtn
          name="map"
          onClick={() => {}}
          style={{ background: "rgba(0,0,0,.45)", backdropFilter: "blur(8px)", color: "#fff" }}
        />
      </div>

      <div style={{ position: "absolute", top: 60, left: 14, zIndex: 9 }}>
        <div
          style={{
            background: "rgba(0,0,0,.5)",
            backdropFilter: "blur(8px)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-sm)",
            padding: "8px 12px",
          }}
        >
          <div style={{ fontWeight: 700, fontSize: 14, color: "#fff" }}>{asText(route.name)}</div>
          <div style={{ fontSize: 12, color: "var(--text-2)" }}>
            {fmtKm(distKm, units)} {distUnit(units)} loop
          </div>
        </div>
      </div>

      {sessionError && (
        <div style={{ position: "absolute", top: 110, left: 14, right: 14, zIndex: 9 }}>
          <div
            style={{
              background: "var(--warn-soft)",
              color: "var(--warn)",
              border: "1px solid var(--warn)",
              borderRadius: "var(--r-sm)",
              padding: "8px 12px",
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            {sessionError}
          </div>
        </div>
      )}

      {/* roster sheet */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          background: "var(--surface)",
          borderRadius: "24px 24px 0 0",
          borderTop: "1px solid var(--border)",
          zIndex: 20,
          boxShadow: "var(--shadow-lg)",
          maxHeight: "64%",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ padding: "10px 0 4px", display: "flex", justifyContent: "center" }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: "var(--border-strong)" }} />
        </div>
        <div
          style={{
            padding: "4px 20px 8px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <h3 style={{ fontSize: 20 }}>Running now</h3>
          <Tag tone={onlineCount > 0 ? "live" : "neutral"} icon="dot">
            {onlineCount}
          </Tag>
        </div>
        <div style={{ overflow: "auto", padding: "0 20px", flex: 1 }}>
          {participantsQ.isLoading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: "22px 0" }}>
              <Spinner color="var(--accent)" />
            </div>
          ) : runners.length === 0 ? (
            <Empty
              icon="signal"
              title="No one running right now"
              sub={
                participantsQ.data?.enabled === false
                  ? "Live tracking isn't available yet — be the first to start a run on this route."
                  : "Be the first to start a run on this route."
              }
            />
          ) : (
            runners.map((rn, i) => {
              const name = rn.displayName ?? "Runner";
              const elapsedS = msStringToSeconds((rn as { elapsedMs?: string }).elapsedMs);
              const distM = asNum((rn as { distanceM?: number }).distanceM);
              const pace = paceSPerKm(elapsedS, distM);
              return (
                <Row
                  key={rn.userId ?? i}
                  gap={12}
                  pad="11px 0"
                  style={{
                    borderBottom: "1px solid var(--border)",
                    opacity: rn.online ? 1 : 0.55,
                  }}
                >
                  <div style={{ position: "relative" }}>
                    <Avatar name={name} src={rn.photoUrl ?? undefined} size={42} />
                    <span
                      style={{
                        position: "absolute",
                        bottom: 0,
                        right: 0,
                        width: 12,
                        height: 12,
                        borderRadius: "50%",
                        background: rn.online ? "var(--live)" : "var(--text-4)",
                        border: "2px solid var(--surface)",
                      }}
                    />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14.5 }}>
                      {name}
                      {!rn.online && (
                        <span style={{ color: "var(--text-3)", fontWeight: 500 }}> · paused</span>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
                      <Metric v={fmtKm(distM / 1000, units)} u={distUnit(units)} />
                      <Metric v={elapsedS ? fmtTime(elapsedS) : "--"} u="time" />
                      <Metric
                        v={pace ? fmtPace(units === "imperial" ? pace / 0.621371 : pace) : "--"}
                        u={"/" + distUnit(units)}
                      />
                    </div>
                  </div>
                </Row>
              );
            })
          )}
          <div style={{ padding: "14px 0 18px", display: "flex", gap: 10 }}>
            <Btn full variant="secondary" icon="target" onClick={() => {}}>
              Fit all
            </Btn>
            <Btn full icon="play" onClick={() => nav("/record?routeId=" + route.id)}>
              Run this route
            </Btn>
          </div>
        </div>
      </div>
    </div>
  );
}
