/**
 * RTDB live writer (CP6, plan §5.5 / §7.6).
 *
 * Owns the client's side of live multi-user tracking while recording on a ROUTE:
 *  - On start: write `presence/<routeId>/<uid>` ({state, startedAt, lastSeen,
 *    online}) and register `onDisconnect()` to flip `online=false` + remove the
 *    `connections/<uid>/<connId>` node (frees the connection slot cleanly).
 *  - On each throttled fix (~throttleMs, default 2 s): OVERWRITE the single
 *    position node `liveSessions/<routeId>/<uid>` ({lat,lng,ts,...}) — never any
 *    history — and bump `presence/<routeId>/<uid>/lastSeen`.
 *  - On pause/resume: update `presence/<routeId>/<uid>/state`.
 *  - On stop: delete the live node + set presence offline.
 *
 * The CLIENT never writes `routeMembers/*` (backend-only, §10). The whole thing
 * is GATED on `isFirebaseConfigured()` AND a `routeId` — free runs (no route)
 * skip live entirely. Paths come from `POST /api/routes/:id/live/session`
 * (`useLiveSession`), which also ensures the backend `routeMembers` index +
 * returns `throttleMs`.
 */
import {
  ref,
  set,
  remove,
  update,
  serverTimestamp,
  onDisconnect,
  onValue,
  type Database,
} from "firebase/database";
import { isFirebaseConfigured, getFirebaseDb } from "@/lib/firebase/client";
import type { AuthUser, GeoPoint } from "@/adapters/types";

export interface LiveSessionPaths {
  /** `liveSessions/<routeId>/<uid>` — the caller's own write subtree. */
  selfPath: string;
  /** `presence/<routeId>` — the route's presence node. */
  presencePath: string;
  /** Min ms between position overwrites. */
  throttleMs: number;
}

interface ActiveLive {
  db: Database;
  uid: string;
  presenceRef: string; // presence/<routeId>/<uid>
  selfRef: string; // liveSessions/<routeId>/<uid>
  connRef: string | null; // connections/<uid>/<connId>
  connWatch: (() => void) | null;
  seq: number;
  throttleMs: number;
  /** Last position published — re-sent by the heartbeat so standing/slow runners stay visible. */
  lastPos: GeoPoint | null;
  /** Heartbeat timer re-publishing lastPos (keeps presence fresh + the runner "online"). */
  hb: ReturnType<typeof setInterval> | null;
}

/** Overwrite the live-position node with `p` and bump presence lastSeen. */
function publish(a: ActiveLive, p: GeoPoint): void {
  a.seq += 1;
  void set(ref(a.db, a.selfRef), {
    lat: p.lat,
    lng: p.lng,
    ts: p.timestamp,
    seq: a.seq,
    ...(p.altitude != null ? { ele: p.altitude } : {}),
    ...(p.speed != null ? { speed: p.speed } : {}),
  });
  void update(ref(a.db, a.presenceRef), { lastSeen: serverTimestamp() });
}

let active: ActiveLive | null = null;
let connId = 0;

/** Derive presence/<routeId>/<uid> from the session's presencePath + uid. */
function presenceSelfPath(presencePath: string, uid: string): string {
  return `${presencePath.replace(/\/$/, "")}/${uid}`;
}

/**
 * Begin a live session: presence + onDisconnect cleanup. No-op (returns false)
 * when Firebase is not configured. Safe to call without a routeId — callers gate
 * on routeId before reaching here, but we double-check `selfPath`.
 */
export async function startLive(
  paths: LiveSessionPaths,
  user: AuthUser,
): Promise<boolean> {
  if (!isFirebaseConfigured() || !paths.selfPath) return false;
  await stopLive(); // ensure no stale session lingers

  const db = getFirebaseDb();
  const uid = user.uid;
  const presenceRef = presenceSelfPath(paths.presencePath, uid);
  const myConnId = `c${Date.now()}_${connId++}`;
  const connRef = `connections/${uid}/${myConnId}`;

  active = {
    db,
    uid,
    presenceRef,
    selfRef: paths.selfPath,
    connRef,
    connWatch: null,
    seq: 0,
    throttleMs: paths.throttleMs > 0 ? paths.throttleMs : 2000,
    lastPos: null,
    hb: null,
  };

  // Presence: I'm running now.
  await set(ref(db, presenceRef), {
    displayName: user.displayName ?? null,
    photoUrl: user.photoUrl ?? null,
    state: "running",
    startedAt: serverTimestamp(),
    lastSeen: serverTimestamp(),
    online: true,
  });

  // Per-connection liveness; onDisconnect frees the slot + flips presence offline.
  await set(ref(db, connRef), true);
  onDisconnect(ref(db, connRef)).remove();
  onDisconnect(ref(db, presenceRef)).update({ online: false, lastSeen: serverTimestamp() });
  onDisconnect(ref(db, paths.selfPath)).remove();

  // When RTDB reports we reconnected after a drop, re-arm presence.online.
  const a = active;
  a.connWatch = onValue(ref(db, ".info/connected"), (snap) => {
    if (snap.val() === true && active === a) {
      void update(ref(db, presenceRef), { online: true, lastSeen: serverTimestamp() });
    }
  });

  // Heartbeat: re-publish the latest known position every throttle. Without this
  // a runner who isn't moving (warming up, paused at a light) stops emitting
  // positions, disappears from other runners' maps, and goes stale/offline.
  a.hb = setInterval(() => {
    if (active === a && a.lastPos) publish(a, a.lastPos);
  }, a.throttleMs);

  return true;
}

/**
 * Overwrite the single live-position node + bump presence lastSeen, and remember
 * it as `lastPos` so the heartbeat keeps re-publishing while the runner is still.
 * The caller (recording store) applies the ~throttleMs throttle for fresh fixes;
 * the heartbeat handles the stationary case.
 */
export function writeLivePosition(p: GeoPoint): void {
  if (!active) return;
  active.lastPos = p;
  publish(active, p);
}

/** Reflect pause/resume in presence state. */
export function setLiveState(state: "running" | "paused"): void {
  if (!active) return;
  const { db, presenceRef } = active;
  void update(ref(db, presenceRef), { state, lastSeen: serverTimestamp() });
}

/** End the session: delete the live node, set presence offline, clear conn. */
export async function stopLive(): Promise<void> {
  const a = active;
  if (!a) return;
  active = null;
  const { db, selfRef, presenceRef, connRef } = a;
  if (a.hb) clearInterval(a.hb);
  a.connWatch?.();
  try {
    // Cancel the onDisconnect hooks since we're cleaning up explicitly.
    await onDisconnect(ref(db, selfRef)).cancel();
    await onDisconnect(ref(db, presenceRef)).cancel();
    if (connRef) await onDisconnect(ref(db, connRef)).cancel();
  } catch {
    /* best-effort — cleanup below is what matters */
  }
  await Promise.allSettled([
    remove(ref(db, selfRef)),
    update(ref(db, presenceRef), { online: false, lastSeen: serverTimestamp() }),
    connRef ? remove(ref(db, connRef)) : Promise.resolve(),
  ]);
}

/** True while a live session is active (used by tests / guards). */
export function isLiveActive(): boolean {
  return active !== null;
}
