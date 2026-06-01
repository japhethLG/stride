/**
 * ActivityDetailPage — ported from design/project/screens-record.jsx
 * `ActivityDetailScreen`.
 *
 * Real wiring: `useActivity(id)` drives the MapLibre `MapView` header (recorded
 * `track` + start/finish markers), the 2x2 stats grid (distance / time / pace /
 * elevation — BigInt `durationMs` parsed for math), the type/PR tags, and the
 * leaderboard-placement card (from the activity's `bestEfforts` -> the route's
 * leaderboard). The linked-route card uses `useRoute(routeId)` for a small
 * MapView thumbnail and links to the route. Delete uses `useDeleteActivity`.
 *
 * The backend's activity track is a geometry-only LineString (no per-point
 * timestamps), so per-split paces aren't derivable here — the splits section
 * renders a graceful empty state rather than fake numbers (TODO: a future
 * activity-splits endpoint would fill it).
 */
import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Btn, Card, IconBtn, Row, Spinner, Tag, Icon } from "@/components/primitives";
import { Empty, TYPE_TONE } from "@/components/chrome";
import { BaseSheet } from "@/components/sheets/BaseSheet";
import { MapView } from "@/components/map/MapView";
import { useActivity, useDeleteActivity } from "@/lib/api/activities";
import { useRoute } from "@/lib/api/routes";
import { useUnits } from "@/lib/prefs/store";
import { fmtKm, distUnit } from "@/lib/format";
import { ElevationChart } from "@/components/pages/routes/_shared";
import type { ActivityType } from "@/components/chrome";
import {
  fmtTime,
  fmtPaceUnit,
  ordinal,
  lineCoords,
  asNum,
  asText,
  msStringToSeconds,
  paceSPerKm,
  longDateTime,
} from "@/components/pages/record/_shared";

export function ActivityDetailPage() {
  const nav = useNavigate();
  const { id } = useParams<{ id: string }>();
  const units = useUnits();

  const activityQ = useActivity(id ?? "");
  const a = activityQ.data;
  const routeId = asText(a?.routeId) || undefined;
  const routeQ = useRoute(routeId);
  const route = routeQ.data;

  const deleteActivity = useDeleteActivity();
  const [delOpen, setDelOpen] = useState(false);
  const [delErr, setDelErr] = useState<string | null>(null);

  const trackCoords = useMemo(() => lineCoords(a?.track), [a?.track]);
  const routeCoords = useMemo(() => lineCoords(route?.geometry), [route?.geometry]);
  const start = trackCoords[0];
  const finish = trackCoords[trackCoords.length - 1];

  const sec = msStringToSeconds(a?.durationMs);
  const distM = a?.distanceM ?? 0;
  const distKm = distM / 1000;
  const elevM = Math.round(asNum(a?.elevationGainM));
  const avgPaceSPerKm =
    typeof a?.avgPaceSPerKm === "number" ? a.avgPaceSPerKm : paceSPerKm(sec, distM);

  // Leaderboard placement from the activity's matched best efforts.
  const topEffort = (a?.bestEfforts ?? [])[0];
  const rank = topEffort?.rank ?? null;
  const isPr = rank === 1;

  if (activityQ.isLoading) {
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
  if (activityQ.isError || !a) {
    return (
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "10px 14px" }}>
          <IconBtn name="chevL" onClick={() => nav(-1)} size={40} iconSize={22} />
        </div>
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Empty
            icon="warning"
            title="Couldn't load activity"
            sub={activityQ.error?.message ?? "This activity may have been removed."}
            action="Retry"
            onAction={() => activityQ.refetch()}
          />
        </div>
      </div>
    );
  }

  async function handleDelete() {
    setDelErr(null);
    try {
      await deleteActivity.mutateAsync({ params: { path: { id: id ?? "" } } });
      nav("/", { replace: true });
    } catch (e) {
      setDelErr(e instanceof Error ? e.message : "Couldn't delete this activity. Try again.");
    }
  }

  const statGrid: [string, string, string, "ruler" | "clock" | "gauge" | "mountain"][] = [
    [fmtKm(distKm, units), distUnit(units), "Distance", "ruler"],
    [fmtTime(sec), "", "Time", "clock"],
    [fmtPaceUnit(avgPaceSPerKm, units), "/" + distUnit(units), "Avg pace", "gauge"],
    ["+" + elevM, "m", "Elevation", "mountain"],
  ];

  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column" }}>
      <div style={{ position: "relative", height: 280, flexShrink: 0 }}>
        <MapView
          interactive={false}
          trackD={trackCoords}
          markers={[
            ...(start ? [{ lng: start[0], lat: start[1], type: "start" as const }] : []),
            ...(finish ? [{ lng: finish[0], lat: finish[1], type: "finish" as const }] : []),
          ]}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(180deg, rgba(9,10,13,.5) 0%, transparent 25%, transparent 65%, var(--bg) 100%)",
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
            zIndex: 6,
          }}
        >
          <IconBtn
            name="chevL"
            onClick={() => nav(-1)}
            style={{ background: "rgba(0,0,0,.45)", backdropFilter: "blur(8px)", color: "#fff" }}
          />
          <div style={{ display: "flex", gap: 8 }}>
            <IconBtn
              name="share"
              onClick={() => {
                if (typeof navigator !== "undefined" && navigator.clipboard) {
                  void navigator.clipboard.writeText(window.location.href);
                }
              }}
              style={{ background: "rgba(0,0,0,.45)", backdropFilter: "blur(8px)", color: "#fff" }}
            />
            <IconBtn
              name="trash"
              onClick={() => setDelOpen(true)}
              style={{ background: "rgba(0,0,0,.45)", backdropFilter: "blur(8px)", color: "#fff" }}
            />
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: "0 20px 24px", marginTop: -8 }}>
        <Row gap={8} style={{ marginBottom: 6 }}>
          <Tag tone={TYPE_TONE[a.type as ActivityType]}>{a.type}</Tag>
          {isPr && (
            <Tag tone="accent" icon="trophy">
              PR
            </Tag>
          )}
        </Row>
        <h1 style={{ fontSize: 32, lineHeight: 1, fontWeight: 700 }}>{asText(a.title)}</h1>
        <div style={{ color: "var(--text-3)", fontSize: 13.5, marginTop: 6 }}>
          {longDateTime(a.startedAt)}
        </div>

        {/* stats grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 18 }}>
          {statGrid.map((s) => (
            <Card key={s[2]} pad={14}>
              <Row gap={6} style={{ color: "var(--text-3)", marginBottom: 6 }}>
                <Icon name={s[3]} size={15} />
                <span className="eyebrow" style={{ fontSize: 10 }}>
                  {s[2]}
                </span>
              </Row>
              <div style={{ display: "flex", alignItems: "baseline", gap: 3 }}>
                <span className="stat-num" style={{ fontSize: 30 }}>
                  {s[0]}
                </span>
                <span style={{ fontSize: 12, color: "var(--text-3)", fontWeight: 700 }}>{s[1]}</span>
              </div>
            </Card>
          ))}
        </div>

        {/* leaderboard placement */}
        {route && rank && (
          <Card
            pad={14}
            interactive
            onClick={() => nav("/routes/" + route.id + "/leaderboard")}
            style={{ marginTop: 14 }}
          >
            <Row gap={12}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: isPr ? "var(--accent)" : "var(--surface-2)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Icon name="trophy" size={22} color={isPr ? "#fff" : "var(--text-2)"} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>
                  {ordinal(rank)} on {asText(route.name)}
                </div>
                <div style={{ fontSize: 12.5, color: "var(--text-2)" }}>
                  {isPr ? "New personal best" : "View segment leaderboard"}
                </div>
              </div>
              <Icon name="chevR" size={20} color="var(--text-4)" />
            </Row>
          </Card>
        )}

        {/* splits */}
        <div style={{ marginTop: 20 }}>
          <div className="eyebrow" style={{ marginBottom: 10 }}>
            Splits · per {distUnit(units)}
          </div>
          <Card pad={14}>
            <div style={{ color: "var(--text-3)", fontSize: 13, textAlign: "center" }}>
              Per-split paces aren't stored for saved activities yet.
            </div>
          </Card>
        </div>

        {/* elevation */}
        <div style={{ marginTop: 20 }}>
          <div className="eyebrow" style={{ marginBottom: 8 }}>
            Elevation profile
          </div>
          <Card pad={14}>
            <ElevationChart profile={route?.elevationProfile} h={70} id={"eg-" + a.id} />
          </Card>
        </div>

        {/* linked route */}
        {route && (
          <Card
            pad={13}
            interactive
            onClick={() => nav("/routes/" + route.id)}
            style={{ marginTop: 14 }}
          >
            <Row gap={12}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 14,
                  overflow: "hidden",
                  flexShrink: 0,
                  border: "1px solid var(--border)",
                  position: "relative",
                }}
              >
                <MapView interactive={false} glow={false} fitPadding={6} routeD={routeCoords} />
              </div>
              <div style={{ flex: 1 }}>
                <div className="eyebrow" style={{ fontSize: 9.5 }}>
                  On route
                </div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{asText(route.name)}</div>
              </div>
              <Icon name="chevR" size={20} color="var(--text-4)" />
            </Row>
          </Card>
        )}
      </div>

      <BaseSheet
        open={delOpen}
        onOpenChange={(o) => !deleteActivity.isPending && setDelOpen(o)}
        title="Delete activity?"
      >
        <p style={{ color: "var(--text-2)", fontSize: 14, lineHeight: 1.5, marginTop: -4 }}>
          This permanently deletes "{asText(a.title)}" and its GPS track. This can't be undone.
        </p>
        {delErr && (
          <div style={{ color: "var(--danger)", fontSize: 12.5, marginTop: 10, fontWeight: 600 }}>
            {delErr}
          </div>
        )}
        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
          <Btn
            full
            size="lg"
            variant="danger"
            icon="trash"
            loading={deleteActivity.isPending}
            onClick={handleDelete}
          >
            Delete
          </Btn>
          <Btn full variant="quiet" onClick={() => setDelOpen(false)}>
            Cancel
          </Btn>
        </div>
      </BaseSheet>
    </div>
  );
}
