/**
 * Active-run recording store (CLAUDE.md §12, plan §7.4).
 *
 * Owns the in-flight run: status, the live track, derived stats (distance, pace,
 * per-km splits), and the client-generated `activityId`. Wires to the
 * `LocationTracker` + `PointUploader` ADAPTERS (never `navigator.geolocation` /
 * `fetch` directly).
 *
 * Lifecycle:
 *  - `start()`  — generate a UUID activityId, acquire the wake lock + start GPS via
 *    the LocationTracker adapter, subscribe to fixes → `addPoint`.
 *  - `addPoint()` — drop low-accuracy fixes, append to `points` + the durable
 *    PointUploader IndexedDB buffer, recompute distance / duration / pace / splits,
 *    and (throttled, 2 s) emit a live current-position write — a GUARDED no-op
 *    until Firebase RTDB lands (TODO(CP6); we only log today).
 *  - `pause()` / `resume()` — bridge to the tracker; paused time is excluded from
 *    `durationMs`.
 *  - `stop()` — assemble the buffered track and POST `/api/activities` (upsert)
 *    through the injected `useCreateActivity` submitter, returning `bestEfforts`,
 *    then clear the IndexedDB buffer for the activity.
 *
 * Crash recovery (§7.4): `pendingCount()` reports buffered batches that survived a
 * reload/crash; `recover()` reloads the most-recent unfinished activity's points
 * back into the store so the Record screen can offer "resume / discard / save".
 *
 * The store is React-free (created outside the tree), so the network POST is
 * provided by a bridge hook (`useRecordingSubmit` in `submit.ts`) that registers
 * the `useCreateActivity` mutation via `setSubmitActivity` — screens never wire the
 * apiClient here.
 */
import { create } from "zustand";
import { v4 as uuidv4 } from "uuid";
import { getAdapters } from "@/adapters";
import type { GeoPoint } from "@/adapters/types";
import { getAllBatches } from "@/lib/db/pointBuffer";
import type {
  ActivityPointRequestDto,
  ActivityResponseDto,
  BestEffortResponseDto,
} from "@/lib/api/types";

export type RecordingStatus =
  | "idle"
  | "acquiring"
  | "recording"
  | "paused"
  | "saving";

export type ActivityType = "RUN" | "JOG" | "WALK";

export interface Split {
  /** 1-based km index */
  km: number;
  /** seconds elapsed within this km */
  durationS: number;
  /** seconds per km for this split */
  paceSPerKm: number;
}

export interface RecordingStats {
  /** meters */
  distanceM: number;
  /** ms of active (non-paused) time */
  durationMs: number;
  /** seconds per km (rolling average), or null until enough distance accrues */
  paceSPerKm: number | null;
  /** completed per-km splits */
  splits: Split[];
}

/**
 * Submitter the bridge hook injects — the `useCreateActivity` mutation's
 * `mutateAsync`, but typed to the request/response shapes the store needs.
 */
export type SubmitActivity = (body: {
  id: string;
  title: string;
  type: ActivityType;
  routeId?: string | null;
  startedAt: number;
  endedAt: number;
  durationMs: number;
  distanceMeters?: number;
  elevation: { gainMeters: number };
  points: ActivityPointRequestDto[];
}) => Promise<ActivityResponseDto>;

interface RecordingState {
  status: RecordingStatus;
  activityId: string | null;
  routeId: string | null;
  /** the activity title to save (Record screen edits before/at Stop) */
  title: string;
  type: ActivityType;
  points: GeoPoint[];
  stats: RecordingStats;
  /** wall-clock start (epoch ms) */
  startedAt: number | null;
  /** accumulated active time at the last pause (ms) — duration baseline */
  accumulatedMs: number;
  /** epoch ms of the last resume/start; null while paused */
  segmentStartedAt: number | null;
  /** result of the last successful Stop */
  lastBestEfforts: BestEffortResponseDto[] | null;

  setTitle(title: string): void;
  setType(type: ActivityType): void;
  start(opts?: { routeId?: string | null; title?: string; type?: ActivityType }): Promise<void>;
  addPoint(p: GeoPoint): void;
  pause(): void;
  resume(): void;
  stop(): Promise<ActivityResponseDto | null>;
  reset(): void;

  /** crash-recovery: number of buffered batches still on disk */
  pendingCount(): Promise<number>;
  /** crash-recovery: reload the most-recent unfinished activity into the store */
  recover(): Promise<boolean>;
}

const EMPTY_STATS: RecordingStats = {
  distanceM: 0,
  durationMs: 0,
  paceSPerKm: null,
  splits: [],
};

/** Drop fixes worse than this horizontal accuracy (meters). */
const MAX_ACCURACY_M = 30;
/** Min interval between live current-position writes (ms). */
const LIVE_THROTTLE_MS = 2000;

function haversineM(a: GeoPoint, b: GeoPoint): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Adapter GeoPoint → wire ActivityPointRequestDto ({lat,lng,ts,ele?,accuracy?}). */
function toWirePoint(p: GeoPoint): ActivityPointRequestDto {
  return {
    lat: p.lat,
    lng: p.lng,
    ts: p.timestamp,
    ...(p.altitude != null ? { ele: p.altitude } : {}),
    ...(p.accuracy != null ? { accuracy: p.accuracy } : {}),
  };
}

/** Recompute completed per-km splits from the full point list. */
function computeSplits(points: GeoPoint[]): Split[] {
  if (points.length < 2) return [];
  const splits: Split[] = [];
  let cumDist = 0;
  let kmIndex = 1;
  let kmStartTs = points[0].timestamp;
  for (let i = 1; i < points.length; i++) {
    cumDist += haversineM(points[i - 1], points[i]);
    while (cumDist >= kmIndex * 1000) {
      const durationS = (points[i].timestamp - kmStartTs) / 1000;
      splits.push({ km: kmIndex, durationS, paceSPerKm: durationS });
      kmStartTs = points[i].timestamp;
      kmIndex += 1;
    }
  }
  return splits;
}

/** ms of active (non-paused) recording time for the current state. */
function activeDurationMs(s: {
  accumulatedMs: number;
  segmentStartedAt: number | null;
}): number {
  return s.accumulatedMs + (s.segmentStartedAt ? Date.now() - s.segmentStartedAt : 0);
}

// --- live-write injection (CP6) -------------------------------------------
let lastLiveWriteAt = 0;
let liveThrottleMs = LIVE_THROTTLE_MS;

/**
 * The RTDB live session controller, injected by the `useRecordingSubmit` bridge
 * (React-side). It joins the backend live session (POST .../live/session), then
 * drives the RTDB writer (presence + throttled position overwrite). A GUARDED
 * no-op when Firebase is not configured or the run has no route (free run) — the
 * bridge simply never starts a session, so `write()` is a no-op.
 */
export interface LiveController {
  /** Join + begin presence; returns the throttle (ms) or null when not live. */
  start(routeId: string, activityId: string): Promise<number | null>;
  write(p: GeoPoint): void;
  setState(state: "running" | "paused"): void;
  stop(): void;
}

let liveController: LiveController | null = null;
export function setLiveController(fn: LiveController | null): void {
  liveController = fn;
}

/**
 * Legacy single-fn live-writer hook (kept for back-compat / tests). Prefer
 * `setLiveController`. When set, it receives every throttled fix.
 */
let liveWriter: ((routeId: string, p: GeoPoint) => void) | null = null;
export function setLiveWriter(fn: ((routeId: string, p: GeoPoint) => void) | null): void {
  liveWriter = fn;
}

function maybeLiveWrite(routeId: string | null, p: GeoPoint): void {
  if (!routeId) return;
  const now = Date.now();
  if (now - lastLiveWriteAt < liveThrottleMs) return;
  lastLiveWriteAt = now;
  if (liveController) liveController.write(p);
  if (liveWriter) liveWriter(routeId, p);
}

// --- elapsed-time ticker ---------------------------------------------------
// The timer must advance every second even when no GPS fix arrives (a stationary
// runner still sees the clock move). Stats' durationMs is otherwise only
// recomputed inside addPoint, so without this the timer freezes between fixes.
let tickTimer: ReturnType<typeof setInterval> | null = null;
function stopDurationTick(): void {
  if (tickTimer) {
    clearInterval(tickTimer);
    tickTimer = null;
  }
}
function startDurationTick(): void {
  stopDurationTick();
  tickTimer = setInterval(() => {
    const s = useRecordingStore.getState();
    if (s.status !== "recording") {
      stopDurationTick();
      return;
    }
    const durationMs = activeDurationMs(s);
    const paceSPerKm =
      s.stats.distanceM > 0 ? durationMs / 1000 / (s.stats.distanceM / 1000) : null;
    useRecordingStore.setState({ stats: { ...s.stats, durationMs, paceSPerKm } });
  }, 1000);
}

// --- network-submit injection (set by the useRecordingSubmit bridge) -------
let submitActivity: SubmitActivity | null = null;
export function setSubmitActivity(fn: SubmitActivity | null): void {
  submitActivity = fn;
}

let unsubscribePosition: (() => void) | null = null;

export const useRecordingStore = create<RecordingState>((set, get) => ({
  status: "idle",
  activityId: null,
  routeId: null,
  title: "",
  type: "RUN",
  points: [],
  stats: EMPTY_STATS,
  startedAt: null,
  accumulatedMs: 0,
  segmentStartedAt: null,
  lastBestEfforts: null,

  setTitle: (title) => set({ title }),
  setType: (type) => set({ type }),

  async start(opts) {
    const { location } = getAdapters();
    const activityId = uuidv4();
    const now = Date.now();
    lastLiveWriteAt = 0;
    liveThrottleMs = LIVE_THROTTLE_MS;
    set({
      status: "acquiring",
      activityId,
      routeId: opts?.routeId ?? null,
      title: opts?.title ?? "",
      type: opts?.type ?? "RUN",
      points: [],
      stats: EMPTY_STATS,
      startedAt: now,
      accumulatedMs: 0,
      segmentStartedAt: now,
      lastBestEfforts: null,
    });

    // Buffer each filtered fix to IndexedDB and update live state.
    unsubscribePosition?.();
    unsubscribePosition = location.onPosition((p) => {
      get().addPoint(p);
    });

    // Begin the RTDB live session CONCURRENTLY with GPS acquisition (route runs
    // only; free runs skip it). Starting it here — rather than after the first
    // fix arrives — is what lets positions publish from the very first fix
    // instead of being dropped while the session is still coming up. Once it's
    // live, seed it with the latest fix in case one already arrived during
    // acquisition. Best-effort; never blocks recording.
    const routeId = opts?.routeId ?? null;
    if (routeId && liveController) {
      void liveController
        .start(routeId, activityId)
        .then(async (throttle) => {
          if (throttle && throttle > 0) liveThrottleMs = throttle;
          // Seed an initial live position so the runner appears immediately (and
          // the heartbeat has something to re-publish). Prefer the latest recorded
          // fix; if none yet (stationary / watchPosition hasn't emitted), fall back
          // to a one-shot getCurrentPosition, which returns even when standing still.
          let seed: GeoPoint | null = get().points[get().points.length - 1] ?? null;
          if (!seed) seed = await location.getCurrentPosition();
          if (seed && get().routeId === routeId) liveController?.write(seed);
        })
        .catch(() => {
          /* live is best-effort — never block recording on it */
        });
    }

    // Each filtered fix is buffered to IndexedDB inside `addPoint`.
    await location.start({ keepScreenOn: true, maxAccuracyM: MAX_ACCURACY_M });
    set({ status: "recording" });
    startDurationTick();
  },

  addPoint(p) {
    // Drop low-accuracy fixes (the tracker also filters, but guard here too).
    if (p.accuracy != null && p.accuracy > MAX_ACCURACY_M) return;

    const state = get();
    if (state.status === "paused") return;

    const prev = state.points[state.points.length - 1];
    const points = [...state.points, p];
    const distanceM = state.stats.distanceM + (prev ? haversineM(prev, p) : 0);
    const durationMs = activeDurationMs(state);
    const paceSPerKm = distanceM > 0 ? durationMs / 1000 / (distanceM / 1000) : null;
    const splits = computeSplits(points);

    set({ points, stats: { distanceM, durationMs, paceSPerKm, splits } });

    // Durable buffer (crash-safe) — never lose an in-progress run.
    if (state.activityId) {
      void getAdapters().uploader.enqueue(state.activityId, [p]);
    }

    // Throttled live current-position write (guarded no-op until CP6).
    maybeLiveWrite(state.routeId, p);
  },

  pause() {
    const state = get();
    if (state.status !== "recording") return;
    getAdapters().location.pause();
    liveController?.setState("paused");
    stopDurationTick();
    set({
      status: "paused",
      accumulatedMs: activeDurationMs(state),
      segmentStartedAt: null,
    });
  },

  resume() {
    const state = get();
    if (state.status !== "paused") return;
    getAdapters().location.resume();
    liveController?.setState("running");
    set({ status: "recording", segmentStartedAt: Date.now() });
    startDurationTick();
  },

  async stop() {
    const { location, uploader } = getAdapters();
    const state = get();
    const { activityId, points, routeId, title, type } = state;
    set({ status: "saving" });

    stopDurationTick();
    unsubscribePosition?.();
    unsubscribePosition = null;
    await location.stop();
    // End the live session: delete the live node + set presence offline (CP6).
    liveController?.stop();

    const durationMs = activeDurationMs(state);
    const startedAt = state.startedAt ?? Date.now();
    const endedAt = startedAt + durationMs;

    // Nothing recorded / no submitter wired — bail out cleanly.
    if (!activityId || points.length === 0 || !submitActivity) {
      set({ status: "idle" });
      return null;
    }

    try {
      const result = await submitActivity({
        id: activityId,
        title: title || defaultTitle(type),
        type,
        routeId: routeId ?? null,
        startedAt,
        endedAt,
        durationMs,
        distanceMeters: state.stats.distanceM,
        elevation: { gainMeters: elevationGainM(points) },
        points: points.map(toWirePoint),
      });
      // Server has the run — clear the durable buffer (the RTDB live node was
      // already removed by liveController.stop() above).
      await uploader.clear(activityId);
      set({
        status: "idle",
        lastBestEfforts: result.bestEfforts ?? null,
      });
      return result;
    } catch (err) {
      // Keep the buffer + state intact so the run is never lost; let the screen
      // surface a retry. Return to a non-saving state.
      set({ status: "idle" });
      throw err;
    }
  },

  reset() {
    stopDurationTick();
    unsubscribePosition?.();
    unsubscribePosition = null;
    liveController?.stop();
    set({
      status: "idle",
      activityId: null,
      routeId: null,
      title: "",
      type: "RUN",
      points: [],
      stats: EMPTY_STATS,
      startedAt: null,
      accumulatedMs: 0,
      segmentStartedAt: null,
      lastBestEfforts: null,
    });
  },

  async pendingCount() {
    return getAdapters().uploader.pendingCount();
  },

  async recover() {
    const batches = await getAllBatches();
    if (batches.length === 0) return false;

    // Group buffered batches by activity, pick the most-recent one, replay points.
    const byActivity = new Map<string, typeof batches>();
    for (const b of batches) {
      const list = byActivity.get(b.activityId) ?? [];
      list.push(b);
      byActivity.set(b.activityId, list);
    }
    let bestId: string | null = null;
    let bestTs = -Infinity;
    for (const [id, list] of byActivity) {
      const maxTs = Math.max(...list.map((b) => b.createdAt));
      if (maxTs > bestTs) {
        bestTs = maxTs;
        bestId = id;
      }
    }
    if (!bestId) return false;

    const list = (byActivity.get(bestId) ?? []).sort((a, b) => a.seq - b.seq);
    const points: GeoPoint[] = list.flatMap((b) => b.points);
    if (points.length === 0) return false;

    let distanceM = 0;
    for (let i = 1; i < points.length; i++) {
      distanceM += haversineM(points[i - 1], points[i]);
    }
    const startedAt = points[0].timestamp;
    const durationMs = points[points.length - 1].timestamp - startedAt;
    const paceSPerKm = distanceM > 0 ? durationMs / 1000 / (distanceM / 1000) : null;

    set({
      status: "paused",
      activityId: bestId,
      points,
      startedAt,
      accumulatedMs: durationMs,
      segmentStartedAt: null,
      stats: { distanceM, durationMs, paceSPerKm, splits: computeSplits(points) },
    });
    return true;
  },
}));

function defaultTitle(type: ActivityType): string {
  const label = type === "RUN" ? "Run" : type === "JOG" ? "Jog" : "Walk";
  const h = new Date().getHours();
  const part = h < 12 ? "Morning" : h < 18 ? "Afternoon" : "Evening";
  return `${part} ${label}`;
}

/** Cumulative positive elevation gain (meters) from point altitudes. */
function elevationGainM(points: GeoPoint[]): number {
  let gain = 0;
  let prevEle: number | null = null;
  for (const p of points) {
    if (p.altitude == null) continue;
    if (prevEle != null && p.altitude > prevEle) gain += p.altitude - prevEle;
    prevEle = p.altitude;
  }
  return gain;
}
