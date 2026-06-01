/**
 * RecordSummaryPage — ported from design/project/screens-record.jsx
 * `SummaryScreen`.
 *
 * Real wiring: the just-finished run lives in the recording store (the store's
 * `stop()` already POSTed `/api/activities` and stashed `lastBestEfforts`). This
 * screen reads `activityId / points / stats / type / title / routeId /
 * lastBestEfforts` from the store — no mock ACTIVITIES. The map header draws the
 * recorded track (store points) via MapView; the headline stats / splits /
 * elevation come from `store.stats`; the "Nth on route" card is derived from the
 * first `bestEffort.rank` (Pending until segment matching returns a rank).
 *
 * Save: the activity is already persisted, so Save re-upserts only if the title
 * or type were edited (POST /api/activities is idempotent on the client id), then
 * navigates to `/activities/:id`. Discard deletes the activity + goes home.
 *
 * If the store is empty (e.g. a hard refresh landed here directly), we show an
 * empty state back to Home rather than fake data.
 */
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Btn, Card, Field, Row, Segmented, StatBlock, Tag, Icon } from "@/components/primitives";
import { Empty } from "@/components/chrome";
import { BaseSheet } from "@/components/sheets/BaseSheet";
import { MapView } from "@/components/map/MapView";
import { useRoute } from "@/lib/api/routes";
import { useCreateActivity, useDeleteActivity } from "@/lib/api/activities";
import { useRecordingStore, type ActivityType } from "@/lib/recording/store";
import { useUnits } from "@/lib/prefs/store";
import { fmtKm, distUnit } from "@/lib/format";
import { ElevationChart } from "@/components/pages/routes/_shared";
import {
  SplitsList,
  buildSplitRows,
  fmtTime,
  fmtPaceUnit,
  ordinal,
  paceSPerKm,
  asText,
  perUnit,
} from "./_shared";

export function RecordSummaryPage() {
  const nav = useNavigate();
  const units = useUnits();

  // The finished run still lives in the store after stop().
  const activityId = useRecordingStore((s) => s.activityId);
  const points = useRecordingStore((s) => s.points);
  const stats = useRecordingStore((s) => s.stats);
  const storeType = useRecordingStore((s) => s.type);
  const storeTitle = useRecordingStore((s) => s.title);
  const routeId = useRecordingStore((s) => s.routeId);
  const bestEfforts = useRecordingStore((s) => s.lastBestEfforts);
  const startedAt = useRecordingStore((s) => s.startedAt);
  const reset = useRecordingStore((s) => s.reset);

  const routeQ = useRoute(routeId ?? undefined);
  const route = routeQ.data;

  const createActivity = useCreateActivity();
  const deleteActivity = useDeleteActivity();

  const defaultTitle =
    storeTitle || (new Date().getHours() < 12 ? "Morning Run" : "Evening Run");
  const [title, setTitle] = useState(defaultTitle);
  const [type, setType] = useState<ActivityType>(storeType);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trackCoords = useMemo(
    () => points.map((p) => [p.lng, p.lat] as [number, number]),
    [points],
  );
  const start = trackCoords[0];
  const finish = trackCoords[trackCoords.length - 1];

  const sec = Math.floor(stats.durationMs / 1000);
  const distKm = stats.distanceM / 1000;
  const pace = paceSPerKm(sec, stats.distanceM);

  const splitRows = useMemo(
    () => buildSplitRows(stats.splits, stats.distanceM, sec, units),
    [stats.splits, stats.distanceM, sec, units],
  );

  // "Nth on route" card from the first matched best effort (Pending until a rank
  // comes back from segment matching).
  const topEffort = (bestEfforts ?? [])[0];
  const rank = topEffort?.rank ?? null;

  // No finished run in the store (direct navigation / refresh): bail gracefully.
  if (!activityId || points.length === 0) {
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
        <Empty
          icon="shoe"
          title="No run to review"
          sub="Start a recording from Home to see its summary here."
          action="Back to Home"
          onAction={() => nav("/", { replace: true })}
        />
      </div>
    );
  }

  async function handleSave() {
    setError(null);
    // Persist title/type edits via the idempotent upsert (same client id).
    const edited = title !== storeTitle || type !== storeType;
    try {
      if (edited && activityId) {
        await createActivity.mutateAsync({
          body: {
            id: activityId,
            title: title || defaultTitle,
            type,
            routeId: routeId ?? null,
            startedAt: startedAt ?? Date.now(),
            endedAt: (startedAt ?? Date.now()) + stats.durationMs,
            durationMs: stats.durationMs,
            distanceMeters: stats.distanceM,
            elevation: { gainMeters: 0 },
            points: points.map((p) => ({
              lat: p.lat,
              lng: p.lng,
              ts: p.timestamp,
              ...(p.altitude != null ? { ele: p.altitude } : {}),
              ...(p.accuracy != null ? { accuracy: p.accuracy } : {}),
            })),
          },
        });
      }
      const id = activityId;
      reset();
      nav("/activities/" + id, { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save your edits. Try again.");
    }
  }

  async function handleDiscard() {
    setError(null);
    try {
      if (activityId) {
        await deleteActivity.mutateAsync({ params: { path: { id: activityId } } });
      }
    } catch {
      // Best-effort: even if the delete fails, drop the local session and leave.
    } finally {
      reset();
      nav("/", { replace: true });
    }
  }

  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column" }}>
      <div style={{ position: "relative", height: 220, flexShrink: 0 }}>
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
            background: "linear-gradient(180deg, transparent 50%, var(--bg) 100%)",
          }}
        />
        <div style={{ position: "absolute", top: 10, left: 14, zIndex: 6 }}>
          <Tag tone="live" icon="checkCircle">
            Run complete
          </Tag>
        </div>
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: "0 20px 110px", marginTop: -6 }}>
        {/* editable title */}
        <Field value={title} onChange={setTitle} icon="edit" />
        <Segmented
          style={{ marginTop: 12 }}
          options={["RUN", "JOG", "WALK"]}
          value={type}
          onChange={(v) => setType(v as ActivityType)}
        />

        {/* headline stats */}
        <Card pad={18} style={{ marginTop: 16 }}>
          <Row style={{ justifyContent: "space-around" }}>
            <StatBlock value={fmtKm(distKm, units)} unit={distUnit(units)} label="Distance" size="sm" />
            <StatBlock value={fmtTime(sec)} label="Time" size="sm" />
            <StatBlock value={fmtPaceUnit(pace, units)} unit={perUnit(units)} label="Avg pace" size="sm" accent />
          </Row>
        </Card>

        {/* leaderboard result */}
        {route && (
          <Card pad={14} style={{ marginTop: 14, background: "var(--accent-soft)", borderColor: "var(--accent)" }}>
            <Row gap={12}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: "var(--accent)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Icon name="trophy" size={24} color="#fff" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>
                  {rank ? `${ordinal(rank)} on ${asText(route.name)}` : asText(route.name)}
                </div>
                <div style={{ fontSize: 12.5, color: "var(--text-2)" }}>
                  {rank ? "Saved to the route leaderboard" : "Saves your effort to the leaderboard"}
                </div>
              </div>
              <Tag tone="accent">{rank ? "Ranked" : "Pending"}</Tag>
            </Row>
          </Card>
        )}

        {error && (
          <div
            style={{
              marginTop: 14,
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
        )}

        {/* splits */}
        <div style={{ marginTop: 20 }}>
          <div className="eyebrow" style={{ marginBottom: 10 }}>
            Splits · per {distUnit(units)}
          </div>
          <SplitsList splits={splitRows} />
        </div>

        <div style={{ marginTop: 20 }}>
          <div className="eyebrow" style={{ marginBottom: 8 }}>
            Elevation
          </div>
          <Card pad={14}>
            <ElevationChart profile={route?.elevationProfile} h={64} id="eg-summary" />
          </Card>
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          padding: "14px 20px 18px",
          background: "linear-gradient(180deg, transparent, var(--bg) 30%)",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        <Btn full size="lg" icon="check" loading={createActivity.isPending} onClick={handleSave}>
          Save activity
        </Btn>
        <Btn full variant="quiet" onClick={() => setDiscardOpen(true)}>
          Discard
        </Btn>
      </div>

      <BaseSheet
        open={discardOpen}
        onOpenChange={(o) => !deleteActivity.isPending && setDiscardOpen(o)}
        title="Discard this run?"
      >
        <p style={{ color: "var(--text-2)", fontSize: 14, lineHeight: 1.5, marginTop: -4 }}>
          This can't be undone. Your {fmtKm(distKm, units)} {distUnit(units)} run won't be kept.
        </p>
        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
          <Btn
            full
            size="lg"
            variant="danger"
            icon="trash"
            loading={deleteActivity.isPending}
            onClick={handleDiscard}
          >
            Discard run
          </Btn>
          <Btn full variant="quiet" onClick={() => setDiscardOpen(false)}>
            Keep it
          </Btn>
        </div>
      </BaseSheet>
    </div>
  );
}
